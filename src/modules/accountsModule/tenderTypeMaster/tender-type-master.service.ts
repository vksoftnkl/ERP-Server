import { Injectable } from '@nestjs/common';
import { AccTenderType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveTenderTypeMasterDto } from './dto/save-tender-type-master.dto';
import {
  TenderTypeMasterErrorDetail,
  TenderTypeMasterPayload,
} from './types/tender-type-master-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const TENDER_TYPE_MASTER_TABLE_NAME = 'tender type';
const TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME = 'Tender Type Master';
type TenderTypeMasterWriteClient = AccountsWriteClient;
@Injectable()
export class TenderTypeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveTenderTypeMasterDto: SaveTenderTypeMasterDto): Promise<TenderTypeMasterPayload> {
    if (saveTenderTypeMasterDto.ttmTypeId) {
      return this.updateTenderType(saveTenderTypeMasterDto);
    }
    return this.createTenderType(saveTenderTypeMasterDto);
  }
  async getById(ttmTypeId: string): Promise<TenderTypeMasterPayload> {
    const record = await this.prisma.accTenderType.findFirst({
      where: {
        ttmTypeId: this.parseTenderTypeId(ttmTypeId, 'ttmTypeId'),
        ttmIsDeleted: false,
      },
    });
    if (!record) {
      throwAccountsNotFound<TenderTypeMasterErrorDetail>(
        'Tender type not found',
        'ttmTypeId',
        `No active tender type found with id ${ttmTypeId}`,
      );
    }
    return this.toPayload(record);
  }
  async softDelete(ttmTypeId: string): Promise<{ ttmTypeId: string; deleted: true }> {
    const tenderTypeId = this.parseTenderTypeId(ttmTypeId, 'ttmTypeId');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accTenderType.findFirst({
        where: {
          ttmTypeId: tenderTypeId,
          ttmIsDeleted: false,
        },
      });
      if (!existing) {
        throwAccountsNotFound<TenderTypeMasterErrorDetail>(
          'Tender type not found',
          'ttmTypeId',
          `No active tender type found with id ${ttmTypeId}`,
        );
      }
      const activeTendersCount = await tx.accTenderMaster.count({
        where: {
          tndTypeId: tenderTypeId,
          tndIsDeleted: false,
        },
      });
      if (activeTendersCount > 0) {
        throwAccountsBadRequest<TenderTypeMasterErrorDetail>(
          'Cannot delete tender type with active tenders',
          [
            {
              field: 'ttmTypeId',
              message: `Tender type ${ttmTypeId} is used by ${activeTendersCount} tender(s).`,
            },
          ],
        );
      }
      const modifiedOn = new Date();
      const result = await tx.accTenderType.updateMany({
        where: {
          ttmTypeId: tenderTypeId,
          ttmIsDeleted: false,
        },
        data: {
          ttmIsDeleted: true,
          ttmIsActive: false,
          ttmModifiedOn: modifiedOn,
          ttmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<TenderTypeMasterErrorDetail>(
          'Tender type not found',
          'ttmTypeId',
          `No active tender type found with id ${ttmTypeId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ttmIsDeleted: true,
        ttmIsActive: false,
        ttmModifiedOn: modifiedOn,
        ttmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_TYPE_MASTER_TABLE_NAME,
          screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ttmTypeId,
          displayName: existing.ttmTypeName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Tender type soft deleted',
        },
        tx,
      );
      return {
        ttmTypeId,
        deleted: true,
      };
    });
  }
  private async createTenderType(
    saveTenderTypeMasterDto: SaveTenderTypeMasterDto,
  ): Promise<TenderTypeMasterPayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const ttmTypeName = normalizeRequiredText<TenderTypeMasterErrorDetail>(
          saveTenderTypeMasterDto.ttmTypeName,
          'ttmTypeName',
        );
        await this.ensureNameIsUnique(tx, ttmTypeName);
        const now = new Date();
        const data: Prisma.AccTenderTypeUncheckedCreateInput = {
          ttmTypeId: await this.allocateTypeId(tx),
          ttmTypeName,
          ttmDisplayName: this.buildDisplayName(saveTenderTypeMasterDto, ttmTypeName),
          ttmCreatedOn: now,
          ttmCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveTenderTypeMasterDto, 'ttmIsActive')) {
          data.ttmIsActive = saveTenderTypeMasterDto.ttmIsActive;
        }
        const created = await tx.accTenderType.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TENDER_TYPE_MASTER_TABLE_NAME,
            screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ttmTypeId,
            displayName: payload.ttmTypeName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Tender type created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<TenderTypeMasterErrorDetail>(
        error,
        'Tender type already exists',
        [{ field: 'ttmTypeName', message: 'Duplicate tender type unique value is not allowed' }],
      );
      throw error;
    }
  }
  private async updateTenderType(
    saveTenderTypeMasterDto: SaveTenderTypeMasterDto,
  ): Promise<TenderTypeMasterPayload> {
    const ttmTypeId = saveTenderTypeMasterDto.ttmTypeId!;
    const tenderTypeId = this.parseTenderTypeId(ttmTypeId, 'ttmTypeId');
    try {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.accTenderType.findFirst({
          where: {
            ttmTypeId: tenderTypeId,
            ttmIsDeleted: false,
          },
        });
        if (!existing) {
          throwAccountsNotFound<TenderTypeMasterErrorDetail>(
            'Tender type not found',
            'ttmTypeId',
            `No active tender type found with id ${ttmTypeId}`,
          );
        }
        const ttmTypeName = normalizeRequiredText<TenderTypeMasterErrorDetail>(
          saveTenderTypeMasterDto.ttmTypeName,
          'ttmTypeName',
        );
        await this.ensureNameIsUnique(tx, ttmTypeName, tenderTypeId);
        const data: Prisma.AccTenderTypeUncheckedUpdateInput = {
          ttmTypeName,
          ttmDisplayName: this.buildDisplayName(saveTenderTypeMasterDto, ttmTypeName),
          ttmModifiedOn: new Date(),
          ttmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveTenderTypeMasterDto, 'ttmIsActive')) {
          data.ttmIsActive = saveTenderTypeMasterDto.ttmIsActive;
        }
        const updated = await tx.accTenderType.update({
          where: {
            ttmTypeId: tenderTypeId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TENDER_TYPE_MASTER_TABLE_NAME,
            screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ttmTypeId,
            displayName: payload.ttmTypeName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Tender type updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<TenderTypeMasterErrorDetail>(
        error,
        'Tender type already exists',
        [{ field: 'ttmTypeName', message: 'Duplicate tender type unique value is not allowed' }],
      );
      throw error;
    }
  }
  // acc_tender_types.ttm_type_id has no sequence — it is a fixed, tenant-agnostic
  // catalogue whose baseline rows are seeded by migration with explicit ids
  // (1..11), so a caller-created row takes max + 1. Runs inside the caller's
  // transaction; the pk collision two concurrent creates would race for surfaces
  // as the same unique-constraint error the name check already handles.
  private async allocateTypeId(tx: TenderTypeMasterWriteClient): Promise<number> {
    const highest = await tx.accTenderType.aggregate({
      _max: { ttmTypeId: true },
    });
    return (highest._max.ttmTypeId ?? 0) + 1;
  }
  private async ensureNameIsUnique(
    tx: TenderTypeMasterWriteClient,
    ttmTypeName: string,
    excludeTtmTypeId?: number,
  ): Promise<void> {
    const existing = await tx.accTenderType.findFirst({
      where: {
        // ux_ttm_name is a plain UNIQUE on ttm_type_name — unlike the tender
        // master's partial indexes it does NOT exclude soft-deleted rows, so a
        // deleted type still reserves its name and must be matched here.
        ttmTypeName: {
          equals: ttmTypeName,
          mode: 'insensitive',
        },
        ...(excludeTtmTypeId
          ? {
              ttmTypeId: {
                not: excludeTtmTypeId,
              },
            }
          : {}),
      },
      select: {
        ttmTypeId: true,
      },
    });
    if (existing) {
      throwAccountsConflict<TenderTypeMasterErrorDetail>('Tender type name already exists', [
        { field: 'ttmTypeName', message: 'Duplicate ttmTypeName is not allowed' },
      ]);
    }
  }
  private buildDisplayName(
    saveTenderTypeMasterDto: SaveTenderTypeMasterDto,
    ttmTypeName: string,
  ): string {
    const provided = saveTenderTypeMasterDto.ttmDisplayName?.trim();
    return provided || ttmTypeName;
  }
  private parseTenderTypeId(value: string, field: string): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwAccountsBadRequest<TenderTypeMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }
    const parsed = Number(normalized);
    // ttm_type_id is a 32-bit integer column; anything wider is a client error
    // rather than a lookup that simply misses.
    if (!Number.isSafeInteger(parsed) || parsed > 2147483647) {
      throwAccountsBadRequest<TenderTypeMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }
    return parsed;
  }
  private toPayload(record: AccTenderType): TenderTypeMasterPayload {
    return {
      ttmTypeId: record.ttmTypeId.toString(),
      ttmTypeName: record.ttmTypeName,
      ttmDisplayName: record.ttmDisplayName,
      ttmIsActive: record.ttmIsActive,
      ttmIsDeleted: record.ttmIsDeleted,
      ttmSyncDate: record.ttmSyncDate ? record.ttmSyncDate.toISOString() : null,
      ttmCreatedOn: record.ttmCreatedOn.toISOString(),
      ttmCreatedBy: record.ttmCreatedBy,
      ttmModifiedOn: record.ttmModifiedOn ? record.ttmModifiedOn.toISOString() : null,
      ttmModifiedBy: record.ttmModifiedBy,
    };
  }
}
