import { Injectable } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import {
  UnitErrorDetail,
  UnitListResult,
  UnitListItem,
  UnitPayload,
} from './types/unit-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { ConfiguredGridSqlService } from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { resolvePagination, runConfiguredGridQuery, runInventoryListQuery } from 'src/common/utils/module-list.utils';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';

const UNIT_TABLE_NAME = 'item_unit_master';
const UNIT_AUDIT_SCREEN_NAME = 'Units Master';
const LEGACY_UNIT_UUID_NUMERIC_COMPARISON_PATTERN =
  /\b(?:[a-z_][a-z0-9_$]*\s*\.\s*)?(unit_id|unit_base_unit_id)\s*=\s*[-+]?\d+\b/i;

@Injectable()
export class UnitsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    if (saveUnitDto.unit_id) {
      return this.updateUnit(saveUnitDto);
    }
    return this.createUnit(saveUnitDto);
  }

  async list(queryDto: ListUnitQueryDto): Promise<UnitListResult> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters =
      queryDto.unit_base_unit_id !== undefined ||
      queryDto.unit_is_active !== undefined;
    const where = this.buildListWhere(queryDto);
    return runInventoryListQuery<Unit, UnitListItem>({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery<UnitListItem>(
        this.configuredGridSqlService,
        {
          tableName: UNIT_TABLE_NAME,
          alias: 'unit_grid',
          search: queryDto.search,
          page,
          limit,
          skip,
          extraForbiddenPatterns: [
            {
              pattern: LEGACY_UNIT_UUID_NUMERIC_COMPARISON_PATTERN,
              message: 'Configured query compares unit UUID fields with numeric values',
            },
          ],
        },
      ),
      countFn: () => this.prisma.unit.count({ where }),
      findManyFn: () => this.prisma.unit.findMany({
        where,
        orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
        skip,
        take: limit,
      }),
      toItemFn: (record) => this.toPayload(record),
      loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(UNIT_TABLE_NAME),
    });
  }
  async getById(unitId: string): Promise<UnitPayload> {
    const record = await this.prisma.unit.findFirst({
      where: { unit_id: unitId, unit_is_deleted: false },
    });
    if (!record) {
      throwInventoryNotFound<UnitErrorDetail>('Unit not found', 'unit_id', `No active unit found with id ${unitId}`);
    }
    return this.toPayload(record);
  }

  async softDelete(unitId: string): Promise<{ unit_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.unit.findFirst({
        where: { unit_id: unitId, unit_is_deleted: false },
      });
      if (!existing) {
        throwInventoryNotFound<UnitErrorDetail>('Unit not found', 'unit_id', `No active unit found with id ${unitId}`);
      }

      const modifiedOn = new Date();
      const result = await tx.unit.updateMany({
        where: { unit_id: unitId, unit_is_deleted: false },
        data: { unit_is_deleted: true, unit_modified_on: modifiedOn, unit_modified_by: DEFAULT_ACTOR },
      });
      if (result.count === 0) {
        throwInventoryNotFound<UnitErrorDetail>('Unit not found', 'unit_id', `No active unit found with id ${unitId}`);
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

      return { unit_id: unitId, deleted: true };
    });
  }

  private async createUnit(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    const baseUnitId = hasOwnProperty(saveUnitDto, 'unit_base_unit_id')
      ? (saveUnitDto.unit_base_unit_id ?? null)
      : null;
    const conversion = hasOwnProperty(saveUnitDto, 'unit_conversion')
      ? (saveUnitDto.unit_conversion ?? null)
      : null;
    this.validateConversionRules(baseUnitId, conversion);
    const now = new Date();
    const createdBy = resolveActor(saveUnitDto.unit_created_by);
    const modifiedBy = resolveActor(saveUnitDto.unit_modified_by, createdBy);
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
          where: { unit_id: unitId, unit_is_deleted: false },
        });
        if (!existing) {
          throwInventoryNotFound<UnitErrorDetail>('Unit not found', 'unit_id', `No active unit found with id ${unitId}`);
        }
        const baseUnitId = hasOwnProperty(saveUnitDto, 'unit_base_unit_id')
          ? (saveUnitDto.unit_base_unit_id ?? null)
          : existing.unit_base_unit_id;
        const conversion = hasOwnProperty(saveUnitDto, 'unit_conversion')
          ? (saveUnitDto.unit_conversion ?? null)
          : toNullableNumber(existing.unit_conversion);
        if (baseUnitId !== null && baseUnitId === unitId) {
          throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
            { field: 'unit_base_unit_id', message: 'unit_base_unit_id cannot be same as unit_id' },
          ]);
        }
        this.validateConversionRules(baseUnitId, conversion);
        const data: Prisma.UnitUncheckedUpdateInput = {
          unit_name: saveUnitDto.unit_name.trim(),
          unit_modified_on: new Date(),
          unit_modified_by: resolveActor(saveUnitDto.unit_modified_by),
        };
        this.applyOptionalFields(data, saveUnitDto);
        const updated = await tx.unit.update({ where: { unit_id: unitId }, data });
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

  private buildListWhere(queryDto: ListUnitQueryDto): Prisma.UnitWhereInput {
    const where: Prisma.UnitWhereInput = { unit_is_deleted: false };

    if (queryDto.unit_base_unit_id !== undefined) where.unit_base_unit_id = queryDto.unit_base_unit_id;
    if (queryDto.unit_is_active !== undefined) where.unit_is_active = queryDto.unit_is_active;

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { unit_name: { contains: search, mode: 'insensitive' } },
        { unit_alias: { contains: search, mode: 'insensitive' } },
        { unit_code: { contains: search, mode: 'insensitive' } },
        { unit_description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private validateConversionRules(baseUnitId: string | null, conversion: number | null): void {
    if (baseUnitId !== null) {
      if (conversion === null || conversion === undefined) {
        throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
          { field: 'unit_conversion', message: 'unit_conversion is required when unit_base_unit_id is set' },
        ]);
      }
      if (Number(conversion) <= 0) {
        throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
          { field: 'unit_conversion', message: 'unit_conversion must be greater than 0' },
        ]);
      }
    }
  }

  private applyOptionalFields(
    data: Prisma.UnitUncheckedCreateInput | Prisma.UnitUncheckedUpdateInput,
    saveUnitDto: SaveUnitDto,
  ): void {
    if (hasOwnProperty(saveUnitDto, 'unit_alias')) data.unit_alias = saveUnitDto.unit_alias;
    if (hasOwnProperty(saveUnitDto, 'unit_code')) data.unit_code = saveUnitDto.unit_code;
    if (hasOwnProperty(saveUnitDto, 'unit_description')) data.unit_description = saveUnitDto.unit_description;
    if (hasOwnProperty(saveUnitDto, 'unit_decimal_count')) data.unit_decimal_count = saveUnitDto.unit_decimal_count;
    if (hasOwnProperty(saveUnitDto, 'unit_weight')) data.unit_weight = saveUnitDto.unit_weight;
    if (hasOwnProperty(saveUnitDto, 'unit_loading')) data.unit_loading = saveUnitDto.unit_loading;
    if (hasOwnProperty(saveUnitDto, 'unit_unloading')) data.unit_unloading = saveUnitDto.unit_unloading;
    if (hasOwnProperty(saveUnitDto, 'unit_attach_charge')) data.unit_attach_charge = saveUnitDto.unit_attach_charge;
    if (hasOwnProperty(saveUnitDto, 'unit_is_pack_unit')) data.unit_is_pack_unit = saveUnitDto.unit_is_pack_unit;
    if (hasOwnProperty(saveUnitDto, 'unit_base_unit_id')) data.unit_base_unit_id = saveUnitDto.unit_base_unit_id;
    if (hasOwnProperty(saveUnitDto, 'unit_conversion')) data.unit_conversion = saveUnitDto.unit_conversion;
    if (hasOwnProperty(saveUnitDto, 'unit_is_active')) data.unit_is_active = saveUnitDto.unit_is_active;
  }

  private toPayload(record: Unit): UnitPayload {
    return {
      unit_id: record.unit_id,
      unit_name: record.unit_name,
      unit_alias: record.unit_alias,
      unit_code: record.unit_code,
      unit_description: record.unit_description,
      unit_decimal_count: record.unit_decimal_count,
      unit_weight: toNullableNumber(record.unit_weight),
      unit_loading: toNullableNumber(record.unit_loading),
      unit_unloading: toNullableNumber(record.unit_unloading),
      unit_attach_charge: toNullableNumber(record.unit_attach_charge),
      unit_is_pack_unit: record.unit_is_pack_unit,
      unit_base_unit_id: record.unit_base_unit_id,
      unit_conversion: toNullableNumber(record.unit_conversion),
      unit_is_active: record.unit_is_active,
      unit_is_deleted: record.unit_is_deleted,
      unit_sync_date: record.unit_sync_date ? record.unit_sync_date.toISOString() : null,
      unit_created_on: record.unit_created_on.toISOString(),
      unit_created_by: record.unit_created_by,
      unit_modified_on: record.unit_modified_on.toISOString(),
      unit_modified_by: record.unit_modified_by,
    };
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<UnitErrorDetail>(error, 'Unit name already exists', [
      { field: 'unit_name', message: 'Duplicate unit_name is not allowed' },
    ]);
  }

}
