import { Injectable } from '@nestjs/common';
import { Prisma, Widget, WidgetPlatform } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ListWidgetQueryDto } from './dto/list-widget-query.dto';
import { SaveWidgetDto } from './dto/save-widget.dto';
import {
  WidgetMasterErrorDetail,
  WidgetMasterListMeta,
  WidgetMasterPayload,
} from './types/widget-master-api.types';
import { resolvePagination } from 'src/common/utils/module-list.utils';
import {
  hasOwnProperty,
  throwMasterBadRequest,
  throwMasterNotFound,
} from 'src/common/utils/module-service.utils';

@Injectable()
export class WidgetMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async save(saveWidgetDto: SaveWidgetDto): Promise<WidgetMasterPayload> {
    if (saveWidgetDto.widgetNo !== undefined) {
      return this.updateWidget(saveWidgetDto);
    }

    return this.createWidget(saveWidgetDto);
  }

  async list(
    queryDto: ListWidgetQueryDto,
  ): Promise<{ items: WidgetMasterPayload[]; meta: WidgetMasterListMeta }> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.WidgetWhereInput = {};
    const search = queryDto.search?.trim() ?? '';
    const widgetGroupId = this.getWidgetGroupId(queryDto);

    if (queryDto.widgetType !== undefined) {
      where.widgetType = queryDto.widgetType;
    }

    if (queryDto.widgetVisibility !== undefined) {
      where.widgetVisibility = queryDto.widgetVisibility;
    }

    if (widgetGroupId === undefined) {
      if (search) {
        where.OR = this.buildSearchConditions(search);
      }

      const [total, records] = await Promise.all([
        this.prisma.widget.count({ where }),
        this.prisma.widget.findMany({
          where,
          orderBy: [
            { widgetType: 'asc' },
            { widgetGroupId: 'asc' },
            { widgetPosition: 'asc' },
            { widgetNo: 'asc' },
          ],
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

    const records = await this.prisma.widget.findMany({
      where,
      orderBy: [
        { widgetType: 'asc' },
        { widgetGroupId: 'asc' },
        { widgetPosition: 'asc' },
        { widgetNo: 'asc' },
      ],
    });

    const groupedRecords = this.collectWidgetGroupBranch(records, widgetGroupId);
    const filteredRecords = search
      ? groupedRecords.filter((record) => this.matchesSearch(record, search))
      : groupedRecords;
    const total = filteredRecords.length;
    const paginatedRecords = filteredRecords.slice(skip, skip + limit);

    return {
      items: paginatedRecords.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
  async getById(widgetNo: number, widgetType?: WidgetPlatform): Promise<WidgetMasterPayload> {
    const normalizedWidgetNo = this.normalizeWidgetNo(widgetNo);
    const where: Prisma.WidgetWhereInput = {
      widgetNo: normalizedWidgetNo,
    };
    if (widgetType !== undefined) {
      where.widgetType = widgetType;
    }
    const record = await this.prisma.widget.findFirst({ where });
    if (!record) {
      this.throwNotFound(normalizedWidgetNo, widgetType);
    }
    return this.toPayload(record);
  }
  async delete(widgetNo: number): Promise<{ widgetNo: number; deleted: true }> {
    const normalizedWidgetNo = this.normalizeWidgetNo(widgetNo);
    const deleted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.widget.findUnique({
        where: {
          widgetNo: normalizedWidgetNo,
        },
        select: {
          widgetNo: true,
        },
      });
      if (!existing) {
        return false;
      }
      await tx.widget.delete({
        where: {
          widgetNo: normalizedWidgetNo,
        },
      });
      return true;
    });
    if (!deleted) {
      this.throwNotFound(normalizedWidgetNo);
    }
    return {
      widgetNo: normalizedWidgetNo,
      deleted: true,
    };
  }
  private async createWidget(saveWidgetDto: SaveWidgetDto): Promise<WidgetMasterPayload> {
    const data: Record<string, unknown> = {
      widgetGroupId: saveWidgetDto.widgetGroupId,
      widgetName: saveWidgetDto.widgetName.trim(),
      widgetPosition: saveWidgetDto.widgetPosition ?? 0,
      widgetVisibility: saveWidgetDto.widgetVisibility ?? true,
      widgetType: saveWidgetDto.widgetType,
    };
    this.applyOptionalFields(data, saveWidgetDto);
    const created = await this.prisma.widget.create({
      data: data as Prisma.WidgetUncheckedCreateInput,
    });
    return this.toPayload(created);
  }
  private async updateWidget(saveWidgetDto: SaveWidgetDto): Promise<WidgetMasterPayload> {
    const widgetNo = this.normalizeWidgetNo(saveWidgetDto.widgetNo!);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.widget.findUnique({
        where: {
          widgetNo,
        },
      });
      if (!existing) {
        this.throwNotFound(widgetNo);
      }
      const data: Record<string, unknown> = {
        widgetGroupId: saveWidgetDto.widgetGroupId,
        widgetName: saveWidgetDto.widgetName.trim(),
        widgetPosition: saveWidgetDto.widgetPosition ?? existing.widgetPosition,
        widgetVisibility: saveWidgetDto.widgetVisibility ?? existing.widgetVisibility,
        widgetType: saveWidgetDto.widgetType,
      };
      this.applyOptionalFields(data, saveWidgetDto);
      const updated = await tx.widget.update({
        where: {
          widgetNo,
        },
        data: data as Prisma.WidgetUncheckedUpdateInput,
      });
      return this.toPayload(updated);
    });
  }
  private applyOptionalFields(
    data: Record<string, unknown>,
    saveWidgetDto: SaveWidgetDto,
  ): void {
    if (hasOwnProperty(saveWidgetDto, 'widgetGuiName')) {
      data.widgetGuiName = saveWidgetDto.widgetGuiName ?? null;
    }
    if (hasOwnProperty(saveWidgetDto, 'widgetSecondaryText')) {
      data.widgetSecondaryText = saveWidgetDto.widgetSecondaryText ?? null;
    }
  }
  private buildSearchConditions(search: string): Prisma.WidgetWhereInput[] {
    const searchConditions: Prisma.WidgetWhereInput[] = [
      { widgetName: { contains: search, mode: 'insensitive' } },
      { widgetGuiName: { contains: search, mode: 'insensitive' } },
      { widgetSecondaryText: { contains: search, mode: 'insensitive' } },
    ];
    if (/^\d+$/.test(search)) {
      searchConditions.push({ widgetGroupId: Number(search) });
    }
    return searchConditions;
  }
  private getWidgetGroupId(queryDto: ListWidgetQueryDto): number | undefined {
    const value = (queryDto as Record<string, unknown>).widgetGroupId;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return Number(value);
    }
    return undefined;
  }
  private matchesSearch(record: Widget, search: string): boolean {
    const normalizedSearch = search.toLowerCase();
    return (
      record.widgetName.toLowerCase().includes(normalizedSearch) ||
      (record.widgetGuiName?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (record.widgetSecondaryText?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (/^\d+$/.test(search) && record.widgetGroupId === Number(search))
    );
  }
  private collectWidgetGroupBranch(records: Widget[], widgetGroupId: number): Widget[] {
    if (records.length === 0) {
      return [];
    }
    const childrenByGroupId = new Map<number, Widget[]>();
    const recordsByWidgetNo = new Map<number, Widget>();
    for (const record of records) {
      recordsByWidgetNo.set(record.widgetNo, record);
      const siblings = childrenByGroupId.get(record.widgetGroupId) ?? [];
      siblings.push(record);
      childrenByGroupId.set(record.widgetGroupId, siblings);
    }
    const ordered: Widget[] = [];
    const visited = new Set<number>();
    const visit = (record: Widget): void => {
      if (visited.has(record.widgetNo)) {
        return;
      }
      visited.add(record.widgetNo);
      ordered.push(record);
      for (const child of childrenByGroupId.get(record.widgetNo) ?? []) {
        visit(child);
      }
    };
    const exactRoot = recordsByWidgetNo.get(widgetGroupId);
    if (exactRoot) {
      visit(exactRoot);
    }
    for (const root of childrenByGroupId.get(widgetGroupId) ?? []) {
      visit(root);
    }
    return ordered;
  }
  private toPayload(record: Widget): WidgetMasterPayload {
    return {
      widgetNo: record.widgetNo,
      widgetGroupId: record.widgetGroupId,
      widgetName: record.widgetName,
      widgetPosition: record.widgetPosition,
      widgetVisibility: record.widgetVisibility,
      widgetGuiName: record.widgetGuiName,
      widgetType: record.widgetType,
      widgetSecondaryText: record.widgetSecondaryText,
    };
  }
  private normalizeWidgetNo(widgetNo: number): number {
    if (!Number.isInteger(widgetNo) || widgetNo <= 0) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'widgetNo',
          message: 'widgetNo must be a positive integer',
        },
      ]);
    }
    return widgetNo;
  }
  private throwNotFound(widgetNo: number, widgetType?: WidgetPlatform): never {
    const suffix = widgetType !== undefined ? ` with widgetType ${widgetType}` : '';
    throwMasterNotFound<WidgetMasterErrorDetail>(
      'Widget not found',
      'widgetNo',
      `No widget found with widgetNo ${widgetNo}${suffix}`,
    );
  }
  private throwBadRequest(message: string, errors: WidgetMasterErrorDetail[]): never {
    throwMasterBadRequest<WidgetMasterErrorDetail>(message, errors);
  }
}
