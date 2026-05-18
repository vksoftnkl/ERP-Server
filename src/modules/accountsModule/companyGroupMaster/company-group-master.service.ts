import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { CompanyGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListCompanyGroupMasterQueryDto } from './dto/list-company-group-master-query.dto';
import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import {
  CompanyGroupMasterErrorDetail,
  CompanyGroupMasterListItem,
  CompanyGroupMasterListMeta,
  CompanyGroupMasterPayload,
} from './types/company-group-master-api.types';
import {
  DEFAULT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  hasOwnProperty,
  normalizeRequiredText,
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
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(
    saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto,
  ): Promise<CompanyGroupMasterPayload> {
    if (saveCompanyGroupMasterDto.cogGroupId) {
      return this.updateGroup(saveCompanyGroupMasterDto);
    }

    return this.createGroup(saveCompanyGroupMasterDto);
  }

  async list(
    queryDto: ListCompanyGroupMasterQueryDto,
  ): Promise<ConfiguredGridListResult<CompanyGroupMasterListItem, CompanyGroupMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.cogIsActive !== undefined;

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.CompanyGroupMasterWhereInput = {
      cogIsDeleted: false,
    };

    if (queryDto.cogIsActive !== undefined) {
      where.cogIsActive = queryDto.cogIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [{ cogGroupName: { contains: search, mode: 'insensitive' } }];
    }

    const [total, records, styles] = await Promise.all([
      this.prisma.companyGroupMaster.count({ where }),
      this.prisma.companyGroupMaster.findMany({
        where,
        orderBy: [{ cogGroupName: 'asc' }, { cogGroupId: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(COMPANY_GROUP_MASTER_TABLE_NAME),
    ]);

    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      ...(styles !== undefined && { styles }),
    };
  }

  private async listFromConfiguredGridSql(
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<CompanyGroupMasterListItem, CompanyGroupMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      COMPANY_GROUP_MASTER_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<CompanyGroupMasterListItem>({
          baseSql: validation.normalizedSql,
          alias: 'company_group_master_grid',
          search,
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
          styles: result.styles,
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  async getById(cogGroupId: string): Promise<CompanyGroupMasterPayload> {
    const record = await this.prisma.companyGroupMaster.findFirst({
      where: {
        cogGroupId,
        cogIsDeleted: false,
      },
    });

    if (!record) {
      throwAccountsNotFound<CompanyGroupMasterErrorDetail>('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
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
        throwAccountsNotFound<CompanyGroupMasterErrorDetail>('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
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
        throwAccountsNotFound<CompanyGroupMasterErrorDetail>('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
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
        const groupName = normalizeRequiredText<CompanyGroupMasterErrorDetail>(saveCompanyGroupMasterDto.cogGroupName, 'cogGroupName');
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
      throwOnUniqueConstraintError<CompanyGroupMasterErrorDetail>(error, 'Company group already exists', [{ field: 'cogGroupName', message: 'Duplicate company group unique value is not allowed' }]);
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
          throwAccountsNotFound<CompanyGroupMasterErrorDetail>('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
        }

        const groupName = normalizeRequiredText<CompanyGroupMasterErrorDetail>(saveCompanyGroupMasterDto.cogGroupName, 'cogGroupName');
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
      throwOnUniqueConstraintError<CompanyGroupMasterErrorDetail>(error, 'Company group already exists', [{ field: 'cogGroupName', message: 'Duplicate company group unique value is not allowed' }]);
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
