import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { GspCompanyService, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListGspCompanyServiceQueryDto } from './dto/list-gsp-company-service-query.dto';
import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import {
  GspCompanyServiceErrorDetail,
  GspCompanyServiceErrorResponse,
  GspCompanyServiceListItem,
  GspCompanyServiceListMeta,
  GspCompanyServicePayload,
} from './types/gsp-company-service-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const GSP_COMPANY_SERVICE_TABLE_NAME = 'gsp company service';
const GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME = 'GSP Company Service';
const GSP_COMPANY_SERVICE_GRID_ALIAS = 'gsp_company_service_grid';
const COMPANY_ID_KEYS = ['csgCompanyId', 'csg_company_id', 'companyId', 'company_id'] as const;
const PROVIDER_ID_KEYS = [
  'csgGspProviderId',
  'csg_gsp_provider_id',
  'providerId',
  'provider_id',
] as const;
const COMPANY_NAME_KEYS = ['companyName', 'company_name', 'compName', 'comp_name'] as const;
const PROVIDER_NAME_KEYS = [
  'providerName',
  'provider_name',
  'gspProviderName',
  'gsp_provider_name',
] as const;
type GspCompanyServiceWriteClient = Prisma.TransactionClient | PrismaService;
type GspCompanyServiceRecordWithCompany = Prisma.GspCompanyServiceGetPayload<{
  include: {
    company: {
      select: {
        compName: true;
      };
    };
  };
}>;
@Injectable()
export class GspCompanyServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(
    saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServicePayload> {
    if (saveGspCompanyServiceDto.csgCompanyServiceId) {
      return this.updateGspCompanyService(saveGspCompanyServiceDto);
    }
    return this.createGspCompanyService(saveGspCompanyServiceDto);
  }
  async list(
    queryDto: ListGspCompanyServiceQueryDto,
  ): Promise<ConfiguredGridListResult<GspCompanyServiceListItem, GspCompanyServiceListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const configuredList = await this.listFromConfiguredGridSql(queryDto, page, limit, skip);
    if (configuredList) {
      return configuredList;
    }
    const where: Prisma.GspCompanyServiceWhereInput = {
      csgIsDeleted: false,
    };
    if (queryDto.csgCompanyId !== undefined) {
      where.csgCompanyId = queryDto.csgCompanyId as string;
    }
    if (queryDto.csgGspProviderId !== undefined) {
      where.csgGspProviderId = queryDto.csgGspProviderId;
    }
    if (queryDto.csgServiceType?.trim()) {
      where.csgServiceType = queryDto.csgServiceType.trim();
    }
    if (queryDto.csgIsActive !== undefined) {
      where.csgIsActive = queryDto.csgIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { csgServiceType: { contains: search, mode: 'insensitive' } },
        { csgEuserName: { contains: search, mode: 'insensitive' } },
        { csgAuthToken: { contains: search, mode: 'insensitive' } },
        { company: { compName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [total, records, styles] = await Promise.all([
      this.prisma.gspCompanyService.count({ where }),
      this.prisma.gspCompanyService.findMany({
        where,
        include: {
          company: {
            select: {
              compName: true,
            },
          },
        },
        orderBy: [
          { csgCompanyId: 'asc' },
          { csgServiceType: 'asc' },
          { csgCompanyServiceId: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(GSP_COMPANY_SERVICE_TABLE_NAME),
    ]);
    const providerNameById = await this.loadProviderNameMap(records.map((record) => record.csgGspProviderId));
    return {
      items: records.map((record) => this.toPayload(record, providerNameById.get(record.csgGspProviderId) ?? null)),
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
    queryDto: ListGspCompanyServiceQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<GspCompanyServiceListItem, GspCompanyServiceListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      GSP_COMPANY_SERVICE_TABLE_NAME,
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
        tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const { sql: filteredSql, params } = this.buildConfiguredGridListSql(
          validation.normalizedSql,
          queryDto,
        );
        const result = await this.configuredGridSqlService.runPagedQuery<GspCompanyServiceListItem>({
          baseSql: filteredSql,
          alias: GSP_COMPANY_SERVICE_GRID_ALIAS,
          params,
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
  private buildConfiguredGridListSql(
    baseSql: string,
    queryDto: ListGspCompanyServiceQueryDto,
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (queryDto.csgCompanyId !== undefined) {
      conditions.push(
        this.buildJsonTextFilterCondition(
          params,
          COMPANY_ID_KEYS,
          queryDto.csgCompanyId,
        ),
      );
    }
    if (queryDto.csgGspProviderId !== undefined) {
      conditions.push(
        this.buildJsonTextFilterCondition(
          params,
          PROVIDER_ID_KEYS,
          queryDto.csgGspProviderId,
        ),
      );
    }
    if (queryDto.csgServiceType?.trim()) {
      conditions.push(
        this.buildJsonTextFilterCondition(
          params,
          ['csgServiceType', 'csg_service_type', 'serviceType', 'service_type'],
          queryDto.csgServiceType.trim(),
        ),
      );
    }
    if (queryDto.csgIsActive !== undefined) {
      conditions.push(
        this.buildJsonTextFilterCondition(
          params,
          ['csgIsActive', 'csg_is_active', 'isActive', 'is_active'],
          String(queryDto.csgIsActive),
          true,
        ),
      );
    }
    if (queryDto.search?.trim()) {
      params.push(`%${queryDto.search.trim()}%`);
      const searchParamIndex = params.length;
      conditions.push(
        `EXISTS (` +
          `SELECT 1 FROM jsonb_each_text(row_to_json(${GSP_COMPANY_SERVICE_GRID_ALIAS})::jsonb) AS grid_kv(key, value) ` +
          `WHERE grid_kv.value ILIKE $${searchParamIndex}` +
          `)`,
      );
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return {
      sql: `SELECT * FROM (${baseSql}) AS ${GSP_COMPANY_SERVICE_GRID_ALIAS}${whereClause}`,
      params,
    };
  }
  private buildJsonTextFilterCondition(
    params: unknown[],
    keys: readonly string[],
    value: string,
    caseInsensitive = false,
  ): string {
    params.push(Array.from(keys));
    const keysParamIndex = params.length;
    params.push(caseInsensitive ? value.toLowerCase() : value);
    const valueParamIndex = params.length;
    const comparison = caseInsensitive
      ? `LOWER(grid_kv.value) = $${valueParamIndex}`
      : `grid_kv.value = $${valueParamIndex}`;

    return (
      `EXISTS (` +
      `SELECT 1 FROM jsonb_each_text(row_to_json(${GSP_COMPANY_SERVICE_GRID_ALIAS})::jsonb) AS grid_kv(key, value) ` +
      `WHERE grid_kv.key = ANY($${keysParamIndex}::text[]) ` +
      `AND ${comparison}` +
      `)`
    );
  }
  async getById(csgCompanyServiceId: string): Promise<GspCompanyServicePayload> {
    const record = await this.prisma.gspCompanyService.findFirst({
      where: {
        csgCompanyServiceId,
        csgIsDeleted: false,
      },
      include: {
        company: {
          select: {
            compName: true,
          },
        },
      },
    });
    if (!record) {
      this.throwNotFound(csgCompanyServiceId);
    }
    const providerNameById = await this.loadProviderNameMap([record.csgGspProviderId]);
    return this.toPayload(record, providerNameById.get(record.csgGspProviderId) ?? null);
  }
  async softDelete(
    csgCompanyServiceId: string,
  ): Promise<{ csgCompanyServiceId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gspCompanyService.findFirst({
        where: {
          csgCompanyServiceId,
          csgIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(csgCompanyServiceId);
      }
      const modifiedOn = new Date();
      const result = await tx.gspCompanyService.updateMany({
        where: {
          csgCompanyServiceId,
          csgIsDeleted: false,
        },
        data: {
          csgIsDeleted: true,
          csgIsActive: false,
          csgModifiedOn: modifiedOn,
          csgModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(csgCompanyServiceId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        csgIsDeleted: true,
        csgIsActive: false,
        csgModifiedOn: modifiedOn,
        csgModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
          screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: csgCompanyServiceId,
          displayName: this.buildDisplayName(existing),
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'GSP company service soft deleted',
        },
        tx,
      );
      return {
        csgCompanyServiceId,
        deleted: true,
      };
    });
  }
  private async createGspCompanyService(
    saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServicePayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const csgServiceType = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgServiceType,
          'csgServiceType',
        );
        const csgEuserName = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserName,
          'csgEuserName',
        );
        const csgEuserPassword = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserPassword,
          'csgEuserPassword',
        );
        const csgAuthToken = this.normalizeNullableString(saveGspCompanyServiceDto.csgAuthToken);
        await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
        await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);
        const now = new Date();
        const data: Prisma.GspCompanyServiceUncheckedCreateInput = {
          csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
          csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
          csgServiceType,
          csgEuserName,
          csgEuserPassword,
          csgCreatedOn: now,
          csgCreatedBy: DEFAULT_ACTOR,
          csgModifiedOn: now,
          csgModifiedBy: DEFAULT_ACTOR,
        };
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthToken')) {
          data.csgAuthToken = csgAuthToken;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
          data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgIsActive')) {
          data.csgIsActive = saveGspCompanyServiceDto.csgIsActive;
        }
        const created = await tx.gspCompanyService.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
            screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.csgCompanyServiceId,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'GSP company service created',
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
  private async updateGspCompanyService(
    saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServicePayload> {
    const csgCompanyServiceId = saveGspCompanyServiceDto.csgCompanyServiceId!;
    try {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.gspCompanyService.findFirst({
          where: {
            csgCompanyServiceId,
            csgIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(csgCompanyServiceId);
        }
        const csgServiceType = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgServiceType,
          'csgServiceType',
        );
        const csgEuserName = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserName,
          'csgEuserName',
        );
        const csgEuserPassword = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserPassword,
          'csgEuserPassword',
        );
        const csgAuthToken = this.normalizeNullableString(saveGspCompanyServiceDto.csgAuthToken);
        await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
        await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);
        const data: Prisma.GspCompanyServiceUncheckedUpdateInput = {
          csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
          csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
          csgServiceType,
          csgEuserName,
          csgEuserPassword,
          csgModifiedOn: new Date(),
          csgModifiedBy: DEFAULT_ACTOR,
        };
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthToken')) {
          data.csgAuthToken = csgAuthToken;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
          data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgIsActive')) {
          data.csgIsActive = saveGspCompanyServiceDto.csgIsActive;
        }
        const updated = await tx.gspCompanyService.update({
          where: {
            csgCompanyServiceId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
            screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: csgCompanyServiceId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'GSP company service updated',
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
  private async ensureCompanyExists(
    companyId: string,
    tx: GspCompanyServiceWriteClient,
  ): Promise<void> {
    const company = await tx.company.findFirst({
      where: {
        compId: companyId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });
    if (!company) {
      this.throwBadRequest('Company does not exist', [
        {
          field: 'csgCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }
  private async ensureGspProviderExists(
    gspProviderId: string,
    tx: GspCompanyServiceWriteClient,
  ): Promise<void> {
    const provider = await tx.gspProviderMaster.findFirst({
      where: {
        gspProviderId,
        gspIsDeleted: false,
      },
      select: {
        gspProviderId: true,
      },
    });
    if (!provider) {
      this.throwBadRequest('GSP provider does not exist', [
        {
          field: 'csgGspProviderId',
          message: `No active GSP provider found with id ${gspProviderId}`,
        },
      ]);
    }
    }
  private normalizeRequiredString(value: string, field: string): string {
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
  private normalizeNullableString(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  private async loadProviderNameMap(
    providerIds: readonly string[],
  ): Promise<Map<string, string>> {
    const uniqueProviderIds = Array.from(
      new Set(providerIds.map((providerId) => providerId.trim()).filter(Boolean)),
    );
    if (uniqueProviderIds.length === 0) {
      return new Map<string, string>();
    }
    const providers = await this.prisma.gspProviderMaster.findMany({
      where: {
        gspProviderId: {
          in: uniqueProviderIds,
        },
      },
      select: {
        gspProviderId: true,
        gspProviderName: true,
      },
    });
    return new Map(
      providers.map((provider) => [provider.gspProviderId, provider.gspProviderName]),
    );
  }
  private async attachReferenceLabels(
    items: GspCompanyServiceListItem[],
  ): Promise<GspCompanyServiceListItem[]> {
    const rows = items.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
    if (rows.length === 0) {
      return items;
    }
    const companyIds = Array.from(
      new Set(rows.map((row) => this.readStringValue(row, COMPANY_ID_KEYS)).filter(Boolean) as string[]),
    );
    const providerIds = Array.from(
      new Set(rows.map((row) => this.readStringValue(row, PROVIDER_ID_KEYS)).filter(Boolean) as string[]),
    );
    const [companies, providerNameById] = await Promise.all([
      companyIds.length > 0
        ? this.prisma.company.findMany({
            where: {
              compId: {
                in: companyIds,
              },
            },
            select: {
              compId: true,
              compName: true,
            },
          })
        : Promise.resolve([]),
      this.loadProviderNameMap(providerIds),
    ]);
    const companyNameById = new Map(companies.map((company) => [company.compId, company.compName]));
    return items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return item;
      }
      const row = item as Record<string, unknown>;
      const companyId = this.readStringValue(row, COMPANY_ID_KEYS);
      const providerId = this.readStringValue(row, PROVIDER_ID_KEYS);
      const companyName =
        this.readStringValue(row, COMPANY_NAME_KEYS) ??
        (companyId ? companyNameById.get(companyId) ?? null : null);
      const providerName =
        this.readStringValue(row, PROVIDER_NAME_KEYS) ??
        (providerId ? providerNameById.get(providerId) ?? null : null);
      return {
        ...row,
        companyName,
        companyDisplay: this.buildReferenceDisplay(companyName, companyId),
        providerName,
        providerDisplay: this.buildReferenceDisplay(providerName, providerId),
      };
    });
  }
  private readStringValue(source: Record<string, unknown>, keys: readonly string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    return null;
  }
  private buildReferenceDisplay(name: string | null, id: string | null): string | null {
    if (name && id) {
      return `${name} (${id})`;
    }
    if (name) {
      return name;
    }
    return id;
  }
  private toPayload(
    record: GspCompanyService | GspCompanyServiceRecordWithCompany,
    providerName: string | null = null,
  ): GspCompanyServicePayload {
    const companyName = 'company' in record ? record.company?.compName ?? null : null;
    return {
      csgCompanyServiceId: record.csgCompanyServiceId,
      csgCompanyId: record.csgCompanyId,
      companyName,
      companyDisplay: this.buildReferenceDisplay(companyName, record.csgCompanyId),
      csgGspProviderId: record.csgGspProviderId,
      providerName,
      providerDisplay: this.buildReferenceDisplay(providerName, record.csgGspProviderId),
      csgServiceType: record.csgServiceType,
      csgEuserName: record.csgEuserName,
      csgEuserPassword: record.csgEuserPassword,
      csgAuthToken: record.csgAuthToken,
      csgAuthTokenValidTill: record.csgAuthTokenValidTill
        ? record.csgAuthTokenValidTill.toISOString()
        : null,
      csgIsActive: record.csgIsActive,
      csgIsDeleted: record.csgIsDeleted,
      csgSyncDate: record.csgSyncDate ? record.csgSyncDate.toISOString() : null,
      csgCreatedOn: record.csgCreatedOn.toISOString(),
      csgCreatedBy: record.csgCreatedBy,
      csgModifiedOn: record.csgModifiedOn.toISOString(),
      csgModifiedBy: record.csgModifiedBy,
    };
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('GSP company service already exists', [
          {
            field: 'csgCompanyServiceId',
            message: 'Duplicate GSP company service unique value is not allowed',
          },
        ]),
      );
    }
    if (this.isForeignKeyConstraintError(error)) {
      this.throwBadRequest('Invalid company or provider reference', [
        {
          field: 'csgCompanyId',
          message: 'Referenced company or provider does not exist',
        },
      ]);
    }
  }
  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2002';
  }
  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2003';
  }
  private throwNotFound(csgCompanyServiceId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('GSP company service not found', [
        {
          field: 'csgCompanyServiceId',
          message: `No active GSP company service found with id ${csgCompanyServiceId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: GspCompanyServiceErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: GspCompanyServiceErrorDetail[] = [],
  ): GspCompanyServiceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
  private buildDisplayName(record: GspCompanyService): string {
    return `${record.csgServiceType} (${record.csgEuserName})`;
  }
  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
