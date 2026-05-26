import { Injectable } from '@nestjs/common';
import { AccountTenderTypes, Prisma } from '@prisma/client';
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
const TENDER_TYPE_MASTER_TABLE_NAME = 'tender type';
const LEGACY_TENDER_TYPE_MASTER_TABLE_NAME = 'tender_type_master';
const TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME = 'Tender Type Master';
type TenderTypeMasterWriteClient = AccountsWriteClient;
@Injectable()
export class TenderTypeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}
  async save(saveTenderTypeMasterDto: SaveTenderTypeMasterDto): Promise<TenderTypeMasterPayload> {
    if (saveTenderTypeMasterDto.ttmTypeId) {
      return this.updateTenderType(saveTenderTypeMasterDto);
    }
    return this.createTenderType(saveTenderTypeMasterDto);
  }
  async getById(ttmTypeId: string): Promise<TenderTypeMasterPayload> {
    const record = await this.prisma.accountTenderTypes.findFirst({
      where: {
        accttTypeId: this.parseTenderTypeId(ttmTypeId, 'ttmTypeId'),
        accttTypeIsDeleted: false,
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
      const existing = await tx.accountTenderTypes.findFirst({
        where: {
          accttTypeId: tenderTypeId,
          accttTypeIsDeleted: false,
        },
      });
      if (!existing) {
        throwAccountsNotFound<TenderTypeMasterErrorDetail>(
          'Tender type not found',
          'ttmTypeId',
          `No active tender type found with id ${ttmTypeId}`,
        );
      }
      const activeTendersCount = await tx.accountTenderMaster.count({
        where: {
          acctndTypeId: tenderTypeId,
          acctndIsDeleted: false,
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
      const result = await tx.accountTenderTypes.updateMany({
        where: {
          accttTypeId: tenderTypeId,
          accttTypeIsDeleted: false,
        },
        data: {
          accttTypeIsDeleted: true,
          accttTypeIsActive: false,
          accttTypeModifiedOn: modifiedOn,
          accttTypeModifiedBy: DEFAULT_ACTOR,
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
        accttTypeIsDeleted: true,
        accttTypeIsActive: false,
        accttTypeModifiedOn: modifiedOn,
        accttTypeModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_TYPE_MASTER_TABLE_NAME,
          screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ttmTypeId,
          displayName: existing.accttTypeName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
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
        const data: Prisma.AccountTenderTypesUncheckedCreateInput = {
          accttTypeName: ttmTypeName,
          accttTypeShortName: this.buildShortName(ttmTypeName),
          accttTypeCreatedOn: now,
          accttTypeCreatedBy: DEFAULT_ACTOR,
          accttTypeModifiedOn: now,
          accttTypeModifiedBy: DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveTenderTypeMasterDto, 'ttmIsActive')) {
          data.accttTypeIsActive = saveTenderTypeMasterDto.ttmIsActive;
        }
        const created = await tx.accountTenderTypes.create({ data });
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
            userId: DEFAULT_ACTOR,
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
        const existing = await tx.accountTenderTypes.findFirst({
          where: {
            accttTypeId: tenderTypeId,
            accttTypeIsDeleted: false,
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
        const data: Prisma.AccountTenderTypesUncheckedUpdateInput = {
          accttTypeName: ttmTypeName,
          accttTypeShortName: this.buildShortName(ttmTypeName),
          accttTypeModifiedOn: new Date(),
          accttTypeModifiedBy: DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveTenderTypeMasterDto, 'ttmIsActive')) {
          data.accttTypeIsActive = saveTenderTypeMasterDto.ttmIsActive;
        }
        const updated = await tx.accountTenderTypes.update({
          where: {
            accttTypeId: tenderTypeId,
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
            userId: DEFAULT_ACTOR,
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
  private async ensureNameIsUnique(
    tx: TenderTypeMasterWriteClient,
    ttmTypeName: string,
    excludeTtmTypeId?: bigint,
  ): Promise<void> {
    const existing = await tx.accountTenderTypes.findFirst({
      where: {
        accttTypeIsDeleted: false,
        accttTypeName: {
          equals: ttmTypeName,
          mode: 'insensitive',
        },
        ...(excludeTtmTypeId
          ? {
              accttTypeId: {
                not: excludeTtmTypeId,
              },
            }
          : {}),
      },
      select: {
        accttTypeId: true,
      },
    });
    if (existing) {
      throwAccountsConflict<TenderTypeMasterErrorDetail>('Tender type name already exists', [
        { field: 'ttmTypeName', message: 'Duplicate ttmTypeName is not allowed' },
      ]);
    }
  }
  private buildShortName(value: string): string {
    return value;
  }
  private parseTenderTypeId(value: string, field: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwAccountsBadRequest<TenderTypeMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }
    return BigInt(normalized);
  }
  private toPayload(record: AccountTenderTypes): TenderTypeMasterPayload {
    return {
      ttmTypeId: record.accttTypeId.toString(),
      ttmTypeName: record.accttTypeName,
      ttmIsActive: record.accttTypeIsActive,
      ttmIsDeleted: record.accttTypeIsDeleted,
      ttmSyncDate: record.accttTypeSyncDate ? record.accttTypeSyncDate.toISOString() : null,
      ttmCreatedOn: record.accttTypeCreatedOn.toISOString(),
      ttmCreatedBy: record.accttTypeCreatedBy,
      ttmModifiedOn: record.accttTypeModifiedOn.toISOString(),
      ttmModifiedBy: record.accttTypeModifiedBy,
    };
  }
}
