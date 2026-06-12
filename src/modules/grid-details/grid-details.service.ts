import { Injectable } from '@nestjs/common';
import { GridColumn, GridDetails, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ListGridDetailQueryDto } from './dto/list-grid-detail-query.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import { SaveGridColumnDto } from './dto/save-grid-column.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import {
  GridColumnPayload,
  GridDetailErrorDetail,
  GridDetailErrorResponse,
  GridDetailListItem,
  GridDetailPayload,
} from './types/grid-detail-api.types';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  hasOwnProperty,
  throwFixedBadRequest,
  throwFixedNotFound,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';

const GRID_DETAIL_TABLE_NAME = 'grid details';
const GRID_COLUMN_TABLE_NAME = 'grid column';
const GRID_DETAIL_AUDIT_SCREEN_NAME = 'Grid Details';

type GridDetailsWithColumns = GridDetails & { columns: GridColumn[] };

@Injectable()
export class GridDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) { }

  async save(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailPayload> {
    return saveGridDetailDto.grid_id
      ? this.updateGridDetails(saveGridDetailDto)
      : this.createGridDetails(saveGridDetailDto);
  }

  async list(queryDto: ListGridDetailQueryDto): Promise<{ items: GridDetailListItem[] }> {
    const requestedGridId = queryDto.gridId ?? queryDto.grid_id;
    const fixedGridId = requestedGridId ? BigInt(requestedGridId) : undefined;
    const search = queryDto.search?.trim();
    const where: Prisma.GridDetailsWhereInput = {
      gridIsDeleted: false,
      ...(fixedGridId !== undefined ? { gridId: fixedGridId } : {}),
      ...(search
        ? {
          OR: [
            { gridName: { contains: search, mode: 'insensitive' } },
            { gridDescription: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const records = await this.prisma.gridDetails.findMany({
      where,
      orderBy: [{ gridSortOrder: 'asc' }, { gridName: 'asc' }],
      include: {
        columns: {
          where: { gridColumnIsDeleted: false },
          orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
        },
      },
    }) as unknown as GridDetailsWithColumns[];

    return { items: records.map((record) => this.toPayload(record)) };
  }

  async updateColumnWidths(dto: SaveColumnWidthDto): Promise<{ updated: number }> {
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const serialId = this.parseUuidId('grid_column_id', item.grid_column_id);
        const existing = await tx.gridColumn.findFirst({
          where: { gridColumnId: serialId, gridColumnIsDeleted: false },
          select: { gridColumnId: true },
        });
        if (!existing) {
          throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
            'Grid column not found',
            'grid_column_id',
            `No active grid column found with id ${item.grid_column_id}`,
          );
        }
        await tx.gridColumn.update({
          where: { gridColumnId: serialId },
          data: { gridColumnWidth: item.grid_column_width },
        });
        count++;
      }
    });
    return { updated: count };
  }

  async updateFilterSettings(dto: SaveFilterSettingsDto): Promise<{ updated: number }> {
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const serialId = this.parseUuidId('grid_column_id', item.grid_column_id);
        const existing = await tx.gridColumn.findFirst({
          where: { gridColumnId: serialId, gridColumnIsDeleted: false },
          select: { gridColumnId: true },
        });
        if (!existing) {
          throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
            'Grid column not found',
            'grid_column_id',
            `No active grid column found with id ${item.grid_column_id}`,
          );
        }
        await tx.gridColumn.update({
          where: { gridColumnId: serialId },
          data: { gridColumnFilter: item.grid_column_filter },
        });
        count++;
      }
    });
    return { updated: count };
  }

  async updateVisibilitySettings(dto: SaveVisibilitySettingsDto): Promise<{ updated: number }> {
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const serialId = this.parseUuidId('grid_column_id', item.grid_column_id);
        const existing = await tx.gridColumn.findFirst({
          where: { gridColumnId: serialId, gridColumnIsDeleted: false },
          select: { gridColumnId: true },
        });
        if (!existing) {
          throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
            'Grid column not found',
            'grid_column_id',
            `No active grid column found with id ${item.grid_column_id}`,
          );
        }
        await tx.gridColumn.update({
          where: { gridColumnId: serialId },
          data: { gridColumnVisibility: item.grid_column_visibility },
        });
        count++;
      }
    });
    return { updated: count };
  }

  async getById(gridId: string): Promise<GridDetailPayload> {
    const parsedGridId = this.parseBigIntId('grid_id', gridId);
    const record = await this.prisma.gridDetails.findFirst({
      where: { gridId: parsedGridId, gridIsDeleted: false },
      include: {
        columns: {
          where: { gridColumnIsDeleted: false },
          orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
        },
      },
    });
    if (!record) {
      throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
        'Grid details not found',
        'grid_id',
        `No active grid details found with id ${gridId}`,
      );
    }
    return this.toPayload(record as GridDetailsWithColumns);
  }

  async softDelete(gridId: string): Promise<{ grid_id: string; deleted: true }> {
    const parsedGridId = this.parseBigIntId('grid_id', gridId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridDetails.findFirst({
        where: { gridId: parsedGridId, gridIsDeleted: false },
      });

      if (!existing) {
        throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
          'Grid details not found',
          'grid_id',
          `No active grid details found with id ${gridId}`,
        );
      }

      const result = await tx.gridDetails.updateMany({
        where: { gridId: parsedGridId, gridIsDeleted: false },
        data: { gridIsDeleted: true, gridStatus: false },
      });

      if (result.count === 0) {
        throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
          'Grid details not found',
          'grid_id',
          `No active grid details found with id ${gridId}`,
        );
      }

      await tx.gridColumn.updateMany({
        where: { gridId: parsedGridId, gridColumnIsDeleted: false },
        data: { gridColumnIsDeleted: true },
      });

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: GRID_DETAIL_TABLE_NAME,
          screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: gridId,
          displayName: existing!.gridName ?? `Grid ${gridId}`,
          originalRecord: this.toPayload({ ...existing!, columns: [] }),
          modifiedRecord: this.toPayload({ ...existing!, gridIsDeleted: true, gridStatus: false, columns: [] }),
          userId: actor,
          notes: 'Grid details soft deleted',
        },
        tx,
      );

      return { grid_id: gridId, deleted: true };
    });
  }

  async softDeleteColumn(grid_column_id: string): Promise<{ grid_column_id: string; deleted: true }> {
    const parsedSerialId = this.parseUuidId('grid_column_id', grid_column_id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridColumn.findFirst({
        where: { gridColumnId: parsedSerialId, gridColumnIsDeleted: false },
      });

      if (!existing) {
        throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
          'Grid column not found',
          'grid_column_id',
          `No active grid column found with id ${grid_column_id}`,
        );
      }

      await tx.gridColumn.update({
        where: { gridColumnId: parsedSerialId },
        data: { gridColumnIsDeleted: true },
      });

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: GRID_COLUMN_TABLE_NAME,
          screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: grid_column_id,
          displayName: existing.gridColumnName ?? `Grid column ${grid_column_id}`,
          originalRecord: this.toColumnPayload(existing),
          modifiedRecord: this.toColumnPayload({ ...existing, gridColumnIsDeleted: true }),
          userId: actor,
          notes: 'Grid column soft deleted',
        },
        tx,
      );

      return { grid_column_id: grid_column_id, deleted: true };
    });
  }

  private async createGridDetails(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailPayload> {
    const data: Prisma.GridDetailsUncheckedCreateInput = {
      gridName: saveGridDetailDto.grid_name.trim(),
    };
    await this.applyOptionalGridFields(data, saveGridDetailDto);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.gridDetails.create({ data });
      if (saveGridDetailDto.grid_columns?.length) {
        await this.saveColumnsInTx(saveGridDetailDto.grid_columns, created.gridId, tx);
      }
      const full = await tx.gridDetails.findFirstOrThrow({
        where: { gridId: created.gridId },
        include: {
          columns: {
            where: { gridColumnIsDeleted: false },
            orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
          },
        },
      });
      const payload = this.toPayload(full as GridDetailsWithColumns);
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: GRID_DETAIL_TABLE_NAME,
          screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: payload.grid_id,
          displayName: payload.grid_name,
          originalRecord: null,
          modifiedRecord: payload,
          userId: actor,
          notes: 'Grid details created',
        },
        tx,
      );
      return payload;
    });
  }

  private async updateGridDetails(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailPayload> {
    const gridId = saveGridDetailDto.grid_id!;
    const parsedGridId = this.parseBigIntId('grid_id', gridId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridDetails.findFirst({
        where: { gridId: parsedGridId, gridIsDeleted: false },
      });

      if (!existing) {
        throwFixedNotFound<GridDetailErrorDetail, GridDetailErrorResponse>(
          'Grid details not found',
          'grid_id',
          `No active grid details found with id ${gridId}`,
        );
      }

      const data: Prisma.GridDetailsUncheckedUpdateInput = {
        gridName: saveGridDetailDto.grid_name.trim(),
      };
      await this.applyOptionalGridFields(data, saveGridDetailDto);
      await tx.gridDetails.update({ where: { gridId: parsedGridId }, data });

      if (saveGridDetailDto.grid_columns !== undefined) {
        await this.saveColumnsInTx(saveGridDetailDto.grid_columns, parsedGridId, tx);
        if (saveGridDetailDto.replace_columns === true) {
          const keptIds = saveGridDetailDto.grid_columns
            .filter((col) => !!col.grid_column_id)
            .map((col) => this.parseUuidId('grid_column_id', col.grid_column_id!));
          await tx.gridColumn.updateMany({
            where: {
              gridId: parsedGridId,
              gridColumnIsDeleted: false,
              ...(keptIds.length > 0 ? { gridColumnId: { notIn: keptIds } } : {}),
            },
            data: { gridColumnIsDeleted: true },
          });
        }
      }

      const full = await tx.gridDetails.findFirstOrThrow({
        where: { gridId: parsedGridId },
        include: {
          columns: {
            where: { gridColumnIsDeleted: false },
            orderBy: [{ gridColumnNumber: 'asc' }, { gridColumnId: 'asc' }],
          },
        },
      });
      const payload = this.toPayload(full as GridDetailsWithColumns);
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: GRID_DETAIL_TABLE_NAME,
          screenName: GRID_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: gridId,
          displayName: payload.grid_name,
          originalRecord: this.toPayload({ ...existing!, columns: [] }),
          modifiedRecord: payload,
          userId: actor,
          notes: 'Grid details updated',
        },
        tx,
      );
      return payload;
    });
  }

  private async saveColumnsInTx(
    columns: SaveGridColumnDto[],
    gridId: bigint,
    tx: FixedWriteClient,
  ): Promise<void> {
    for (const colDto of columns) {
      await this.upsertColumnInTx(colDto, gridId, tx);
    }
  }

  private async upsertColumnInTx(
    colDto: SaveGridColumnDto,
    gridId: bigint,
    tx: FixedWriteClient,
  ): Promise<void> {
    const normalizedName = colDto.grid_column_name?.trim();
    if (!normalizedName) {
      throwFixedBadRequest<GridDetailErrorDetail, GridDetailErrorResponse>(
        'Validation failed',
        [{ field: 'grid_column_name', message: 'grid_column_name must not be empty' }],
      );
    }

    if (colDto.grid_column_id) {
      const parsedId = this.parseUuidId('grid_column_id', colDto.grid_column_id);
      const colData: Prisma.GridColumnUncheckedUpdateInput = {
        gridColumnName: normalizedName,
        gridId,
        gridColumnNumber: colDto.grid_column_number,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.gridColumn.update({ where: { gridColumnId: parsedId }, data: colData });
    } else {
      const colData: Prisma.GridColumnUncheckedCreateInput = {
        gridColumnName: normalizedName,
        gridId,
        gridColumnNumber: colDto.grid_column_number,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.gridColumn.create({ data: colData });
    }
  }

  private applyOptionalColumnFields(
    data: Prisma.GridColumnUncheckedCreateInput | Prisma.GridColumnUncheckedUpdateInput,
    dto: SaveGridColumnDto,
  ): void {
    if (hasOwnProperty(dto, 'grid_column_width')) data.gridColumnWidth = dto.grid_column_width;
    if (hasOwnProperty(dto, 'grid_column_position')) data.gridColumnPosition = dto.grid_column_position;
    if (hasOwnProperty(dto, 'grid_column_alignment')) data.gridColumnAlignment = dto.grid_column_alignment;
    if (hasOwnProperty(dto, 'grid_column_visibility')) data.gridColumnVisibility = dto.grid_column_visibility;
    if (hasOwnProperty(dto, 'grid_column_filter')) data.gridColumnFilter = dto.grid_column_filter;
    if (hasOwnProperty(dto, 'grid_column_condition')) data.gridColumnCondition = dto.grid_column_condition;
    if (hasOwnProperty(dto, 'grid_column_condition_color')) data.gridColumnConditionColor = dto.grid_column_condition_color;
    if (hasOwnProperty(dto, 'grid_column_group')) data.gridColumnGroup = dto.grid_column_group;
    if (hasOwnProperty(dto, 'grid_column_total')) data.gridColumnTotal = dto.grid_column_total;
    if (hasOwnProperty(dto, 'grid_column_data_type')) data.gridColumnDataType = dto.grid_column_data_type;
    if (hasOwnProperty(dto, 'grid_column_color')) data.gridColumnColor = dto.grid_column_color;
    if (hasOwnProperty(dto, 'grid_column_notes')) data.gridColumnNotes = dto.grid_column_notes;
    if (hasOwnProperty(dto, 'grid_column_sql_field_name')) data.gridColumnSqlFieldName = dto.grid_column_sql_field_name;
  }

  private async applyOptionalGridFields(
    data: Prisma.GridDetailsUncheckedCreateInput | Prisma.GridDetailsUncheckedUpdateInput,
    dto: SaveGridDetailDto,
  ): Promise<void> {
    if (hasOwnProperty(dto, 'grid_description')) data.gridDescription = dto.grid_description;
    if (hasOwnProperty(dto, 'grid_sort_column')) data.gridSortColumn = dto.grid_sort_column;
    if (hasOwnProperty(dto, 'grid_sort_order')) data.gridSortOrder = dto.grid_sort_order;
    if (hasOwnProperty(dto, 'grid_sql')) data.gridSql = await this.normalizeGridSql(dto.grid_sql);
    if (hasOwnProperty(dto, 'grid_status')) data.gridStatus = dto.grid_status;
    if (hasOwnProperty(dto, 'grid_device_type')) data.gridDeviceType = dto.grid_device_type;
  }

  private async normalizeGridSql(
    gridSql: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (gridSql === undefined || gridSql === null) return gridSql;
    const normalized = gridSql.trim();
    if (!normalized) return null;

    const topLevelTableName = this.configuredGridSqlService.extractTopLevelFromTableName(normalized);
    if (!topLevelTableName) {
      throwFixedBadRequest<GridDetailErrorDetail, GridDetailErrorResponse>(
        'Invalid grid_sql configuration',
        [{ field: 'grid_sql', message: 'grid_sql must be a SELECT query with a top-level FROM table' }],
      );
    }

    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: normalized,
      tableName: topLevelTableName,
    });
    if (!validation.isValid) {
      throwFixedBadRequest<GridDetailErrorDetail, GridDetailErrorResponse>(
        'Invalid grid_sql configuration',
        [{ field: 'grid_sql', message: validation.message }],
      );
    }

    try {
      await this.configuredGridSqlService.assertBaseSqlExecutable(
        validation.normalizedSql,
        'grid_sql_validation',
      );
    } catch (error: unknown) {
      const rawMessage = this.extractErrorMessage(error);
      throwFixedBadRequest<GridDetailErrorDetail, GridDetailErrorResponse>(
        'Invalid grid_sql configuration',
        [
          {
            field: 'grid_sql',
            message: rawMessage
              ? `grid_sql could not be executed: ${rawMessage}`
              : 'grid_sql could not be executed',
          },
        ],
      );
    }

    return validation.normalizedSql;
  }

  private toPayload(record: GridDetailsWithColumns): GridDetailPayload {
    return {
      grid_id: record.gridId.toString(),
      grid_name: record.gridName,
      grid_description: record.gridDescription,
      grid_sort_column: record.gridSortColumn,
      grid_sort_order: record.gridSortOrder,
      grid_sql: record.gridSql,
      grid_status: record.gridStatus,
      grid_device_type: record.gridDeviceType,
      grid_is_deleted: record.gridIsDeleted,
      columns: record.columns.map((col) => this.toColumnPayload(col)),
    };
  }

  private toColumnPayload(record: GridColumn): GridColumnPayload {
    return {
      grid_column_id: record.gridColumnId,
      grid_id: record.gridId.toString(),
      grid_column_number: record.gridColumnNumber,
      grid_column_name: record.gridColumnName,
      grid_column_width: toNullableNumber(record.gridColumnWidth),
      grid_column_position: toNullableNumber(record.gridColumnPosition),
      grid_column_alignment: record.gridColumnAlignment,
      grid_column_visibility: record.gridColumnVisibility,
      grid_column_filter: record.gridColumnFilter,
      grid_column_condition: record.gridColumnCondition,
      grid_column_condition_color: record.gridColumnConditionColor,
      grid_column_group: record.gridColumnGroup,
      grid_column_total: record.gridColumnTotal,
      grid_column_data_type: record.gridColumnDataType,
      grid_column_color: record.gridColumnColor,
      grid_column_notes: record.gridColumnNotes,
      grid_column_sql_field_name: record.gridColumnSqlFieldName,
      grid_column_is_deleted: record.gridColumnIsDeleted,
    };
  }

  private parseUuidId(field: string, value: string): string {
    const normalized = value.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
      throwFixedBadRequest<GridDetailErrorDetail, GridDetailErrorResponse>("Validation error", [
        { field, message: `${field} must be a valid UUID` },
      ]);
    }
    return normalized;
  }

  private parseBigIntId(field: string, value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwFixedBadRequest<GridDetailErrorDetail, GridDetailErrorResponse>('Validation error', [
        { field, message: `${field} must be a numeric id` },
      ]);
    }
    return BigInt(normalized);
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof Error) return error.message.replace(/\s+/g, ' ').trim();
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message.replace(/\s+/g, ' ').trim();
    }
    return null;
  }
}
