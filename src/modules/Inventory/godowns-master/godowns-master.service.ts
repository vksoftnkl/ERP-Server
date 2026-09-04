import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GodownLocation, Prisma } from '@prisma/client';
import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownErrorDetail, GodownPayload } from './types/godown-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const GODOWN_LOCATION_TABLE_NAME = 'godown locations';
const GODOWN_LOCATION_AUDIT_SCREEN_NAME = 'Godown Location Master';
type GodownLocationWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class GodownsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveGodownDto: SaveGodownDto): Promise<GodownPayload> {
    const normalizedSaveGodownDto = this.normalizeLegacySaveGodownDto(saveGodownDto);
    if (normalizedSaveGodownDto.gdl_id) {
      return this.updateGodownLocation(normalizedSaveGodownDto);
    }
    return this.createGodownLocation(normalizedSaveGodownDto);
  }
  async getById(gdlId: string): Promise<GodownPayload> {
    const record = await this.findActiveLocation(this.prisma, gdlId);
    if (!record) {
      throwInventoryNotFound<GodownErrorDetail>(
        'Godown location not found',
        'gdl_id',
        `No active godown location found with id ${gdlId}`,
      );
    }
    const payload = this.toPayload(record);
    const [parentName, branchName] = await Promise.all([
      this.getParentName(this.prisma, record.gdlParentId),
      this.getBranchName(this.prisma, record.gdlBranchId),
    ]);
    payload.gdl_parent_name = parentName;
    payload.gdl_branch_name = branchName;
    return payload;
  }
  async toggleDelete(gdlId: string): Promise<{ gdl_id: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Find regardless of current deleted state
      const existing = await tx.godownLocation.findFirst({
        where: { gdlId },
      });
      if (!existing) {
        throwInventoryNotFound<GodownErrorDetail>(
          'Godown location not found',
          'gdl_id',
          `No godown location found with id ${gdlId}`,
        );
      }

      const wasDeleted = existing.gdlIsDeleted;
      const nextDeleted = !wasDeleted;
      const now = new Date();
      const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const subtreeIds = await this.getActiveSubtreeIds(tx, gdlId);
      const ancestorIds = await this.getAncestorIds(tx, existing.gdlParentId);

      // Guarded update: only flips if state hasn't changed since the read
      const result = await tx.godownLocation.updateMany({
        where: {
          gdlId,
          gdlIsDeleted: wasDeleted,
        },
        data: {
          gdlIsDeleted: nextDeleted,
          gdlModifiedOn: now,
          gdlModifiedBy: userId,
        },
      });

      if (result.count === 0) {
        throwInventoryNotFound<GodownErrorDetail>(
          'Godown location not found',
          'gdl_id',
          `No godown location found with id ${gdlId}`,
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
        gdlIsDeleted: nextDeleted,
        gdlModifiedOn: now,
        gdlModifiedBy: userId,
      });

      await this.auditLogService.logEntityChange(
        {
          action: nextDeleted ? 'cancel' : 'update',
          tableName: GODOWN_LOCATION_TABLE_NAME,
          screenName: GODOWN_LOCATION_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: gdlId,
          displayName: existing.gdlName,
          originalRecord,
          modifiedRecord,
          userId,
          notes: nextDeleted ? 'Godown location soft deleted' : 'Godown location restored',
        },
        tx,
      );

      return {
        gdl_id: gdlId,
        deleted: nextDeleted,
      };
    });
  }

  private async createGodownLocation(saveGodownDto: SaveGodownDto): Promise<GodownPayload> {
    const { gdlName, gdlBranchId } = this.validateCreatePayload(saveGodownDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        await this.validateParentAssignment(tx, {
          parentId: saveGodownDto.gdl_parent_id ?? null,
          gdlBranchId,
        });

        const data: Prisma.GodownLocationUncheckedCreateInput = {
          gdlBranchId,
          gdlName,
          gdlCreatedOn: now,
          gdlCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveGodownDto);

        const created = await tx.godownLocation.create({ data });
        await this.ensureSelfInPath(tx, created.gdlId);

        if (saveGodownDto.gdl_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveGodownDto.gdl_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.gdlId]);
        }

        const refreshed = await this.findActiveLocation(tx, created.gdlId);
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              gdlPathIdsCache: this.mergePathIds(created.gdlPathIdsCache, [created.gdlId]),
            })
          : this.toPayload(refreshed);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: GODOWN_LOCATION_TABLE_NAME,
            screenName: GODOWN_LOCATION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.gdl_id,
            displayName: payload.gdl_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Godown location created',
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

  private async updateGodownLocation(saveGodownDto: SaveGodownDto): Promise<GodownPayload> {
    const gdlId = saveGodownDto.gdl_id!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.getActiveLocationOrThrow(tx, gdlId);
        const gdlBranchId = saveGodownDto.gdl_branch_id ?? existing.gdlBranchId;
        const parentId = hasOwnProperty(saveGodownDto, 'gdl_parent_id')
          ? (saveGodownDto.gdl_parent_id ?? null)
          : existing.gdlParentId;

        await this.validateParentAssignment(tx, {
          currentId: gdlId,
          parentId,
          gdlBranchId,
        });

        const hasParentField = hasOwnProperty(saveGodownDto, 'gdl_parent_id');
        const nextParentId = hasParentField
          ? (saveGodownDto.gdl_parent_id ?? null)
          : existing.gdlParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.gdlParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, gdlId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.gdlParentId)
          : [];

        const data: Prisma.GodownLocationUncheckedUpdateInput = {};
        this.applyOptionalFields(data, saveGodownDto);

        if (hasOwnProperty(saveGodownDto, 'gdl_name')) {
          if (!saveGodownDto.gdl_name?.trim()) {
            throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
              { field: 'gdl_name', message: 'gdl_name cannot be empty' },
            ]);
          }

          data.gdlName = saveGodownDto.gdl_name.trim();
        }

        if (Object.keys(data).length === 0) {
          return this.toPayload(existing);
        }

        data.gdlModifiedOn = new Date();
        data.gdlModifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;

        const updated = await tx.godownLocation.update({
          where: {
            gdlId,
          },
          data,
        });

        await this.ensureSelfInPath(tx, gdlId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await this.findActiveLocation(tx, gdlId);
        const payload = this.toPayload(refreshed ?? updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: GODOWN_LOCATION_TABLE_NAME,
            screenName: GODOWN_LOCATION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.gdl_id,
            displayName: payload.gdl_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Godown location updated',
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
  private normalizeLegacySaveGodownDto(saveGodownDto: SaveGodownDto): SaveGodownDto {
    const normalized: SaveGodownDto = { ...saveGodownDto };

    if (normalized.gdl_id === undefined && normalized.gdl_location_id !== undefined) {
      normalized.gdl_id = normalized.gdl_location_id;
    }
    if (normalized.gdl_branch_id === undefined && normalized.branch_id !== undefined) {
      normalized.gdl_branch_id = normalized.branch_id;
    }

    if (normalized.gdl_name === undefined && normalized.godown_name !== undefined) {
      normalized.gdl_name = normalized.godown_name;
    }

    if (normalized.gdl_code === undefined && normalized.godown_code !== undefined) {
      normalized.gdl_code = normalized.godown_code;
    }

    if (normalized.gdl_short === undefined) {
      if (normalized.godown_short !== undefined) {
        normalized.gdl_short = normalized.godown_short;
      } else if (normalized.godown_alias !== undefined) {
        normalized.gdl_short = normalized.godown_alias;
      }
    }

    if (normalized.gdl_remarks === undefined && normalized.godown_description !== undefined) {
      normalized.gdl_remarks = normalized.godown_description;
    }

    if (normalized.gdl_sort === undefined && normalized.godown_sort !== undefined) {
      normalized.gdl_sort = normalized.godown_sort;
    }

    if (normalized.gdl_parent_id === undefined && normalized.parent_id !== undefined) {
      normalized.gdl_parent_id = normalized.parent_id;
    }

    if (normalized.gdl_is_active === undefined && normalized.is_active !== undefined) {
      normalized.gdl_is_active = normalized.is_active;
    }

    return normalized;
  }

  private validateCreatePayload(saveGodownDto: SaveGodownDto): {
    gdlName: string;
    gdlBranchId: string;
  } {
    const gdlName = saveGodownDto.gdl_name?.trim();
    if (!gdlName) {
      throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
        { field: 'gdl_name', message: 'gdl_name is required' },
      ]);
    }

    if (!saveGodownDto.gdl_branch_id) {
      throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
        { field: 'gdl_branch_id', message: 'gdl_branch_id is required' },
      ]);
    }

    return {
      gdlName,
      gdlBranchId: saveGodownDto.gdl_branch_id,
    };
  }

  private async findActiveLocation(
    client: GodownLocationWriteClient,
    gdlId: string,
  ): Promise<GodownLocation | null> {
    return client.godownLocation.findFirst({
      where: {
        gdlId,
        gdlIsDeleted: false,
      },
    });
  }

  private async getParentName(
    client: GodownLocationWriteClient,
    parentId: string | null,
  ): Promise<string | null> {
    if (!parentId) {
      return null;
    }
    const parent = await client.godownLocation.findFirst({
      where: { gdlId: parentId },
      select: { gdlName: true },
    });
    return parent?.gdlName ?? null;
  }

  private async getBranchName(
    client: GodownLocationWriteClient,
    branchId: string | null,
  ): Promise<string | null> {
    if (!branchId) {
      return null;
    }
    const branch = await client.branchMaster.findFirst({
      where: { brId: branchId },
      select: { brName: true },
    });
    return branch?.brName ?? null;
  }

  private async getActiveLocationOrThrow(
    client: GodownLocationWriteClient,
    gdlId: string,
  ): Promise<GodownLocation> {
    const record = await this.findActiveLocation(client, gdlId);
    if (!record) {
      throwInventoryNotFound<GodownErrorDetail>(
        'Godown location not found',
        'gdl_id',
        `No active godown location found with id ${gdlId}`,
      );
    }

    return record;
  }

  private async validateParentAssignment(
    tx: GodownLocationWriteClient,
    params: {
      parentId: string | null;
      gdlBranchId: string;
      currentId?: string;
    },
  ): Promise<void> {
    if (!params.parentId) {
      return;
    }

    if (params.currentId && params.parentId === params.currentId) {
      throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
        { field: 'gdl_parent_id', message: 'gdl_parent_id cannot be the same as gdl_id' },
      ]);
    }

    const parent = await this.findActiveLocation(tx, params.parentId);
    if (!parent) {
      throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
        {
          field: 'gdl_parent_id',
          message: `No active parent location found with id ${params.parentId}`,
        },
      ]);
    }

    const isSameHierarchy = parent.gdlBranchId === params.gdlBranchId;
    if (!isSameHierarchy) {
      throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
        {
          field: 'gdl_parent_id',
          message: 'Parent location must belong to the same gdl_branch_id',
        },
      ]);
    }
  }

  private async getAncestorIds(
    tx: GodownLocationWriteClient,
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

      const parent = await tx.godownLocation.findFirst({
        where: {
          gdlId: currentParentId,
          gdlIsDeleted: false,
        },
        select: {
          gdlId: true,
          gdlParentId: true,
        },
      });
      if (!parent) {
        break;
      }

      ancestorIds.push(parent.gdlId);
      currentParentId = parent.gdlParentId;
    }

    return ancestorIds;
  }

  private async getActiveSubtreeIds(
    tx: GodownLocationWriteClient,
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

      const node = await tx.godownLocation.findFirst({
        where: {
          gdlId: currentId,
          gdlIsDeleted: false,
        },
        select: {
          gdlId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.gdlId);

      const children = await tx.godownLocation.findMany({
        where: {
          gdlParentId: node.gdlId,
          gdlIsDeleted: false,
        },
        select: {
          gdlId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.gdlId)) {
          queue.push(child.gdlId);
        }
      }
    }

    return subtreeIds;
  }

  private async appendPathIds(
    tx: GodownLocationWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.godownLocation.findMany({
      where: {
        gdlId: {
          in: normalizedTargetIds,
        },
        gdlIsDeleted: false,
      },
      select: {
        gdlId: true,
        gdlPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.gdlPathIdsCache, normalizedIdsToAdd);
      if (this.areSameIds(record.gdlPathIdsCache, nextPathIds)) {
        continue;
      }

      await tx.godownLocation.update({
        where: {
          gdlId: record.gdlId,
        },
        data: {
          gdlPathIdsCache: nextPathIds,
        },
      });
    }
  }

  private async removePathIds(
    tx: GodownLocationWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.godownLocation.findMany({
      where: {
        gdlId: {
          in: normalizedTargetIds,
        },
        gdlIsDeleted: false,
      },
      select: {
        gdlId: true,
        gdlPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.gdlPathIdsCache, normalizedIdsToRemove);
      if (this.areSameIds(record.gdlPathIdsCache, nextPathIds)) {
        continue;
      }

      await tx.godownLocation.update({
        where: {
          gdlId: record.gdlId,
        },
        data: {
          gdlPathIdsCache: nextPathIds,
        },
      });
    }
  }

  private async ensureSelfInPath(tx: GodownLocationWriteClient, gdlId: string): Promise<void> {
    await this.appendPathIds(tx, [gdlId], [gdlId]);
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

  private applyOptionalFields(
    data: Prisma.GodownLocationUncheckedCreateInput | Prisma.GodownLocationUncheckedUpdateInput,
    saveGodownDto: SaveGodownDto,
  ): void {
    if (
      hasOwnProperty(saveGodownDto, 'gdl_branch_id') &&
      saveGodownDto.gdl_branch_id !== undefined
    ) {
      data.gdlBranchId = saveGodownDto.gdl_branch_id;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_short') && saveGodownDto.gdl_short !== undefined) {
      data.gdlShort = saveGodownDto.gdl_short;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_code') && saveGodownDto.gdl_code !== undefined) {
      data.gdlCode = saveGodownDto.gdl_code;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_type') && saveGodownDto.gdl_type !== undefined) {
      if (!saveGodownDto.gdl_type.trim()) {
        throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
          { field: 'gdl_type', message: 'gdl_type cannot be empty' },
        ]);
      }
      data.gdlType = saveGodownDto.gdl_type.trim();
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_parent_id')) {
      data.gdlParentId = saveGodownDto.gdl_parent_id ?? null;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_sort') && saveGodownDto.gdl_sort !== undefined) {
      data.gdlSort = saveGodownDto.gdl_sort;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_level') && saveGodownDto.gdl_level !== undefined) {
      data.gdlLevel = saveGodownDto.gdl_level;
    }
    if (
      hasOwnProperty(saveGodownDto, 'gdl_del_sheet') &&
      saveGodownDto.gdl_del_sheet !== undefined
    ) {
      data.gdlDelSheet = saveGodownDto.gdl_del_sheet;
    }
    if (
      hasOwnProperty(saveGodownDto, 'gdl_split_stock') &&
      saveGodownDto.gdl_split_stock !== undefined
    ) {
      data.gdlSplitStock = saveGodownDto.gdl_split_stock;
    }
    if (
      hasOwnProperty(saveGodownDto, 'gdl_negative_stock') &&
      saveGodownDto.gdl_negative_stock !== undefined
    ) {
      data.gdlNegativeStock = saveGodownDto.gdl_negative_stock;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_volume') && saveGodownDto.gdl_volume !== undefined) {
      data.gdlVolume = saveGodownDto.gdl_volume;
    }
    if (
      hasOwnProperty(saveGodownDto, 'gdl_is_active') &&
      saveGodownDto.gdl_is_active !== undefined
    ) {
      data.gdlIsActive = saveGodownDto.gdl_is_active;
    }
    if (hasOwnProperty(saveGodownDto, 'gdl_remarks') && saveGodownDto.gdl_remarks !== undefined) {
      data.gdlRemarks = saveGodownDto.gdl_remarks;
    }
  }
  private toPayload(record: GodownLocation): GodownPayload {
    return {
      gdl_id: record.gdlId,
      gdl_branch_id: record.gdlBranchId,
      gdl_name: record.gdlName,
      gdl_short: record.gdlShort,
      gdl_code: record.gdlCode,
      gdl_type: record.gdlType,
      gdl_parent_id: record.gdlParentId,
      gdl_sort: record.gdlSort,
      gdl_level: record.gdlLevel,
      gdl_path_ids_cache: record.gdlPathIdsCache,
      gdl_del_sheet: record.gdlDelSheet,
      gdl_split_stock: record.gdlSplitStock,
      gdl_negative_stock: record.gdlNegativeStock,
      gdl_volume: toNumber(record.gdlVolume),
      gdl_is_active: record.gdlIsActive,
      gdl_is_deleted: record.gdlIsDeleted,
      gdl_created_on: record.gdlCreatedOn.toISOString(),
      gdl_created_by: record.gdlCreatedBy,
      gdl_modified_on: record.gdlModifiedOn.toISOString(),
      gdl_modified_by: record.gdlModifiedBy,
      gdl_remarks: record.gdlRemarks,
    };
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<GodownErrorDetail>(error, 'Godown location already exists', [
      { field: 'gdl_name', message: 'Duplicate gdl_name under the same parent is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<GodownErrorDetail>('Validation failed', [
        { field: 'gdl_parent_id', message: 'Invalid gdl_parent_id reference' },
      ]);
    }
  }
}
