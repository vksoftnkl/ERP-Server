import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemBrandMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemBrandQueryDto } from './dto/list-item-brand-query.dto';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import {
  ItemBrandErrorDetail,
  ItemBrandErrorResponse,
  ItemBrandListItem,
  ItemBrandListMeta,
  ItemBrandPayload,
} from './types/item-brand-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ITEM_BRAND_TABLE_NAME = 'item_brand_master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;
type ItemBrandWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class ItemsBrandMasterService {
  constructor(private readonly prisma: PrismaService) {}
  async save(saveItemBrandDto: SaveItemBrandDto): Promise<ItemBrandPayload> {
    if (saveItemBrandDto.brand_id) {
      return this.updateItemBrand(saveItemBrandDto);
    }
    return this.createItemBrand(saveItemBrandDto);
  }
  async list(
    queryDto: ListItemBrandQueryDto,
  ): Promise<{ items: ItemBrandListItem[]; meta: ItemBrandListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.brand_parent_id !== undefined ||
      queryDto.brand_is_active !== undefined ||
      Boolean(queryDto.search?.trim());
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.ItemBrandMasterWhereInput = {
      brand_is_deleted: false,
    };
    if (queryDto.brand_parent_id !== undefined) {
      where.brand_parent_id = queryDto.brand_parent_id;
    }
    if (queryDto.brand_is_active !== undefined) {
      where.brand_is_active = queryDto.brand_is_active;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { brand_name: { contains: search, mode: 'insensitive' } },
        { brand_alias: { contains: search, mode: 'insensitive' } },
        { brand_description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.itemBrandMaster.count({ where }),
      this.prisma.itemBrandMaster.findMany({
        where,
        orderBy: [{ brand_sort: 'asc' }, { brand_name: 'asc' }],
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
  ): Promise<{ items: ItemBrandListItem[]; meta: ItemBrandListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: ITEM_BRAND_TABLE_NAME,
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
    const baseSql = this.validateConfiguredGridSql(rawGridSql);
    const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS item_brand_grid`;
    const rowsSql = `SELECT * FROM (${baseSql}) AS item_brand_grid LIMIT $1 OFFSET $2`;
    try {
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql),
        this.prisma.$queryRawUnsafe<ItemBrandListItem[]>(rowsSql, limit, skip),
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
      this.throwBadRequest('Invalid grid_sql configuration for item brand list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for item_brand_master',
        },
      ]);
    }
  }
  private validateConfiguredGridSql(sql: string): string {
    const normalized = sql.trim().replace(/;+\s*$/g, '');
    if (!/^select\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item brand list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }
    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for item brand list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }
    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item brand list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }
    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item brand list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }
    if (!/\bitem_brand_master\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item brand list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference item_brand_master table',
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
  async getById(brandId: string): Promise<ItemBrandPayload> {
    const record = await this.prisma.itemBrandMaster.findFirst({
      where: {
        brand_id: brandId,
        brand_is_deleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(brandId);
    }
    return this.toPayload(record);
  }
  async softDelete(brandId: string): Promise<{ brand_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemBrandMaster.findFirst({
        where: {
          brand_id: brandId,
          brand_is_deleted: false,
        },
        select: {
          brand_parent_id: true,
        },
      });
      if (!existing) {
        this.throwNotFound(brandId);
      }

      const subtreeIds = await this.getActiveSubtreeIds(tx, brandId);
      const ancestorIds = await this.getAncestorIds(tx, existing.brand_parent_id);
      const result = await tx.itemBrandMaster.updateMany({
        where: {
          brand_id: brandId,
          brand_is_deleted: false,
        },
        data: {
          brand_is_deleted: true,
          brand_modified_on: new Date(),
          brand_modified_by: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(brandId);
      }

      await this.removePathIds(tx, ancestorIds, subtreeIds);
      return {
        brand_id: brandId,
        deleted: true,
      };
    });
  }
  private async createItemBrand(saveItemBrandDto: SaveItemBrandDto): Promise<ItemBrandPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (saveItemBrandDto.brand_parent_id) {
          await this.ensureParentExists(saveItemBrandDto.brand_parent_id, tx);
        }

        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data: Prisma.ItemBrandMasterUncheckedCreateInput = {
          brand_name: saveItemBrandDto.brand_name.trim(),
          brand_created_on: now,
          brand_created_by: createdBy,
          brand_modified_on: now,
          brand_modified_by: modifiedBy,
        };
        this.applyOptionalFields(data, saveItemBrandDto);
        const created = await tx.itemBrandMaster.create({ data });
        await this.ensureSelfInPath(tx, created.brand_id);

        if (saveItemBrandDto.brand_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveItemBrandDto.brand_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.brand_id]);
        }

        const refreshed = await tx.itemBrandMaster.findFirst({
          where: {
            brand_id: created.brand_id,
            brand_is_deleted: false,
          },
        });
        if (!refreshed) {
          return this.toPayload({
            ...created,
            brand_path_ids: this.mergePathIds(created.brand_path_ids, [created.brand_id]),
          });
        }
        return this.toPayload(refreshed);
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async updateItemBrand(saveItemBrandDto: SaveItemBrandDto): Promise<ItemBrandPayload> {
    const brandId = saveItemBrandDto.brand_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemBrandMaster.findFirst({
          where: {
            brand_id: brandId,
            brand_is_deleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(brandId);
        }
        if (saveItemBrandDto.brand_parent_id === brandId) {
          this.throwBadRequest('Item brand cannot be its own parent', [
            {
              field: 'brand_parent_id',
              message: 'brand_parent_id cannot be same as brand_id',
            },
          ]);
        }
        if (saveItemBrandDto.brand_parent_id) {
          await this.ensureParentExists(saveItemBrandDto.brand_parent_id, tx);
        }

        const hasParentField = this.hasOwnProperty(saveItemBrandDto, 'brand_parent_id');
        const nextParentId = hasParentField
          ? (saveItemBrandDto.brand_parent_id ?? null)
          : existing.brand_parent_id;
        const isParentChanged = hasParentField && nextParentId !== existing.brand_parent_id;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, brandId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.brand_parent_id)
          : [];

        const data: Prisma.ItemBrandMasterUncheckedUpdateInput = {
          brand_name: saveItemBrandDto.brand_name.trim(),
          brand_modified_on: new Date(),
          brand_modified_by: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveItemBrandDto);
        const updated = await tx.itemBrandMaster.update({
          where: {
            brand_id: brandId,
          },
          data,
        });

        await this.ensureSelfInPath(tx, brandId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await tx.itemBrandMaster.findFirst({
          where: {
            brand_id: brandId,
            brand_is_deleted: false,
          },
        });
        return this.toPayload(refreshed ?? updated);
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async ensureParentExists(parentId: string, tx: ItemBrandWriteClient): Promise<void> {
    const parent = await tx.itemBrandMaster.findFirst({
      where: {
        brand_id: parentId,
        brand_is_deleted: false,
      },
      select: {
        brand_id: true,
      },
    });
    if (!parent) {
      this.throwBadRequest('Parent item brand does not exist', [
        {
          field: 'brand_parent_id',
          message: `No active item brand found with id ${parentId}`,
        },
      ]);
    }
  }
  private applyOptionalFields(
    data: Prisma.ItemBrandMasterUncheckedCreateInput | Prisma.ItemBrandMasterUncheckedUpdateInput,
    saveItemBrandDto: SaveItemBrandDto,
  ): void {
    if (this.hasOwnProperty(saveItemBrandDto, 'brand_alias')) {
      data.brand_alias = saveItemBrandDto.brand_alias;
    }
    if (this.hasOwnProperty(saveItemBrandDto, 'brand_short')) {
      data.brand_short = saveItemBrandDto.brand_short;
    }
    if (this.hasOwnProperty(saveItemBrandDto, 'brand_description')) {
      data.brand_description = saveItemBrandDto.brand_description;
    }

    if (this.hasOwnProperty(saveItemBrandDto, 'brand_parent_id')) {
      data.brand_parent_id = saveItemBrandDto.brand_parent_id;
    }

    if (this.hasOwnProperty(saveItemBrandDto, 'brand_sort')) {
      data.brand_sort = saveItemBrandDto.brand_sort;
    }

    if (this.hasOwnProperty(saveItemBrandDto, 'brand_level')) {
      data.brand_level = saveItemBrandDto.brand_level;
    }
    if (this.hasOwnProperty(saveItemBrandDto, 'brand_photo')) {
      data.brand_photo = this.decodePhotoInput(saveItemBrandDto.brand_photo);
    }

    if (this.hasOwnProperty(saveItemBrandDto, 'brand_photo_url')) {
      data.brand_photo_url = saveItemBrandDto.brand_photo_url;
    }
  }
  private async getAncestorIds(
    tx: ItemBrandWriteClient,
    startParentId: string | null | undefined,
  ): Promise<string[]> {
    const ancestorIds: string[] = [];
    const visited = new Set<string>();
    let currentParentId = startParentId;

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        break;
      }
      visited.add(currentParentId);

      const parent = await tx.itemBrandMaster.findFirst({
        where: {
          brand_id: currentParentId,
          brand_is_deleted: false,
        },
        select: {
          brand_id: true,
          brand_parent_id: true,
        },
      });
      if (!parent) {
        break;
      }

      ancestorIds.push(parent.brand_id);
      currentParentId = parent.brand_parent_id;
    }

    return ancestorIds;
  }
  private async getActiveSubtreeIds(tx: ItemBrandWriteClient, rootId: string): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = await tx.itemBrandMaster.findFirst({
        where: {
          brand_id: currentId,
          brand_is_deleted: false,
        },
        select: {
          brand_id: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.brand_id);

      const children = await tx.itemBrandMaster.findMany({
        where: {
          brand_parent_id: node.brand_id,
          brand_is_deleted: false,
        },
        select: {
          brand_id: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.brand_id)) {
          queue.push(child.brand_id);
        }
      }
    }

    return subtreeIds;
  }
  private async appendPathIds(
    tx: ItemBrandWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.itemBrandMaster.findMany({
      where: {
        brand_id: {
          in: normalizedTargetIds,
        },
        brand_is_deleted: false,
      },
      select: {
        brand_id: true,
        brand_path_ids: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.brand_path_ids, normalizedIdsToAdd);
      if (this.areSameIds(record.brand_path_ids, nextPathIds)) {
        continue;
      }
      await tx.itemBrandMaster.update({
        where: {
          brand_id: record.brand_id,
        },
        data: {
          brand_path_ids: nextPathIds,
        },
      });
    }
  }
  private async removePathIds(
    tx: ItemBrandWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.itemBrandMaster.findMany({
      where: {
        brand_id: {
          in: normalizedTargetIds,
        },
        brand_is_deleted: false,
      },
      select: {
        brand_id: true,
        brand_path_ids: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.brand_path_ids, normalizedIdsToRemove);
      if (this.areSameIds(record.brand_path_ids, nextPathIds)) {
        continue;
      }
      await tx.itemBrandMaster.update({
        where: {
          brand_id: record.brand_id,
        },
        data: {
          brand_path_ids: nextPathIds,
        },
      });
    }
  }
  private async ensureSelfInPath(tx: ItemBrandWriteClient, brandId: string): Promise<void> {
    await this.appendPathIds(tx, [brandId], [brandId]);
  }
  private mergePathIds(existingIds: readonly string[], idsToAdd: readonly string[]): string[] {
    return this.toUniqueIds([...existingIds, ...idsToAdd]);
  }
  private excludePathIds(existingIds: readonly string[], idsToRemove: readonly string[]): string[] {
    const removeSet = new Set(idsToRemove);
    return existingIds.filter((id) => !removeSet.has(id));
  }
  private toUniqueIds(ids: readonly string[]): string[] {
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }
    return uniqueIds;
  }
  private areSameIds(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
    return true;
  }

  private decodePhotoInput(
    photo: string | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (photo === undefined) {
      return undefined;
    }

    if (photo === null) {
      return null;
    }

    const trimmed = photo.trim();
    if (!trimmed) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'brand_photo',
          message: 'brand_photo must be a non-empty base64 string',
        },
      ]);
    }

    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'brand_photo',
          message: 'brand_photo must be valid base64 content',
        },
      ]);
    }

    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }

  private toPayload(record: ItemBrandMaster): ItemBrandPayload {
    return {
      brand_id: record.brand_id,
      brand_name: record.brand_name,
      brand_alias: record.brand_alias,
      brand_short: record.brand_short,
      brand_description: record.brand_description,
      brand_photo: record.brand_photo ? Buffer.from(record.brand_photo).toString('base64') : null,
      brand_photo_url: record.brand_photo_url,
      brand_parent_id: record.brand_parent_id,
      brand_sort: record.brand_sort,
      brand_level: record.brand_level,
      brand_path_ids: record.brand_path_ids,
      brand_is_active: record.brand_is_active,
      brand_is_deleted: record.brand_is_deleted,
      brand_sync_date: record.brand_sync_date ? record.brand_sync_date.toISOString() : null,
      brand_created_on: record.brand_created_on.toISOString(),
      brand_created_by: record.brand_created_by,
      brand_modified_on: record.brand_modified_on.toISOString(),
      brand_modified_by: record.brand_modified_by,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item brand name already exists', [
          {
            field: 'brand_name',
            message: 'Duplicate brand_name is not allowed',
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

  private throwNotFound(brandId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item brand not found', [
        {
          field: 'brand_id',
          message: `No active item brand found with id ${brandId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemBrandErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemBrandErrorDetail[] = [],
  ): ItemBrandErrorResponse {
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
