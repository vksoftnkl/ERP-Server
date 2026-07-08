import { Injectable } from '@nestjs/common';
import { FreightCharges, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveFreightChargesDto } from './dto/save-freight-charges.dto';
import {
  FreightChargesErrorDetail,
  FreightChargesErrorResponse,
  FreightChargesPayload,
} from './types/freight-charges-api.types';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const FREIGHT_CHARGES_TABLE_NAME = 'freight charges';
const FREIGHT_CHARGES_AUDIT_SCREEN_NAME = 'Freight Charges';
const FREIGHT_CHARGES_OPTIONAL_FIELDS = [
  'frFromKm',
  'frToKm',
  'frFreightChrg',
  'frFromWeight',
  'frToWeight',
  'frLoadChrg',
  'frUnloadChrg',
  'frIsActive',
];

type FreightChargesWriteClient = SalesWriteClient;

@Injectable()
export class FreightChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(dto: SaveFreightChargesDto): Promise<FreightChargesPayload> {
    if (dto.frId) {
      return this.updateFreightCharges(dto);
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.createFreightCharges(dto, userId);
  }

  async createFreightCharges(
    dto: SaveFreightChargesDto,
    userId: string,
  ): Promise<FreightChargesPayload> {
    const actor = resolveActor(dto.frCreatedBy, userId);
    const now = new Date();
    const isDeleted = dto.frIsActive === false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const data: Prisma.FreightChargesUncheckedCreateInput = {
          frFromKm: dto.frFromKm ?? 0,
          frToKm: dto.frToKm ?? 0,
          frFreightChrg: dto.frFreightChrg ?? 0,
          frFromWeight: dto.frFromWeight ?? 0,
          frToWeight: dto.frToWeight ?? 0,
          frLoadChrg: dto.frLoadChrg ?? 0,
          frUnloadChrg: dto.frUnloadChrg ?? 0,
          frIsActive: !isDeleted,
          frIsDeleted: isDeleted,
          frCreatedOn: now,
          frCreatedBy: actor,
          frModifiedOn: now,
          frModifiedBy: actor,
        };

        const created = await tx.freightCharges.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: FREIGHT_CHARGES_TABLE_NAME,
            screenName: FREIGHT_CHARGES_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.frId,
            displayName: `FR-${payload.frFromKm}-${payload.frToKm}`,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Freight charges created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<FreightChargesErrorDetail, FreightChargesErrorResponse>(
        error,
        'Freight charges already exists',
        [
          {
            field: 'frFromKm',
            message: 'Duplicate freight charges range is not allowed',
          },
        ],
      );
      throw error;
    }
  }

  async getById(frId: string): Promise<FreightChargesPayload> {
    const record = await this.prisma.freightCharges.findFirst({
      where: {
        frId,
        frIsDeleted: false,
      },
    });

    if (!record) {
      throwSalesNotFound<FreightChargesErrorDetail, FreightChargesErrorResponse>(
        'Freight charges not found',
        'frId',
        `No active freight charges found with id ${frId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(frId: string): Promise<{ frId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.freightCharges.findFirst({
        where: {
          frId,
          frIsDeleted: false,
        },
      });

      if (!existing) {
        throwSalesNotFound<FreightChargesErrorDetail, FreightChargesErrorResponse>(
          'Freight charges not found',
          'frId',
          `No active freight charges found with id ${frId}`,
        );
      }

      const modifiedOn = new Date();
      const result = await tx.freightCharges.updateMany({
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
        throwSalesNotFound<FreightChargesErrorDetail, FreightChargesErrorResponse>(
          'Freight charges not found',
          'frId',
          `No active freight charges found with id ${frId}`,
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
          tableName: FREIGHT_CHARGES_TABLE_NAME,
          screenName: FREIGHT_CHARGES_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: frId,
          displayName: `FR-${existing.frFromKm}-${existing.frToKm}`,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Freight charges soft deleted',
        },
        tx,
      );

      return {
        frId,
        deleted: true,
      };
    });
  }

  private async updateFreightCharges(dto: SaveFreightChargesDto): Promise<FreightChargesPayload> {
    const frId = dto.frId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.freightCharges.findFirst({
          where: {
            frId,
            frIsDeleted: false,
          },
        });

        if (!existing) {
          throwSalesNotFound<FreightChargesErrorDetail, FreightChargesErrorResponse>(
            'Freight charges not found',
            'frId',
            `No active freight charges found with id ${frId}`,
          );
        }

        const data: Prisma.FreightChargesUncheckedUpdateInput = {
          frModifiedOn: new Date(),
          frModifiedBy: resolveActor(
            dto.frModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };

        this.applyOptionalFields(data, dto);

        const updated = await tx.freightCharges.update({
          where: { frId },
          data,
        });

        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: FREIGHT_CHARGES_TABLE_NAME,
            screenName: FREIGHT_CHARGES_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: frId,
            displayName: `FR-${payload.frFromKm}-${payload.frToKm}`,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.frModifiedBy,
            notes: 'Freight charges updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<FreightChargesErrorDetail, FreightChargesErrorResponse>(
        error,
        'Freight charges already exists',
        [
          {
            field: 'frFromKm',
            message: 'Duplicate freight charges range is not allowed',
          },
        ],
      );
      throw error;
    }
  }

  private applyOptionalFields(
    data: Prisma.FreightChargesUncheckedCreateInput | Prisma.FreightChargesUncheckedUpdateInput,
    dto: SaveFreightChargesDto,
  ): void {
    applyPresentFields(data, dto, FREIGHT_CHARGES_OPTIONAL_FIELDS);
  }

  private toPayload(record: FreightCharges): FreightChargesPayload {
    return {
      frId: record.frId,
      frFromKm: record.frFromKm,
      frToKm: record.frToKm,
      frFreightChrg: record.frFreightChrg ? toNumber(record.frFreightChrg) : null,
      frFromWeight: record.frFromWeight ? toNumber(record.frFromWeight) : null,
      frToWeight: record.frToWeight ? toNumber(record.frToWeight) : null,
      frLoadChrg: record.frLoadChrg ? toNumber(record.frLoadChrg) : null,
      frUnloadChrg: record.frUnloadChrg ? toNumber(record.frUnloadChrg) : null,
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
