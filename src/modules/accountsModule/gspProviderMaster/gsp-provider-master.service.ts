import { isIP } from 'node:net';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { GspProviderMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListGspProviderMasterQueryDto } from './dto/list-gsp-provider-master-query.dto';
import { SaveGspProviderMasterDto } from './dto/save-gsp-provider-master.dto';
import {
  GspProviderMasterErrorDetail,
  GspProviderMasterErrorResponse,
  GspProviderMasterListItem,
  GspProviderMasterListMeta,
  GspProviderMasterPayload,
} from './types/gsp-provider-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const GSP_PROVIDER_MASTER_TABLE_NAME = 'gsp_provider_master';
const GSP_PROVIDER_MASTER_AUDIT_SCREEN_NAME = 'GSP Provider Master';

type GspProviderMasterWriteClient = Prisma.TransactionClient | PrismaService;

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
  ): Promise<{ items: GspProviderMasterListItem[]; meta: GspProviderMasterListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.gspIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.GspProviderMasterWhereInput = {
      gspIsDeleted: false,
    };

    if (queryDto.gspIsActive !== undefined) {
      where.gspIsActive = queryDto.gspIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { gspProviderCode: { contains: search, mode: 'insensitive' } },
        { gspProviderName: { contains: search, mode: 'insensitive' } },
        { gspBaseUrl: { contains: search, mode: 'insensitive' } },
        { gspRoute: { contains: search, mode: 'insensitive' } },
        { gspIpAddress: { contains: search, mode: 'insensitive' } },
        { gspUserName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.gspProviderMaster.count({ where }),
      this.prisma.gspProviderMaster.findMany({
        where,
        orderBy: [{ gspProviderName: 'asc' }, { gspProviderId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ items: GspProviderMasterListItem[]; meta: GspProviderMasterListMeta } | null> {
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
          limit,
          skip,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
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
      this.throwNotFound(gspProviderId);
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
        this.throwNotFound(gspProviderId);
      }

      const activeServiceCount = await tx.gspCompanyService.count({
        where: {
          csgGspProviderId: gspProviderId,
          csgIsDeleted: false,
        },
      });

      if (activeServiceCount > 0) {
        this.throwBadRequest('Cannot delete GSP provider linked to active company services', [
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
        this.throwNotFound(gspProviderId);
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
        const gspProviderCode = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspProviderCode,
          'gspProviderCode',
        );
        const gspProviderName = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspProviderName,
          'gspProviderName',
        );
        const gspBaseUrl = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspBaseUrl,
          'gspBaseUrl',
        );
        const gspRoute = this.normalizeRequiredText(saveGspProviderMasterDto.gspRoute, 'gspRoute');
        const gspIpAddress = this.normalizeIpAddress(saveGspProviderMasterDto.gspIpAddress);
        const gspUserName = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspUserName,
          'gspUserName',
        );
        const gspUserPassword = this.normalizeRequiredText(
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

        if (this.hasOwnProperty(saveGspProviderMasterDto, 'gspIsActive')) {
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
      this.handleWriteError(error);
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
          this.throwNotFound(gspProviderId);
        }

        const gspProviderCode = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspProviderCode,
          'gspProviderCode',
        );
        const gspProviderName = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspProviderName,
          'gspProviderName',
        );
        const gspBaseUrl = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspBaseUrl,
          'gspBaseUrl',
        );
        const gspRoute = this.normalizeRequiredText(saveGspProviderMasterDto.gspRoute, 'gspRoute');
        const gspIpAddress = this.normalizeIpAddress(saveGspProviderMasterDto.gspIpAddress);
        const gspUserName = this.normalizeRequiredText(
          saveGspProviderMasterDto.gspUserName,
          'gspUserName',
        );
        const gspUserPassword = this.normalizeRequiredText(
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

        if (this.hasOwnProperty(saveGspProviderMasterDto, 'gspIsActive')) {
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
      this.handleWriteError(error);
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
      throw new ConflictException(
        this.buildErrorResponse('GSP provider code already exists', [
          {
            field: 'gspProviderCode',
            message: 'Duplicate gspProviderCode is not allowed',
          },
        ]),
      );
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
      throw new ConflictException(
        this.buildErrorResponse('GSP provider name already exists', [
          {
            field: 'gspProviderName',
            message: 'Duplicate gspProviderName is not allowed',
          },
        ]),
      );
    }
  }

  private normalizeRequiredText(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must not be empty`,
        },
      ]);
    }

    return trimmed;
  }

  private normalizeIpAddress(value: string): string {
    const normalized = value.trim();
    if (!normalized || isIP(normalized) === 0) {
      this.throwBadRequest('Validation failed', [
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

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('GSP provider already exists', [
          {
            field: 'gspProviderCode',
            message: 'Duplicate GSP provider unique value is not allowed',
          },
        ]),
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private throwNotFound(gspProviderId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('GSP provider not found', [
        {
          field: 'gspProviderId',
          message: `No active GSP provider found with id ${gspProviderId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: GspProviderMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: GspProviderMasterErrorDetail[] = [],
  ): GspProviderMasterErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
