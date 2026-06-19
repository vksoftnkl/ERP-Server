import { Injectable } from '@nestjs/common';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemBrandErrorDetail, ItemBrandPayload } from './types/item-brand-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ItemBrandMaster, Prisma } from '@prisma/client';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const ITEM_BRAND_TABLE_NAME = 'item brand master';
const ITEM_BRAND_AUDIT_SCREEN_NAME = 'Item Brand Master';
type ItemBrandWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class ItemsBrandMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveItemBrandDto: SaveItemBrandDto): Promise<ItemBrandPayload> {
    if (saveItemBrandDto.brand_id) {
      return this.updateItemBrand(saveItemBrandDto);
    }
    return this.createItemBrand(saveItemBrandDto);
  }
  async getById(brandId: string): Promise<ItemBrandPayload> {
    const record = await this.prisma.itemBrandMaster.findFirst({
      where: {
        brand_id: brandId,
        brand_is_deleted: false,
      },
    });
    if (!record) {
      throwInventoryNotFound<ItemBrandErrorDetail>(
        'Item brand not found',
        'brand_id',
        `No active item brand found with id ${brandId}`,
      );
    }
    return this.toPayload(record);
  }
  async toggleDelete(brandId: string): Promise<{ brand_id: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Find regardless of current deleted state
      const existing = await tx.itemBrandMaster.findFirst({
        where: {
          brand_id: brandId,
        },
      });
      if (!existing) {
        throwInventoryNotFound<ItemBrandErrorDetail>(
          'Item brand not found',
          'brand_id',
          `No item brand found with id ${brandId}`,
        );
      }
      const wasDeleted = existing.brand_is_deleted;
      const nextDeleted = !wasDeleted;
      const subtreeIds = await this.getActiveSubtreeIds(tx, brandId);
      const ancestorIds = await this.getAncestorIds(tx, existing.brand_parent_id);
      const modifiedOn = new Date();
      const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // Guarded update: only flips if state hasn't changed since the read
      const result = await tx.itemBrandMaster.updateMany({
        where: {
          brand_id: brandId,
          brand_is_deleted: wasDeleted,
        },
        data: {
          brand_is_deleted: nextDeleted,
          brand_modified_on: modifiedOn,
          brand_modified_by: userId,
        },
      });
      if (result.count === 0) {
        throwInventoryNotFound<ItemBrandErrorDetail>(
          'Item brand not found',
          'brand_id',
          `No item brand found with id ${brandId}`,
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
        brand_is_deleted: nextDeleted,
        brand_modified_on: modifiedOn,
        brand_modified_by: userId,
      });
      await this.auditLogService.logEntityChange(
        {
          action: nextDeleted ? 'cancel' : 'update',
          tableName: ITEM_BRAND_TABLE_NAME,
          screenName: ITEM_BRAND_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: brandId,
          displayName: existing.brand_name,
          originalRecord,
          modifiedRecord,
          userId,
          notes: nextDeleted ? 'Item brand soft deleted' : 'Item brand restored',
        },
        tx,
      );
      return {
        brand_id: brandId,
        deleted: nextDeleted,
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
        const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data: Prisma.ItemBrandMasterUncheckedCreateInput = {
          brand_name: saveItemBrandDto.brand_name.trim(),
          brand_created_on: now,
          brand_created_by: createdBy,
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
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              brand_path_ids: this.mergePathIds(created.brand_path_ids, [created.brand_id]),
            })
          : this.toPayload(refreshed);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_BRAND_TABLE_NAME,
            screenName: ITEM_BRAND_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.brand_id,
            displayName: payload.brand_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item brand created',
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
          throwInventoryNotFound<ItemBrandErrorDetail>(
            'Item brand not found',
            'brand_id',
            `No active item brand found with id ${brandId}`,
          );
        }
        if (saveItemBrandDto.brand_parent_id === brandId) {
          throwInventoryBadRequest<ItemBrandErrorDetail>('Item brand cannot be its own parent', [
            {
              field: 'brand_parent_id',
              message: 'brand_parent_id cannot be same as brand_id',
            },
          ]);
        }
        if (saveItemBrandDto.brand_parent_id) {
          await this.ensureParentExists(saveItemBrandDto.brand_parent_id, tx);
        }
        const hasParentField = hasOwnProperty(saveItemBrandDto, 'brand_parent_id');
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
          brand_modified_by: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        const payload = this.toPayload(refreshed ?? updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_BRAND_TABLE_NAME,
            screenName: ITEM_BRAND_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: brandId,
            displayName: payload.brand_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item brand updated',
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
      throwInventoryBadRequest<ItemBrandErrorDetail>('Parent item brand does not exist', [
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
    if (hasOwnProperty(saveItemBrandDto, 'brand_alias')) {
      data.brand_alias = saveItemBrandDto.brand_alias;
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_short')) {
      data.brand_short = saveItemBrandDto.brand_short;
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_description')) {
      data.brand_description = saveItemBrandDto.brand_description;
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_parent_id')) {
      data.brand_parent_id = saveItemBrandDto.brand_parent_id;
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_sort')) {
      data.brand_sort = saveItemBrandDto.brand_sort;
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_level')) {
      data.brand_level = saveItemBrandDto.brand_level;
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_photo')) {
      data.brand_photo = this.decodePhotoInput(saveItemBrandDto.brand_photo);
    }
    if (hasOwnProperty(saveItemBrandDto, 'brand_photo_url')) {
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
      throwInventoryBadRequest<ItemBrandErrorDetail>('Invalid base64 image provided', [
        {
          field: 'brand_photo',
          message: 'brand_photo must be a non-empty base64 string',
        },
      ]);
    }
    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      throwInventoryBadRequest<ItemBrandErrorDetail>('Invalid base64 image provided', [
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
    throwOnUniqueConstraintError<ItemBrandErrorDetail>(error, 'Item brand name already exists', [
      { field: 'brand_name', message: 'Duplicate brand_name is not allowed' },
    ]);
  }
}
