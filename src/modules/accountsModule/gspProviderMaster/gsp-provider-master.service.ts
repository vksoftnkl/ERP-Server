import { isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { GspProviderMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListGspProviderMasterQueryDto } from './dto/list-gsp-provider-master-query.dto';
import { SaveGspProviderMasterDto } from './dto/save-gsp-provider-master.dto';
import {
  GspProviderMasterErrorDetail,
  GspProviderMasterListItem,
  GspProviderMasterListMeta,
  GspProviderMasterPayload,
} from './types/gsp-provider-master-api.types';
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
import { resolvePagination, runConfiguredGridQuery } from 'src/common/utils/module-list.utils';
const GSP_PROVIDER_MASTER_TABLE_NAME = 'gsp provider master';
const GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME = 'GSP Provider Master';
type GspProviderMasterWriteClient = AccountsWriteClient;
@Injectable()
export class GspProviderMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(
    saveGspProviderMasterDto: SaveGspProviderMasterDto,
  ): Promise<GspProviderMasterPayload> {
    if (saveGspProviderMasterDto.gspProviderId) {
      return this.updateProvider(saveGspProviderMasterDto);
    }
    return this.createProvider(saveGspProviderMasterDto);
  }
  async list(
    queryDto: ListGspProviderMasterQueryDto,
  ): Promise<ConfiguredGridListResult<GspProviderMasterListItem, GspProviderMasterListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const result = await runConfiguredGridQuery<GspProviderMasterListItem>(
      this.configuredGridSqlService,
      { tableName: GSP_PROVIDER_MASTER_TABLE_NAME, alias: 'gsp_provider_master_grid', search: queryDto.search, page, limit, skip },
    );
    if (!result) {
      throwAccountsBadRequest<GspProviderMasterErrorDetail>('No configured grid found for GSP provider master list', []);
    }
    return result;
  }
  private async listFromConfiguredGridSql(
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<GspProviderMasterListItem, GspProviderMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      GSP_PROVIDER_MASTER_TABLE_NAME,
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
        tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result = await this.configuredGridSqlService.runPagedQuery<GspProviderMasterListItem>({
          baseSql: validation.normalizedSql,
          alias: 'gsp_provider_master_grid',
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
  async getById(gspProviderId: string): Promise<GspProviderMasterPayload> {
    const record = await this.prisma.gspProviderMaster.findFirst({
      where: {
        gspProviderId,
        gspIsDeleted: false,
      },
    });
    if (!record) {
      throwAccountsNotFound<GspProviderMasterErrorDetail>('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
    }
    return this.toPayload(record);
  }
  async softDelete(gspProviderId: string): Promise<{ gspProviderId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gspProviderMaster.findFirst({
        where: {
          gspProviderId,
          gspIsDeleted: false,
        },
      });
      if (!existing) {
        throwAccountsNotFound<GspProviderMasterErrorDetail>('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
      }
      const activeServiceCount = await tx.gspCompanyService.count({
        where: {
          csgGspProviderId: gspProviderId,
          csgIsDeleted: false,
        },
      });
      if (activeServiceCount > 0) {
        throwAccountsBadRequest<GspProviderMasterErrorDetail>('Cannot delete GSP provider linked to active company services', [
          {
            field: 'gspProviderId',
            message: `GSP provider ${gspProviderId} is linked to ${activeServiceCount} active service record(s).`,
          },
        ]);
      }
      const modifiedOn = new Date();
      const result = await tx.gspProviderMaster.updateMany({
        where: {
          gspProviderId,
          gspIsDeleted: false,
        },
        data: {
          gspIsDeleted: true,
          gspIsActive: false,
          gspModifiedOn: modifiedOn,
          gspModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<GspProviderMasterErrorDetail>('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        gspIsDeleted: true,
        gspIsActive: false,
        gspModifiedOn: modifiedOn,
        gspModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
          screenName: GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: gspProviderId,
          displayName: existing.gspProviderName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'GSP provider soft deleted',
        },
        tx,
      );
      return {
        gspProviderId,
        deleted: true,
      };
    });
  }
  private async createProvider(
    saveGspProviderMasterDto: SaveGspProviderMasterDto,
  ): Promise<GspProviderMasterPayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const gspProviderCode = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspProviderCode,
          'gspProviderCode',
        );
        const gspProviderName = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspProviderName,
          'gspProviderName',
        );
        const gspBaseUrl = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspBaseUrl,
          'gspBaseUrl',
        );
        const gspRoute = normalizeRequiredText<GspProviderMasterErrorDetail>(saveGspProviderMasterDto.gspRoute, 'gspRoute');
        const gspIpAddress = this.normalizeIpAddress(saveGspProviderMasterDto.gspIpAddress);
        const gspUserName = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspUserName,
          'gspUserName',
        );
        const gspUserPassword = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspUserPassword,
          'gspUserPassword',
        );
        await this.ensureCodeIsUnique(tx, gspProviderCode);
        await this.ensureNameIsUnique(tx, gspProviderName);
        const now = new Date();
        const data: Prisma.GspProviderMasterUncheckedCreateInput = {
          gspProviderCode,
          gspProviderName,
          gspBaseUrl,
          gspRoute,
          gspIpAddress,
          gspUserName,
          gspUserPassword,
          gspCreatedOn: now,
          gspCreatedBy: DEFAULT_ACTOR,
          gspModifiedOn: now,
          gspModifiedBy: DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveGspProviderMasterDto, 'gspIsActive')) {
          data.gspIsActive = saveGspProviderMasterDto.gspIsActive;
        }
        const created = await tx.gspProviderMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
            screenName: GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.gspProviderId,
            displayName: payload.gspProviderName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'GSP provider created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<GspProviderMasterErrorDetail>(error, 'GSP provider already exists', [{ field: 'gspProviderCode', message: 'Duplicate GSP provider unique value is not allowed' }]);
      throw error;
    }
  }
  private async updateProvider(
    saveGspProviderMasterDto: SaveGspProviderMasterDto,
  ): Promise<GspProviderMasterPayload> {
    const gspProviderId = saveGspProviderMasterDto.gspProviderId!;
    try {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.gspProviderMaster.findFirst({
          where: {
            gspProviderId,
            gspIsDeleted: false,
          },
        });
        if (!existing) {
          throwAccountsNotFound<GspProviderMasterErrorDetail>('GSP provider not found', 'gspProviderId', `No active GSP provider found with id ${gspProviderId}`);
        }
        const gspProviderCode = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspProviderCode,
          'gspProviderCode',
        );
        const gspProviderName = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspProviderName,
          'gspProviderName',
        );
        const gspBaseUrl = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspBaseUrl,
          'gspBaseUrl',
        );
        const gspRoute = normalizeRequiredText<GspProviderMasterErrorDetail>(saveGspProviderMasterDto.gspRoute, 'gspRoute');
        const gspIpAddress = this.normalizeIpAddress(saveGspProviderMasterDto.gspIpAddress);
        const gspUserName = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspUserName,
          'gspUserName',
        );
        const gspUserPassword = normalizeRequiredText<GspProviderMasterErrorDetail>(
          saveGspProviderMasterDto.gspUserPassword,
          'gspUserPassword',
        );
        await this.ensureCodeIsUnique(tx, gspProviderCode, gspProviderId);
        await this.ensureNameIsUnique(tx, gspProviderName, gspProviderId);
        const data: Prisma.GspProviderMasterUncheckedUpdateInput = {
          gspProviderCode,
          gspProviderName,
          gspBaseUrl,
          gspRoute,
          gspIpAddress,
          gspUserName,
          gspUserPassword,
          gspModifiedOn: new Date(),
          gspModifiedBy: DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveGspProviderMasterDto, 'gspIsActive')) {
          data.gspIsActive = saveGspProviderMasterDto.gspIsActive;
        }
        const updated = await tx.gspProviderMaster.update({
          where: {
            gspProviderId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: GSP_PROVIDER_MASTER_TABLE_NAME,
            screenName: GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: gspProviderId,
            displayName: payload.gspProviderName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'GSP provider updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<GspProviderMasterErrorDetail>(error, 'GSP provider already exists', [{ field: 'gspProviderCode', message: 'Duplicate GSP provider unique value is not allowed' }]);
      throw error;
    }
  }
  private async ensureCodeIsUnique(
    tx: GspProviderMasterWriteClient,
    gspProviderCode: string,
    excludeProviderId?: string,
  ): Promise<void> {
    const existing = await tx.gspProviderMaster.findFirst({
      where: {
        gspIsDeleted: false,
        gspProviderCode: {
          equals: gspProviderCode,
          mode: 'insensitive',
        },
        ...(excludeProviderId
          ? {
              gspProviderId: {
                not: excludeProviderId,
              },
            }
          : {}),
      },
      select: {
        gspProviderId: true,
      },
    });
    if (existing) {
      throwAccountsConflict<GspProviderMasterErrorDetail>('GSP provider code already exists', [
        { field: 'gspProviderCode', message: 'Duplicate gspProviderCode is not allowed' },
      ]);
    }
  }
  private async ensureNameIsUnique(
    tx: GspProviderMasterWriteClient,
    gspProviderName: string,
    excludeProviderId?: string,
  ): Promise<void> {
    const existing = await tx.gspProviderMaster.findFirst({
      where: {
        gspIsDeleted: false,
        gspProviderName: {
          equals: gspProviderName,
          mode: 'insensitive',
        },
        ...(excludeProviderId
          ? {
              gspProviderId: {
                not: excludeProviderId,
              },
            }
          : {}),
      },
      select: {
        gspProviderId: true,
      },
    });
    if (existing) {
      throwAccountsConflict<GspProviderMasterErrorDetail>('GSP provider name already exists', [
        { field: 'gspProviderName', message: 'Duplicate gspProviderName is not allowed' },
      ]);
    }
  }
  private normalizeIpAddress(value: string): string {
    const normalized = value.trim();
    if (!normalized || isIP(normalized) === 0) {
      throwAccountsBadRequest<GspProviderMasterErrorDetail>('Validation failed', [
        {
          field: 'gspIpAddress',
          message: 'gspIpAddress must be a valid IP address',
        },
      ]);
    }
    return normalized;
  }
  private toPayload(record: GspProviderMaster): GspProviderMasterPayload {
    return {
      gspProviderId: record.gspProviderId,
      gspProviderCode: record.gspProviderCode,
      gspProviderName: record.gspProviderName,
      gspBaseUrl: record.gspBaseUrl,
      gspRoute: record.gspRoute,
      gspIpAddress: record.gspIpAddress,
      gspUserName: record.gspUserName,
      gspUserPassword: record.gspUserPassword,
      gspIsActive: record.gspIsActive,
      gspIsDeleted: record.gspIsDeleted,
      gspCreatedOn: record.gspCreatedOn.toISOString(),
      gspCreatedBy: record.gspCreatedBy,
      gspModifiedOn: record.gspModifiedOn.toISOString(),
      gspModifiedBy: record.gspModifiedBy,
    };
  }
}