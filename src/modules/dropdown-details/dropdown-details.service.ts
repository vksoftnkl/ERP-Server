import { Injectable } from '@nestjs/common';
import { DropdownDetails, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListDropdownDetailQueryDto } from './dto/list-dropdown-detail-query.dto';
import { SaveDropdownDetailDto } from './dto/save-dropdown-detail.dto';
import {
  DropdownDetailErrorDetail,
  DropdownDetailListMeta,
  DropdownDetailPayload,
} from './types/dropdown-detail-api.types';
import { resolvePagination } from 'src/common/utils/module-list.utils';
import {
  hasOwnProperty,
  throwBadRequest,
  throwNotFound,
} from 'src/common/utils/module-service.utils';
@Injectable()
export class DropdownDetailsService {
  constructor(private readonly prisma: PrismaService) {}
  async save(saveDropdownDetailDto: SaveDropdownDetailDto): Promise<DropdownDetailPayload> {
    if (saveDropdownDetailDto.dropdown_id) {
      return this.updateDropdownDetails(saveDropdownDetailDto);
    }
    return this.createDropdownDetails(saveDropdownDetailDto);
  }
  async list(
    queryDto: ListDropdownDetailQueryDto,
  ): Promise<{ items: DropdownDetailPayload[]; meta: DropdownDetailListMeta }> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.DropdownDetailsWhereInput = {};
    if (queryDto.dropdown_show_header !== undefined) {
      where.dropdownShowHeader = queryDto.dropdown_show_header;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { dropdownName: { contains: search, mode: 'insensitive' } },
        { dropdownDescription: { contains: search, mode: 'insensitive' } },
        { dropdownSql: { contains: search, mode: 'insensitive' } },
        { dropdownSortColumn: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.dropdownDetails.count({ where }),
      this.prisma.dropdownDetails.findMany({
        where,
        orderBy: [{ dropdownName: 'asc' }, { dropdownId: 'asc' }],
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
  async getById(dropdownId: string): Promise<DropdownDetailPayload> {
    const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
    const record = await this.prisma.dropdownDetails.findUnique({
      where: {
        dropdownId: parsedDropdownId,
      },
    });
    if (!record) {
      throwNotFound<DropdownDetailErrorDetail>('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${dropdownId}`);
    }
    return this.toPayload(record);
  }
  async delete(dropdownId: string): Promise<{ dropdown_id: string; deleted: true }> {
    const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
    const deleted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownDetails.findUnique({
        where: {
          dropdownId: parsedDropdownId,
        },
        select: {
          dropdownId: true,
        },
      });
      if (!existing) {
        return false;
      }
      await tx.dropdownDetails.delete({
        where: {
          dropdownId: parsedDropdownId,
        },
      });
      return true;
    });
    if (!deleted) {
      throwNotFound<DropdownDetailErrorDetail>('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${dropdownId}`);
    }
    return {
      dropdown_id: dropdownId,
      deleted: true,
    };
  }
  private async createDropdownDetails(
    saveDropdownDetailDto: SaveDropdownDetailDto,
  ): Promise<DropdownDetailPayload> {
    const data: Prisma.DropdownDetailsUncheckedCreateInput = {
      dropdownName: saveDropdownDetailDto.dropdown_name.trim(),
      dropdownSql: saveDropdownDetailDto.dropdown_sql.trim(),
    };
    this.applyOptionalFields(data, saveDropdownDetailDto);
    const created = await this.prisma.dropdownDetails.create({ data });
    return this.toPayload(created);
  }
  private async updateDropdownDetails(
    saveDropdownDetailDto: SaveDropdownDetailDto,
  ): Promise<DropdownDetailPayload> {
    const dropdownId = saveDropdownDetailDto.dropdown_id!;
    const parsedDropdownId = this.parseIntId('dropdown_id', dropdownId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownDetails.findUnique({
        where: {
          dropdownId: parsedDropdownId,
        },
      });
      if (!existing) {
        throwNotFound<DropdownDetailErrorDetail>('Dropdown details not found', 'dropdown_id', `No dropdown details found with id ${dropdownId}`);
      }
      const data: Prisma.DropdownDetailsUncheckedUpdateInput = {
        dropdownName: saveDropdownDetailDto.dropdown_name.trim(),
        dropdownSql: saveDropdownDetailDto.dropdown_sql.trim(),
      };
      this.applyOptionalFields(data, saveDropdownDetailDto);
      const updated = await tx.dropdownDetails.update({
        where: { dropdownId: parsedDropdownId },
        data,
      });
      return this.toPayload(updated);
    });
  }
  private applyOptionalFields(
    data:
      | Prisma.DropdownDetailsUncheckedCreateInput
      | Prisma.DropdownDetailsUncheckedUpdateInput,
    saveDropdownDetailDto: SaveDropdownDetailDto,
  ): void {
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_description')) {
      data.dropdownDescription = saveDropdownDetailDto.dropdown_description;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_sort_order')) {
      data.dropdownSortOrder = saveDropdownDetailDto.dropdown_sort_order;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_sort_column')) {
      data.dropdownSortColumn = saveDropdownDetailDto.dropdown_sort_column;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_completion')) {
      data.dropdownCompletion = saveDropdownDetailDto.dropdown_completion;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_sql_regional')) {
      data.dropdownSqlRegional = saveDropdownDetailDto.dropdown_sql_regional;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_max_visible_items')) {
      data.dropdownMaxVisibleItems = saveDropdownDetailDto.dropdown_max_visible_items;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_show_header')) {
      data.dropdownShowHeader = saveDropdownDetailDto.dropdown_show_header;
    }
    if (hasOwnProperty(saveDropdownDetailDto, 'dropdown_width')) {
      data.dropdownWidth = saveDropdownDetailDto.dropdown_width;
    }
  }
  private toPayload(record: DropdownDetails): DropdownDetailPayload {
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
    };
  }
  private parseIntId(field: string, value: string): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwBadRequest<DropdownDetailErrorDetail>('Validation error', [
        {
          field,
          message: `${field} must be a numeric id`,
        },
      ]);
    }
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throwBadRequest<DropdownDetailErrorDetail>('Validation error', [
        {
          field,
          message: `${field} must be a positive numeric id`,
        },
      ]);
    }
    return parsed;
  }
}
