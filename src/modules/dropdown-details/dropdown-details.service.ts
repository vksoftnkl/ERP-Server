import { Injectable } from '@nestjs/common';
import { DropdownColumns, DropdownDetails, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ListDropdownDetailQueryDto } from './dto/list-dropdown-detail-query.dto';
import { SaveDropdownDetailDto } from './dto/save-dropdown-detail.dto';
import { SaveDropdownColumnDto } from './dto/save-dropdown-column.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import {
  DropdownColumnPayload,
  DropdownDetailErrorDetail,
  DropdownDetailErrorResponse,
  DropdownDetailListItem,
  DropdownDetailPayload,
} from './types/dropdown-detail-api.types';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  hasOwnProperty,
  throwFixedBadRequest,
  throwFixedNotFound,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';

const DROPDOWN_DETAIL_TABLE_NAME = 'dropdown details';
const DROPDOWN_COLUMN_TABLE_NAME = 'dropdown column';
const DROPDOWN_DETAIL_AUDIT_SCREEN_NAME = 'Dropdown Details';

type DropdownDetailsWithColumns = DropdownDetails & { dropdownColumns: DropdownColumns[] };

@Injectable()
export class DropdownDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveDropdownDetailDto: SaveDropdownDetailDto): Promise<DropdownDetailPayload> {
    return saveDropdownDetailDto.dropdown_id
      ? this.updateDropdownDetails(saveDropdownDetailDto)
      : this.createDropdownDetails(saveDropdownDetailDto);
  }

  async list(queryDto: ListDropdownDetailQueryDto): Promise<{ items: DropdownDetailListItem[] }> {
    const requestedDropdownId = queryDto.dropdownId ?? queryDto.dropdown_id;
    const parsedDropdownId = requestedDropdownId
      ? this.parseIntId('dropdown_id', requestedDropdownId)
      : undefined;
    const search = queryDto.search?.trim();
    const where: Prisma.DropdownDetailsWhereInput = {
      ...(parsedDropdownId !== undefined ? { dropdownId: parsedDropdownId } : {}),
      ...(search
        ? {
            OR: [
              { dropdownName: { contains: search, mode: 'insensitive' } },
              { dropdownDescription: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const records = (await this.prisma.dropdownDetails.findMany({
      where,
      orderBy: [{ dropdownName: 'asc' }, { dropdownId: 'asc' }],
      include: {
        dropdownColumns: {
          orderBy: [{ dropColumnsColumnNo: 'asc' }, { dropColumnsId: 'asc' }],
        },
      },
    })) as unknown as DropdownDetailsWithColumns[];

    return { items: records.map((record) => this.toPayload(record)) };
  }

  async updateColumnWidths(dto: SaveColumnWidthDto): Promise<{ updated: number }> {
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const columnId = this.parseUuidId('drop_columns_id', item.drop_columns_id);
        const existing = await tx.dropdownColumns.findFirst({
          where: { dropColumnsId: columnId },
          select: { dropColumnsId: true },
        });
        if (!existing) {
          throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
            'Dropdown column not found',
            'drop_columns_id',
            `No dropdown column found with id ${item.drop_columns_id}`,
          );
        }
        await tx.dropdownColumns.update({
          where: { dropColumnsId: columnId },
          data: { dropColumnsColumnWidth: item.drop_columns_column_width },
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
        const columnId = this.parseUuidId('drop_columns_id', item.drop_columns_id);
        const existing = await tx.dropdownColumns.findFirst({
          where: { dropColumnsId: columnId },
          select: { dropColumnsId: true },
        });
        if (!existing) {
          throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
            'Dropdown column not found',
            'drop_columns_id',
            `No dropdown column found with id ${item.drop_columns_id}`,
          );
        }
        await tx.dropdownColumns.update({
          where: { dropColumnsId: columnId },
          data: { dropColumnsColumnFilter: item.drop_columns_column_filter },
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
        const columnId = this.parseUuidId('drop_columns_id', item.drop_columns_id);
        const existing = await tx.dropdownColumns.findFirst({
          where: { dropColumnsId: columnId },
          select: { dropColumnsId: true },
        });
        if (!existing) {
          throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
            'Dropdown column not found',
            'drop_columns_id',
            `No dropdown column found with id ${item.drop_columns_id}`,
          );
        }
        await tx.dropdownColumns.update({
          where: { dropColumnsId: columnId },
          data: { dropColumnsColumnVisiblity: item.drop_columns_column_visiblity },
        });
        count++;
      }
    });
    return { updated: count };
  }

  async getById(dropdownId: string): Promise<DropdownDetailPayload> {
    const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
    const record = await this.prisma.dropdownDetails.findFirst({
      where: { dropdownId: parsedDropdownId },
      include: {
        dropdownColumns: {
          orderBy: [{ dropColumnsColumnNo: 'asc' }, { dropColumnsId: 'asc' }],
        },
      },
    });
    if (!record) {
      throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Dropdown details not found',
        'dropdown_id',
        `No dropdown details found with id ${dropdownId}`,
      );
    }
    return this.toPayload(record as DropdownDetailsWithColumns);
  }

  async delete(dropdownId: string): Promise<{ dropdown_id: string; deleted: true }> {
    const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownDetails.findFirst({
        where: { dropdownId: parsedDropdownId },
      });

      if (!existing) {
        throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
          'Dropdown details not found',
          'dropdown_id',
          `No dropdown details found with id ${dropdownId}`,
        );
      }

      await tx.dropdownDetails.delete({ where: { dropdownId: parsedDropdownId } });

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: DROPDOWN_DETAIL_TABLE_NAME,
          screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: dropdownId,
          displayName: existing.dropdownName ?? `Dropdown ${dropdownId}`,
          originalRecord: this.toPayload({ ...existing, dropdownColumns: [] }),
          modifiedRecord: this.toPayload({ ...existing, dropdownColumns: [] }),
          userId: actor,
          notes: 'Dropdown details deleted',
        },
        tx,
      );

      return { dropdown_id: dropdownId, deleted: true };
    });
  }

  async deleteColumn(drop_columns_id: string): Promise<{ drop_columns_id: string; deleted: true }> {
    const parsedColumnId = this.parseUuidId('drop_columns_id', drop_columns_id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownColumns.findFirst({
        where: { dropColumnsId: parsedColumnId },
      });

      if (!existing) {
        throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
          'Dropdown column not found',
          'drop_columns_id',
          `No dropdown column found with id ${drop_columns_id}`,
        );
      }

      await tx.dropdownColumns.delete({ where: { dropColumnsId: parsedColumnId } });

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: DROPDOWN_COLUMN_TABLE_NAME,
          screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: drop_columns_id,
          displayName: existing.dropColumnsColumnName ?? `Dropdown column ${drop_columns_id}`,
          originalRecord: this.toColumnPayload(existing),
          modifiedRecord: this.toColumnPayload(existing),
          userId: actor,
          notes: 'Dropdown column deleted',
        },
        tx,
      );

      return { drop_columns_id: drop_columns_id, deleted: true };
    });
  }

  private async createDropdownDetails(
    saveDropdownDetailDto: SaveDropdownDetailDto,
  ): Promise<DropdownDetailPayload> {
    const data: Prisma.DropdownDetailsUncheckedCreateInput = {
      dropdownName: saveDropdownDetailDto.dropdown_name.trim(),
      dropdownSql: saveDropdownDetailDto.dropdown_sql.trim(),
    };
    this.applyOptionalDropdownFields(data, saveDropdownDetailDto);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.dropdownDetails.create({ data });
      if (saveDropdownDetailDto.dropdown_columns?.length) {
        await this.saveColumnsInTx(saveDropdownDetailDto.dropdown_columns, created.dropdownId, tx);
      }
      const full = await tx.dropdownDetails.findFirstOrThrow({
        where: { dropdownId: created.dropdownId },
        include: {
          dropdownColumns: {
            orderBy: [{ dropColumnsColumnNo: 'asc' }, { dropColumnsId: 'asc' }],
          },
        },
      });
      const payload = this.toPayload(full as DropdownDetailsWithColumns);
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: DROPDOWN_DETAIL_TABLE_NAME,
          screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: payload.dropdown_id,
          displayName: payload.dropdown_name,
          originalRecord: null,
          modifiedRecord: payload,
          userId: actor,
          notes: 'Dropdown details created',
        },
        tx,
      );
      return payload;
    });
  }

  private async updateDropdownDetails(
    saveDropdownDetailDto: SaveDropdownDetailDto,
  ): Promise<DropdownDetailPayload> {
    const dropdownId = saveDropdownDetailDto.dropdown_id!;
    const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownDetails.findFirst({
        where: { dropdownId: parsedDropdownId },
      });

      if (!existing) {
        throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
          'Dropdown details not found',
          'dropdown_id',
          `No dropdown details found with id ${dropdownId}`,
        );
      }

      const data: Prisma.DropdownDetailsUncheckedUpdateInput = {
        dropdownName: saveDropdownDetailDto.dropdown_name.trim(),
        dropdownSql: saveDropdownDetailDto.dropdown_sql.trim(),
      };
      this.applyOptionalDropdownFields(data, saveDropdownDetailDto);
      await tx.dropdownDetails.update({ where: { dropdownId: parsedDropdownId }, data });

      if (saveDropdownDetailDto.dropdown_columns !== undefined) {
        await this.saveColumnsInTx(saveDropdownDetailDto.dropdown_columns, parsedDropdownId, tx);
        if (saveDropdownDetailDto.replace_columns === true) {
          const keptIds = saveDropdownDetailDto.dropdown_columns
            .filter((col) => !!col.drop_columns_id)
            .map((col) => this.parseUuidId('drop_columns_id', col.drop_columns_id!));
          await tx.dropdownColumns.deleteMany({
            where: {
              dropColumnsDropdownId: parsedDropdownId,
              ...(keptIds.length > 0 ? { dropColumnsId: { notIn: keptIds } } : {}),
            },
          });
        }
      }

      const full = await tx.dropdownDetails.findFirstOrThrow({
        where: { dropdownId: parsedDropdownId },
        include: {
          dropdownColumns: {
            orderBy: [{ dropColumnsColumnNo: 'asc' }, { dropColumnsId: 'asc' }],
          },
        },
      });
      const payload = this.toPayload(full as DropdownDetailsWithColumns);
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: DROPDOWN_DETAIL_TABLE_NAME,
          screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: dropdownId,
          displayName: payload.dropdown_name,
          originalRecord: this.toPayload({ ...existing, dropdownColumns: [] }),
          modifiedRecord: payload,
          userId: actor,
          notes: 'Dropdown details updated',
        },
        tx,
      );
      return payload;
    });
  }

  private async saveColumnsInTx(
    columns: SaveDropdownColumnDto[],
    dropdownId: number,
    tx: FixedWriteClient,
  ): Promise<void> {
    for (const colDto of columns) {
      await this.upsertColumnInTx(colDto, dropdownId, tx);
    }
  }

  private async upsertColumnInTx(
    colDto: SaveDropdownColumnDto,
    dropdownId: number,
    tx: FixedWriteClient,
  ): Promise<void> {
    const normalizedName = colDto.drop_columns_column_name?.trim();
    if (!normalizedName) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation failed',
        [
          {
            field: 'drop_columns_column_name',
            message: 'drop_columns_column_name must not be empty',
          },
        ],
      );
    }
    const normalizedDataType = colDto.drop_columns_data_type?.trim();
    if (!normalizedDataType) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation failed',
        [{ field: 'drop_columns_data_type', message: 'drop_columns_data_type must not be empty' }],
      );
    }

    if (colDto.drop_columns_id) {
      const parsedId = this.parseUuidId('drop_columns_id', colDto.drop_columns_id);
      const colData: Prisma.DropdownColumnsUncheckedUpdateInput = {
        dropColumnsColumnName: normalizedName,
        dropColumnsDropdownId: dropdownId,
        dropColumnsColumnNo: colDto.drop_columns_column_no,
        dropColumnsDataType: normalizedDataType,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.dropdownColumns.update({ where: { dropColumnsId: parsedId }, data: colData });
    } else {
      const colData: Prisma.DropdownColumnsUncheckedCreateInput = {
        dropColumnsColumnName: normalizedName,
        dropColumnsDropdownId: dropdownId,
        dropColumnsColumnNo: colDto.drop_columns_column_no,
        dropColumnsDataType: normalizedDataType,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.dropdownColumns.create({ data: colData });
    }
  }

  private applyOptionalColumnFields(
    data: Prisma.DropdownColumnsUncheckedCreateInput | Prisma.DropdownColumnsUncheckedUpdateInput,
    dto: SaveDropdownColumnDto,
  ): void {
    if (hasOwnProperty(dto, 'drop_columns_column_alias'))
      data.dropColumnsColumnAlias = dto.drop_columns_column_alias;
    if (hasOwnProperty(dto, 'drop_columns_column_width'))
      data.dropColumnsColumnWidth = dto.drop_columns_column_width;
    if (hasOwnProperty(dto, 'drop_columns_column_visiblity'))
      data.dropColumnsColumnVisiblity = dto.drop_columns_column_visiblity;
    if (hasOwnProperty(dto, 'drop_columns_column_allignment'))
      data.dropColumnsColumnAllignment = dto.drop_columns_column_allignment;
    if (hasOwnProperty(dto, 'drop_columns_column_filter'))
      data.dropColumnsColumnFilter = dto.drop_columns_column_filter;
  }

  private applyOptionalDropdownFields(
    data: Prisma.DropdownDetailsUncheckedCreateInput | Prisma.DropdownDetailsUncheckedUpdateInput,
    dto: SaveDropdownDetailDto,
  ): void {
    if (hasOwnProperty(dto, 'dropdown_description'))
      data.dropdownDescription = dto.dropdown_description;
    if (hasOwnProperty(dto, 'dropdown_sort_order'))
      data.dropdownSortOrder = dto.dropdown_sort_order;
    if (hasOwnProperty(dto, 'dropdown_sort_column'))
      data.dropdownSortColumn = dto.dropdown_sort_column;
    if (hasOwnProperty(dto, 'dropdown_completion'))
      data.dropdownCompletion = dto.dropdown_completion;
    if (hasOwnProperty(dto, 'dropdown_sql_regional'))
      data.dropdownSqlRegional = dto.dropdown_sql_regional;
    if (hasOwnProperty(dto, 'dropdown_max_visible_items'))
      data.dropdownMaxVisibleItems = dto.dropdown_max_visible_items;
    if (hasOwnProperty(dto, 'dropdown_show_header'))
      data.dropdownShowHeader = dto.dropdown_show_header;
    if (hasOwnProperty(dto, 'dropdown_width')) data.dropdownWidth = dto.dropdown_width;
  }

  private toPayload(record: DropdownDetailsWithColumns): DropdownDetailPayload {
    return {
      dropdown_id: String(record.dropdownId),
      dropdown_name: record.dropdownName,
      dropdown_description: record.dropdownDescription,
      dropdown_sql: record.dropdownSql,
      dropdown_sort_order: record.dropdownSortOrder,
      dropdown_sort_column: record.dropdownSortColumn,
      dropdown_completion: record.dropdownCompletion,
      dropdown_sql_regional: record.dropdownSqlRegional,
      dropdown_max_visible_items: record.dropdownMaxVisibleItems,
      dropdown_show_header: record.dropdownShowHeader,
      dropdown_width: record.dropdownWidth,
      columns: record.dropdownColumns.map((col) => this.toColumnPayload(col)),
    };
  }

  private toColumnPayload(record: DropdownColumns): DropdownColumnPayload {
    return {
      drop_columns_id: record.dropColumnsId,
      dropdown_id: String(record.dropColumnsDropdownId),
      drop_columns_column_no: record.dropColumnsColumnNo,
      drop_columns_data_type: record.dropColumnsDataType,
      drop_columns_column_name: record.dropColumnsColumnName,
      drop_columns_column_alias: record.dropColumnsColumnAlias,
      drop_columns_column_width: toNullableNumber(record.dropColumnsColumnWidth),
      drop_columns_column_visiblity: record.dropColumnsColumnVisiblity,
      drop_columns_column_allignment: record.dropColumnsColumnAllignment,
      drop_columns_column_filter: record.dropColumnsColumnFilter,
    };
  }

  private parseUuidId(field: string, value: string): string {
    const normalized = value.trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation error',
        [{ field, message: `${field} must be a valid UUID` }],
      );
    }
    return normalized;
  }

  private parseIntId(field: string, value: string): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation error',
        [{ field, message: `${field} must be a numeric id` }],
      );
    }
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation error',
        [{ field, message: `${field} must be a positive numeric id` }],
      );
    }
    return parsed;
  }
}
