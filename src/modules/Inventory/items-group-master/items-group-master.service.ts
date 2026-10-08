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
import { StockTrackPolicyService } from 'src/modules/stocks/stock-track-policy/stock-track-policy.service';
import {
  ITEM_GROUP_TREE,
  assertDeleteState,
  assertNoLiveChildren,
  assertNoLiveReferences,
  assertNotUnderOwnSubtree,
  assertParentLive,
  relevelSubtree,
  type LiveReference,
} from '../utils/master-tree.helper';
const ITEM_GROUP_TABLE_NAME = 'item group master';
const ITEM_GROUP_AUDIT_SCREEN_NAME = 'Item Group Master';
// The payload echoes the preset's name next to itg_track_preset_id, so every
// path that builds one pulls that single column over the relation.
const TRACK_PRESET_INCLUDE = {
  trackPreset: { select: { sptName: true } },
} satisfies Prisma.ItemGroupMasterInclude;
type ItemGroupWriteClient = Prisma.TransactionClient | PrismaService;
/** What keeps a group from being deleted besides its own children (notes 70 B4). */
const ITEM_GROUP_REFERENCES: readonly LiveReference[] = [
  {
    table: 'inventory.item_master',
    column: 'item_group_id',
    live: 'item_is_deleted = false',
    label: 'items',
  },
];
const ITEM_GROUP_DELETE_STATE = {
  label: 'item group',
  idField: 'itg_id',
  restoreRoute: '/item-groups/restore',
};
@Injectable()
export class ItemsGroupMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly stockTrackPolicyService: StockTrackPolicyService,
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
      include: TRACK_PRESET_INCLUDE,
    });
    if (!record) {
      throwInventoryNotFound<ItemGroupErrorDetail>(
        'Item group not found',
        'itg_id',
        `No active item group found with id ${itgId}`,
      );
    }
    const parentName = await this.resolveParentName(record.itgParentId);
    return this.toPayload(record, parentName);
  }
  private async resolveParentName(parentId: string | null): Promise<string | null> {
    if (!parentId) {
      return null;
    }
    const parent = await this.prisma.itemGroupMaster.findFirst({
      where: { itgId: parentId },
      select: { itgName: true },
    });
    return parent?.itgName ?? null;
  }
  /**
   * DELETE deletes — it is no longer a toggle (notes 70 C1): an already
   * deleted group is a 409, and POST /item-groups/restore brings one back.
   * Refused (409) while live sub-groups or live items still hang off it (B4).
   */
  async softDelete(itgId: string): Promise<{ itg_id: string; deleted: boolean }> {
    return this.setDeleted(itgId, true);
  }
  /** Restore a deleted group. Refused (409) when it is not deleted or its parent is. */
  async restore(itgId: string): Promise<{ itg_id: string; deleted: boolean }> {
    return this.setDeleted(itgId, false);
  }
  private async setDeleted(
    itgId: string,
    wantDeleted: boolean,
  ): Promise<{ itg_id: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Find regardless of current deleted state
      const existing = await tx.itemGroupMaster.findFirst({
        where: { itgId },
      });

      if (!existing) {
        throwInventoryNotFound<ItemGroupErrorDetail>(
          'Item group not found',
          'itg_id',
          `No item group found with id ${itgId}`,
        );
      }

      assertDeleteState(existing.itgIsDeleted, wantDeleted, ITEM_GROUP_DELETE_STATE);
      if (wantDeleted) {
        await assertNoLiveChildren(tx, ITEM_GROUP_TREE, itgId);
        await assertNoLiveReferences(tx, ITEM_GROUP_REFERENCES, itgId, ITEM_GROUP_DELETE_STATE);
      } else {
        await assertParentLive(tx, ITEM_GROUP_TREE, existing.itgParentId);
      }
      const wasDeleted = existing.itgIsDeleted;
      const nextDeleted = wantDeleted;
      const modifiedOn = new Date();
      const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;

      // getActiveSubtreeIds only walks live rows, so the subtree has to be read
      // while this row is still active — before the flip when deleting, after
      // it when restoring (below). Reading it in the deleted state yields
      // nothing, and the ancestors' caches never get the ids back.
      const subtreeIds = wasDeleted ? [] : await this.getActiveSubtreeIds(tx, itgId);
      const ancestorIds = await this.getAncestorIds(tx, existing.itgParentId);

      // Guarded update: only flips if state hasn't changed since the read
      const result = await tx.itemGroupMaster.updateMany({
        where: { itgId, itgIsDeleted: wasDeleted },
        data: {
          itgIsDeleted: nextDeleted,
          itgModifiedOn: modifiedOn,
          itgModifiedBy: userId,
        },
      });

      if (result.count === 0) {
        // Lost a race, or row vanished between read and write
        throwInventoryNotFound<ItemGroupErrorDetail>(
          'Item group not found',
          'itg_id',
          `No item group found with id ${itgId}`,
        );
      }

      if (nextDeleted) {
        await this.removePathIds(tx, ancestorIds, subtreeIds);
        // Notes 71 B3 — the group's derived GROUP-scope policy goes with it; it
        // used to stay live and active under a deleted group.
        await this.stockTrackPolicyService.retireForGroup(itgId, tx);
      } else {
        // Now that the row is live again, the same subtree the delete stripped
        // out — this row plus every descendant that stayed active — reads back.
        await this.appendPathIds(tx, ancestorIds, await this.getActiveSubtreeIds(tx, itgId));
        // ...and its preset derives the GROUP policy again.
        await this.stockTrackPolicyService.syncFromItemGroup(existing, tx);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        itgIsDeleted: nextDeleted,
        itgModifiedOn: modifiedOn,
        itgModifiedBy: userId,
      });

      await this.auditLogService.logEntityChange(
        {
          action: nextDeleted ? 'cancel' : 'update',
          tableName: ITEM_GROUP_TABLE_NAME,
          screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: itgId,
          displayName: existing.itgName,
          originalRecord,
          modifiedRecord,
          userId,
          notes: nextDeleted ? 'Item group soft deleted' : 'Item group restored',
        },
        tx,
      );

      return { itg_id: itgId, deleted: nextDeleted };
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
        const data: Prisma.ItemGroupMasterUncheckedCreateInput = {
          itgName: saveItemGroupDto.itg_name.trim(),
          itgCreatedOn: now,
          itgCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        const created = await tx.itemGroupMaster.create({ data, include: TRACK_PRESET_INCLUDE });
        await this.ensureSelfInPath(tx, created.itgId);
        // Same transaction as the group: a GROUP-scope track policy and the
        // group it applies to are written or rolled back together. A no-op when
        // no preset was chosen — a group has no tracking flags to fall back to,
        // and an empty GROUP policy would shadow the company-wide one for every
        // item in the group.
        await this.stockTrackPolicyService.syncFromItemGroup(created, tx);

        if (saveItemGroupDto.itg_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveItemGroupDto.itg_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.itgId]);
        }
        // itg_level is the node's depth, computed — never the payload's (B1).
        await relevelSubtree(tx, ITEM_GROUP_TREE, created.itgId);
        const refreshed = await tx.itemGroupMaster.findFirst({
          where: {
            itgId: created.itgId,
            itgIsDeleted: false,
          },
          include: TRACK_PRESET_INCLUDE,
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
        // `!== undefined`, not hasOwnProperty: every declared DTO field is an
        // own property (ES2022 class fields), so an OMITTED parent used to read
        // as "moved to root" and shuffle the path caches. null / "" still clear.
        const hasParentField = saveItemGroupDto.itg_parent_id !== undefined;
        const nextParentId = hasParentField
          ? (saveItemGroupDto.itg_parent_id ?? null)
          : existing.itgParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.itgParentId;
        if (isParentChanged) {
          // B3: under its own descendant would be a loop.
          await assertNotUnderOwnSubtree(tx, ITEM_GROUP_TREE, itgId, nextParentId);
        }
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
          include: TRACK_PRESET_INCLUDE,
        });
        await this.ensureSelfInPath(tx, itgId);
        // Refreshes the derived policy from the saved row: writes it when a
        // preset was picked, retires it when the preset was cleared, and leaves
        // an admin-authored GROUP policy alone either way.
        await this.stockTrackPolicyService.syncFromItemGroup(updated, tx);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }
        // The node and its whole subtree take their depth from where they now
        // sit (B1, B2) — also repairs a level a payload or an old bug left wrong.
        await relevelSubtree(tx, ITEM_GROUP_TREE, itgId);
        const refreshed = await tx.itemGroupMaster.findFirst({
          where: {
            itgId,
            itgIsDeleted: false,
          },
          include: TRACK_PRESET_INCLUDE,
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
    // itg_level is not taken from the payload: relevelSubtree computes it (B1).
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
    if (hasOwnProperty(saveItemGroupDto, 'itg_track_preset_id')) {
      data.itgTrackPresetId = saveItemGroupDto.itg_track_preset_id;
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
  private toPayload(
    record: ItemGroupMaster & { trackPreset?: { sptName: string } | null },
    parentName: string | null = null,
  ): ItemGroupPayload {
    return {
      itg_id: record.itgId,
      itg_name: record.itgName,
      itg_alias: record.itgAlias,
      itg_short: record.itgShort,
      itg_description: record.itgDescription,
      itg_parent_id: record.itgParentId,
      itg_parent_name: parentName,
      itg_sort: record.itgSort,
      itg_level: record.itgLevel,
      itg_path_ids_cache: record.itgPathIdsCache,
      itg_tax_claim: record.itgTaxClaim,
      itg_default_tax_id: record.itgDefaultTaxId,
      itg_default_hsn: record.itgDefaultHsn,
      itg_default_uom_id: record.itgDefaultUomId,
      itg_track_preset_id: record.itgTrackPresetId,
      itg_track_preset_name: record.trackPreset?.sptName ?? null,
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
