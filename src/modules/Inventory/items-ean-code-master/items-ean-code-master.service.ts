import { Injectable } from '@nestjs/common';
import { ItemEanCode, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemEanCodeQueryDto } from './dto/get-item-ean-code-query.dto';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import {
  ItemEanCodeDeleteResult,
  ItemEanCodeErrorDetail,
  ItemEanCodeListItem,
  ItemEanCodeListMeta,
  ItemEanCodePayload,
} from './types/item-ean-code-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const ITEM_EAN_CODE_TABLE_NAME = 'item ean codes';
const ITEM_EAN_CODE_AUDIT_SCREEN_NAME = 'Item EAN Code Master';

@Injectable()
export class ItemsEanCodeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodePayload>;
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodePayload[]>;
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto | SaveItemEanCodeDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodePayload | ItemEanCodePayload[]>;
  /**
   * `ean_unit_id` must hold an `iuc_id` from item_unit_conversion, not a raw
   * unit_id — the column is a FK to item_unit_conversion(iuc_id).
   *
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own (see ItemsMasterService.saveComposite).
   */
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto | SaveItemEanCodeDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodePayload | ItemEanCodePayload[]> {
    const saveItems = Array.isArray(saveItemEanCodeDto) ? saveItemEanCodeDto : [saveItemEanCodeDto];
    const saveAll = async (client: Prisma.TransactionClient) => {
      const savedItems: ItemEanCodePayload[] = [];

      for (const saveItem of saveItems) {
        savedItems.push(await this.saveItemEanCode(client, saveItem));
      }

      return savedItems;
    };

    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);

      return Array.isArray(saveItemEanCodeDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async list(
    queryDto: GetItemEanCodeQueryDto,
  ): Promise<ConfiguredGridListResult<ItemEanCodeListItem, ItemEanCodeListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemEanCodeWhereInput = {
      eanIsDeleted: false,
      ...(queryDto.ean_item_id !== undefined && { eanItemId: queryDto.ean_item_id }),
      ...(queryDto.ean_unit_id !== undefined && { eanUnitId: queryDto.ean_unit_id }),
      ...(queryDto.ean_is_default !== undefined && { eanIsDefault: queryDto.ean_is_default }),
      ...(queryDto.ean_is_active !== undefined && { eanIsActive: queryDto.ean_is_active }),
    };
    return runInventoryListQuery<ItemEanCode, ItemEanCodeListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemEanCodeListItem>(
            this.configuredGridSqlService,
            {
              tableName: ITEM_EAN_CODE_TABLE_NAME,
              alias: 'item_ean_code_grid',
              search: queryDto.search,
              page,
              limit,
              skip,
            },
          ),
        countFn: () => this.prisma.itemEanCode.count({ where }),
        findManyFn: () =>
          this.prisma.itemEanCode.findMany({
            where,
            orderBy: [{ eanItemId: 'asc' }, { eanId: 'asc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(eanId: string): Promise<ItemEanCodePayload> {
    const record = await this.prisma.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });

    if (!record) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No active item EAN code found with id ${eanId}`,
      );
    }

    return this.toPayload(record);
  }
  async findByItemId(
    itemId: string,
    client: InventoryWriteClient = this.prisma,
  ): Promise<ItemEanCodePayload[]> {
    const records = await client.itemEanCode.findMany({
      where: { eanItemId: itemId, eanIsDeleted: false },
      orderBy: [{ eanId: 'asc' }],
    });
    return records.map((record) => this.toPayload(record));
  }
  async findIdsByItemId(itemId: string, isDeleted: boolean): Promise<string[]> {
    const records = await this.prisma.itemEanCode.findMany({
      where: { eanItemId: itemId, eanIsDeleted: isDeleted },
      select: { eanId: true },
    });
    return records.map((record) => record.eanId);
  }

  async toggleDelete(
    eanId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodeDeleteResult>;
  async toggleDelete(
    eanId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodeDeleteResult[]>;
  async toggleDelete(
    eanId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]>;
  async toggleDelete(
    eanId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]> {
    const toggleIds = Array.isArray(eanId) ? eanId : [eanId];
    const toggleAll = async (client: Prisma.TransactionClient) => {
      const toggledItems: ItemEanCodeDeleteResult[] = [];

      for (const toggleId of toggleIds) {
        toggledItems.push(await this.toggleDeleteItemEanCode(client, toggleId));
      }

      return toggledItems;
    };

    const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);

    return Array.isArray(eanId) ? results : results[0];
  }

  private async saveItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    if (saveItemEanCodeDto.ean_id) {
      return this.updateItemEanCode(tx, saveItemEanCodeDto);
    }

    return this.createItemEanCode(tx, saveItemEanCodeDto);
  }

  private async toggleDeleteItemEanCode(
    tx: Prisma.TransactionClient,
    eanId: string,
  ): Promise<ItemEanCodeDeleteResult> {
    // Find regardless of current deleted state
    const existing = await tx.itemEanCode.findFirst({
      where: {
        eanId,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No item EAN code found with id ${eanId}`,
      );
    }

    const wasDeleted = existing.eanIsDeleted;
    const nextDeleted = !wasDeleted;
    const modifiedOn = new Date();
    const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    // Guarded update: only flips if state hasn't changed since the read
    const result = await tx.itemEanCode.updateMany({
      where: {
        eanId,
        eanIsDeleted: wasDeleted,
      },
      data: {
        eanIsDeleted: nextDeleted,
        eanModifiedOn: modifiedOn,
        eanModifiedBy: modifiedBy,
      },
    });
    if (result.count === 0) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No item EAN code found with id ${eanId}`,
      );
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      eanIsDeleted: nextDeleted,
      eanModifiedOn: modifiedOn,
      eanModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: eanId,
        displayName: existing.eanCode,
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: nextDeleted ? 'Item EAN code soft deleted' : 'Item EAN code restored',
      },
      tx,
    );

    return {
      ean_id: eanId,
      deleted: nextDeleted,
    };
  }

  private async createItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    const eanCode = saveItemEanCodeDto.ean_code?.trim();
    if (!eanCode) {
      throwInventoryBadRequest<ItemEanCodeErrorDetail>('Validation failed', [
        {
          field: 'ean_code',
          message: 'ean_code is required',
        },
      ]);
    }

    const now = new Date();
    const createdBy = resolveActor(saveItemEanCodeDto.ean_created_by, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveItemEanCodeDto.ean_modified_by, createdBy);
    const data: Prisma.ItemEanCodeUncheckedCreateInput = {
      eanItemId: saveItemEanCodeDto.ean_item_id,
      eanUnitId: saveItemEanCodeDto.ean_unit_id,
      eanCode,
      eanCreatedOn: now,
      eanCreatedBy: createdBy,
      eanModifiedOn: now,
      eanModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemEanCodeDto);

    const created = await tx.itemEanCode.create({ data });
    await this.enforceSingleDefaultInScope(tx, created, created.eanModifiedBy ?? modifiedBy);

    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ean_id,
        displayName: payload.ean_code,
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
        notes: 'Item EAN code created',
      },
      tx,
    );

    return payload;
  }

  private async updateItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    const eanId = saveItemEanCodeDto.ean_id!;

    const existing = await tx.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No active item EAN code found with id ${eanId}`,
      );
    }

    const eanCode = saveItemEanCodeDto.ean_code?.trim();
    if (!eanCode) {
      throwInventoryBadRequest<ItemEanCodeErrorDetail>('Validation failed', [
        {
          field: 'ean_code',
          message: 'ean_code cannot be empty',
        },
      ]);
    }

    const data: Prisma.ItemEanCodeUncheckedUpdateInput = {
      eanItemId: saveItemEanCodeDto.ean_item_id,
      eanUnitId: saveItemEanCodeDto.ean_unit_id,
      eanCode,
      eanModifiedOn: new Date(),
      eanModifiedBy: resolveActor(saveItemEanCodeDto.ean_modified_by, this.requestContextService.getUserId()),
    };
    this.applyOptionalFields(data, saveItemEanCodeDto);

    const updated = await tx.itemEanCode.update({
      where: {
        eanId,
      },
      data,
    });

    await this.enforceSingleDefaultInScope(tx, updated, updated.eanModifiedBy ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR);

    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: eanId,
        displayName: payload.ean_code,
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.ean_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        notes: 'Item EAN code updated',
      },
      tx,
    );

    return payload;
  }
  private applyOptionalFields(
    data: Prisma.ItemEanCodeUncheckedCreateInput | Prisma.ItemEanCodeUncheckedUpdateInput,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): void {
    if (hasOwnProperty(saveItemEanCodeDto, 'ean_is_default')) {
      data.eanIsDefault = saveItemEanCodeDto.ean_is_default;
    }

    if (hasOwnProperty(saveItemEanCodeDto, 'ean_is_active')) {
      data.eanIsActive = saveItemEanCodeDto.ean_is_active;
    }

    if (hasOwnProperty(saveItemEanCodeDto, 'ean_remarks')) {
      data.eanRemarks = saveItemEanCodeDto.ean_remarks;
    }
  }

  private async enforceSingleDefaultInScope(
    tx: Prisma.TransactionClient,
    record: ItemEanCode,
    actor: string,
  ): Promise<void> {
    if (!record.eanIsDefault) {
      return;
    }

    await tx.itemEanCode.updateMany({
      where: {
        eanItemId: record.eanItemId,
        eanUnitId: record.eanUnitId,
        eanIsDeleted: false,
        eanIsDefault: true,
        eanId: {
          not: record.eanId,
        },
      },
      data: {
        eanIsDefault: false,
        eanModifiedOn: new Date(),
        eanModifiedBy: actor,
      },
    });
  }

  private toPayload(record: ItemEanCode): ItemEanCodePayload {
    return {
      ean_id: record.eanId,
      ean_item_id: record.eanItemId,
      ean_unit_id: record.eanUnitId,
      ean_code: record.eanCode,
      ean_is_default: record.eanIsDefault,
      ean_is_active: record.eanIsActive,
      ean_is_deleted: record.eanIsDeleted,
      ean_created_on: record.eanCreatedOn.toISOString(),
      ean_created_by: record.eanCreatedBy,
      ean_modified_on: record.eanModifiedOn.toISOString(),
      ean_modified_by: record.eanModifiedBy,
      ean_remarks: record.eanRemarks,
    };
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemEanCodeErrorDetail>(error, 'EAN code already exists', [
      { field: 'ean_code', message: 'Duplicate ean_code is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemEanCodeErrorDetail>('Invalid relation reference', [
        { field: 'ean_unit_id', message: 'Referenced relation does not exist' },
      ]);
    }
  }
}
