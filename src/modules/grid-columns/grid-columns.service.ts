import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GridColumn, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListGridColumnQueryDto } from './dto/list-grid-column-query.dto';
import { SaveGridColumnDto } from './dto/save-grid-column.dto';
import {
  GridColumnErrorDetail,
  GridColumnErrorResponse,
  GridColumnListMeta,
  GridColumnPayload,
} from './types/grid-column-api.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
type GridColumnWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class GridColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(saveGridColumnDto: SaveGridColumnDto): Promise<GridColumnPayload> {
    if (saveGridColumnDto.grid_serialid) {
      return this.updateGridColumn(saveGridColumnDto);
    }

    return this.createGridColumn(saveGridColumnDto);
  }

  async list(
    queryDto: ListGridColumnQueryDto,
  ): Promise<{ items: GridColumnPayload[]; meta: GridColumnListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.GridColumnWhereInput = {
      gridColumnIsDeleted: false,
      grid: {
        gridIsDeleted: false,
      },
    };

    if (queryDto.grid_id !== undefined) {
      where.gridId = this.parseBigIntId('grid_id', queryDto.grid_id);
    }

    if (queryDto.grid_column_visibility !== undefined) {
      where.gridColumnVisibility = queryDto.grid_column_visibility;
    }

    if (queryDto.grid_column_filter !== undefined) {
      where.gridColumnFilter = queryDto.grid_column_filter;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { gridColumnName: { contains: search, mode: 'insensitive' } },
        { gridColumnNotes: { contains: search, mode: 'insensitive' } },
        { gridColumnDataType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.gridColumn.count({ where }),
      this.prisma.gridColumn.findMany({
        where,
        orderBy: [{ gridId: 'asc' }, { gridColumnNumber: 'asc' }],
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

  async getById(gridSerialId: string): Promise<GridColumnPayload> {
    const parsedGridSerialId = this.parseBigIntId('grid_serialid', gridSerialId);

    const record = await this.prisma.gridColumn.findFirst({
      where: {
        gridSerialId: parsedGridSerialId,
        gridColumnIsDeleted: false,
        grid: {
          gridIsDeleted: false,
        },
      },
    });

    if (!record) {
      this.throwNotFound(gridSerialId);
    }

    return this.toPayload(record);
  }

  async softDelete(gridSerialId: string): Promise<{ grid_serialid: string; deleted: true }> {
    const parsedGridSerialId = this.parseBigIntId('grid_serialid', gridSerialId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridColumn.findFirst({
        where: {
          gridSerialId: parsedGridSerialId,
          gridColumnIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(gridSerialId);
      }

      const result = await tx.gridColumn.updateMany({
        where: {
          gridSerialId: parsedGridSerialId,
          gridColumnIsDeleted: false,
        },
        data: {
          gridColumnIsDeleted: true,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(gridSerialId);
      }

      return {
        grid_serialid: gridSerialId,
        deleted: true,
      };
    });
  }

  private async createGridColumn(saveGridColumnDto: SaveGridColumnDto): Promise<GridColumnPayload> {
    const parsedGridId = this.parseBigIntId('grid_id', saveGridColumnDto.grid_id);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureGridExists(parsedGridId, saveGridColumnDto.grid_id, tx);

      const data: Prisma.GridColumnUncheckedCreateInput = {
        gridId: parsedGridId,
        gridColumnNumber: saveGridColumnDto.grid_column_number,
        gridColumnName: saveGridColumnDto.grid_column_name.trim(),
      };

      this.applyOptionalFields(data, saveGridColumnDto);
      const created = await tx.gridColumn.create({ data });
      return this.toPayload(created);
    });
  }

  private async updateGridColumn(saveGridColumnDto: SaveGridColumnDto): Promise<GridColumnPayload> {
    const gridSerialId = saveGridColumnDto.grid_serialid!;
    const parsedGridSerialId = this.parseBigIntId('grid_serialid', gridSerialId);
    const parsedGridId = this.parseBigIntId('grid_id', saveGridColumnDto.grid_id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridColumn.findFirst({
        where: {
          gridSerialId: parsedGridSerialId,
          gridColumnIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(gridSerialId);
      }

      await this.ensureGridExists(parsedGridId, saveGridColumnDto.grid_id, tx);

      const data: Prisma.GridColumnUncheckedUpdateInput = {
        gridId: parsedGridId,
        gridColumnNumber: saveGridColumnDto.grid_column_number,
        gridColumnName: saveGridColumnDto.grid_column_name.trim(),
      };

      this.applyOptionalFields(data, saveGridColumnDto);
      const updated = await tx.gridColumn.update({
        where: {
          gridSerialId: parsedGridSerialId,
        },
        data,
      });
      return this.toPayload(updated);
    });
  }

  private async ensureGridExists(
    gridId: bigint,
    rawGridId: string,
    tx: GridColumnWriteClient = this.prisma,
  ): Promise<void> {
    const parentGrid = await tx.gridDetails.findFirst({
      where: {
        gridId,
        gridIsDeleted: false,
      },
      select: {
        gridId: true,
      },
    });

    if (!parentGrid) {
      this.throwBadRequest('Validation error', [
        {
          field: 'grid_id',
          message: `No active grid details found with id ${rawGridId}`,
        },
      ]);
    }
  }

  private applyOptionalFields(
    data: Prisma.GridColumnUncheckedCreateInput | Prisma.GridColumnUncheckedUpdateInput,
    saveGridColumnDto: SaveGridColumnDto,
  ): void {
    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_width')) {
      data.gridColumnWidth = saveGridColumnDto.grid_column_width;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_position')) {
      data.gridColumnPosition = saveGridColumnDto.grid_column_position;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_alignment')) {
      data.gridColumnAlignment = saveGridColumnDto.grid_column_alignment;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_visibility')) {
      data.gridColumnVisibility = saveGridColumnDto.grid_column_visibility;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_filter')) {
      data.gridColumnFilter = saveGridColumnDto.grid_column_filter;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_condition')) {
      data.gridColumnCondition = saveGridColumnDto.grid_column_condition;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_condition_color')) {
      data.gridColumnConditionColor = saveGridColumnDto.grid_column_condition_color;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_group')) {
      data.gridColumnGroup = saveGridColumnDto.grid_column_group;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_total')) {
      data.gridColumnTotal = saveGridColumnDto.grid_column_total;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_data_type')) {
      data.gridColumnDataType = saveGridColumnDto.grid_column_data_type;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_color')) {
      data.gridColumnColor = saveGridColumnDto.grid_column_color;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_notes')) {
      data.gridColumnNotes = saveGridColumnDto.grid_column_notes;
    }

    if (this.hasOwnProperty(saveGridColumnDto, 'grid_column_sql_field_name')) {
      data.gridColumnSqlFieldName = saveGridColumnDto.grid_column_sql_field_name;
    }
  }

  private toPayload(record: GridColumn): GridColumnPayload {
    return {
      grid_serialid: record.gridSerialId.toString(),
      grid_id: record.gridId.toString(),
      grid_column_number: record.gridColumnNumber,
      grid_column_name: record.gridColumnName,
      grid_column_width: this.toNullableNumber(record.gridColumnWidth),
      grid_column_position: this.toNullableNumber(record.gridColumnPosition),
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

  private toNullableNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private parseBigIntId(field: string, value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      this.throwBadRequest('Validation error', [
        {
          field,
          message: `${field} must be a numeric id`,
        },
      ]);
    }

    return BigInt(normalized);
  }

  private throwNotFound(gridSerialId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Grid column not found', [
        {
          field: 'grid_serialid',
          message: `No active grid column found with id ${gridSerialId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: GridColumnErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: GridColumnErrorDetail[] = [],
  ): GridColumnErrorResponse {
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
