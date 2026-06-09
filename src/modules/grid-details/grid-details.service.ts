import { Injectable } from '@nestjs/common';
import { GridColumn, GridDetails, Prisma } from '@prisma/client';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ListGridDetailQueryDto } from './dto/list-grid-detail-query.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import { SaveGridColumnDto } from './dto/save-grid-column.dto';
import {
  GridColumnPayload,
  GridDetailErrorDetail,
  GridDetailErrorResponse,
  GridDetailListItem,
  GridDetailListMeta,
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
import { resolvePagination, runConfiguredGridQuery, runFixedListQuery } from 'src/common/utils/module-list.utils';

const GRID_DETAIL_TABLE_NAME = 'grid details';
const GRID_DETAIL_AUDIT_SCREEN_NAME = 'Grid Details';

type GridDetailsWithColumns = GridDetails & { columns: GridColumn[] };

@Injectable()
export class GridDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailPayload> {
    return saveGridDetailDto.grid_id
      ? this.updateGridDetails(saveGridDetailDto)
      : this.createGridDetails(saveGridDetailDto);
  }

  async list(
    queryDto: ListGridDetailQueryDto,
  ): Promise<ConfiguredGridListResult<GridDetailListItem, GridDetailListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const fixedGridId = queryDto.gridId ? BigInt(queryDto.gridId) : undefined;
    const fixedGridSerialId = queryDto.grid_serial_id ? BigInt(queryDto.grid_serial_id) : undefined;
    const where: Prisma.GridDetailsWhereInput = {
      gridIsDeleted: false,
      ...(fixedGridId !== undefined ? { gridId: fixedGridId } : {}),
      ...(queryDto.grid_status !== undefined ? { gridStatus: queryDto.grid_status } : {}),
    };
    const columnWhere: Prisma.GridColumnWhereInput = {
      gridColumnIsDeleted: false,
      ...(fixedGridSerialId !== undefined ? { gridSerialId: fixedGridSerialId } : {}),
    };

    return runFixedListQuery<GridDetailsWithColumns, GridDetailListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<GridDetailListItem>(
            this.configuredGridSqlService,
            {
              tableName: GRID_DETAIL_TABLE_NAME,
              alias: 'grid_detail_grid',
              search: queryDto.search,
              page,
              limit,
              skip,
              fixedGridId,
            },
          ),
        countFn: () => this.prisma.gridDetails.count({ where }),
        findManyFn: () =>
          this.prisma.gridDetails.findMany({
            where,
            orderBy: [{ gridSortOrder: 'asc' }, { gridName: 'asc' }],
            include: {
              columns: {
                where: columnWhere,
                orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
              },
            },
            skip,
            take: limit,
          }) as unknown as Promise<GridDetailsWithColumns[]>,
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(gridId: string): Promise<GridDetailPayload> {
    const parsedGridId = this.parseBigIntId('grid_id', gridId);
    const record = await this.prisma.gridDetails.findFirst({
      where: { gridId: parsedGridId, gridIsDeleted: false },
      include: {
        columns: {
          where: { gridColumnIsDeleted: false },
          orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
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
            orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
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
        const keptIds = saveGridDetailDto.grid_columns
          .filter((col) => !!col.grid_serialid)
          .map((col) => BigInt(col.grid_serialid!));
        await tx.gridColumn.updateMany({
          where: {
            gridId: parsedGridId,
            gridColumnIsDeleted: false,
            ...(keptIds.length > 0 ? { gridSerialId: { notIn: keptIds } } : {}),
          },
          data: { gridColumnIsDeleted: true },
        });
      }

      const full = await tx.gridDetails.findFirstOrThrow({
        where: { gridId: parsedGridId },
        include: {
          columns: {
            where: { gridColumnIsDeleted: false },
            orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
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

    if (colDto.grid_serialid) {
      const parsedId = BigInt(colDto.grid_serialid);
      const colData: Prisma.GridColumnUncheckedUpdateInput = {
        gridColumnName: normalizedName,
        gridId,
        gridColumnNumber: colDto.grid_column_number,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.gridColumn.update({ where: { gridSerialId: parsedId }, data: colData });
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
      grid_serialid: record.gridSerialId.toString(),
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
