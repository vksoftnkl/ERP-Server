import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import {
  UnitErrorDetail,
  UnitErrorResponse,
  UnitListItem,
  UnitListMeta,
  UnitPayload,
} from './types/unit-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const UNIT_TABLE_NAME = 'units';
const UNIT_AUDIT_SCREEN_NAME = 'Units Master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;
@Injectable()
export class UnitsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}
  async save(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    if (saveUnitDto.unit_id) {
      return this.updateUnit(saveUnitDto);
    }
    return this.createUnit(saveUnitDto);
  }
  async list(queryDto: ListUnitQueryDto): Promise<{ items: UnitListItem[]; meta: UnitListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.unit_base_unit_id !== undefined ||
      queryDto.unit_is_active !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.UnitWhereInput = {
      unit_is_deleted: false,
    };
    if (queryDto.unit_base_unit_id !== undefined) {
      where.unit_base_unit_id = queryDto.unit_base_unit_id;
    }
    if (queryDto.unit_is_active !== undefined) {
      where.unit_is_active = queryDto.unit_is_active;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { unit_name: { contains: search, mode: 'insensitive' } },
        { unit_alias: { contains: search, mode: 'insensitive' } },
        { unit_code: { contains: search, mode: 'insensitive' } },
        { unit_description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.unit.count({ where }),
      this.prisma.unit.findMany({
        where,
        orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
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
  ): Promise<{ items: UnitListItem[]; meta: UnitListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: UNIT_TABLE_NAME,
          mode: 'insensitive',
        },
      },
      orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
      select: {
        gridSql: true,
      },
    });
    const rawGridSql = configuredGrid?.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }
    try {
      const baseSql = this.validateConfiguredGridSql(rawGridSql);
      const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS unit_grid`;
      const rowsSql = `SELECT * FROM (${baseSql}) AS unit_grid LIMIT $1 OFFSET $2`;
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql),
        this.prisma.$queryRawUnsafe<UnitListItem[]>(rowsSql, limit, skip),
      ]);
      const total = this.parseCountValue(countResult[0]?.total);
      return {
        items: rows,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch {
      // If configured grid_sql is invalid, fall back to standard list query.
      return null;
    }
  }
  private validateConfiguredGridSql(sql: string): string {
    const normalized = sql.trim().replace(/;+\s*$/g, '');
    if (!/^select\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for unit list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }
    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for unit list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }
    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for unit list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }
    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for unit list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }
    if (!/\bunits\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for unit list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference units table',
        },
      ]);
    }
    return normalized;
  }
  private parseCountValue(value: bigint | number | string | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  async getById(unitId: string): Promise<UnitPayload> {
    const record = await this.prisma.unit.findFirst({
      where: {
        unit_id: unitId,
        unit_is_deleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(unitId);
    }
    return this.toPayload(record);
  }
  async softDelete(unitId: string): Promise<{ unit_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.unit.findFirst({
        where: {
          unit_id: unitId,
          unit_is_deleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(unitId);
      }

      const modifiedOn = new Date();
      const result = await tx.unit.updateMany({
        where: {
          unit_id: unitId,
          unit_is_deleted: false,
        },
        data: {
          unit_is_deleted: true,
          unit_modified_on: modifiedOn,
          unit_modified_by: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(unitId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        unit_is_deleted: true,
        unit_modified_on: modifiedOn,
        unit_modified_by: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: UNIT_TABLE_NAME,
          screenName: UNIT_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: unitId,
          displayName: existing.unit_name,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Unit soft deleted',
        },
        tx,
      );

      return {
        unit_id: unitId,
        deleted: true,
      };
    });
  }
  private async createUnit(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    const baseUnitId = this.hasOwnProperty(saveUnitDto, 'unit_base_unit_id')
      ? (saveUnitDto.unit_base_unit_id ?? null)
      : null;
    const conversion = this.hasOwnProperty(saveUnitDto, 'unit_conversion')
      ? (saveUnitDto.unit_conversion ?? null)
      : null;
    this.validateConversionRules(baseUnitId, conversion);
    const now = new Date();
    const createdBy = this.resolveActor(saveUnitDto.unit_created_by);
    const modifiedBy = this.resolveActor(saveUnitDto.unit_modified_by, createdBy);
    const data: Prisma.UnitUncheckedCreateInput = {
      unit_name: saveUnitDto.unit_name.trim(),
      unit_created_on: now,
      unit_created_by: createdBy,
      unit_modified_on: now,
      unit_modified_by: modifiedBy,
    };
    this.applyOptionalFields(data, saveUnitDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.unit.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: UNIT_TABLE_NAME,
            screenName: UNIT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.unit_id,
            displayName: payload.unit_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Unit created',
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
  private async updateUnit(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    const unitId = saveUnitDto.unit_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.unit.findFirst({
          where: {
            unit_id: unitId,
            unit_is_deleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(unitId);
        }
        const baseUnitId = this.hasOwnProperty(saveUnitDto, 'unit_base_unit_id')
          ? (saveUnitDto.unit_base_unit_id ?? null)
          : existing.unit_base_unit_id;
        const conversion = this.hasOwnProperty(saveUnitDto, 'unit_conversion')
          ? (saveUnitDto.unit_conversion ?? null)
          : this.toNullableNumber(existing.unit_conversion);
        if (baseUnitId !== null && baseUnitId === unitId) {
          this.throwBadRequest('Validation error', [
            {
              field: 'unit_base_unit_id',
              message: 'unit_base_unit_id cannot be same as unit_id',
            },
          ]);
        }
        this.validateConversionRules(baseUnitId, conversion);
        const data: Prisma.UnitUncheckedUpdateInput = {
          unit_name: saveUnitDto.unit_name.trim(),
          unit_modified_on: new Date(),
          unit_modified_by: this.resolveActor(saveUnitDto.unit_modified_by),
        };
        this.applyOptionalFields(data, saveUnitDto);
        const updated = await tx.unit.update({
          where: {
            unit_id: unitId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: UNIT_TABLE_NAME,
            screenName: UNIT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: unitId,
            displayName: payload.unit_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.unit_modified_by,
            notes: 'Unit updated',
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
  private validateConversionRules(baseUnitId: string | null, conversion: number | null): void {
    if (baseUnitId !== null) {
      if (conversion === null || conversion === undefined) {
        this.throwBadRequest('Validation error', [
          {
            field: 'unit_conversion',
            message: 'unit_conversion is required when unit_base_unit_id is set',
          },
        ]);
      }
      if (Number(conversion) <= 0) {
        this.throwBadRequest('Validation error', [
          {
            field: 'unit_conversion',
            message: 'unit_conversion must be greater than 0',
          },
        ]);
      }
    }
  }
  private applyOptionalFields(
    data: Prisma.UnitUncheckedCreateInput | Prisma.UnitUncheckedUpdateInput,
    saveUnitDto: SaveUnitDto,
  ): void {
    if (this.hasOwnProperty(saveUnitDto, 'unit_alias')) {
      data.unit_alias = saveUnitDto.unit_alias;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_code')) {
      data.unit_code = saveUnitDto.unit_code;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_description')) {
      data.unit_description = saveUnitDto.unit_description;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_decimal_count')) {
      data.unit_decimal_count = saveUnitDto.unit_decimal_count;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_weight')) {
      data.unit_weight = saveUnitDto.unit_weight;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_loading')) {
      data.unit_loading = saveUnitDto.unit_loading;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_unloading')) {
      data.unit_unloading = saveUnitDto.unit_unloading;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_attach_charge')) {
      data.unit_attach_charge = saveUnitDto.unit_attach_charge;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_is_pack_unit')) {
      data.unit_is_pack_unit = saveUnitDto.unit_is_pack_unit;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_base_unit_id')) {
      data.unit_base_unit_id = saveUnitDto.unit_base_unit_id;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_conversion')) {
      data.unit_conversion = saveUnitDto.unit_conversion;
    }
    if (this.hasOwnProperty(saveUnitDto, 'unit_is_active')) {
      data.unit_is_active = saveUnitDto.unit_is_active;
    }
  }
  private toPayload(record: Unit): UnitPayload {
    return {
      unit_id: record.unit_id,
      unit_name: record.unit_name,
      unit_alias: record.unit_alias,
      unit_code: record.unit_code,
      unit_description: record.unit_description,
      unit_decimal_count: record.unit_decimal_count,
      unit_weight: this.toNullableNumber(record.unit_weight),
      unit_loading: this.toNullableNumber(record.unit_loading),
      unit_unloading: this.toNullableNumber(record.unit_unloading),
      unit_attach_charge: this.toNullableNumber(record.unit_attach_charge),
      unit_is_pack_unit: record.unit_is_pack_unit,
      unit_base_unit_id: record.unit_base_unit_id,
      unit_conversion: this.toNullableNumber(record.unit_conversion),
      unit_is_active: record.unit_is_active,
      unit_is_deleted: record.unit_is_deleted,
      unit_sync_date: record.unit_sync_date ? record.unit_sync_date.toISOString() : null,
      unit_created_on: record.unit_created_on.toISOString(),
      unit_created_by: record.unit_created_by,
      unit_modified_on: record.unit_modified_on.toISOString(),
      unit_modified_by: record.unit_modified_by,
    };
  }
  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value.toString());
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
        this.buildErrorResponse('Unit name already exists', [
          {
            field: 'unit_name',
            message: 'Duplicate unit_name is not allowed',
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
  private throwNotFound(unitId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Unit not found', [
        {
          field: 'unit_id',
          message: `No active unit found with id ${unitId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: UnitErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(message: string, errors: UnitErrorDetail[] = []): UnitErrorResponse {
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
