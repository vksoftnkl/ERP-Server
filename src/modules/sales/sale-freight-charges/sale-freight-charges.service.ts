import { Injectable } from '@nestjs/common';
import { Prisma, SaleFreightCharge } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleFreightChargeDto } from './dto/save-sale-freight-charges.dto';
import {
  SaleFreightChargeErrorDetail,
  SaleFreightChargeErrorResponse,
  SaleFreightChargePayload,
} from './types/sale-freight-charges-api.types';
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

const SALE_FREIGHT_CHARGE_TABLE_NAME = 'sale freight charges';
const SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME = 'Sale Freight Charges';
const SALE_FREIGHT_CHARGE_OPTIONAL_FIELDS = [
  'frCompanyId',
  'frBranchId',
  'frFromKm',
  'frToKm',
  'frFreightChrg',
  'frFromWeight',
  'frToWeight',
  'frIsActive',
];

@Injectable()
export class SaleFreightChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(dto: SaveSaleFreightChargeDto): Promise<SaleFreightChargePayload> {
    if (dto.frId) {
      return this.updateSaleFreightCharge(dto);
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.createSaleFreightCharge(dto, userId);
  }

  async createSaleFreightCharge(
    dto: SaveSaleFreightChargeDto,
    userId: string,
  ): Promise<SaleFreightChargePayload> {
    const actor = resolveActor(dto.frCreatedBy, userId);
    const now = new Date();
    const isDeleted = dto.frIsActive === false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const data: Prisma.SaleFreightChargeUncheckedCreateInput = {
          frCompanyId: dto.frCompanyId ?? null,
          frBranchId: dto.frBranchId ?? null,
          frFromKm: dto.frFromKm ?? 0,
          frToKm: dto.frToKm ?? 0,
          frFreightChrg: dto.frFreightChrg ?? 0,
          frFromWeight: dto.frFromWeight ?? 0,
          frToWeight: dto.frToWeight ?? 0,
          frIsActive: !isDeleted,
          frIsDeleted: isDeleted,
          frCreatedOn: now,
          frCreatedBy: actor,
          frModifiedOn: now,
          frModifiedBy: actor,
        };

        const created = await tx.saleFreightCharge.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SALE_FREIGHT_CHARGE_TABLE_NAME,
            screenName: SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.frId,
            displayName: `FR-${payload.frFromKm}-${payload.frToKm}`,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Sale freight charge created',
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

  async getById(frId: string): Promise<SaleFreightChargePayload> {
    const record = await this.prisma.saleFreightCharge.findFirst({
      where: {
        frId,
        frIsDeleted: false,
      },
    });

    if (!record) {
      throwSalesNotFound<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse>(
        'Sale freight charge not found',
        'frId',
        `No active sale freight charge found with id ${frId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(frId: string): Promise<{ frId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleFreightCharge.findFirst({
        where: {
          frId,
          frIsDeleted: false,
        },
      });

      if (!existing) {
        throwSalesNotFound<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse>(
          'Sale freight charge not found',
          'frId',
          `No active sale freight charge found with id ${frId}`,
        );
      }

      const modifiedOn = new Date();
      const result = await tx.saleFreightCharge.updateMany({
        where: {
          frId,
          frIsDeleted: false,
        },
        data: {
          frIsDeleted: true,
          frIsActive: false,
          frModifiedOn: modifiedOn,
          frModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        throwSalesNotFound<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse>(
          'Sale freight charge not found',
          'frId',
          `No active sale freight charge found with id ${frId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        frIsDeleted: true,
        frIsActive: false,
        frModifiedOn: modifiedOn,
        frModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SALE_FREIGHT_CHARGE_TABLE_NAME,
          screenName: SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: frId,
          displayName: `FR-${existing.frFromKm}-${existing.frToKm}`,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Sale freight charge soft deleted',
        },
        tx,
      );

      return {
        frId,
        deleted: true,
      };
    });
  }

  private async updateSaleFreightCharge(
    dto: SaveSaleFreightChargeDto,
  ): Promise<SaleFreightChargePayload> {
    const frId = dto.frId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleFreightCharge.findFirst({
          where: {
            frId,
            frIsDeleted: false,
          },
        });

        if (!existing) {
          throwSalesNotFound<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse>(
            'Sale freight charge not found',
            'frId',
            `No active sale freight charge found with id ${frId}`,
          );
        }

        const data: Prisma.SaleFreightChargeUncheckedUpdateInput = {
          frModifiedOn: new Date(),
          frModifiedBy: resolveActor(
            dto.frModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };

        this.applyOptionalFields(data, dto);

        const updated = await tx.saleFreightCharge.update({
          where: { frId },
          data,
        });

        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_FREIGHT_CHARGE_TABLE_NAME,
            screenName: SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: frId,
            displayName: `FR-${payload.frFromKm}-${payload.frToKm}`,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.frModifiedBy,
            notes: 'Sale freight charge updated',
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
    throwOnUniqueConstraintError<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse>(
      error,
      'Sale freight charge already exists',
      [
        {
          field: 'frFromKm',
          message: 'Duplicate sale freight charge range is not allowed',
        },
      ],
    );
    if (isForeignKeyConstraintError(error)) {
      throwSalesBadRequest<SaleFreightChargeErrorDetail, SaleFreightChargeErrorResponse>(
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
      | Prisma.SaleFreightChargeUncheckedCreateInput
      | Prisma.SaleFreightChargeUncheckedUpdateInput,
    dto: SaveSaleFreightChargeDto,
  ): void {
    applyPresentFields(data, dto, SALE_FREIGHT_CHARGE_OPTIONAL_FIELDS);
  }

  private toPayload(record: SaleFreightCharge): SaleFreightChargePayload {
    return {
      frId: record.frId,
      frCompanyId: record.frCompanyId,
      frBranchId: record.frBranchId,
      frFromKm: record.frFromKm,
      frToKm: record.frToKm,
      frFreightChrg: record.frFreightChrg ? toNumber(record.frFreightChrg) : null,
      frFromWeight: record.frFromWeight ? toNumber(record.frFromWeight) : null,
      frToWeight: record.frToWeight ? toNumber(record.frToWeight) : null,
      frIsActive: record.frIsActive,
      frIsDeleted: record.frIsDeleted,
      frSyncDate: record.frSyncDate ? record.frSyncDate.toISOString() : null,
      frCreatedOn: record.frCreatedOn.toISOString(),
      frCreatedBy: record.frCreatedBy,
      frModifiedOn: record.frModifiedOn.toISOString(),
      frModifiedBy: record.frModifiedBy,
    };
  }
}
