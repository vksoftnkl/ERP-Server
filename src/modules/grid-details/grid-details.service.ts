import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GridDetails, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListGridDetailQueryDto } from './dto/list-grid-detail-query.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import {
  GridDetailErrorDetail,
  GridDetailErrorResponse,
  GridDetailListMeta,
  GridDetailPayload,
} from './types/grid-detail-api.types';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
@Injectable()
export class GridDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailPayload> {
    if (saveGridDetailDto.grid_id) {
      return this.updateGridDetails(saveGridDetailDto);
    }
    return this.createGridDetails(saveGridDetailDto);
  }
  async list(
    queryDto: ListGridDetailQueryDto,
  ): Promise<{ items: GridDetailPayload[]; meta: GridDetailListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const where: Prisma.GridDetailsWhereInput = {
      gridIsDeleted: false,
    };
    if (queryDto.grid_status !== undefined) {
      where.gridStatus = queryDto.grid_status;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { gridName: { contains: search, mode: 'insensitive' } },
        { gridDescription: { contains: search, mode: 'insensitive' } },
        { gridSql: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.gridDetails.count({ where }),
      this.prisma.gridDetails.findMany({
        where,
        orderBy: [{ gridSortOrder: 'asc' }, { gridName: 'asc' }],
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
  async getById(gridId: string): Promise<GridDetailPayload> {
    const parsedGridId = this.parseBigIntId('grid_id', gridId);
    const record = await this.prisma.gridDetails.findFirst({
      where: {
        gridId: parsedGridId,
        gridIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(gridId);
    }
    return this.toPayload(record);
  }
  async softDelete(gridId: string): Promise<{ grid_id: string; deleted: true }> {
    const parsedGridId = this.parseBigIntId('grid_id', gridId);
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridDetails.findFirst({
        where: {
          gridId: parsedGridId,
          gridIsDeleted: false,
        },
      });
      if (!existing) {
        return 0;
      }
      const updatedGrid = await tx.gridDetails.updateMany({
        where: {
          gridId: parsedGridId,
          gridIsDeleted: false,
        },
        data: {
          gridIsDeleted: true,
          gridStatus: false,
        },
      });
      if (updatedGrid.count === 0) {
        return 0;
      }
      await tx.gridColumn.updateMany({
        where: {
          gridId: parsedGridId,
          gridColumnIsDeleted: false,
        },
        data: {
          gridColumnIsDeleted: true,
        },
      });
      return updatedGrid.count;
    });
    if (result === 0) {
      this.throwNotFound(gridId);
    }
    return {
      grid_id: gridId,
      deleted: true,
    };
  }
  private async createGridDetails(
    saveGridDetailDto: SaveGridDetailDto,
  ): Promise<GridDetailPayload> {
    const data: Prisma.GridDetailsUncheckedCreateInput = {
      gridName: saveGridDetailDto.grid_name.trim(),
    };
    await this.applyOptionalFields(data, saveGridDetailDto);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.gridDetails.create({ data });
      return this.toPayload(created);
    });
  }
  private async updateGridDetails(
    saveGridDetailDto: SaveGridDetailDto,
  ): Promise<GridDetailPayload> {
    const gridId = saveGridDetailDto.grid_id!;
    const parsedGridId = this.parseBigIntId('grid_id', gridId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gridDetails.findFirst({
        where: {
          gridId: parsedGridId,
          gridIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(gridId);
      }
      const data: Prisma.GridDetailsUncheckedUpdateInput = {
        gridName: saveGridDetailDto.grid_name.trim(),
      };
      await this.applyOptionalFields(data, saveGridDetailDto);
      const updated = await tx.gridDetails.update({
        where: { gridId: parsedGridId },
        data,
      });
      return this.toPayload(updated);
    });
  }
  private async applyOptionalFields(
    data: Prisma.GridDetailsUncheckedCreateInput | Prisma.GridDetailsUncheckedUpdateInput,
    saveGridDetailDto: SaveGridDetailDto,
  ): Promise<void> {
    if (this.hasOwnProperty(saveGridDetailDto, 'grid_description')) {
      data.gridDescription = saveGridDetailDto.grid_description;
    }
    if (this.hasOwnProperty(saveGridDetailDto, 'grid_sort_column')) {
      data.gridSortColumn = saveGridDetailDto.grid_sort_column;
    }
    if (this.hasOwnProperty(saveGridDetailDto, 'grid_sort_order')) {
      data.gridSortOrder = saveGridDetailDto.grid_sort_order;
    }
    if (this.hasOwnProperty(saveGridDetailDto, 'grid_sql')) {
      data.gridSql = await this.normalizeGridSql(saveGridDetailDto.grid_sql);
    }
    if (this.hasOwnProperty(saveGridDetailDto, 'grid_status')) {
      data.gridStatus = saveGridDetailDto.grid_status;
    }
    if (this.hasOwnProperty(saveGridDetailDto, 'grid_device_type')) {
      data.gridDeviceType = saveGridDetailDto.grid_device_type;
    }
  } 
  private async normalizeGridSql(gridSql: string | null | undefined): Promise<string | null | undefined> {
    if (gridSql === undefined || gridSql === null) {
      return gridSql;
    }
    const normalizedInput = gridSql.trim();
    if (!normalizedInput) {
      return null;
    }
    const topLevelTableName =
      this.configuredGridSqlService.extractTopLevelFromTableName(normalizedInput);
    if (!topLevelTableName) {
      this.throwBadRequest('Invalid grid_sql configuration', [
        {
          field: 'grid_sql',
          message: 'grid_sql must be a SELECT query with a top-level FROM table',
        },
      ]);
    }
    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: normalizedInput,
      tableName: topLevelTableName,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }
    try {
      await this.configuredGridSqlService.assertBaseSqlExecutable(
        validation.normalizedSql,
        'grid_sql_validation',
      );
    } catch (error: unknown) {
      const rawMessage = this.extractGridSqlErrorMessage(error);
      this.throwBadRequest('Invalid grid_sql configuration', [
        {
          field: 'grid_sql',
          message: rawMessage
            ? `grid_sql could not be executed: ${rawMessage}`
            : 'grid_sql could not be executed',
        },
      ]);
    }
    return validation.normalizedSql;
  }
  private toPayload(record: GridDetails): GridDetailPayload {
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
    };
  }
  private throwNotFound(gridId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Grid details not found', [
        {
          field: 'grid_id',
          message: `No active grid details found with id ${gridId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: GridDetailErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
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
  private buildErrorResponse(
    message: string,
    errors: GridDetailErrorDetail[] = [],
  ): GridDetailErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  private extractGridSqlErrorMessage(error: unknown): string | null {
    if (error instanceof Error) {
      return error.message.replace(/\s+/g, ' ').trim();
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message.replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  }
}
