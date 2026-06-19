import { Injectable } from '@nestjs/common';
import { categoryMaster, Prisma } from '@prisma/client';
import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import { ItemCategoryErrorDetail, ItemCategoryPayload } from './types/item-category-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const ITEM_CATEGORY_TABLE_NAME = 'item category master';
const ITEM_CATEGORY_AUDIT_SCREEN_NAME = 'Category Master';
type ItemCategoryWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class ItemsCategoryMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveItemCategoryDto: SaveItemCategoryDto): Promise<ItemCategoryPayload> {
    if (saveItemCategoryDto.category_id) {
      return this.updateItemCategory(saveItemCategoryDto);
    }
    return this.createItemCategory(saveItemCategoryDto);
  }
  async getById(categoryId: string): Promise<ItemCategoryPayload> {
    const record = await this.prisma.categoryMaster.findFirst({
      where: {
        categoryId,
        categoryIsDeleted: false,
      },
    });
    if (!record) {
      throwInventoryNotFound<ItemCategoryErrorDetail>(
        'Item category not found',
        'category_id',
        `No active item category found with id ${categoryId}`,
      );
    }
    const parentName = await this.getParentName(record.categoryParentId);
    return this.toPayload(record, parentName);
  }
  private async getParentName(parentId: string | null): Promise<string | null> {
    if (!parentId) return null;
    const parent = await this.prisma.categoryMaster.findFirst({
      where: { categoryId: parentId },
      select: { categoryName: true },
    });
    return parent?.categoryName ?? null;
  }
  async toggleDelete(categoryId: string): Promise<{ category_id: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Find regardless of current deleted state
      const existing = await tx.categoryMaster.findFirst({
        where: {
          categoryId,
        },
      });
      if (!existing) {
        throwInventoryNotFound<ItemCategoryErrorDetail>(
          'Item category not found',
          'category_id',
          `No item category found with id ${categoryId}`,
        );
      }
      const wasDeleted = existing.categoryIsDeleted;
      const nextDeleted = !wasDeleted;
      const subtreeIds = await this.getActiveSubtreeIds(tx, categoryId);
      const ancestorIds = await this.getAncestorIds(tx, existing.categoryParentId);
      const modifiedOn = new Date();
      const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // Guarded update: only flips if state hasn't changed since the read
      const result = await tx.categoryMaster.updateMany({
        where: {
          categoryId,
          categoryIsDeleted: wasDeleted,
        },
        data: {
          categoryIsDeleted: nextDeleted,
          categoryModifiedOn: modifiedOn,
          categoryModifiedBy: userId,
        },
      });
      if (result.count === 0) {
        throwInventoryNotFound<ItemCategoryErrorDetail>(
          'Item category not found',
          'category_id',
          `No item category found with id ${categoryId}`,
        );
      }
      if (nextDeleted) {
        await this.removePathIds(tx, ancestorIds, subtreeIds);
      } else {
        await this.appendPathIds(tx, ancestorIds, subtreeIds);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        categoryIsDeleted: nextDeleted,
        categoryModifiedOn: modifiedOn,
        categoryModifiedBy: userId,
      });
      await this.auditLogService.logEntityChange(
        {
          action: nextDeleted ? 'cancel' : 'update',
          tableName: ITEM_CATEGORY_TABLE_NAME,
          screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: categoryId,
          displayName: existing.categoryName,
          originalRecord,
          modifiedRecord,
          userId,
          notes: nextDeleted ? 'Item category soft deleted' : 'Item category restored',
        },
        tx,
      );
      return {
        category_id: categoryId,
        deleted: nextDeleted,
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
        const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data: Prisma.categoryMasterUncheckedCreateInput = {
          categoryName: saveItemCategoryDto.category_name.trim(),
          categoryCreatedOn: now,
          categoryCreatedBy: createdBy,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          throwInventoryNotFound<ItemCategoryErrorDetail>(
            'Item category not found',
            'category_id',
            `No active item category found with id ${categoryId}`,
          );
        }
        if (saveItemCategoryDto.category_parent_id === categoryId) {
          throwInventoryBadRequest<ItemCategoryErrorDetail>(
            'Item category cannot be its own parent',
            [
              {
                field: 'category_parent_id',
                message: 'category_parent_id cannot be same as category_id',
              },
            ],
          );
        }
        if (saveItemCategoryDto.category_parent_id) {
          await this.ensureParentExists(saveItemCategoryDto.category_parent_id, tx);
        }
        const hasParentField = hasOwnProperty(saveItemCategoryDto, 'category_parent_id');
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
          categoryModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
      throwInventoryBadRequest<ItemCategoryErrorDetail>('Parent item category does not exist', [
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
    if (hasOwnProperty(saveItemCategoryDto, 'category_alias')) {
      data.categoryAlias = saveItemCategoryDto.category_alias;
    }

    if (hasOwnProperty(saveItemCategoryDto, 'category_short')) {
      data.categoryShort = saveItemCategoryDto.category_short;
    }
    if (hasOwnProperty(saveItemCategoryDto, 'category_description')) {
      data.categoryDescription = saveItemCategoryDto.category_description;
    }
    if (hasOwnProperty(saveItemCategoryDto, 'category_parent_id')) {
      data.categoryParentId = saveItemCategoryDto.category_parent_id;
    }
    if (hasOwnProperty(saveItemCategoryDto, 'category_sort')) {
      data.categorySort = saveItemCategoryDto.category_sort;
    }
    if (hasOwnProperty(saveItemCategoryDto, 'category_level')) {
      data.categoryLevel = saveItemCategoryDto.category_level;
    }
    if (hasOwnProperty(saveItemCategoryDto, 'category_photo')) {
      data.categoryPhoto = this.decodePhotoInput(saveItemCategoryDto.category_photo);
    }
    if (hasOwnProperty(saveItemCategoryDto, 'category_photo_url')) {
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
      throwInventoryBadRequest<ItemCategoryErrorDetail>('Invalid base64 image provided', [
        {
          field: 'category_photo',
          message: 'category_photo must be a non-empty base64 string',
        },
      ]);
    }
    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      throwInventoryBadRequest<ItemCategoryErrorDetail>('Invalid base64 image provided', [
        {
          field: 'category_photo',
          message: 'category_photo must be valid base64 content',
        },
      ]);
    }
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }
  private toPayload(record: categoryMaster, parentName: string | null = null): ItemCategoryPayload {
    return {
      category_id: record.categoryId,
      category_name: record.categoryName,
      category_alias: record.categoryAlias,
      category_short: record.categoryShort,
      category_description: record.categoryDescription,
      category_parent_id: record.categoryParentId,
      category_parent_name: parentName,
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
    throwOnUniqueConstraintError<ItemCategoryErrorDetail>(
      error,
      'Item category name already exists',
      [{ field: 'category_name', message: 'Duplicate category_name is not allowed' }],
    );
  }
}
