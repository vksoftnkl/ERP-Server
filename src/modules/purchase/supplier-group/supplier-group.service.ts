import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Prisma, SupplierGroup } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListSupplierGroupQueryDto } from './dto/list-supplier-group-query.dto';
import { SaveSupplierGroupDto } from './dto/save-supplier-group.dto';
import {
  SupplierGroupErrorDetail,
  SupplierGroupErrorResponse,
  SupplierGroupListItem,
  SupplierGroupListMeta,
  SupplierGroupPayload,
} from './types/supplier-group-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const SUPPLIER_GROUP_TABLE_NAME = 'supplier_groups';
const SUPPLIER_GROUP_AUDIT_SCREEN_NAME = 'Supplier Group Master';
type SupplierGroupWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class SupplierGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveSupplierGroupDto: SaveSupplierGroupDto): Promise<SupplierGroupPayload> {
    if (saveSupplierGroupDto.spgId) {
      return this.updateSupplierGroup(saveSupplierGroupDto);
    }
    return this.createSupplierGroup(saveSupplierGroupDto);
  }
  async list(
    queryDto: ListSupplierGroupQueryDto,
  ): Promise<ConfiguredGridListResult<SupplierGroupListItem, SupplierGroupListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.spgIsActive !== undefined || Boolean(queryDto.search?.trim());
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.SupplierGroupWhereInput = {
      spgIsDeleted: false,
    };
    if (queryDto.spgIsActive !== undefined) {
      where.spgIsActive = queryDto.spgIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { spgName: { contains: search, mode: 'insensitive' } },
        { spgAlias: { contains: search, mode: 'insensitive' } },
        { spgShort: { contains: search, mode: 'insensitive' } },
        { spgDesc: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.supplierGroup.count({ where }),
      this.prisma.supplierGroup.findMany({
        where,
        orderBy: [{ spgName: 'asc' }, { spgId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<SupplierGroupListItem, SupplierGroupListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: SUPPLIER_GROUP_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      SUPPLIER_GROUP_TABLE_NAME,
    );
    const configuredGrid = primaryConfiguredGrids[0];
    if (!configuredGrid) {
      return null;
    }
    const rawGridSql = configuredGrid.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }
    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: rawGridSql,
      tableName: SUPPLIER_GROUP_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for supplier group list', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }
    try {
      const result = await this.configuredGridSqlService.runPagedQuery<SupplierGroupListItem>({
        baseSql: validation.normalizedSql,
        alias: 'supplier_group_grid',
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
      this.throwBadRequest('Invalid grid_sql configuration for supplier group list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for supplier_groups',
        },
      ]);
    }
  }
  async getById(spgId: string): Promise<SupplierGroupPayload> {
    const record = await this.prisma.supplierGroup.findFirst({
      where: {
        spgId,
        spgIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(spgId);
    }
    return this.toPayload(record);
  }
  async softDelete(spgId: string): Promise<{ spgId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.supplierGroup.findFirst({
        where: {
          spgId,
          spgIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(spgId);
      }
      const supplierCount = await tx.supplier.count({
        where: {
          supGroupId: spgId,
          supIsDeleted: false,
        },
      });
      if (supplierCount > 0) {
        this.throwBadRequest('Cannot delete supplier group with active suppliers', [
          {
            field: 'spgId',
            message: `Supplier group ${spgId} is used by ${supplierCount} supplier(s).`,
          },
        ]);
      }
      const modifiedOn = new Date();
      const result = await tx.supplierGroup.updateMany({
        where: {
          spgId,
          spgIsDeleted: false,
        },
        data: {
          spgIsDeleted: true,
          spgIsActive: false,
          spgModifiedOn: modifiedOn,
          spgModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(spgId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        spgIsDeleted: true,
        spgIsActive: false,
        spgModifiedOn: modifiedOn,
        spgModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SUPPLIER_GROUP_TABLE_NAME,
          screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: spgId,
          displayName: existing.spgName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Supplier group soft deleted',
        },
        tx,
      );
      return {
        spgId,
        deleted: true,
      };
    });
    }
  private async createSupplierGroup(
    saveSupplierGroupDto: SaveSupplierGroupDto,
  ): Promise<SupplierGroupPayload> {
    const now = new Date();
    const createdBy = this.resolveActor(saveSupplierGroupDto.spgCreatedBy);
    const modifiedBy = this.resolveActor(saveSupplierGroupDto.spgModifiedBy, createdBy);
    const normalizedName = this.normalizeRequiredName(saveSupplierGroupDto.spgName);
    const data: Prisma.SupplierGroupUncheckedCreateInput = {
      spgName: normalizedName,
      spgCreatedOn: now,
      spgCreatedBy: createdBy,
      spgModifiedOn: now,
      spgModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveSupplierGroupDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureNameIsUnique(tx, normalizedName);
        const created = await tx.supplierGroup.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SUPPLIER_GROUP_TABLE_NAME,
            screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.spgId,
            displayName: payload.spgName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Supplier group created',
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
  private async updateSupplierGroup(
    saveSupplierGroupDto: SaveSupplierGroupDto,
  ): Promise<SupplierGroupPayload> {
    const spgId = saveSupplierGroupDto.spgId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supplierGroup.findFirst({
          where: {
            spgId,
            spgIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(spgId);
        }
        const normalizedName = this.normalizeRequiredName(saveSupplierGroupDto.spgName);
        await this.ensureNameIsUnique(tx, normalizedName, spgId);
        const data: Prisma.SupplierGroupUncheckedUpdateInput = {
          spgName: normalizedName,
          spgModifiedOn: new Date(),
          spgModifiedBy: this.resolveActor(saveSupplierGroupDto.spgModifiedBy),
        };
        this.applyOptionalFields(data, saveSupplierGroupDto);
        const updated = await tx.supplierGroup.update({
          where: {
            spgId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SUPPLIER_GROUP_TABLE_NAME,
            screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: spgId,
            displayName: payload.spgName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.spgModifiedBy,
            notes: 'Supplier group updated',
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
  private async ensureNameIsUnique(
    tx: SupplierGroupWriteClient,
    groupName: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.supplierGroup.findFirst({
      where: {
        spgIsDeleted: false,
        spgName: {
          equals: groupName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              spgId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        spgId: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Supplier group name already exists', [
          {
            field: 'spgName',
            message: 'Duplicate supplier group name is not allowed',
          },
        ]),
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.SupplierGroupUncheckedCreateInput | Prisma.SupplierGroupUncheckedUpdateInput,
    saveSupplierGroupDto: SaveSupplierGroupDto,
  ): void {
    if (this.hasOwnProperty(saveSupplierGroupDto, 'spgAlias')) {
      data.spgAlias = saveSupplierGroupDto.spgAlias;
    }
    if (this.hasOwnProperty(saveSupplierGroupDto, 'spgShort')) {
      data.spgShort = saveSupplierGroupDto.spgShort;
    }
    if (this.hasOwnProperty(saveSupplierGroupDto, 'spgDesc')) {
      data.spgDesc = saveSupplierGroupDto.spgDesc;
    }
    if (this.hasOwnProperty(saveSupplierGroupDto, 'spgIsActive')) {
      data.spgIsActive = saveSupplierGroupDto.spgIsActive;
    }
  }
  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'spgName',
          message: 'spgName must not be empty',
        },
      ]);
    }
    return trimmed;
  }
  private toPayload(record: SupplierGroup): SupplierGroupPayload {
    return {
      spgId: record.spgId,
      spgName: record.spgName,
      spgAlias: record.spgAlias,
      spgShort: record.spgShort,
      spgDesc: record.spgDesc,
      spgIsActive: record.spgIsActive,
      spgIsDeleted: record.spgIsDeleted,
      spgSyncDate: record.spgSyncDate ? record.spgSyncDate.toISOString() : null,
      spgCreatedOn: record.spgCreatedOn.toISOString(),
      spgCreatedBy: record.spgCreatedBy,
      spgModifiedOn: record.spgModifiedOn.toISOString(),
      spgModifiedBy: record.spgModifiedBy,
    };
  }
  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Supplier group name already exists', [
          {
            field: 'spgName',
            message: 'Duplicate supplier group name is not allowed',
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
  private throwNotFound(spgId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Supplier group not found', [
        {
          field: 'spgId',
          message: `No active supplier group found with id ${spgId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: SupplierGroupErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: SupplierGroupErrorDetail[] = [],
  ): SupplierGroupErrorResponse {
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
