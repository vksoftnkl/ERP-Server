import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { categoryMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemCategoryQueryDto } from './dto/list-item-category-query.dto';
import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import {
  ItemCategoryErrorDetail,
  ItemCategoryErrorResponse,
  ItemCategoryListItem,
  ItemCategoryListMeta,
  ItemCategoryPayload,
} from './types/item-category-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ITEM_CATEGORY_TABLE_NAME = 'category_master';
const ITEM_CATEGORY_AUDIT_SCREEN_NAME = 'Category Master';
type ItemCategoryWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ItemsCategoryMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveItemCategoryDto: SaveItemCategoryDto): Promise<ItemCategoryPayload> {
    if (saveItemCategoryDto.category_id) {
      return this.updateItemCategory(saveItemCategoryDto);
    }

    return this.createItemCategory(saveItemCategoryDto);
  }

  async list(
    queryDto: ListItemCategoryQueryDto,
  ): Promise<{ items: ItemCategoryListItem[]; meta: ItemCategoryListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.category_parent_id !== undefined ||
      queryDto.category_is_active !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.categoryMasterWhereInput = {
      categoryIsDeleted: false,
    };

    if (queryDto.category_parent_id !== undefined) {
      where.categoryParentId = queryDto.category_parent_id;
    }

    if (queryDto.category_is_active !== undefined) {
      where.categoryIsActive = queryDto.category_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { categoryName: { contains: search, mode: 'insensitive' } },
        { categoryAlias: { contains: search, mode: 'insensitive' } },
        { categoryDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.categoryMaster.count({ where }),
      this.prisma.categoryMaster.findMany({
        where,
        orderBy: [{ categorySort: 'asc' }, { categoryName: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toListItem(record)),
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
  ): Promise<{ items: ItemCategoryListItem[]; meta: ItemCategoryListMeta } | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_CATEGORY_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_CATEGORY_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: ITEM_CATEGORY_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemCategoryListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_category_grid',
          limit,
          skip,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  private toListItem(record: categoryMaster): ItemCategoryListItem {
    return {
      category_id: record.categoryId,
      category_name: record.categoryName,
    };
  }

  async getById(categoryId: string): Promise<ItemCategoryPayload> {
    const record = await this.prisma.categoryMaster.findFirst({
      where: {
        categoryId,
        categoryIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(categoryId);
    }

    return this.toPayload(record);
  }

  async softDelete(categoryId: string): Promise<{ category_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.categoryMaster.findFirst({
        where: {
          categoryId,
          categoryIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(categoryId);
      }

      const subtreeIds = await this.getActiveSubtreeIds(tx, categoryId);
      const ancestorIds = await this.getAncestorIds(tx, existing.categoryParentId);
      const modifiedOn = new Date();
      const result = await tx.categoryMaster.updateMany({
        where: {
          categoryId,
          categoryIsDeleted: false,
        },
        data: {
          categoryIsDeleted: true,
          categoryModifiedOn: modifiedOn,
          categoryModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(categoryId);
      }

      await this.removePathIds(tx, ancestorIds, subtreeIds);

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        categoryIsDeleted: true,
        categoryModifiedOn: modifiedOn,
        categoryModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_CATEGORY_TABLE_NAME,
          screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: categoryId,
          displayName: existing.categoryName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Item category soft deleted',
        },
        tx,
      );

      return {
        category_id: categoryId,
        deleted: true,
      };
    });
  }

  private async createItemCategory(
    saveItemCategoryDto: SaveItemCategoryDto,
  ): Promise<ItemCategoryPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (saveItemCategoryDto.category_parent_id) {
          await this.ensureParentExists(saveItemCategoryDto.category_parent_id, tx);
        }

        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;

        const data: Prisma.categoryMasterUncheckedCreateInput = {
          categoryName: saveItemCategoryDto.category_name.trim(),
          categoryCreatedOn: now,
          categoryCreatedBy: createdBy,
          categoryModifiedOn: now,
          categoryModifiedBy: modifiedBy,
        };

        this.applyOptionalFields(data, saveItemCategoryDto);
        const created = await tx.categoryMaster.create({ data });
        await this.ensureSelfInPath(tx, created.categoryId);

        if (saveItemCategoryDto.category_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveItemCategoryDto.category_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.categoryId]);
        }

        const refreshed = await tx.categoryMaster.findFirst({
          where: {
            categoryId: created.categoryId,
            categoryIsDeleted: false,
          },
        });
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              categoryPathIdsCache: this.mergePathIds(created.categoryPathIdsCache, [
                created.categoryId,
              ]),
            })
          : this.toPayload(refreshed);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_CATEGORY_TABLE_NAME,
            screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.category_id,
            displayName: payload.category_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Item category created',
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

  private async updateItemCategory(
    saveItemCategoryDto: SaveItemCategoryDto,
  ): Promise<ItemCategoryPayload> {
    const categoryId = saveItemCategoryDto.category_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.categoryMaster.findFirst({
          where: {
            categoryId,
            categoryIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(categoryId);
        }

        if (saveItemCategoryDto.category_parent_id === categoryId) {
          this.throwBadRequest('Item category cannot be its own parent', [
            {
              field: 'category_parent_id',
              message: 'category_parent_id cannot be same as category_id',
            },
          ]);
        }

        if (saveItemCategoryDto.category_parent_id) {
          await this.ensureParentExists(saveItemCategoryDto.category_parent_id, tx);
        }

        const hasParentField = this.hasOwnProperty(saveItemCategoryDto, 'category_parent_id');
        const nextParentId = hasParentField
          ? (saveItemCategoryDto.category_parent_id ?? null)
          : existing.categoryParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.categoryParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, categoryId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.categoryParentId)
          : [];

        const data: Prisma.categoryMasterUncheckedUpdateInput = {
          categoryName: saveItemCategoryDto.category_name.trim(),
          categoryModifiedOn: new Date(),
          categoryModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveItemCategoryDto);
        const updated = await tx.categoryMaster.update({
          where: {
            categoryId,
          },
          data,
        });

        await this.ensureSelfInPath(tx, categoryId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await tx.categoryMaster.findFirst({
          where: {
            categoryId,
            categoryIsDeleted: false,
          },
        });
        const payload = this.toPayload(refreshed ?? updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_CATEGORY_TABLE_NAME,
            screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: categoryId,
            displayName: payload.category_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Item category updated',
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

  private async ensureParentExists(parentId: string, tx: ItemCategoryWriteClient): Promise<void> {
    const parent = await tx.categoryMaster.findFirst({
      where: {
        categoryId: parentId,
        categoryIsDeleted: false,
      },
      select: {
        categoryId: true,
      },
    });

    if (!parent) {
      this.throwBadRequest('Parent item category does not exist', [
        {
          field: 'category_parent_id',
          message: `No active item category found with id ${parentId}`,
        },
      ]);
    }
  }

  private applyOptionalFields(
    data: Prisma.categoryMasterUncheckedCreateInput | Prisma.categoryMasterUncheckedUpdateInput,
    saveItemCategoryDto: SaveItemCategoryDto,
  ): void {
    if (this.hasOwnProperty(saveItemCategoryDto, 'category_alias')) {
      data.categoryAlias = saveItemCategoryDto.category_alias;
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_short')) {
      data.categoryShort = saveItemCategoryDto.category_short;
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_description')) {
      data.categoryDescription = saveItemCategoryDto.category_description;
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_parent_id')) {
      data.categoryParentId = saveItemCategoryDto.category_parent_id;
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_sort')) {
      data.categorySort = saveItemCategoryDto.category_sort;
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_level')) {
      data.categoryLevel = saveItemCategoryDto.category_level;
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_photo')) {
      data.categoryPhoto = this.decodePhotoInput(saveItemCategoryDto.category_photo);
    }

    if (this.hasOwnProperty(saveItemCategoryDto, 'category_photo_url')) {
      data.categoryPhotoUrl = saveItemCategoryDto.category_photo_url;
    }
  }

  private async getAncestorIds(
    tx: ItemCategoryWriteClient,
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

      const parent = await tx.categoryMaster.findFirst({
        where: {
          categoryId: currentParentId,
          categoryIsDeleted: false,
        },
        select: {
          categoryId: true,
          categoryParentId: true,
        },
      });
      if (!parent) {
        break;
      }

      ancestorIds.push(parent.categoryId);
      currentParentId = parent.categoryParentId;
    }

    return ancestorIds;
  }

  private async getActiveSubtreeIds(
    tx: ItemCategoryWriteClient,
    rootId: string,
  ): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = await tx.categoryMaster.findFirst({
        where: {
          categoryId: currentId,
          categoryIsDeleted: false,
        },
        select: {
          categoryId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.categoryId);

      const children = await tx.categoryMaster.findMany({
        where: {
          categoryParentId: node.categoryId,
          categoryIsDeleted: false,
        },
        select: {
          categoryId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.categoryId)) {
          queue.push(child.categoryId);
        }
      }
    }

    return subtreeIds;
  }

  private async appendPathIds(
    tx: ItemCategoryWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.categoryMaster.findMany({
      where: {
        categoryId: {
          in: normalizedTargetIds,
        },
        categoryIsDeleted: false,
      },
      select: {
        categoryId: true,
        categoryPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.categoryPathIdsCache, normalizedIdsToAdd);
      if (this.areSameIds(record.categoryPathIdsCache, nextPathIds)) {
        continue;
      }
      await tx.categoryMaster.update({
        where: {
          categoryId: record.categoryId,
        },
        data: {
          categoryPathIdsCache: nextPathIds,
        },
      });
    }
  }

  private async removePathIds(
    tx: ItemCategoryWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.categoryMaster.findMany({
      where: {
        categoryId: {
          in: normalizedTargetIds,
        },
        categoryIsDeleted: false,
      },
      select: {
        categoryId: true,
        categoryPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.categoryPathIdsCache, normalizedIdsToRemove);
      if (this.areSameIds(record.categoryPathIdsCache, nextPathIds)) {
        continue;
      }
      await tx.categoryMaster.update({
        where: {
          categoryId: record.categoryId,
        },
        data: {
          categoryPathIdsCache: nextPathIds,
        },
      });
    }
  }

  private async ensureSelfInPath(tx: ItemCategoryWriteClient, categoryId: string): Promise<void> {
    await this.appendPathIds(tx, [categoryId], [categoryId]);
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
          field: 'category_photo',
          message: 'category_photo must be a non-empty base64 string',
        },
      ]);
    }
    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'category_photo',
          message: 'category_photo must be valid base64 content',
        },
      ]);
    }
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }

  private toPayload(record: categoryMaster): ItemCategoryPayload {
    return {
      category_id: record.categoryId,
      category_name: record.categoryName,
      category_alias: record.categoryAlias,
      category_short: record.categoryShort,
      category_description: record.categoryDescription,
      category_parent_id: record.categoryParentId,
      category_sort: record.categorySort,
      category_level: record.categoryLevel,
      category_path_ids_cache: record.categoryPathIdsCache,
      category_tax_claim: null,
      category_default_tax_id: null,
      category_default_hsn: null,
      category_default_uom_id: null,
      category_photo: record.categoryPhoto
        ? Buffer.from(record.categoryPhoto).toString('base64')
        : null,
      category_photo_url: record.categoryPhotoUrl,
      category_sync_date: record.categorySyncDate ? record.categorySyncDate.toISOString() : null,
      category_is_active: record.categoryIsActive,
      category_is_deleted: record.categoryIsDeleted,
      category_created_on: record.categoryCreatedOn.toISOString(),
      category_created_by: record.categoryCreatedBy,
      category_modified_on: record.categoryModifiedOn.toISOString(),
      category_modified_by: record.categoryModifiedBy,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item category name already exists', [
          {
            field: 'category_name',
            message: 'Duplicate category_name is not allowed',
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

  private throwNotFound(categoryId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item category not found', [
        {
          field: 'category_id',
          message: `No active item category found with id ${categoryId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemCategoryErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemCategoryErrorDetail[] = [],
  ): ItemCategoryErrorResponse {
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
