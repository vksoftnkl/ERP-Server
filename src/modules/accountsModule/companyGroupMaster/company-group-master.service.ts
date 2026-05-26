import { Injectable } from '@nestjs/common';
import { CompanyGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import {
  CompanyGroupMasterErrorDetail,
  CompanyGroupMasterPayload,
} from './types/company-group-master-api.types';
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
const COMPANY_GROUP_MASTER_TABLE_NAME = 'company group master';
const COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME = 'Company Group Master';
type CompanyGroupWriteClient = AccountsWriteClient;

@Injectable()
export class CompanyGroupMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(
    saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto,
  ): Promise<CompanyGroupMasterPayload> {
    if (saveCompanyGroupMasterDto.cogGroupId) {
      return this.updateGroup(saveCompanyGroupMasterDto);
    }

    return this.createGroup(saveCompanyGroupMasterDto);
  }

  async getById(cogGroupId: string): Promise<CompanyGroupMasterPayload> {
    const record = await this.prisma.companyGroupMaster.findFirst({
      where: {
        cogGroupId,
        cogIsDeleted: false,
      },
    });

    if (!record) {
      throwAccountsNotFound<CompanyGroupMasterErrorDetail>(
        'Company group not found',
        'cogGroupId',
        `No active company group found with id ${cogGroupId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(cogGroupId: string): Promise<{ cogGroupId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.companyGroupMaster.findFirst({
        where: {
          cogGroupId,
          cogIsDeleted: false,
        },
      });

      if (!existing) {
        throwAccountsNotFound<CompanyGroupMasterErrorDetail>(
          'Company group not found',
          'cogGroupId',
          `No active company group found with id ${cogGroupId}`,
        );
      }

      const modifiedOn = new Date();
      const result = await tx.companyGroupMaster.updateMany({
        where: {
          cogGroupId,
          cogIsDeleted: false,
        },
        data: {
          cogIsDeleted: true,
          cogIsActive: false,
          cogModifiedOn: modifiedOn,
          cogModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        throwAccountsNotFound<CompanyGroupMasterErrorDetail>(
          'Company group not found',
          'cogGroupId',
          `No active company group found with id ${cogGroupId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        cogIsDeleted: true,
        cogIsActive: false,
        cogModifiedOn: modifiedOn,
        cogModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
          screenName: COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: cogGroupId,
          displayName: existing.cogGroupName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Company group soft deleted',
        },
        tx,
      );

      return {
        cogGroupId,
        deleted: true,
      };
    });
  }

  private async createGroup(
    saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto,
  ): Promise<CompanyGroupMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const groupName = normalizeRequiredText<CompanyGroupMasterErrorDetail>(
          saveCompanyGroupMasterDto.cogGroupName,
          'cogGroupName',
        );
        const companyIds = this.toUniqueIds(saveCompanyGroupMasterDto.cogCompanyIds);

        await this.ensureGroupNameIsUnique(tx, groupName);

        const now = new Date();
        const data: Prisma.CompanyGroupMasterUncheckedCreateInput = {
          cogGroupName: groupName,
          cogCompanyIds: companyIds,
          cogCreatedOn: now,
          cogCreatedBy: DEFAULT_ACTOR,
          cogModifiedOn: now,
          cogModifiedBy: DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveCompanyGroupMasterDto, 'cogIsActive')) {
          data.cogIsActive = saveCompanyGroupMasterDto.cogIsActive;
        }

        const created = await tx.companyGroupMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
            screenName: COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.cogGroupId,
            displayName: payload.cogGroupName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Company group created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CompanyGroupMasterErrorDetail>(
        error,
        'Company group already exists',
        [{ field: 'cogGroupName', message: 'Duplicate company group unique value is not allowed' }],
      );
      throw error;
    }
  }

  private async updateGroup(
    saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto,
  ): Promise<CompanyGroupMasterPayload> {
    const cogGroupId = saveCompanyGroupMasterDto.cogGroupId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.companyGroupMaster.findFirst({
          where: {
            cogGroupId,
            cogIsDeleted: false,
          },
        });

        if (!existing) {
          throwAccountsNotFound<CompanyGroupMasterErrorDetail>(
            'Company group not found',
            'cogGroupId',
            `No active company group found with id ${cogGroupId}`,
          );
        }

        const groupName = normalizeRequiredText<CompanyGroupMasterErrorDetail>(
          saveCompanyGroupMasterDto.cogGroupName,
          'cogGroupName',
        );
        const companyIds = this.toUniqueIds(saveCompanyGroupMasterDto.cogCompanyIds);

        await this.ensureGroupNameIsUnique(tx, groupName, cogGroupId);

        const data: Prisma.CompanyGroupMasterUncheckedUpdateInput = {
          cogGroupName: groupName,
          cogCompanyIds: companyIds,
          cogModifiedOn: new Date(),
          cogModifiedBy: DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveCompanyGroupMasterDto, 'cogIsActive')) {
          data.cogIsActive = saveCompanyGroupMasterDto.cogIsActive;
        }

        const updated = await tx.companyGroupMaster.update({
          where: {
            cogGroupId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
            screenName: COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: cogGroupId,
            displayName: payload.cogGroupName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Company group updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CompanyGroupMasterErrorDetail>(
        error,
        'Company group already exists',
        [{ field: 'cogGroupName', message: 'Duplicate company group unique value is not allowed' }],
      );
      throw error;
    }
  }

  private async ensureGroupNameIsUnique(
    tx: CompanyGroupWriteClient,
    cogGroupName: string,
    excludeGroupId?: string,
  ): Promise<void> {
    const existing = await tx.companyGroupMaster.findFirst({
      where: {
        cogIsDeleted: false,
        cogGroupName: {
          equals: cogGroupName,
          mode: 'insensitive',
        },
        ...(excludeGroupId
          ? {
              cogGroupId: {
                not: excludeGroupId,
              },
            }
          : {}),
      },
      select: {
        cogGroupId: true,
      },
    });

    if (existing) {
      throwAccountsConflict<CompanyGroupMasterErrorDetail>('Company group name already exists', [
        { field: 'cogGroupName', message: 'Duplicate cogGroupName is not allowed' },
      ]);
    }
  }

  private toUniqueIds(ids: readonly string[]): string[] {
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }
    return uniqueIds;
  }

  private toPayload(record: CompanyGroupMaster): CompanyGroupMasterPayload {
    return {
      cogGroupId: record.cogGroupId,
      cogGroupName: record.cogGroupName,
      cogCompanyIds: record.cogCompanyIds,
      cogIsActive: record.cogIsActive,
      cogIsDeleted: record.cogIsDeleted,
      cogSyncDate: record.cogSyncDate ? record.cogSyncDate.toISOString() : null,
      cogCreatedOn: record.cogCreatedOn.toISOString(),
      cogCreatedBy: record.cogCreatedBy,
      cogModifiedOn: record.cogModifiedOn.toISOString(),
      cogModifiedBy: record.cogModifiedBy,
    };
  }
}
