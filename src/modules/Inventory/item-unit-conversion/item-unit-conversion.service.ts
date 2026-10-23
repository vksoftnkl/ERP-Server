import { Injectable } from '@nestjs/common';
import { ItemUnitConversion, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemUnitConversionQueryDto } from './dto/get-item-unit-conversion-query.dto';
import { SaveItemUnitConversionDto } from './dto/save-item-unit-conversion.dto';
import {
  ItemUnitConversionDeleteResult,
  ItemUnitConversionErrorDetail,
  ItemUnitConversionListItem,
  ItemUnitConversionListMeta,
  ItemUnitConversionPayload,
} from './types/item-unit-conversion-api.types';
import { ItemUnitConversionErrorCode } from './types/item-unit-conversion-error-codes';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  hasOwnProperty,
  isForeignKeyConstraintError,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
import { assertChildDeletable, assertItemsLive } from '../utils/item-child.helper';
import { baseUnitChange, refuseBaseUnitChange } from '../utils/item-base-unit.helper';
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_UNIT_CONVERSION_TABLE_NAME = 'item_unit_conversion';
const ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME = 'Item Unit Conversion Master';
type EffectiveItemUnitConversionRow = {
  saveIndex?: number;
  iucId?: string;
  unitId: string;
  baseUnitId: string;
  unitSlno: number;
  toBaseFactor?: number;
  unitFactor?: number;
  isBaseUnit: boolean;
};
@Injectable()
export class ItemUnitConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionPayload>;
  async save(
    saveItemUnitConversionDto: SaveItemUnitConversionDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionPayload[]>;
  async save(
    saveItemUnitConversionDto: SaveItemUnitConversionDto | SaveItemUnitConversionDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionPayload | ItemUnitConversionPayload[]>;
  /**
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own, so a later failure rolls these rows back too
   * (see ItemsMasterService.saveComposite).
   */
  async save(
    saveItemUnitConversionDto: SaveItemUnitConversionDto | SaveItemUnitConversionDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionPayload | ItemUnitConversionPayload[]> {
    const saveItems = Array.isArray(saveItemUnitConversionDto)
      ? saveItemUnitConversionDto
      : [saveItemUnitConversionDto];
    const saveAll = async (client: Prisma.TransactionClient) => {
      await assertItemsLive(
        client,
        saveItems.map((item) => item.iuc_item_id),
        { field: 'iuc_item_id', code: ItemUnitConversionErrorCode.ITEM_NOT_LIVE },
      );
      await this.assertBaseUnitsKept(client, saveItems, Array.isArray(saveItemUnitConversionDto));
      const baseUnitNormalizedSaveItems = await this.normalizeItemUnitConversionBaseUnits(
        client,
        saveItems,
      );
      for (const saveItem of baseUnitNormalizedSaveItems) {
        this.validateItemUnitConversion(saveItem);
      }
      const normalizedSaveItems = await this.normalizeItemUnitConversionFactors(
        client,
        baseUnitNormalizedSaveItems,
      );
      const savedItems: ItemUnitConversionPayload[] = [];
      for (const saveItem of normalizedSaveItems) {
        savedItems.push(await this.saveItemUnitConversion(client, saveItem));
      }
      return savedItems;
    };
    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
      return Array.isArray(saveItemUnitConversionDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  /**
   * Notes 138 A1 — a row of an item that already has a base row may not change
   * its base unit (see item-base-unit.helper). Read from the stored base rows
   * BEFORE normalisation, which would otherwise re-derive the base from what
   * was sent. One query per batch.
   */
  private async assertBaseUnitsKept(
    client: Prisma.TransactionClient,
    saveItems: SaveItemUnitConversionDto[],
    indexed: boolean,
  ): Promise<void> {
    const itemIds = Array.from(new Set(saveItems.map((saveItem) => saveItem.iuc_item_id)));
    const baseRows = await client.itemUnitConversion.findMany({
      where: { iucItemId: { in: itemIds }, iucIsBaseUnit: true, iucIsDeleted: false },
      select: { iucId: true, iucItemId: true, iucUnitId: true },
    });
    const baseByItemId = new Map(
      baseRows.map((row) => [row.iucItemId, { iuc_id: row.iucId, iuc_unit_id: row.iucUnitId }]),
    );
    saveItems.forEach((saveItem, index) => {
      const base = baseByItemId.get(saveItem.iuc_item_id);
      const change = base && baseUnitChange(base, saveItem);
      if (change) {
        refuseBaseUnitChange(
          ItemUnitConversionErrorCode.BASE_UNIT_LOCKED,
          indexed ? `${index}.${change.column}` : change.column,
          change.message,
        );
      }
    });
  }
  async list(
    queryDto: GetItemUnitConversionQueryDto,
  ): Promise<ConfiguredGridListResult<ItemUnitConversionListItem, ItemUnitConversionListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemUnitConversionWhereInput = {
      iucIsDeleted: false,
      ...(queryDto.iuc_item_id !== undefined && { iucItemId: queryDto.iuc_item_id }),
      ...(queryDto.iuc_is_active !== undefined && { iucIsActive: queryDto.iuc_is_active }),
    };
    return runInventoryListQuery<ItemUnitConversion, ItemUnitConversionListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemUnitConversionListItem>(this.configuredGridSqlService, {
            tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
            alias: 'item_unit_conversion_grid',
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.itemUnitConversion.count({ where }),
        findManyFn: () =>
          this.prisma.itemUnitConversion.findMany({
            where,
            orderBy: [{ iucItemId: 'asc' }, { iucUnitSlno: 'asc' }, { iucId: 'asc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }
  async getById(iucId: string): Promise<ItemUnitConversionPayload> {
    const record = await this.prisma.itemUnitConversion.findFirst({
      where: {
        iucId,
        iucIsDeleted: false,
      },
    });
    if (!record) {
      throwInventoryNotFound<ItemUnitConversionErrorDetail>(
        'Item unit conversion not found',
        'iuc_id',
        `No item unit conversion found with id ${iucId}`,
        ItemUnitConversionErrorCode.NOT_FOUND,
      );
    }
    return this.toPayload(record);
  }
  async findByItemId(
    itemId: string,
    client: InventoryWriteClient = this.prisma,
  ): Promise<ItemUnitConversionPayload[]> {
    const records = await client.itemUnitConversion.findMany({
      where: { iucItemId: itemId, iucIsDeleted: false },
      orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
    });
    return records.map((record) => this.toPayload(record));
  }
  async toggleDelete(
    iucId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionDeleteResult>;
  async toggleDelete(
    iucId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionDeleteResult[]>;
  async toggleDelete(
    iucId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]>;
  async toggleDelete(
    iucId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]> {
    const toggleIds = Array.isArray(iucId) ? iucId : [iucId];
    const toggleAll = async (client: Prisma.TransactionClient) => {
      const toggledItems: ItemUnitConversionDeleteResult[] = [];
      for (const toggleId of toggleIds) {
        toggledItems.push(await this.toggleDeleteItemUnitConversion(client, toggleId));
      }
      return toggledItems;
    };
    try {
      const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
      return Array.isArray(iucId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }
  /**
   * DELETE /item-unit-conversions/delete. Deletes only — a deleted row is a
   * 409, not a restore (notes 137 D1) — and refuses (409 UNIT_CONV_IN_USE,
   * naming them) while live prices, EAN codes or reorder rows still use the
   * unit: they stayed live behind a deleted unit, the barcode kept scanning
   * and the next item save that echoed them failed (notes 137 A4). The
   * composite save removes a unit together with its rows instead.
   */
  async delete(iucId: string): Promise<ItemUnitConversionDeleteResult>;
  async delete(iucId: string[]): Promise<ItemUnitConversionDeleteResult[]>;
  async delete(
    iucId: string | string[],
  ): Promise<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]>;
  async delete(
    iucId: string | string[],
  ): Promise<ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]> {
    const ids = Array.isArray(iucId) ? iucId : [iucId];
    try {
      const results = await this.prisma.$transaction(async (client) => {
        const deleted: ItemUnitConversionDeleteResult[] = [];
        for (const id of ids) {
          const existing = await client.itemUnitConversion.findFirst({ where: { iucId: id } });
          if (!existing) {
            throwInventoryNotFound<ItemUnitConversionErrorDetail>(
              'Item unit conversion not found',
              'iuc_id',
              `No item unit conversion found with id ${id}`,
              ItemUnitConversionErrorCode.NOT_FOUND,
            );
          }
          await assertChildDeletable(
            client,
            { isDeleted: existing.iucIsDeleted, itemId: existing.iucItemId },
            {
              label: 'unit conversion',
              idField: 'iuc_id',
              alreadyDeletedCode: ItemUnitConversionErrorCode.ALREADY_DELETED,
              itemNotLiveCode: ItemUnitConversionErrorCode.ITEM_NOT_LIVE,
            },
          );
          // Notes 138 A1 — removing the base row would leave the item's
          // stock counted in no unit at all.
          if (existing.iucIsBaseUnit) {
            refuseBaseUnitChange(
              ItemUnitConversionErrorCode.BASE_UNIT_LOCKED,
              'iuc_id',
              `Unit conversion ${id} is the item's base row and cannot be deleted.`,
            );
          }
          await this.assertNoLiveDependants(client, id);
          deleted.push(await this.toggleDeleteItemUnitConversion(client, id));
        }
        return deleted;
      });
      return Array.isArray(iucId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }
  /** Notes 137 A4 — the live price, EAN and reorder rows that hold this iuc_id. */
  private async assertNoLiveDependants(
    client: Prisma.TransactionClient,
    iucId: string,
  ): Promise<void> {
    const [prices, eanCodes, reorders] = await Promise.all([
      client.itemPriceMaster.count({ where: { ipmUcUnitId: iucId, ipmIsDeleted: false } }),
      client.itemEanCode.findMany({
        where: { eanUcUnitId: iucId, eanIsDeleted: false },
        select: { eanCode: true },
      }),
      client.itemReorder.count({ where: { irUcUnitId: iucId, irIsDeleted: false } }),
    ]);
    const used = [
      prices ? `${prices} price row(s)` : null,
      eanCodes.length
        ? `${eanCodes.length} EAN code(s) (${eanCodes.map((row) => row.eanCode).join(', ')})`
        : null,
      reorders ? `${reorders} reorder row(s)` : null,
    ].filter((part): part is string => part !== null);
    if (used.length) {
      throwInventoryConflict<ItemUnitConversionErrorDetail>('This unit is still in use', [
        {
          field: 'iuc_id',
          code: ItemUnitConversionErrorCode.IN_USE,
          message: `Used by ${used.join(', ')}. Delete those first, or remove the unit from the item card, which removes them with it.`,
        },
      ]);
    }
  }
  private async saveItemUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload> {
    if (saveItemUnitConversionDto.iuc_id) {
      return this.updateItemUnitConversion(tx, saveItemUnitConversionDto);
    }
    return this.createItemUnitConversion(tx, saveItemUnitConversionDto);
  }
  private async createItemUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload> {
    this.validateItemUnitConversion(saveItemUnitConversionDto);
    const now = new Date();
    // The request's user, never the payload's iuc_created_by / iuc_updated_by
    // (notes 137 C2): a body could name anyone.
    const createdBy = this.requestUser();
    const updatedBy = createdBy;
    const baseUnitId =
      saveItemUnitConversionDto.iuc_base_unit_id ?? saveItemUnitConversionDto.iuc_unit_id;
    const data: Prisma.ItemUnitConversionUncheckedCreateInput = {
      iucItemId: saveItemUnitConversionDto.iuc_item_id,
      iucUnitId: saveItemUnitConversionDto.iuc_unit_id,
      iucBaseUnitId: baseUnitId,
      iucCreatedOn: now,
      iucCreatedBy: createdBy,
      iucUpdatedOn: now,
      iucUpdatedBy: updatedBy,
    };
    this.applyOptionalFields(data, saveItemUnitConversionDto);
    this.assertItemUnitConversionConstraints({
      unitId: saveItemUnitConversionDto.iuc_unit_id,
      baseUnitId,
      toBaseFactor: saveItemUnitConversionDto.iuc_to_base_factor ?? 1,
      uomWeight: saveItemUnitConversionDto.iuc_uom_weight ?? 0,
      isBaseUnit: saveItemUnitConversionDto.iuc_is_base_unit ?? false,
    });
    const created = await tx.itemUnitConversion.create({ data });
    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
        screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.iuc_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: this.resolveAuditActor(createdBy),
        notes: 'Item unit conversion created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): Promise<ItemUnitConversionPayload> {
    this.validateItemUnitConversion(saveItemUnitConversionDto);
    const iucId = saveItemUnitConversionDto.iuc_id!;
    // By id AND item: another item's conversion row is not this item's to
    // rewrite (notes 137 A1).
    const existing = await tx.itemUnitConversion.findFirst({
      where: {
        iucId,
        iucItemId: saveItemUnitConversionDto.iuc_item_id,
        iucIsDeleted: false,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemUnitConversionErrorDetail>(
        'Item unit conversion not found',
        'iuc_id',
        `No live unit conversion ${iucId} on item ${saveItemUnitConversionDto.iuc_item_id}`,
        ItemUnitConversionErrorCode.NOT_FOUND,
      );
    }
    const baseUnitId = saveItemUnitConversionDto.iuc_base_unit_id ?? existing.iucBaseUnitId;
    // iuc_item_id is the row's owner, not a field it can change.
    const data: Prisma.ItemUnitConversionUncheckedUpdateInput = {
      iucUnitId: saveItemUnitConversionDto.iuc_unit_id,
      iucBaseUnitId: baseUnitId,
      iucUpdatedOn: new Date(),
      // The request's user, else the stored one — never the payload's
      // iuc_updated_by (notes 137 C2).
      iucUpdatedBy: this.requestUser() ?? existing.iucUpdatedBy,
    };
    this.applyOptionalFields(data, saveItemUnitConversionDto);
    // Unprovided fields keep their existing persisted values, so validate the
    // effective post-update state (incoming values merged over the stored row).
    this.assertItemUnitConversionConstraints({
      unitId: saveItemUnitConversionDto.iuc_unit_id ?? existing.iucUnitId,
      baseUnitId,
      toBaseFactor:
        saveItemUnitConversionDto.iuc_to_base_factor ?? toNumber(existing.iucToBaseFactor),
      uomWeight: saveItemUnitConversionDto.iuc_uom_weight ?? toNumber(existing.iucUomWeight),
      isBaseUnit: saveItemUnitConversionDto.iuc_is_base_unit ?? existing.iucIsBaseUnit,
    });
    const updated = await tx.itemUnitConversion.update({
      where: {
        iucId,
      },
      data,
    });
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
        screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iucId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: this.resolveAuditActor(payload.iuc_updated_by),
        notes: 'Item unit conversion updated',
      },
      tx,
    );
    return payload;
  }
  private async toggleDeleteItemUnitConversion(
    tx: Prisma.TransactionClient,
    iucId: string,
  ): Promise<ItemUnitConversionDeleteResult> {
    // Find regardless of current deleted state
    const existing = await tx.itemUnitConversion.findFirst({
      where: {
        iucId,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemUnitConversionErrorDetail>(
        'Item unit conversion not found',
        'iuc_id',
        `No item unit conversion found with id ${iucId}`,
        ItemUnitConversionErrorCode.NOT_FOUND,
      );
    }
    const nextDeleted = !existing.iucIsDeleted;
    const updatedOn = new Date();
    const updated = await tx.itemUnitConversion.update({
      where: {
        iucId,
      },
      data: {
        iucIsDeleted: nextDeleted,
        iucUpdatedOn: updatedOn,
        iucUpdatedBy: this.requestUser() ?? existing.iucUpdatedBy,
      },
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_UNIT_CONVERSION_TABLE_NAME,
        screenName: ITEM_UNIT_CONVERSION_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iucId,
        displayName: this.buildDisplayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: this.resolveAuditActor(updated.iucUpdatedBy),
        notes: nextDeleted ? 'Item unit conversion soft deleted' : 'Item unit conversion restored',
      },
      tx,
    );
    return {
      iuc_id: iucId,
      deleted: nextDeleted,
    };
  }
  private validateItemUnitConversion(saveItemUnitConversionDto: SaveItemUnitConversionDto): void {
    const factor = saveItemUnitConversionDto.iuc_to_base_factor;
    const unitFactor =
      saveItemUnitConversionDto.iuc_unit_factor ?? saveItemUnitConversionDto.iul_unit_factor;
    const resolvedBaseUnitId =
      saveItemUnitConversionDto.iuc_base_unit_id ?? saveItemUnitConversionDto.iuc_unit_id;
    if (factor !== undefined && factor <= 0) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', [
        {
          field: 'iuc_to_base_factor',
          code: ItemUnitConversionErrorCode.FACTOR_NOT_POSITIVE,
          message: 'iuc_to_base_factor must be greater than 0',
        },
      ]);
    }
    if (unitFactor !== undefined && unitFactor <= 0) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', [
        {
          field: 'iuc_unit_factor',
          code: ItemUnitConversionErrorCode.UNIT_FACTOR_NOT_POSITIVE,
          message: 'iuc_unit_factor must be greater than 0',
        },
      ]);
    }
    const uomWeight = saveItemUnitConversionDto.iuc_uom_weight;
    if (uomWeight !== undefined && uomWeight < 0) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', [
        {
          field: 'iuc_uom_weight',
          code: ItemUnitConversionErrorCode.WEIGHT_NEGATIVE,
          message: 'iuc_uom_weight cannot be negative',
        },
      ]);
    }
    if (saveItemUnitConversionDto.iuc_is_base_unit !== true) {
      return;
    }
    if (saveItemUnitConversionDto.iuc_unit_id !== resolvedBaseUnitId) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', [
        {
          field: 'iuc_unit_id',
          code: ItemUnitConversionErrorCode.BASE_ROW_UNIT_MISMATCH,
          message: 'Base unit conversion row must use the selected base unit as iuc_unit_id',
        },
      ]);
    }
    // Do not force iuc_unit_factor = 1 for the base row.
    // Base unit may be first, middle, or last row in the chain.
    // The persisted-state guard (assertItemUnitConversionConstraints) enforces
    // iuc_to_base_factor = 1 for the base row after factor normalization.
  }
  /**
   * Application-layer replacement for the database CHECK constraints that were
   * dropped from the item_unit_conversion table:
   *   - chk_iuc_to_base_factor : iuc_to_base_factor > 0
   *   - chk_iuc_uom_weight     : iuc_uom_weight >= 0
   *   - chk_iuc_base_row       : (iuc_is_base_unit = true  AND iuc_unit_id = iuc_base_unit_id AND iuc_to_base_factor = 1)
   *                              OR (iuc_is_base_unit = false AND iuc_to_base_factor > 0)
   *
   * Runs against the final, resolved row values immediately before persistence,
   * mirroring exactly where the database constraint would have fired.
   */
  private assertItemUnitConversionConstraints(row: {
    unitId: string;
    baseUnitId: string;
    toBaseFactor: number;
    uomWeight: number;
    isBaseUnit: boolean;
  }): void {
    const errors: ItemUnitConversionErrorDetail[] = [];
    // chk_iuc_to_base_factor
    if (!(row.toBaseFactor > 0)) {
      errors.push({
        field: 'iuc_to_base_factor',
        code: ItemUnitConversionErrorCode.FACTOR_NOT_POSITIVE,
        message: 'iuc_to_base_factor must be greater than 0',
      });
    } else if (row.isBaseUnit && row.toBaseFactor !== 1) {
      // chk_iuc_base_row: base row must convert to itself (factor 1)
      errors.push({
        field: 'iuc_to_base_factor',
        code: ItemUnitConversionErrorCode.BASE_ROW_FACTOR_NOT_ONE,
        message: 'Base unit conversion row must use iuc_to_base_factor = 1',
      });
    }
    // chk_iuc_uom_weight
    if (row.uomWeight < 0) {
      errors.push({
        field: 'iuc_uom_weight',
        code: ItemUnitConversionErrorCode.WEIGHT_NEGATIVE,
        message: 'iuc_uom_weight cannot be negative',
      });
    }
    // chk_iuc_base_row: base row must reference itself as the base unit
    if (row.isBaseUnit && row.unitId !== row.baseUnitId) {
      errors.push({
        field: 'iuc_unit_id',
        code: ItemUnitConversionErrorCode.BASE_ROW_UNIT_MISMATCH,
        message: 'Base unit conversion row must use the selected base unit as iuc_unit_id',
      });
    }
    if (errors.length > 0) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', errors);
    }
  }
  private async normalizeItemUnitConversionBaseUnits(
    tx: Prisma.TransactionClient,
    saveItems: SaveItemUnitConversionDto[],
  ): Promise<SaveItemUnitConversionDto[]> {
    const inferredBaseUnitIds = new Map<string, string>();
    for (const saveItem of saveItems) {
      if (saveItem.iuc_base_unit_id) {
        inferredBaseUnitIds.set(saveItem.iuc_item_id, saveItem.iuc_base_unit_id);
        continue;
      }
      if (saveItem.iuc_is_base_unit === true) {
        inferredBaseUnitIds.set(saveItem.iuc_item_id, saveItem.iuc_unit_id);
      }
    }
    for (const saveItem of saveItems) {
      if (saveItem.iuc_base_unit_id || inferredBaseUnitIds.has(saveItem.iuc_item_id)) {
        continue;
      }
      const persistedBaseUnitId = await this.resolvePersistedItemUnitConversionBaseUnitId(
        tx,
        saveItem.iuc_id,
        saveItem.iuc_item_id,
      );
      inferredBaseUnitIds.set(saveItem.iuc_item_id, persistedBaseUnitId ?? saveItem.iuc_unit_id);
    }
    return saveItems.map((saveItem) =>
      saveItem.iuc_base_unit_id
        ? saveItem
        : {
            ...saveItem,
            iuc_base_unit_id: inferredBaseUnitIds.get(saveItem.iuc_item_id) ?? saveItem.iuc_unit_id,
          },
    );
  }
  private async normalizeItemUnitConversionFactors(
    tx: Prisma.TransactionClient,
    saveItems: SaveItemUnitConversionDto[],
  ): Promise<SaveItemUnitConversionDto[]> {
    if (saveItems.length === 0) {
      return saveItems;
    }
    const normalizedItems = [...saveItems];
    const saveItemsByItemId = new Map<
      string,
      Array<{ index: number; item: SaveItemUnitConversionDto }>
    >();
    saveItems.forEach((saveItem, index) => {
      const existingEntries = saveItemsByItemId.get(saveItem.iuc_item_id) ?? [];
      existingEntries.push({ index, item: saveItem });
      saveItemsByItemId.set(saveItem.iuc_item_id, existingEntries);
    });
    for (const [itemId, indexedSaveItems] of saveItemsByItemId.entries()) {
      const persistedRows = await tx.itemUnitConversion.findMany({
        where: {
          iucItemId: itemId,
          iucIsDeleted: false,
        },
        orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
      });
      const effectiveRows: EffectiveItemUnitConversionRow[] = persistedRows.map((row) => ({
        iucId: row.iucId,
        unitId: row.iucUnitId,
        baseUnitId: row.iucBaseUnitId,
        unitSlno: row.iucUnitSlno,
        toBaseFactor: this.toPositiveFactor(row.iucToBaseFactor),
        unitFactor: this.toPositiveFactor(row.iucUnitFactor),
        isBaseUnit: row.iucIsBaseUnit,
      }));
      for (const { index, item } of indexedSaveItems) {
        const nextRow: EffectiveItemUnitConversionRow = {
          saveIndex: index,
          iucId: item.iuc_id,
          unitId: item.iuc_unit_id,
          baseUnitId: item.iuc_base_unit_id ?? item.iuc_unit_id,
          unitSlno: item.iuc_unit_slno ?? 0,
          toBaseFactor: this.toPositiveFactor(item.iuc_to_base_factor),
          unitFactor: this.toPositiveFactor(item.iuc_unit_factor ?? item.iul_unit_factor),
          isBaseUnit:
            item.iuc_is_base_unit === true ||
            (item.iuc_base_unit_id ?? item.iuc_unit_id) === item.iuc_unit_id,
        };
        const existingIndex = effectiveRows.findIndex((row) =>
          item.iuc_id ? row.iucId === item.iuc_id : row.unitId === item.iuc_unit_id,
        );
        if (existingIndex >= 0) {
          effectiveRows[existingIndex] = {
            ...effectiveRows[existingIndex],
            ...nextRow,
          };
        } else {
          effectiveRows.push(nextRow);
        }
      }
      if (effectiveRows.length === 0) {
        continue;
      }
      effectiveRows.sort((left, right) => {
        if (left.unitSlno !== right.unitSlno) {
          return left.unitSlno - right.unitSlno;
        }
        return left.unitId.localeCompare(right.unitId);
      });
      const resolvedBaseUnitId =
        indexedSaveItems.find(({ item }) => item.iuc_is_base_unit === true)?.item.iuc_unit_id ??
        effectiveRows.find((row) => row.isBaseUnit)?.unitId ??
        effectiveRows[0].baseUnitId ??
        effectiveRows[0].unitId;
      for (const row of effectiveRows) {
        row.baseUnitId = resolvedBaseUnitId;
        row.isBaseUnit = row.unitId === resolvedBaseUnitId;
      }
      const cumulativeByUnitId = new Map<string, number>();
      for (let i = 0; i < effectiveRows.length; i++) {
        const row = effectiveRows[i];
        if (i === 0) {
          row.unitFactor = 1;
          // The chain is anchored here, so an anchor row that carries no
          // to-base factor of its own stands in as the 1x reference the next
          // row's step factor is derived against.
          row.toBaseFactor = row.toBaseFactor ?? 1;
          cumulativeByUnitId.set(row.unitId, 1);
          continue;
        }
        const previousRow = effectiveRows[i - 1];
        const resolvedUnitFactor = this.resolveChainUnitFactor(previousRow, row);
        row.unitFactor = resolvedUnitFactor;
        const previousCumulative = cumulativeByUnitId.get(previousRow.unitId)!;
        const currentCumulative = this.roundFactor(previousCumulative * resolvedUnitFactor);
        cumulativeByUnitId.set(row.unitId, currentCumulative);
      }
      // THE ITEM CARD'S RULE (notes 147 A, 2026-10-23): the list runs from the
      // biggest unit down, and a row's iuc_unit_factor is how many of IT make one
      // of the row above — Bottle (1) / PCS (10) is 1 Bottle = 10 PCS. So a
      // row's cumulative counts its units in one of row 1, and
      // iuc_to_base_factor ("qty in this unit x factor = qty in the base unit")
      // is the base's cumulative over the row's: a row above the base is bigger
      // (Bottle = 10), one below it smaller (a factor under 1). 99d0a468
      // (2026-07-27) had inverted this to row / base, which stored Bottle = 0.1.
      // When the base unit has no row in the chain there is nothing to anchor
      // against, and each row keeps the to-base factor it came in with.
      const baseCumulative = cumulativeByUnitId.get(resolvedBaseUnitId);
      for (const row of effectiveRows) {
        const rowCumulative = cumulativeByUnitId.get(row.unitId)!;
        row.toBaseFactor = baseCumulative
          ? this.roundFactor(baseCumulative / rowCumulative)
          : (row.toBaseFactor ?? rowCumulative);
      }
      for (const row of effectiveRows) {
        if (row.saveIndex === undefined) {
          continue;
        }
        const saveItem = normalizedItems[row.saveIndex];
        normalizedItems[row.saveIndex] = {
          ...saveItem,
          iuc_base_unit_id: resolvedBaseUnitId,
          iuc_unit_slno: row.unitSlno,
          iuc_to_base_factor: row.toBaseFactor,
          iuc_unit_factor: row.unitFactor,
          iul_unit_factor: row.unitFactor,
          iuc_is_base_unit: row.isBaseUnit,
        };
      }
    }
    return normalizedItems;
  }
  private resolveChainUnitFactor(
    previousRow: EffectiveItemUnitConversionRow,
    currentRow: EffectiveItemUnitConversionRow,
  ): number {
    const explicitUnitFactor = this.toPositiveFactor(currentRow.unitFactor);
    if (explicitUnitFactor !== undefined) {
      return this.roundFactor(explicitUnitFactor);
    }
    const previousToBaseFactor = this.toPositiveFactor(previousRow.toBaseFactor);
    const currentToBaseFactor = this.toPositiveFactor(currentRow.toBaseFactor);
    // Both to-base factors count base units per row unit, so the step — how
    // many of this row make one of the row above (the item card's rule) — is
    // the previous row's over this one's.
    if (previousToBaseFactor !== undefined && currentToBaseFactor !== undefined) {
      return this.roundFactor(previousToBaseFactor / currentToBaseFactor);
    }
    throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', [
      {
        field: 'iuc_unit_factor',
        code: ItemUnitConversionErrorCode.UNIT_FACTOR_MISSING,
        message: `Missing iuc_unit_factor for unit row ${currentRow.unitId}`,
      },
    ]);
  }
  private roundFactor(value: number, scale = 9): number {
    return Number(value.toFixed(scale));
  }
  private toPositiveFactor(value: Prisma.Decimal | number | null | undefined): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }
    return parsed;
  }
  private async resolvePersistedItemUnitConversionBaseUnitId(
    tx: Prisma.TransactionClient,
    iucId: string | undefined,
    itemId: string,
  ): Promise<string | undefined> {
    if (iucId) {
      const existingRecord = await tx.itemUnitConversion.findFirst({
        where: {
          iucId,
          iucIsDeleted: false,
        },
      });
      if (existingRecord?.iucBaseUnitId) {
        return existingRecord.iucBaseUnitId;
      }
    }
    const baseRow = await tx.itemUnitConversion.findFirst({
      where: {
        iucItemId: itemId,
        iucIsBaseUnit: true,
        iucIsDeleted: false,
      },
    });
    if (baseRow?.iucBaseUnitId) {
      return baseRow.iucBaseUnitId;
    }
    const existingRow = await tx.itemUnitConversion.findFirst({
      where: {
        iucItemId: itemId,
        iucIsDeleted: false,
      },
    });
    if (existingRow?.iucBaseUnitId) {
      return existingRow.iucBaseUnitId;
    }
    const item = await tx.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
      },
      select: {
        itemBaseUnitId: true,
      },
    });
    return item?.itemBaseUnitId ?? undefined;
  }
  private applyOptionalFields(
    data:
      | Prisma.ItemUnitConversionUncheckedCreateInput
      | Prisma.ItemUnitConversionUncheckedUpdateInput,
    saveItemUnitConversionDto: SaveItemUnitConversionDto,
  ): void {
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_to_base_factor')) {
      data.iucToBaseFactor = saveItemUnitConversionDto.iuc_to_base_factor;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_unit_slno')) {
      data.iucUnitSlno = saveItemUnitConversionDto.iuc_unit_slno;
    }
    const hasUnitFactor =
      hasOwnProperty(saveItemUnitConversionDto, 'iuc_unit_factor') ||
      hasOwnProperty(saveItemUnitConversionDto, 'iul_unit_factor');
    const unitFactor =
      saveItemUnitConversionDto.iuc_unit_factor ?? saveItemUnitConversionDto.iul_unit_factor;
    if (hasUnitFactor && unitFactor !== undefined) {
      data.iucUnitFactor = unitFactor;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_default_unit')) {
      data.iucIsDefaultUnit = saveItemUnitConversionDto.iuc_is_default_unit;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_base_unit')) {
      data.iucIsBaseUnit = saveItemUnitConversionDto.iuc_is_base_unit;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_big_unit')) {
      data.iucIsBigUnit = saveItemUnitConversionDto.iuc_is_big_unit;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_uom_weight')) {
      data.iucUomWeight = saveItemUnitConversionDto.iuc_uom_weight;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_uom_remarks')) {
      data.iucUomRemarks = saveItemUnitConversionDto.iuc_uom_remarks;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_is_active')) {
      data.iucIsActive = saveItemUnitConversionDto.iuc_is_active;
    }
    if (hasOwnProperty(saveItemUnitConversionDto, 'iuc_sync_date')) {
      data.iucSyncDate = this.parseOptionalDate(
        saveItemUnitConversionDto.iuc_sync_date,
        'iuc_sync_date',
      );
    }
  }
  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Validation failed', [
        {
          field: fieldName,
          code: ItemUnitConversionErrorCode.DATE_INVALID,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }
    return parsedDate;
  }
  private toPayload(record: ItemUnitConversion): ItemUnitConversionPayload {
    return {
      iuc_id: record.iucId,
      iuc_item_id: record.iucItemId,
      iuc_unit_id: record.iucUnitId,
      iuc_base_unit_id: record.iucBaseUnitId,
      iuc_to_base_factor: toNumber(record.iucToBaseFactor),
      iuc_unit_slno: record.iucUnitSlno,
      iuc_unit_factor: toNumber(record.iucUnitFactor),
      iuc_is_default_unit: record.iucIsDefaultUnit,
      iuc_is_base_unit: record.iucIsBaseUnit,
      iuc_is_big_unit: record.iucIsBigUnit,
      iuc_uom_weight: toNumber(record.iucUomWeight),
      iuc_uom_remarks: record.iucUomRemarks,
      iuc_is_active: record.iucIsActive,
      iuc_is_deleted: record.iucIsDeleted,
      iuc_sync_date: record.iucSyncDate ? record.iucSyncDate.toISOString() : null,
      iuc_created_on: record.iucCreatedOn.toISOString(),
      iuc_created_by: record.iucCreatedBy,
      iuc_updated_on: record.iucUpdatedOn ? record.iucUpdatedOn.toISOString() : null,
      iuc_updated_by: record.iucUpdatedBy,
    };
  }
  private buildDisplayName(record: ItemUnitConversion): string {
    return `${record.iucItemId}:${record.iucUnitId}:${record.iucBaseUnitId}`;
  }
  /** The authenticated user, or null — never the nil-uuid DEFAULT_ACTOR sentinel. */
  private requestUser(): string | null {
    return this.requestContextService.getUserId()?.trim() || null;
  }
  private resolveAuditActor(
    value: string | null | undefined,
    fallback = DEFAULT_AUDIT_ACTOR,
  ): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemUnitConversionErrorDetail>(
      error,
      'Item unit conversion already exists',
      [
        {
          field: 'iuc_unit_id',
          code: ItemUnitConversionErrorCode.DUPLICATE,
          message:
            'Duplicate item unit conversion, default-unit, or base-unit configuration is not allowed',
        },
      ],
    );
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>('Invalid relation reference', [
        {
          field: 'request',
          code: ItemUnitConversionErrorCode.REFERENCE_NOT_FOUND,
          message: 'Referenced item, unit, or base unit does not exist',
        },
      ]);
    }
  }
  private handleDeleteError(error: unknown): void {
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemUnitConversionErrorDetail>(
        'Cannot delete item unit conversion',
        [
          {
            field: 'iuc_id',
            code: ItemUnitConversionErrorCode.IN_USE,
            message: 'Item unit conversion is referenced by related records',
          },
        ],
      );
    }
  }
}
