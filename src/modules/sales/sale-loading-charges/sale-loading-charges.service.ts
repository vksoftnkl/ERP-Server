import { Injectable } from '@nestjs/common';
import { Prisma, SaleLoadingCharge } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleLoadingChargeDto } from './dto/save-sale-loading-charges.dto';
import {
  SaleLoadingChargeErrorDetail,
  SaleLoadingChargeErrorResponse,
  SaleLoadingChargePayload,
} from './types/sale-loading-charges-api.types';
import {
  DEFAULT_ACTOR,
  applyPresentFields,
  isForeignKeyConstraintError,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const SALE_LOADING_CHARGE_RELATIONS = {
  company: { select: { compName: true } },
  branch: { select: { brName: true } },
} satisfies Prisma.SaleLoadingChargeInclude;

type SaleLoadingChargeWithRelations = Prisma.SaleLoadingChargeGetPayload<{
  include: typeof SALE_LOADING_CHARGE_RELATIONS;
}>;

const SALE_LOADING_CHARGE_TABLE_NAME = 'sale loading charges';
const SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME = 'Sale Loading Charges';
const SALE_LOADING_CHARGE_OPTIONAL_FIELDS = [
  'ilcCompId',
  'ilcBranchId',
  'ilcFromWeight',
  'ilcToWeight',
  'ilcLoadChrg',
  'ilcUnloadChrg',
  'ilcIsActive',
];

@Injectable()
export class SaleLoadingChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(dto: SaveSaleLoadingChargeDto): Promise<SaleLoadingChargePayload> {
    if (dto.ilcId) {
      return this.updateSaleLoadingCharge(dto);
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.createSaleLoadingCharge(dto, userId);
  }

  async createSaleLoadingCharge(
    dto: SaveSaleLoadingChargeDto,
    userId: string,
  ): Promise<SaleLoadingChargePayload> {
    const actor = resolveActor(dto.ilcCreatedBy, userId);
    const now = new Date();
    const isDeleted = dto.ilcIsActive === false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const data: Prisma.SaleLoadingChargeUncheckedCreateInput = {
          ilcCompId: dto.ilcCompId ?? null,
          ilcBranchId: dto.ilcBranchId ?? null,
          ilcFromWeight: dto.ilcFromWeight ?? 0,
          ilcToWeight: dto.ilcToWeight ?? 0,
          ilcLoadChrg: dto.ilcLoadChrg ?? 0,
          ilcUnloadChrg: dto.ilcUnloadChrg ?? 0,
          ilcIsActive: !isDeleted,
          ilcIsDeleted: isDeleted,
          ilcCreatedOn: now,
          ilcCreatedBy: actor,
          ilcModifiedOn: now,
          ilcModifiedBy: actor,
        };

        const created = await tx.saleLoadingCharge.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SALE_LOADING_CHARGE_TABLE_NAME,
            screenName: SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ilcId,
            displayName: `ILC-${payload.ilcFromWeight}-${payload.ilcToWeight}`,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Sale loading charge created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  async getById(ilcId: string): Promise<SaleLoadingChargePayload> {
    const record = await this.prisma.saleLoadingCharge.findFirst({
      where: {
        ilcId,
        ilcIsDeleted: false,
      },
      include: SALE_LOADING_CHARGE_RELATIONS,
    });

    if (!record) {
      throwSalesNotFound<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse>(
        'Sale loading charge not found',
        'ilcId',
        `No active sale loading charge found with id ${ilcId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(ilcId: string): Promise<{ ilcId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleLoadingCharge.findFirst({
        where: {
          ilcId,
          ilcIsDeleted: false,
        },
      });

      if (!existing) {
        throwSalesNotFound<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse>(
          'Sale loading charge not found',
          'ilcId',
          `No active sale loading charge found with id ${ilcId}`,
        );
      }

      const modifiedOn = new Date();
      const result = await tx.saleLoadingCharge.updateMany({
        where: {
          ilcId,
          ilcIsDeleted: false,
        },
        data: {
          ilcIsDeleted: true,
          ilcIsActive: false,
          ilcModifiedOn: modifiedOn,
          ilcModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        throwSalesNotFound<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse>(
          'Sale loading charge not found',
          'ilcId',
          `No active sale loading charge found with id ${ilcId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ilcIsDeleted: true,
        ilcIsActive: false,
        ilcModifiedOn: modifiedOn,
        ilcModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SALE_LOADING_CHARGE_TABLE_NAME,
          screenName: SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ilcId,
          displayName: `ILC-${existing.ilcFromWeight}-${existing.ilcToWeight}`,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Sale loading charge soft deleted',
        },
        tx,
      );

      return {
        ilcId,
        deleted: true,
      };
    });
  }

  private async updateSaleLoadingCharge(
    dto: SaveSaleLoadingChargeDto,
  ): Promise<SaleLoadingChargePayload> {
    const ilcId = dto.ilcId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleLoadingCharge.findFirst({
          where: {
            ilcId,
            ilcIsDeleted: false,
          },
        });

        if (!existing) {
          throwSalesNotFound<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse>(
            'Sale loading charge not found',
            'ilcId',
            `No active sale loading charge found with id ${ilcId}`,
          );
        }

        const data: Prisma.SaleLoadingChargeUncheckedUpdateInput = {
          ilcModifiedOn: new Date(),
          ilcModifiedBy: resolveActor(
            dto.ilcModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };

        this.applyOptionalFields(data, dto);

        const updated = await tx.saleLoadingCharge.update({
          where: { ilcId },
          data,
        });

        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_LOADING_CHARGE_TABLE_NAME,
            screenName: SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ilcId,
            displayName: `ILC-${payload.ilcFromWeight}-${payload.ilcToWeight}`,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.ilcModifiedBy,
            notes: 'Sale loading charge updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse>(
      error,
      'Sale loading charge already exists',
      [
        {
          field: 'ilcFromWeight',
          message: 'Duplicate sale loading charge range is not allowed',
        },
      ],
    );
    if (isForeignKeyConstraintError(error)) {
      throwSalesBadRequest<SaleLoadingChargeErrorDetail, SaleLoadingChargeErrorResponse>(
        'Invalid relation reference',
        [
          {
            field: 'request',
            message: 'Referenced company or branch does not exist',
          },
        ],
      );
    }
  }

  private applyOptionalFields(
    data:
      | Prisma.SaleLoadingChargeUncheckedCreateInput
      | Prisma.SaleLoadingChargeUncheckedUpdateInput,
    dto: SaveSaleLoadingChargeDto,
  ): void {
    applyPresentFields(data, dto, SALE_LOADING_CHARGE_OPTIONAL_FIELDS);
  }

  private toPayload(
    record: SaleLoadingCharge | SaleLoadingChargeWithRelations,
  ): SaleLoadingChargePayload {
    return {
      ilcId: record.ilcId,
      ilcCompId: record.ilcCompId,
      ilcCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
      ilcBranchId: record.ilcBranchId,
      ilcBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
      ilcFromWeight: record.ilcFromWeight ? toNumber(record.ilcFromWeight) : null,
      ilcToWeight: record.ilcToWeight ? toNumber(record.ilcToWeight) : null,
      ilcLoadChrg: record.ilcLoadChrg ? toNumber(record.ilcLoadChrg) : null,
      ilcUnloadChrg: record.ilcUnloadChrg ? toNumber(record.ilcUnloadChrg) : null,
      ilcIsActive: record.ilcIsActive,
      ilcIsDeleted: record.ilcIsDeleted,
      ilcSyncDate: record.ilcSyncDate ? record.ilcSyncDate.toISOString() : null,
      ilcCreatedOn: record.ilcCreatedOn.toISOString(),
      ilcCreatedBy: record.ilcCreatedBy,
      ilcModifiedOn: record.ilcModifiedOn.toISOString(),
      ilcModifiedBy: record.ilcModifiedBy,
    };
  }
}
