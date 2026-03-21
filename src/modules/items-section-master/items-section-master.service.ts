import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemSectionMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemSectionQueryDto } from './dto/list-item-section-query.dto';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import {
  ItemSectionErrorDetail,
  ItemSectionErrorResponse,
  ItemSectionListItem,
  ItemSectionListMeta,
  ItemSectionPayload,
} from './types/item-section-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ROOT_SECTION_LEVEL = 1;
const ITEM_SECTION_TABLE_NAME = 'item_section_master';
const ITEM_SECTION_AUDIT_SCREEN_NAME = 'Item Section Master';
type ItemSectionWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ItemsSectionMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveItemSectionDto: SaveItemSectionDto): Promise<ItemSectionPayload> {
    if (saveItemSectionDto.sec_id) {
      return this.updateItemSection(saveItemSectionDto);
    }

    return this.createItemSection(saveItemSectionDto);
  }

  async list(
    queryDto: ListItemSectionQueryDto,
  ): Promise<ConfiguredGridListResult<ItemSectionListItem, ItemSectionListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.sec_parent_id !== undefined ||
      queryDto.sec_is_active !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.ItemSectionMasterWhereInput = {
      secIsDeleted: false,
    };

    if (queryDto.sec_parent_id !== undefined) {
      where.secParentId = queryDto.sec_parent_id;
    }

    if (queryDto.sec_is_active !== undefined) {
      where.secIsActive = queryDto.sec_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { secName: { contains: search, mode: 'insensitive' } },
        { secAlias: { contains: search, mode: 'insensitive' } },
        { secDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.itemSectionMaster.count({ where }),
      this.prisma.itemSectionMaster.findMany({
        where,
        orderBy: [{ secSort: 'asc' }, { secName: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<ItemSectionListItem, ItemSectionListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_SECTION_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_SECTION_TABLE_NAME,
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
        tableName: ITEM_SECTION_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemSectionListItem>({
          baseSql: validation.normalizedSql,
          alias: 'item_section_grid',
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
          styles: result.styles,
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  private toListItem(record: ItemSectionMaster): ItemSectionListItem {
    return {
      sec_id: record.secId,
      sec_name: record.secName,
    };
  }

  async getById(secId: string): Promise<ItemSectionPayload> {
    const record = await this.prisma.itemSectionMaster.findFirst({
      where: {
        secId,
        secIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(secId);
    }

    return this.toPayload(record);
  }

  async softDelete(secId: string): Promise<{ sec_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemSectionMaster.findFirst({
        where: {
          secId,
          secIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(secId);
      }

      const subtreeIds = await this.getActiveSubtreeIds(tx, secId);
      const ancestorIds = await this.getAncestorIds(tx, existing.secParentId);
      const modifiedOn = new Date();
      const result = await tx.itemSectionMaster.updateMany({
        where: {
          secId,
          secIsDeleted: false,
        },
        data: {
          secIsDeleted: true,
          secModifiedOn: modifiedOn,
          secModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(secId);
      }

      await this.removePathIds(tx, ancestorIds, subtreeIds);

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        secIsDeleted: true,
        secModifiedOn: modifiedOn,
        secModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_SECTION_TABLE_NAME,
          screenName: ITEM_SECTION_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: secId,
          displayName: existing.secName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Item section soft deleted',
        },
        tx,
      );

      return {
        sec_id: secId,
        deleted: true,
      };
    });
  }

  private async createItemSection(
    saveItemSectionDto: SaveItemSectionDto,
  ): Promise<ItemSectionPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        let parentLevel: number | null | undefined;
        if (saveItemSectionDto.sec_parent_id) {
          const parent = await this.ensureParentExists(saveItemSectionDto.sec_parent_id, tx);
          parentLevel = parent.secLevel;
        }

        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;

        const data: Prisma.ItemSectionMasterUncheckedCreateInput = {
          secName: saveItemSectionDto.sec_name.trim(),
          secLevel: this.resolveSectionLevel(saveItemSectionDto.sec_parent_id, parentLevel),
          secCreatedOn: now,
          secCreatedBy: createdBy,
          secModifiedOn: now,
          secModifiedBy: modifiedBy,
        };

        this.applyOptionalFields(data, saveItemSectionDto);
        const created = await tx.itemSectionMaster.create({ data });
        await this.ensureSelfInPath(tx, created.secId);

        if (saveItemSectionDto.sec_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveItemSectionDto.sec_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.secId]);
        }

        const refreshed = await tx.itemSectionMaster.findFirst({
          where: {
            secId: created.secId,
            secIsDeleted: false,
          },
        });
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              secPathIds: this.mergePathIds(created.secPathIds, [created.secId]),
            })
          : this.toPayload(refreshed);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_SECTION_TABLE_NAME,
            screenName: ITEM_SECTION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.sec_id,
            displayName: payload.sec_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Item section created',
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

  private async updateItemSection(
    saveItemSectionDto: SaveItemSectionDto,
  ): Promise<ItemSectionPayload> {
    const secId = saveItemSectionDto.sec_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemSectionMaster.findFirst({
          where: {
            secId,
            secIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(secId);
        }

        if (saveItemSectionDto.sec_parent_id === secId) {
          this.throwBadRequest('Item section cannot be its own parent', [
            {
              field: 'sec_parent_id',
              message: 'sec_parent_id cannot be same as sec_id',
            },
          ]);
        }

        let requestedParentLevel: number | null | undefined;
        if (saveItemSectionDto.sec_parent_id) {
          const parent = await this.ensureParentExists(saveItemSectionDto.sec_parent_id, tx);
          requestedParentLevel = parent.secLevel;
        }

        const hasParentField = this.hasOwnProperty(saveItemSectionDto, 'sec_parent_id');
        const nextParentId = hasParentField
          ? (saveItemSectionDto.sec_parent_id ?? null)
          : existing.secParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.secParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, secId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.secParentId)
          : [];

        const data: Prisma.ItemSectionMasterUncheckedUpdateInput = {
          secName: saveItemSectionDto.sec_name.trim(),
          secModifiedOn: new Date(),
          secModifiedBy: DEFAULT_ACTOR,
        };
        if (isParentChanged) {
          data.secLevel = this.resolveSectionLevel(nextParentId, requestedParentLevel);
        }

        this.applyOptionalFields(data, saveItemSectionDto);
        const updated = await tx.itemSectionMaster.update({
          where: {
            secId,
          },
          data,
        });

        await this.ensureSelfInPath(tx, secId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await tx.itemSectionMaster.findFirst({
          where: {
            secId,
            secIsDeleted: false,
          },
        });
        const payload = this.toPayload(refreshed ?? updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_SECTION_TABLE_NAME,
            screenName: ITEM_SECTION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: secId,
            displayName: payload.sec_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Item section updated',
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

  private async ensureParentExists(
    parentId: string,
    tx: ItemSectionWriteClient,
  ): Promise<{ secId: string; secLevel: number | null }> {
    const parent = await tx.itemSectionMaster.findFirst({
      where: {
        secId: parentId,
        secIsDeleted: false,
      },
      select: {
        secId: true,
        secLevel: true,
      },
    });

    if (!parent) {
      this.throwBadRequest('Parent item section does not exist', [
        {
          field: 'sec_parent_id',
          message: `No active item section found with id ${parentId}`,
        },
      ]);
    }

    return parent;
  }

  private applyOptionalFields(
    data:
      | Prisma.ItemSectionMasterUncheckedCreateInput
      | Prisma.ItemSectionMasterUncheckedUpdateInput,
    saveItemSectionDto: SaveItemSectionDto,
  ): void {
    if (this.hasOwnProperty(saveItemSectionDto, 'sec_alias')) {
      data.secAlias = saveItemSectionDto.sec_alias;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_short')) {
      data.secShort = saveItemSectionDto.sec_short;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_description')) {
      data.secDescription = saveItemSectionDto.sec_description;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_parent_id')) {
      data.secParentId = saveItemSectionDto.sec_parent_id;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_sort')) {
      data.secSort = saveItemSectionDto.sec_sort;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_position')) {
      data.secPosition = saveItemSectionDto.sec_position;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_color_code')) {
      data.secColorCode = saveItemSectionDto.sec_color_code;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_icon')) {
      data.secIcon = saveItemSectionDto.sec_icon;
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_photo')) {
      data.secPhoto = this.decodePhotoInput(saveItemSectionDto.sec_photo);
    }

    if (this.hasOwnProperty(saveItemSectionDto, 'sec_photo_url')) {
      data.secPhotoUrl = saveItemSectionDto.sec_photo_url;
    }
  }

  private async getAncestorIds(
    tx: ItemSectionWriteClient,
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

      const parent = await tx.itemSectionMaster.findFirst({
        where: {
          secId: currentParentId,
          secIsDeleted: false,
        },
        select: {
          secId: true,
          secParentId: true,
        },
      });
      if (!parent) {
        break;
      }

      ancestorIds.push(parent.secId);
      currentParentId = parent.secParentId;
    }

    return ancestorIds;
  }

  private async getActiveSubtreeIds(tx: ItemSectionWriteClient, rootId: string): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = await tx.itemSectionMaster.findFirst({
        where: {
          secId: currentId,
          secIsDeleted: false,
        },
        select: {
          secId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.secId);

      const children = await tx.itemSectionMaster.findMany({
        where: {
          secParentId: node.secId,
          secIsDeleted: false,
        },
        select: {
          secId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.secId)) {
          queue.push(child.secId);
        }
      }
    }

    return subtreeIds;
  }

  private async appendPathIds(
    tx: ItemSectionWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.itemSectionMaster.findMany({
      where: {
        secId: {
          in: normalizedTargetIds,
        },
        secIsDeleted: false,
      },
      select: {
        secId: true,
        secPathIds: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.secPathIds, normalizedIdsToAdd);
      if (this.areSameIds(record.secPathIds, nextPathIds)) {
        continue;
      }
      await tx.itemSectionMaster.update({
        where: {
          secId: record.secId,
        },
        data: {
          secPathIds: nextPathIds,
        },
      });
    }
  }

  private async removePathIds(
    tx: ItemSectionWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.itemSectionMaster.findMany({
      where: {
        secId: {
          in: normalizedTargetIds,
        },
        secIsDeleted: false,
      },
      select: {
        secId: true,
        secPathIds: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.secPathIds, normalizedIdsToRemove);
      if (this.areSameIds(record.secPathIds, nextPathIds)) {
        continue;
      }
      await tx.itemSectionMaster.update({
        where: {
          secId: record.secId,
        },
        data: {
          secPathIds: nextPathIds,
        },
      });
    }
  }

  private async ensureSelfInPath(tx: ItemSectionWriteClient, secId: string): Promise<void> {
    await this.appendPathIds(tx, [secId], [secId]);
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
    photo: string | Buffer | Uint8Array | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (photo === undefined) {
      return undefined;
    }

    if (photo === null) {
      return null;
    }

    if (Buffer.isBuffer(photo)) {
      if (photo.length === 0) {
        this.throwBadRequest('Invalid image provided', [
          {
            field: 'sec_photo',
            message: 'sec_photo must contain binary image data',
          },
        ]);
      }

      return new Uint8Array(photo);
    }

    if (photo instanceof Uint8Array) {
      if (photo.length === 0) {
        this.throwBadRequest('Invalid image provided', [
          {
            field: 'sec_photo',
            message: 'sec_photo must contain binary image data',
          },
        ]);
      }

      return new Uint8Array(photo);
    }

    const trimmed = photo.trim();
    if (!trimmed) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'sec_photo',
          message: 'sec_photo must be a non-empty base64 string',
        },
      ]);
    }

    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'sec_photo',
          message: 'sec_photo must be valid base64 content',
        },
      ]);
    }

    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }

  private toPayload(record: ItemSectionMaster): ItemSectionPayload {
    return {
      sec_id: record.secId,
      sec_name: record.secName,
      sec_alias: record.secAlias,
      sec_short: record.secShort,
      sec_description: record.secDescription,
      sec_parent_id: record.secParentId,
      sec_sort: record.secSort,
      sec_level: record.secLevel,
      sec_path_ids: record.secPathIds,
      sec_position: record.secPosition,
      sec_color_code: record.secColorCode,
      sec_icon: record.secIcon,
      sec_photo: record.secPhoto ? Buffer.from(record.secPhoto).toString('base64') : null,
      sec_photo_url: record.secPhotoUrl,
      sec_sync_date: record.secSyncDate ? record.secSyncDate.toISOString() : null,
      sec_is_active: record.secIsActive,
      sec_is_deleted: record.secIsDeleted,
      sec_created_on: record.secCreatedOn.toISOString(),
      sec_created_by: record.secCreatedBy,
      sec_modified_on: record.secModifiedOn.toISOString(),
      sec_modified_by: record.secModifiedBy,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item section name already exists', [
          {
            field: 'sec_name',
            message: 'Duplicate sec_name is not allowed',
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

  private throwNotFound(secId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item section not found', [
        {
          field: 'sec_id',
          message: `No active item section found with id ${secId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemSectionErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemSectionErrorDetail[] = [],
  ): ItemSectionErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  private resolveSectionLevel(
    parentId: string | null | undefined,
    parentLevel: number | null | undefined,
  ): number {
    if (!parentId) {
      return ROOT_SECTION_LEVEL;
    }

    return (parentLevel ?? ROOT_SECTION_LEVEL) + 1;
  }
}
