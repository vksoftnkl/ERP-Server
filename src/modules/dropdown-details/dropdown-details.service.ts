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
          orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
        },
      },
    })) as unknown as DropdownDetailsWithColumns[];
    return { items: records.map((record) => this.toPayload(record)) };
  }
  async updateColumnWidths(dto: SaveColumnWidthDto): Promise<{ updated: number }> {
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.columns) {
        const columnId = this.parseUuidId('dropdown_columns_id', item.dropdown_columns_id);
        const existing = await tx.dropdownColumns.findFirst({
          where: { dropdownColumnsId: columnId },
          select: { dropdownColumnsId: true },
        });
        if (!existing) {
          throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
            'Dropdown column not found',
            'dropdown_columns_id',
            `No dropdown column found with id ${item.dropdown_columns_id}`,
          );
        }
        await tx.dropdownColumns.update({
          where: { dropdownColumnsId: columnId },
          data: { dropdownColumnsWidth: item.dropdown_columns_width },
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
        const columnId = this.parseUuidId('dropdown_columns_id', item.dropdown_columns_id);
        const existing = await tx.dropdownColumns.findFirst({
          where: { dropdownColumnsId: columnId },
          select: { dropdownColumnsId: true },
        });
        if (!existing) {
          throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
            'Dropdown column not found',
            'dropdown_columns_id',
            `No dropdown column found with id ${item.dropdown_columns_id}`,
          );
        }
        await tx.dropdownColumns.update({
          where: { dropdownColumnsId: columnId },
          data: { dropdownColumnsFilter: item.dropdown_columns_filter },
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
        const columnId = this.parseUuidId('dropdown_columns_id', item.dropdown_columns_id);
        const existing = await tx.dropdownColumns.findFirst({
          where: { dropdownColumnsId: columnId },
          select: { dropdownColumnsId: true },
        });
        if (!existing) {
          throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
            'Dropdown column not found',
            'dropdown_columns_id',
            `No dropdown column found with id ${item.dropdown_columns_id}`,
          );
        }
        await tx.dropdownColumns.update({
          where: { dropdownColumnsId: columnId },
          data: { dropdownColumnsVisiblity: item.dropdown_columns_visiblity },
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
          orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
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

  async deleteColumn(dropdown_columns_id: string): Promise<{ dropdown_columns_id: string; deleted: true }> {
    const parsedColumnId = this.parseUuidId('dropdown_columns_id', dropdown_columns_id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownColumns.findFirst({
        where: { dropdownColumnsId: parsedColumnId },
      });

      if (!existing) {
        throwFixedNotFound<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
          'Dropdown column not found',
          'dropdown_columns_id',
          `No dropdown column found with id ${dropdown_columns_id}`,
        );
      }

      await tx.dropdownColumns.delete({ where: { dropdownColumnsId: parsedColumnId } });

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: DROPDOWN_COLUMN_TABLE_NAME,
          screenName: DROPDOWN_DETAIL_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: dropdown_columns_id,
          displayName: existing.dropdownColumnsName ?? `Dropdown column ${dropdown_columns_id}`,
          originalRecord: this.toColumnPayload(existing),
          modifiedRecord: this.toColumnPayload(existing),
          userId: actor,
          notes: 'Dropdown column deleted',
        },
        tx,
      );

      return { dropdown_columns_id: dropdown_columns_id, deleted: true };
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
            orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
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
        // Prune removed columns BEFORE upserting. New columns in the payload have
        // no dropdown_columns_id yet, so they are absent from keptIds; deleting
        // first ensures the cleanup only targets columns the user actually removed
        // and never the rows that saveColumnsInTx is about to insert.
        if (saveDropdownDetailDto.replace_columns === true) {
          const keptIds = saveDropdownDetailDto.dropdown_columns
            .filter((col) => !!col.dropdown_columns_id)
            .map((col) => this.parseUuidId('dropdown_columns_id', col.dropdown_columns_id!));
          await tx.dropdownColumns.deleteMany({
            where: {
              dropdownColumnsDropdownId: parsedDropdownId,
              ...(keptIds.length > 0 ? { dropdownColumnsId: { notIn: keptIds } } : {}),
            },
          });
        }
        await this.saveColumnsInTx(saveDropdownDetailDto.dropdown_columns, parsedDropdownId, tx);
      }

      const full = await tx.dropdownDetails.findFirstOrThrow({
        where: { dropdownId: parsedDropdownId },
        include: {
          dropdownColumns: {
            orderBy: [{ dropdownColumnsNo: 'asc' }, { dropdownColumnsId: 'asc' }],
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
    const normalizedName = colDto.dropdown_columns_name?.trim();
    if (!normalizedName) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation failed',
        [
          {
            field: 'dropdown_columns_name',
            message: 'dropdown_columns_name must not be empty',
          },
        ],
      );
    }
    const normalizedDataType = colDto.dropdown_columns_data_type?.trim();
    if (!normalizedDataType) {
      throwFixedBadRequest<DropdownDetailErrorDetail, DropdownDetailErrorResponse>(
        'Validation failed',
        [{ field: 'dropdown_columns_data_type', message: 'dropdown_columns_data_type must not be empty' }],
      );
    }

    if (colDto.dropdown_columns_id) {
      const parsedId = this.parseUuidId('dropdown_columns_id', colDto.dropdown_columns_id);
      const colData: Prisma.DropdownColumnsUncheckedUpdateInput = {
        dropdownColumnsName: normalizedName,
        dropdownColumnsDropdownId: dropdownId,
        dropdownColumnsNo: colDto.dropdown_columns_no,
        dropdownColumnsDataType: normalizedDataType,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.dropdownColumns.update({ where: { dropdownColumnsId: parsedId }, data: colData });
    } else {
      const colData: Prisma.DropdownColumnsUncheckedCreateInput = {
        dropdownColumnsName: normalizedName,
        dropdownColumnsDropdownId: dropdownId,
        dropdownColumnsNo: colDto.dropdown_columns_no,
        dropdownColumnsDataType: normalizedDataType,
      };
      this.applyOptionalColumnFields(colData, colDto);
      await tx.dropdownColumns.create({ data: colData });
    }
  }

  private applyOptionalColumnFields(
    data: Prisma.DropdownColumnsUncheckedCreateInput | Prisma.DropdownColumnsUncheckedUpdateInput,
    dto: SaveDropdownColumnDto,
  ): void {
    if (hasOwnProperty(dto, 'dropdown_columns_alias'))
      data.dropdownColumnsAlias = dto.dropdown_columns_alias;
    if (hasOwnProperty(dto, 'dropdown_columns_width'))
      data.dropdownColumnsWidth = dto.dropdown_columns_width;
    if (hasOwnProperty(dto, 'dropdown_columns_visiblity'))
      data.dropdownColumnsVisiblity = dto.dropdown_columns_visiblity;
    if (hasOwnProperty(dto, 'dropdown_columns_allignment'))
      data.dropdownColumnsAllignment = dto.dropdown_columns_allignment;
    if (hasOwnProperty(dto, 'dropdown_columns_filter'))
      data.dropdownColumnsFilter = dto.dropdown_columns_filter;
    if (hasOwnProperty(dto, 'dropdown_columns_sql_name'))
      data.dropdownColumnsSqlName = dto.dropdown_columns_sql_name;
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
    if (hasOwnProperty(dto, 'dropdown_device_type'))
      data.dropdownDeviceType = dto.dropdown_device_type;
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
      dropdown_device_type: record.dropdownDeviceType,
      columns: record.dropdownColumns.map((col) => this.toColumnPayload(col)),
    };
  }

  private toColumnPayload(record: DropdownColumns): DropdownColumnPayload {
    return {
      dropdown_columns_id: record.dropdownColumnsId,
      dropdown_columns_dropdown_id: String(record.dropdownColumnsDropdownId),
      dropdown_columns_no: record.dropdownColumnsNo,
      dropdown_columns_data_type: record.dropdownColumnsDataType,
      dropdown_columns_name: record.dropdownColumnsName,
      dropdown_columns_alias: record.dropdownColumnsAlias,
      dropdown_columns_width: toNullableNumber(record.dropdownColumnsWidth),
      dropdown_columns_visiblity: record.dropdownColumnsVisiblity,
      dropdown_columns_allignment: record.dropdownColumnsAllignment,
      dropdown_columns_filter: record.dropdownColumnsFilter,
      dropdown_columns_sql_name: record.dropdownColumnsSqlName,
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
