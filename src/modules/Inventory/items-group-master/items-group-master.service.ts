import { Injectable } from '@nestjs/common';
import { ItemGroupMaster, Prisma } from '@prisma/client';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemGroupErrorDetail, ItemGroupPayload } from './types/item-group-api.types';
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
const ITEM_GROUP_TABLE_NAME = 'item group master';
const ITEM_GROUP_AUDIT_SCREEN_NAME = 'Item Group Master';
type ItemGroupWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class ItemsGroupMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    if (saveItemGroupDto.itg_id) {
      return this.updateItemGroup(saveItemGroupDto);
    }
    return this.createItemGroup(saveItemGroupDto);
  }
  async getById(itgId: string): Promise<ItemGroupPayload> {
    const record = await this.prisma.itemGroupMaster.findFirst({
      where: {
        itgId,
        itgIsDeleted: false,
      },
    });
    if (!record) {
      throwInventoryNotFound<ItemGroupErrorDetail>(
        'Item group not found',
        'itg_id',
        `No active item group found with id ${itgId}`,
      );
    }
    return this.toPayload(record);
  }
  async softDelete(itgId: string): Promise<{ itg_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemGroupMaster.findFirst({
        where: {
          itgId,
          itgIsDeleted: false,
        },
      });
      if (!existing) {
        throwInventoryNotFound<ItemGroupErrorDetail>(
          'Item group not found',
          'itg_id',
          `No active item group found with id ${itgId}`,
        );
      }
      const subtreeIds = await this.getActiveSubtreeIds(tx, itgId);
      const ancestorIds = await this.getAncestorIds(tx, existing.itgParentId);
      const modifiedOn = new Date();
      const result = await tx.itemGroupMaster.updateMany({
        where: {
          itgId,
          itgIsDeleted: false,
        },
        data: {
          itgIsDeleted: true,
          itgModifiedOn: modifiedOn,
          itgModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwInventoryNotFound<ItemGroupErrorDetail>(
          'Item group not found',
          'itg_id',
          `No active item group found with id ${itgId}`,
        );
      }
      await this.removePathIds(tx, ancestorIds, subtreeIds);
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        itgIsDeleted: true,
        itgModifiedOn: modifiedOn,
        itgModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_GROUP_TABLE_NAME,
          screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: itgId,
          displayName: existing.itgName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Item group soft deleted',
        },
        tx,
      );
      return {
        itg_id: itgId,
        deleted: true,
      };
    });
  }
  private async createItemGroup(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (saveItemGroupDto.itg_parent_id) {
          await this.ensureParentExists(saveItemGroupDto.itg_parent_id, tx);
        }
        const now = new Date();
        const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data: Prisma.ItemGroupMasterUncheckedCreateInput = {
          itgName: saveItemGroupDto.itg_name.trim(),
          itgCreatedOn: now,
          itgCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        const created = await tx.itemGroupMaster.create({ data });
        await this.ensureSelfInPath(tx, created.itgId);

        if (saveItemGroupDto.itg_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveItemGroupDto.itg_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.itgId]);
        }
        const refreshed = await tx.itemGroupMaster.findFirst({
          where: {
            itgId: created.itgId,
            itgIsDeleted: false,
          },
        });
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              itgPathIdsCache: this.mergePathIds(created.itgPathIdsCache, [created.itgId]),
            })
          : this.toPayload(refreshed);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_GROUP_TABLE_NAME,
            screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.itg_id,
            displayName: payload.itg_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item group created',
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
  private async updateItemGroup(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    const itgId = saveItemGroupDto.itg_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemGroupMaster.findFirst({
          where: {
            itgId,
            itgIsDeleted: false,
          },
        });
        if (!existing) {
          throwInventoryNotFound<ItemGroupErrorDetail>(
            'Item group not found',
            'itg_id',
            `No active item group found with id ${itgId}`,
          );
        }
        if (saveItemGroupDto.itg_parent_id === itgId) {
          throwInventoryBadRequest<ItemGroupErrorDetail>('Item group cannot be its own parent', [
            {
              field: 'itg_parent_id',
              message: 'itg_parent_id cannot be same as itg_id',
            },
          ]);
        }
        if (saveItemGroupDto.itg_parent_id) {
          await this.ensureParentExists(saveItemGroupDto.itg_parent_id, tx);
        }
        const hasParentField = hasOwnProperty(saveItemGroupDto, 'itg_parent_id');
        const nextParentId = hasParentField
          ? (saveItemGroupDto.itg_parent_id ?? null)
          : existing.itgParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.itgParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, itgId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.itgParentId)
          : [];
        const data: Prisma.ItemGroupMasterUncheckedUpdateInput = {
          itgName: saveItemGroupDto.itg_name.trim(),
          itgModifiedOn: new Date(),
          itgModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        const updated = await tx.itemGroupMaster.update({
          where: {
            itgId,
          },
          data,
        });
        await this.ensureSelfInPath(tx, itgId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }
        const refreshed = await tx.itemGroupMaster.findFirst({
          where: {
            itgId,
            itgIsDeleted: false,
          },
        });
        const payload = this.toPayload(refreshed ?? updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_GROUP_TABLE_NAME,
            screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: itgId,
            displayName: payload.itg_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item group updated',
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
  private async ensureParentExists(parentId: string, tx: ItemGroupWriteClient): Promise<void> {
    const parent = await tx.itemGroupMaster.findFirst({
      where: {
        itgId: parentId,
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
      },
    });
    if (!parent) {
      throwInventoryBadRequest<ItemGroupErrorDetail>('Parent item group does not exist', [
        {
          field: 'itg_parent_id',
          message: `No active item group found with id ${parentId}`,
        },
      ]);
    }
  }
  private applyOptionalFields(
    data: Prisma.ItemGroupMasterUncheckedCreateInput | Prisma.ItemGroupMasterUncheckedUpdateInput,
    saveItemGroupDto: SaveItemGroupDto,
  ): void {
    if (hasOwnProperty(saveItemGroupDto, 'itg_alias')) {
      data.itgAlias = saveItemGroupDto.itg_alias;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_short')) {
      data.itgShort = saveItemGroupDto.itg_short;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_description')) {
      data.itgDescription = saveItemGroupDto.itg_description;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_parent_id')) {
      data.itgParentId = saveItemGroupDto.itg_parent_id;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_sort')) {
      data.itgSort = saveItemGroupDto.itg_sort;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_level')) {
      data.itgLevel = saveItemGroupDto.itg_level;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_tax_claim')) {
      data.itgTaxClaim = saveItemGroupDto.itg_tax_claim;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_default_tax_id')) {
      data.itgDefaultTaxId = saveItemGroupDto.itg_default_tax_id;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_default_hsn')) {
      data.itgDefaultHsn = saveItemGroupDto.itg_default_hsn;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_default_uom_id')) {
      data.itgDefaultUomId = saveItemGroupDto.itg_default_uom_id;
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_photo')) {
      data.itgPhoto = this.decodePhotoInput(saveItemGroupDto.itg_photo);
    }
    if (hasOwnProperty(saveItemGroupDto, 'itg_photo_url')) {
      data.itgPhotoUrl = saveItemGroupDto.itg_photo_url;
    }
  }
  private async getAncestorIds(
    tx: ItemGroupWriteClient,
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

      const parent = await tx.itemGroupMaster.findFirst({
        where: {
          itgId: currentParentId,
          itgIsDeleted: false,
        },
        select: {
          itgId: true,
          itgParentId: true,
        },
      });
      if (!parent) {
        break;
      }
      ancestorIds.push(parent.itgId);
      currentParentId = parent.itgParentId;
    }
    return ancestorIds;
  }
  private async getActiveSubtreeIds(tx: ItemGroupWriteClient, rootId: string): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);
      const node = await tx.itemGroupMaster.findFirst({
        where: {
          itgId: currentId,
          itgIsDeleted: false,
        },
        select: {
          itgId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.itgId);

      const children = await tx.itemGroupMaster.findMany({
        where: {
          itgParentId: node.itgId,
          itgIsDeleted: false,
        },
        select: {
          itgId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.itgId)) {
          queue.push(child.itgId);
        }
      }
    }
    return subtreeIds;
  }
  private async appendPathIds(
    tx: ItemGroupWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }
    const records = await tx.itemGroupMaster.findMany({
      where: {
        itgId: {
          in: normalizedTargetIds,
        },
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
        itgPathIdsCache: true,
      },
    });
    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.itgPathIdsCache, normalizedIdsToAdd);
      if (this.areSameIds(record.itgPathIdsCache, nextPathIds)) {
        continue;
      }
      await tx.itemGroupMaster.update({
        where: {
          itgId: record.itgId,
        },
        data: {
          itgPathIdsCache: nextPathIds,
        },
      });
    }
  }
  private async removePathIds(
    tx: ItemGroupWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }
    const records = await tx.itemGroupMaster.findMany({
      where: {
        itgId: {
          in: normalizedTargetIds,
        },
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
        itgPathIdsCache: true,
      },
    });
    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.itgPathIdsCache, normalizedIdsToRemove);
      if (this.areSameIds(record.itgPathIdsCache, nextPathIds)) {
        continue;
      }
      await tx.itemGroupMaster.update({
        where: {
          itgId: record.itgId,
        },
        data: {
          itgPathIdsCache: nextPathIds,
        },
      });
    }
  }
  private async ensureSelfInPath(tx: ItemGroupWriteClient, itgId: string): Promise<void> {
    await this.appendPathIds(tx, [itgId], [itgId]);
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
      throwInventoryBadRequest<ItemGroupErrorDetail>('Invalid base64 image provided', [
        {
          field: 'itg_photo',
          message: 'itg_photo must be a non-empty base64 string',
        },
      ]);
    }
    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      throwInventoryBadRequest<ItemGroupErrorDetail>('Invalid base64 image provided', [
        {
          field: 'itg_photo',
          message: 'itg_photo must be valid base64 content',
        },
      ]);
    }
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }
  private toPayload(record: ItemGroupMaster): ItemGroupPayload {
    return {
      itg_id: record.itgId,
      itg_name: record.itgName,
      itg_alias: record.itgAlias,
      itg_short: record.itgShort,
      itg_description: record.itgDescription,
      itg_parent_id: record.itgParentId,
      itg_sort: record.itgSort,
      itg_level: record.itgLevel,
      itg_path_ids_cache: record.itgPathIdsCache,
      itg_tax_claim: record.itgTaxClaim,
      itg_default_tax_id: record.itgDefaultTaxId,
      itg_default_hsn: record.itgDefaultHsn,
      itg_default_uom_id: record.itgDefaultUomId,
      itg_photo: record.itgPhoto ? Buffer.from(record.itgPhoto).toString('base64') : null,
      itg_photo_url: record.itgPhotoUrl,
      itg_sync_date: record.itgSyncDate ? record.itgSyncDate.toISOString() : null,
      itg_is_active: record.itgIsActive,
      itg_is_deleted: record.itgIsDeleted,
      itg_created_on: record.itgCreatedOn.toISOString(),
      itg_created_by: record.itgCreatedBy,
      itg_modified_on: record.itgModifiedOn.toISOString(),
      itg_modified_by: record.itgModifiedBy,
    };
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemGroupErrorDetail>(error, 'Item group name already exists', [
      { field: 'itg_name', message: 'Duplicate itg_name is not allowed' },
    ]);
  }
}
