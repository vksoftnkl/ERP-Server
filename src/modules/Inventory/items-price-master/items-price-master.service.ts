import { Injectable } from '@nestjs/common';
import { ItemPriceMaster, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemPriceQueryDto } from './dto/get-item-price-query.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import {
  ItemPriceDeleteResult,
  ItemPriceErrorDetail,
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
  ScheduledItemPricePayload,
} from './types/item-price-api.types';
import { ItemPriceErrorCode } from './types/item-price-error-codes';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PriceBucketService } from './price-bucket.service';
import { PriceMasterWriter } from '../item-price-log/price-master-writer.service';
import { PRICE_ORIGIN } from '../item-price-log/types/price-change-log.types';
import { sameBucket, bucketKeyOfRow, toDay, type BucketKey } from './price-resolver';
import {
  databaseToday,
  priceRowsInForce,
  priceRowsScheduledAfter,
  toDateColumn,
} from './price-period.helper';
import { resolveItemTaxRates } from '../utils/item-tax-rate.helper';
import { recomputeLevel } from 'src/modules/stocks/selling-price-bulk/selling-price-math.helper';
import { assertChildDeletable, assertItemsLive } from '../utils/item-child.helper';
import {
  hasOwnProperty,
  isExclusionConstraintError,
  isForeignKeyConstraintError,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  throwUnprocessable,
  toNullableNumber,
  toNumber,
  violatedCheckOf,
} from 'src/common/utils/module-service.utils';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
const DEFAULT_AUDIT_ACTOR = 'system';
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
/**
 * The price table's CHECKs, in words. The database is the last line; what it
 * must not do is answer a shopkeeper with a constraint name.
 */
const CHECK_MESSAGES: Readonly<
  Record<string, { field: string; code: ItemPriceErrorCode; message: string }>
> = {
  ck_ipm_not_above_mrp: {
    field: 'ipm_max_price',
    code: ItemPriceErrorCode.ABOVE_MRP,
    message:
      'A price for one MRP cannot be above that MRP. Lower the selling price, or correct the MRP.',
  },
  ck_ipm_bucket_mrp_is_max: {
    field: 'ipm_max_price',
    code: ItemPriceErrorCode.MRP_BUCKET_MISMATCH,
    message: "A price row's MRP bucket and its MRP must be the same figure.",
  },
  ck_ipm_bucket_mrp: {
    field: 'ipm_max_price',
    code: ItemPriceErrorCode.MRP_BUCKET_NOT_POSITIVE,
    message: 'An MRP bucket must be above zero.',
  },
  ck_ipm_bucket_sp: {
    field: 'ipm_sales_price_a',
    code: ItemPriceErrorCode.SP_BUCKET_NOT_POSITIVE,
    message: 'A sale-price bucket must be above zero.',
  },
  ck_ipm_dates: {
    field: 'request',
    code: ItemPriceErrorCode.DATES_REVERSED,
    message: 'A price cannot end before it starts.',
  },
  chk_ipm_nonnegative: {
    field: 'request',
    code: ItemPriceErrorCode.NEGATIVE_FIGURE,
    message: 'Prices, charges and points cannot be negative.',
  },
};
/**
 * item_price_master stores no unit shape (base unit, factors, slno, the is_*
 * flags) — item_unit_conversion owns it, and a price row reaches it through
 * ipm_uc_unit_id. Callers that need those attributes read the conversion row
 * itself; nothing here mirrors them onto the price payload.
 */
@Injectable()
export class ItemsPriceMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
    private readonly priceBucketService: PriceBucketService,
    /** Notes 144 — the one writer of the price table; it logs every change it makes. */
    private readonly priceWriter: PriceMasterWriter,
  ) {}
  async save(
    saveItemPriceDto: SaveItemPriceDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload>;
  async save(
    saveItemPriceDto: SaveItemPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload[]>;
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload | ItemPricePayload[]>;
  /**
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own (see ItemsMasterService.saveComposite).
   */
  async save(
    saveItemPriceDto: SaveItemPriceDto | SaveItemPriceDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPricePayload | ItemPricePayload[]> {
    const saveItems = Array.isArray(saveItemPriceDto) ? saveItemPriceDto : [saveItemPriceDto];
    const saveAll = async (client: Prisma.TransactionClient) => {
      await assertItemsLive(
        client,
        saveItems.map((item) => item.ipm_item_id),
        { field: 'ipm_item_id', code: ItemPriceErrorCode.ITEM_NOT_LIVE },
      );
      const savedItems: ItemPricePayload[] = [];
      for (const saveItem of saveItems) {
        savedItems.push(await this.saveItemPrice(client, saveItem));
      }
      return savedItems;
    };
    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
      return Array.isArray(saveItemPriceDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async listPrices(
    queryDto: GetItemPriceQueryDto,
  ): Promise<ConfiguredGridListResult<ItemPriceListItem, ItemPriceListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemPriceMasterWhereInput = {
      ipmIsDeleted: false,
      ...(queryDto.ipm_item_id !== undefined && { ipmItemId: queryDto.ipm_item_id }),
      ...(queryDto.ipm_company_id !== undefined && { ipmCompanyId: queryDto.ipm_company_id }),
      ...(queryDto.ipm_branch_id !== undefined && { ipmBranchId: queryDto.ipm_branch_id }),
      ...(queryDto.ipm_is_active !== undefined && { ipmIsActive: queryDto.ipm_is_active }),
    };
    return runInventoryListQuery<ItemPriceMaster, ItemPriceListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemPriceListItem>(this.configuredGridSqlService, {
            tableName: ITEM_PRICE_TABLE_NAME,
            alias: 'item_price_grid',
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.itemPriceMaster.count({ where }),
        findManyFn: () =>
          this.prisma.itemPriceMaster.findMany({
            where,
            // ipm_sl_no is the price row's own display order; where it ties
            // (both default 0), the conversion row's unit order decides.
            orderBy: [
              { ipmItemId: 'asc' },
              { ipmSlNo: 'asc' },
              { itemUnitConversion: { iucUnitSlno: 'asc' } },
              { ipmId: 'asc' },
            ],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(ipmId: string): Promise<ItemPricePayload> {
    const record = await this.prisma.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmIsDeleted: false,
      },
    });
    if (!record) {
      throwInventoryNotFound<ItemPriceErrorDetail>(
        'Item price not found',
        'ipm_id',
        `No item price found with id ${ipmId}`,
        ItemPriceErrorCode.NOT_FOUND,
      );
    }
    return this.toPayload(record);
  }
  /**
   * The item's prices TODAY — the rows in force on the database's today
   * (notes 140 C). What the item card shows and syncs: a scheduled row (it
   * starts after today) and a row a split closed (it ended before today) share
   * their key with today's row, and matched by key they would be claimed,
   * refused as duplicates or soft-deleted as unclaimed.
   */
  async findByItemId(
    itemId: string,
    client: InventoryWriteClient = this.prisma,
  ): Promise<ItemPricePayload[]> {
    const today = await databaseToday(client);
    const records = await client.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: false, ...priceRowsInForce(today) },
      orderBy: [
        { ipmSlNo: 'asc' },
        { itemUnitConversion: { iucUnitSlno: 'asc' } },
        { ipmId: 'asc' },
      ],
    });
    return records.map((record) => this.toPayload(record));
  }
  /**
   * Notes 140 C — the item's scheduled prices: live rows starting after today,
   * with their period, in start order. Read-only on the item card; Change
   * Selling Price writes and cancels them.
   */
  async findScheduledByItemId(
    itemId: string,
    client: InventoryWriteClient = this.prisma,
  ): Promise<ScheduledItemPricePayload[]> {
    const today = await databaseToday(client);
    const records = await client.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: false, ...priceRowsScheduledAfter(today) },
      orderBy: [
        { itemUnitConversion: { iucUnitSlno: 'asc' } },
        { ipmEffectiveFrom: 'asc' },
        { ipmId: 'asc' },
      ],
    });
    return records.map((record) => ({
      ...this.toPayload(record),
      ipm_effective_from: toDay(record.ipmEffectiveFrom),
      ipm_effective_to: toDay(record.ipmEffectiveTo),
    }));
  }
  async toggleDelete(ipmId: string, tx?: Prisma.TransactionClient): Promise<ItemPriceDeleteResult>;
  async toggleDelete(
    ipmId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPriceDeleteResult[]>;
  async toggleDelete(
    ipmId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async toggleDelete(
    ipmId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const toggleIds = Array.isArray(ipmId) ? ipmId : [ipmId];
    const toggleAll = async (client: Prisma.TransactionClient) => {
      const toggledItems: ItemPriceDeleteResult[] = [];
      for (const toggleId of toggleIds) {
        toggledItems.push(await this.toggleDeleteItemPrice(client, toggleId));
      }
      return toggledItems;
    };
    try {
      const results = tx ? await toggleAll(tx) : await this.prisma.$transaction(toggleAll);
      return Array.isArray(ipmId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }
  /**
   * DELETE /item-prices/delete. Deletes only — a deleted row is a 409, not a
   * restore (notes 137 D1); toggleDelete stays the composite's tool.
   */
  async delete(ipmId: string): Promise<ItemPriceDeleteResult>;
  async delete(ipmId: string[]): Promise<ItemPriceDeleteResult[]>;
  async delete(ipmId: string | string[]): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]>;
  async delete(ipmId: string | string[]): Promise<ItemPriceDeleteResult | ItemPriceDeleteResult[]> {
    const ids = Array.isArray(ipmId) ? ipmId : [ipmId];
    try {
      const results = await this.prisma.$transaction(async (client) => {
        const deleted: ItemPriceDeleteResult[] = [];
        for (const id of ids) {
          const existing = await client.itemPriceMaster.findFirst({ where: { ipmId: id } });
          if (!existing) {
            throwInventoryNotFound<ItemPriceErrorDetail>(
              'Item price not found',
              'ipm_id',
              `No item price found with id ${id}`,
              ItemPriceErrorCode.NOT_FOUND,
            );
          }
          await assertChildDeletable(
            client,
            { isDeleted: existing.ipmIsDeleted, itemId: existing.ipmItemId },
            {
              label: 'price row',
              idField: 'ipm_id',
              alreadyDeletedCode: ItemPriceErrorCode.ALREADY_DELETED,
              itemNotLiveCode: ItemPriceErrorCode.ITEM_NOT_LIVE,
            },
          );
          deleted.push(await this.toggleDeleteItemPrice(client, id));
        }
        return deleted;
      });
      return Array.isArray(ipmId) ? results : results[0];
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }
  private async saveItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    if (saveItemPriceDto.ipm_id) {
      return this.updateItemPrice(tx, saveItemPriceDto);
    }
    return this.createItemPrice(tx, saveItemPriceDto);
  }
  private async toggleDeleteItemPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
  ): Promise<ItemPriceDeleteResult> {
    // Find regardless of current deleted state
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemPriceErrorDetail>(
        'Item price not found',
        'ipm_id',
        `No item price found with id ${ipmId}`,
        ItemPriceErrorCode.NOT_FOUND,
      );
    }
    const nextDeleted = !existing.ipmIsDeleted;
    const updatedOn = new Date();
    const updated = await this.priceWriter.updatePrice(tx, PRICE_ORIGIN.ITEM_CARD, ipmId, {
      ipmIsDeleted: nextDeleted,
      ipmUpdatedOn: updatedOn,
      ipmUpdatedBy: this.requestUser() ?? existing.ipmUpdatedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(existing),
        originalRecord: this.toPayload(existing),
        modifiedRecord: this.toPayload(updated),
        userId: this.resolveAuditActor(updated.ipmUpdatedBy),
        notes: nextDeleted ? 'Item price soft deleted' : 'Item price restored',
      },
      tx,
    );
    return {
      ipm_id: ipmId,
      deleted: nextDeleted,
    };
  }
  private async createItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_profit_type',
          code: ItemPriceErrorCode.PROFIT_TYPE_REQUIRED,
          message: 'ipm_profit_type is required',
        },
      ]);
    }
    const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
    await this.assertRowScope(tx, saveItemPriceDto, null);
    const now = new Date();
    // The request's user, never the payload's ipm_created_by / ipm_updated_by
    // (notes 137 C2): a body could name anyone.
    const createdBy = this.requestUser();
    const updatedBy = createdBy;
    const data: Prisma.ItemPriceMasterUncheckedCreateInput = {
      ipmItemId: saveItemPriceDto.ipm_item_id,
      ipmUcUnitId: unitConversion.iucId,
      ipmGodownId: saveItemPriceDto.ipm_godown_id ?? null,
      ipmProfitType: profitType,
      // The unit's own remark seeds the price row when the caller sends none.
      ipmUomRemarks: unitConversion.iucUomRemarks,
      ipmCreatedOn: now,
      ipmCreatedBy: createdBy,
      ipmUpdatedOn: now,
      ipmUpdatedBy: updatedBy,
    };
    this.applyOptionalFields(data, saveItemPriceDto);
    await this.applyBucket(tx, data, saveItemPriceDto, null);
    await this.applyOpenPeriod(tx, data);
    await this.fillLevelFigures(tx, data, saveItemPriceDto, null);
    const created = await this.priceWriter.createPrice(tx, PRICE_ORIGIN.ITEM_CARD, data);
    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ipm_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: this.resolveAuditActor(createdBy),
        notes: 'Item price created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemPrice(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPricePayload> {
    const ipmId = saveItemPriceDto.ipm_id!;
    const profitType = saveItemPriceDto.ipm_profit_type?.trim();
    if (!profitType) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_profit_type',
          code: ItemPriceErrorCode.PROFIT_TYPE_REQUIRED,
          message: 'ipm_profit_type cannot be empty',
        },
      ]);
    }
    // By id AND item: another item's price row is not this item's to rewrite.
    // Loading by id alone moved item A's price onto item B (notes 137 A1).
    const existing = await tx.itemPriceMaster.findFirst({
      where: {
        ipmId,
        ipmItemId: saveItemPriceDto.ipm_item_id,
        ipmIsDeleted: false,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemPriceErrorDetail>(
        'Item price not found',
        'ipm_id',
        `No live price row ${ipmId} on item ${saveItemPriceDto.ipm_item_id}`,
        ItemPriceErrorCode.NOT_FOUND,
      );
    }
    const unitConversion = await this.requireUnitConversion(tx, saveItemPriceDto);
    await this.assertRowScope(tx, saveItemPriceDto, existing);
    // ipm_item_id is the row's owner, not a field it can change.
    const data: Prisma.ItemPriceMasterUncheckedUpdateInput = {
      ipmUcUnitId: unitConversion.iucId,
      ipmProfitType: profitType,
      ipmUpdatedOn: new Date(),
      // The request's user, else the stored one — never the payload's
      // ipm_updated_by (notes 137 C2).
      ipmUpdatedBy: this.requestUser() ?? existing.ipmUpdatedBy,
    };
    // Omitted keeps the stored godown; only an explicit null makes the row
    // global again.
    if (saveItemPriceDto.ipm_godown_id !== undefined) {
      data.ipmGodownId = saveItemPriceDto.ipm_godown_id ?? null;
    }
    this.applyOptionalFields(data, saveItemPriceDto);
    await this.applyBucket(tx, data, saveItemPriceDto, existing);
    await this.fillLevelFigures(tx, data, saveItemPriceDto, existing);
    const updated = await this.priceWriter.updatePrice(tx, PRICE_ORIGIN.ITEM_CARD, ipmId, data);
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_PRICE_TABLE_NAME,
        screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ipmId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: this.resolveAuditActor(payload.ipm_updated_by),
        notes: 'Item price updated',
      },
      tx,
    );
    return payload;
  }
  /**
   * The row's bucket, DERIVED — never read from the payload (the DTO has no
   * field for it, and forbidNonWhitelisted refuses one). Computed from what the
   * row will hold after this write: the payload's value where it sent one, the
   * stored value where it did not. See PriceBucketService.
   *
   * ck_ipm_bucket_mrp_is_max holds by construction: the MRP bucket IS
   * NULLIF(ipm_max_price, 0).
   *
   * Notes 140 D — an UPDATE may not move the row onto other stock. The key is
   * derived twice under the policy in force now and at the row's new scope:
   * from what the row will hold, and from what it holds. When they differ the
   * edit itself changed the bucket — a new MRP on an MRP row, a new
   * default-level price on a sale-price row — and the "MRP 300" price would
   * silently become the "MRP 320" one: 400 ITEM_PRICE_BUCKET_CHANGED. A price
   * for other stock is a new row. When they agree the derived key is written
   * as before, which is how a save that changed the item's tracking re-keys.
   */
  private async applyBucket(
    tx: Prisma.TransactionClient,
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    dto: SaveItemPriceDto,
    existing: ItemPriceMaster | null,
  ): Promise<void> {
    const pick = (sent: number | undefined, stored: Prisma.Decimal | undefined) =>
      sent !== undefined ? sent : stored !== undefined ? toNumber(stored) : 0;
    const scope = {
      companyId:
        dto.ipm_company_id !== undefined ? dto.ipm_company_id : (existing?.ipmCompanyId ?? null),
      branchId:
        dto.ipm_branch_id !== undefined ? dto.ipm_branch_id : (existing?.ipmBranchId ?? null),
    };
    const next = {
      ...scope,
      maxPrice: pick(dto.ipm_max_price, existing?.ipmMaxPrice),
      prices: [
        pick(dto.ipm_sales_price_a, existing?.ipmSalesPriceA),
        pick(dto.ipm_sales_price_b, existing?.ipmSalesPriceB),
        pick(dto.ipm_sales_price_c, existing?.ipmSalesPriceC),
        pick(dto.ipm_sales_price_d, existing?.ipmSalesPriceD),
      ] as const,
    };
    if (!existing) {
      const [key] = await this.priceBucketService.deriveBuckets(tx, dto.ipm_item_id, [next]);
      data.ipmBucketMrp = key.mrp;
      data.ipmBucketSp = key.salePrice;
      return;
    }
    const stored = {
      ...scope,
      maxPrice: toNumber(existing.ipmMaxPrice),
      prices: [
        toNumber(existing.ipmSalesPriceA),
        toNumber(existing.ipmSalesPriceB),
        toNumber(existing.ipmSalesPriceC),
        toNumber(existing.ipmSalesPriceD),
      ] as const,
    };
    const [key, kept] = await this.priceBucketService.deriveBuckets(tx, dto.ipm_item_id, [
      next,
      stored,
    ]);
    if (!sameBucket(key, kept)) {
      this.refuseBucketChange(existing, next, kept, key);
    }
    data.ipmBucketMrp = key.mrp;
    data.ipmBucketSp = key.salePrice;
  }
  /** Notes 140 D — the refusal, naming the row and the figure that moved it. */
  private refuseBucketChange(
    existing: ItemPriceMaster,
    next: { maxPrice: number; prices: readonly number[] },
    from: BucketKey,
    to: BucketKey,
  ): never {
    const stored = bucketKeyOfRow(existing);
    const describe = (key: BucketKey) =>
      [
        key.mrp !== null ? `MRP ${key.mrp}` : null,
        key.salePrice !== null ? `sale price ${key.salePrice}` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'no bucket';
    const levels = ['a', 'b', 'c', 'd'] as const;
    const storedPrices = [
      existing.ipmSalesPriceA,
      existing.ipmSalesPriceB,
      existing.ipmSalesPriceC,
      existing.ipmSalesPriceD,
    ].map((price) => toNumber(price));
    // The figure that moved it: the MRP for an MRP bucket, else the level
    // whose new price is the new sale-price bucket.
    const level =
      from.mrp !== to.mrp
        ? null
        : levels.find(
            (_, index) =>
              next.prices[index] === to.salePrice && next.prices[index] !== storedPrices[index],
          );
    throwInventoryBadRequest<ItemPriceErrorDetail>(
      'This edit would move the price onto other stock',
      [
        {
          field: level ? `ipm_sales_price_${level}` : 'ipm_max_price',
          code: ItemPriceErrorCode.BUCKET_CHANGED,
          message:
            `Price row ${existing.ipmId} prices the stock at ${describe(stored)}; this edit would ` +
            `make it the price of ${describe(to)}. Add a new price row for that stock instead.`,
        },
      ],
    );
  }
  /**
   * Notes 140 C — a NEW row is in force today and fills exactly the gap its key
   * has around today: from the day after the key's last closed row (a split's
   * history) and to the day before its next scheduled row. A key with neither
   * keeps the column defaults (1900-01-01 … 9999-12-31), so nothing changes
   * for an item that has never had a price scheduled. Without this the
   * defaults would overlap those rows and ex_ipm_overlap would refuse the row.
   */
  private async applyOpenPeriod(
    tx: Prisma.TransactionClient,
    data: Prisma.ItemPriceMasterUncheckedCreateInput,
  ): Promise<void> {
    const [gap] = await tx.$queryRaw<Array<{ from: string | null; to: string | null }>>`
      WITH k AS (
        SELECT ipm_effective_from, ipm_effective_to
          FROM inventory.item_price_master
         WHERE ipm_is_deleted = false
           AND ipm_company_id IS NOT DISTINCT FROM ${data.ipmCompanyId ?? null}::uuid
           AND ipm_branch_id  IS NOT DISTINCT FROM ${data.ipmBranchId ?? null}::uuid
           AND ipm_item_id    = ${data.ipmItemId}::uuid
           AND ipm_uc_unit_id = ${data.ipmUcUnitId}::uuid
           AND ipm_key_mrp    = COALESCE(${data.ipmBucketMrp ?? null}::numeric, -1)
           AND ipm_key_sp     = COALESCE(${data.ipmBucketSp ?? null}::numeric, -1)
      )
      SELECT (SELECT MAX(ipm_effective_to) + 1 FROM k WHERE ipm_effective_to < CURRENT_DATE)::text
                 AS "from",
             (SELECT MIN(ipm_effective_from) - 1 FROM k WHERE ipm_effective_from > CURRENT_DATE)::text
                 AS "to"
    `;
    if (gap?.from) data.ipmEffectiveFrom = toDateColumn(gap.from);
    if (gap?.to) data.ipmEffectiveTo = toDateColumn(gap.to);
  }
  /**
   * Notes 71 B4 — a level whose PRICE is sent but whose without-tax figure or
   * markup is not gets them derived here, by the rule menu 30 applies ("price
   * wins", selling-price-math.helper): price ÷ (1 + tax %) at the item's tax
   * rate as of today, and (price − cost) ÷ cost on the row's cost. A client
   * that sends them — the Qt item card always does — is taken at its word; a
   * client that sent prices only used to leave 0 in both.
   */
  private async fillLevelFigures(
    tx: Prisma.TransactionClient,
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    dto: SaveItemPriceDto,
    existing: ItemPriceMaster | null,
  ): Promise<void> {
    const levels = [
      {
        level: 1,
        price: dto.ipm_sales_price_a,
        wot: dto.ipm_price_a_wot,
        markup: dto.ipm_price_a_markup_perc,
      },
      {
        level: 2,
        price: dto.ipm_sales_price_b,
        wot: dto.ipm_price_b_wot,
        markup: dto.ipm_price_b_markup_perc,
      },
      {
        level: 3,
        price: dto.ipm_sales_price_c,
        wot: dto.ipm_price_c_wot,
        markup: dto.ipm_price_c_markup_perc,
      },
      {
        level: 4,
        price: dto.ipm_sales_price_d,
        wot: dto.ipm_price_d_wot,
        markup: dto.ipm_price_d_markup_perc,
      },
    ] as const;
    const missing = levels.filter(
      (l) => l.price !== undefined && (l.wot === undefined || l.markup === undefined),
    );
    if (!missing.length) {
      return;
    }
    const taxPerc =
      (await resolveItemTaxRates(tx, [dto.ipm_item_id])).get(dto.ipm_item_id)?.taxPerc ?? 0;
    const cost =
      dto.ipm_cost_price !== undefined
        ? dto.ipm_cost_price
        : existing
          ? toNumber(existing.ipmCostPrice)
          : 0;
    for (const l of missing) {
      const figures = recomputeLevel(l.level, l.price ?? 0, taxPerc, cost);
      const wot = l.wot === undefined ? figures.priceWot : undefined;
      const markup = l.markup === undefined ? figures.markupPerc : undefined;
      switch (l.level) {
        case 1:
          if (wot !== undefined) data.ipmPriceAWot = wot;
          if (markup !== undefined) data.ipmPriceAMarkupPerc = markup;
          break;
        case 2:
          if (wot !== undefined) data.ipmPriceBWot = wot;
          if (markup !== undefined) data.ipmPriceBMarkupPerc = markup;
          break;
        case 3:
          if (wot !== undefined) data.ipmPriceCWot = wot;
          if (markup !== undefined) data.ipmPriceCMarkupPerc = markup;
          break;
        case 4:
          if (wot !== undefined) data.ipmPriceDWot = wot;
          if (markup !== undefined) data.ipmPriceDMarkupPerc = markup;
          break;
      }
    }
  }
  /**
   * ipm_uc_unit_id is a FK to item_unit_conversion(iuc_id), and the conversion
   * row must belong to the item being priced — the FK alone would happily let a
   * price point at another item's unit. Resolving it here also names the
   * offending field instead of surfacing an opaque foreign-key violation.
   */
  private async requireUnitConversion(
    tx: Prisma.TransactionClient,
    saveItemPriceDto: SaveItemPriceDto,
  ): Promise<{ iucId: string; iucUomRemarks: string | null }> {
    const unitConversion = await tx.itemUnitConversion.findFirst({
      where: {
        iucId: saveItemPriceDto.ipm_uc_unit_id,
        iucItemId: saveItemPriceDto.ipm_item_id,
        iucIsDeleted: false,
      },
      select: { iucId: true, iucUomRemarks: true },
    });
    if (!unitConversion) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: 'ipm_uc_unit_id',
          code: ItemPriceErrorCode.UNIT_NOT_FOUND,
          message: `Unit conversion ${saveItemPriceDto.ipm_uc_unit_id} does not exist for item ${saveItemPriceDto.ipm_item_id}`,
        },
      ]);
    }
    return unitConversion;
  }
  /**
   * Notes 137 C4 — a price row's scope must fit the item and itself:
   *   - ipm_company_id is the item's company, or blank (every company) — a
   *     company-owned item has no price for another company to read;
   *   - ipm_branch_id is a branch of the row's company, else of the item's;
   *   - ipm_godown_id is a godown of the row's branch, else one of the row's /
   *     the item's company.
   * Checked for a new row and for a save that changes any of the three, so a
   * stored row nobody touches never blocks an unrelated edit of the item.
   */
  private async assertRowScope(
    tx: Prisma.TransactionClient,
    dto: SaveItemPriceDto,
    existing: ItemPriceMaster | null,
  ): Promise<void> {
    const pick = (sent: string | null | undefined, stored: string | null | undefined) =>
      sent !== undefined ? sent : (stored ?? null);
    const companyId = pick(dto.ipm_company_id, existing?.ipmCompanyId);
    const branchId = pick(dto.ipm_branch_id, existing?.ipmBranchId);
    const godownId = pick(dto.ipm_godown_id, existing?.ipmGodownId);
    if (
      existing &&
      companyId === existing.ipmCompanyId &&
      branchId === existing.ipmBranchId &&
      godownId === existing.ipmGodownId
    ) {
      return;
    }
    const refuse = (field: string, code: ItemPriceErrorCode, message: string): never =>
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        { field, code, message },
      ]);
    const item = await tx.itemMaster.findFirst({
      where: { itemId: dto.ipm_item_id },
      select: { itemCompanyId: true },
    });
    const itemCompanyId = item?.itemCompanyId ?? null;
    if (companyId && itemCompanyId && companyId !== itemCompanyId) {
      refuse(
        'ipm_company_id',
        ItemPriceErrorCode.OTHER_COMPANY,
        'The item belongs to another company. Leave ipm_company_id blank or name the item’s company.',
      );
    }
    const scopeCompanyId = companyId ?? itemCompanyId;
    if (branchId) {
      const branch = await tx.branchMaster.findFirst({
        where: { brId: branchId },
        select: { brCompId: true, brName: true },
      });
      if (!branch || (scopeCompanyId && branch.brCompId !== scopeCompanyId)) {
        refuse(
          'ipm_branch_id',
          ItemPriceErrorCode.BRANCH_OTHER_COMPANY,
          branch
            ? `${branch.brName} belongs to another company than the price row's`
            : `No branch found with id ${branchId}`,
        );
      }
    }
    if (godownId) {
      const godown = await tx.godownLocation.findFirst({
        where: { gdlId: godownId },
        select: { gdlBranchId: true },
      });
      const godownCompanyId =
        godown && !branchId && scopeCompanyId
          ? ((
              await tx.branchMaster.findFirst({
                where: { brId: godown.gdlBranchId },
                select: { brCompId: true },
              })
            )?.brCompId ?? null)
          : null;
      const outside =
        !godown ||
        (branchId
          ? godown.gdlBranchId !== branchId
          : !!scopeCompanyId && godownCompanyId !== scopeCompanyId);
      if (outside) {
        refuse(
          'ipm_godown_id',
          ItemPriceErrorCode.GODOWN_OUT_OF_SCOPE,
          godown
            ? 'The godown belongs to another branch / company than the price row'
            : `No godown found with id ${godownId}`,
        );
      }
    }
  }
  private applyOptionalFields(
    data: Prisma.ItemPriceMasterUncheckedCreateInput | Prisma.ItemPriceMasterUncheckedUpdateInput,
    saveItemPriceDto: SaveItemPriceDto,
  ): void {
    if (hasOwnProperty(saveItemPriceDto, 'ipm_company_id')) {
      data.ipmCompanyId = saveItemPriceDto.ipm_company_id;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_branch_id')) {
      data.ipmBranchId = saveItemPriceDto.ipm_branch_id;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sl_no')) {
      data.ipmSlNo = saveItemPriceDto.ipm_sl_no;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_cost_price')) {
      data.ipmCostPrice = saveItemPriceDto.ipm_cost_price;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_cost_wot')) {
      data.ipmCostWot = saveItemPriceDto.ipm_cost_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_a')) {
      data.ipmSalesPriceA = saveItemPriceDto.ipm_sales_price_a;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_b')) {
      data.ipmSalesPriceB = saveItemPriceDto.ipm_sales_price_b;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_c')) {
      data.ipmSalesPriceC = saveItemPriceDto.ipm_sales_price_c;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sales_price_d')) {
      data.ipmSalesPriceD = saveItemPriceDto.ipm_sales_price_d;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_a_wot')) {
      data.ipmPriceAWot = saveItemPriceDto.ipm_price_a_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_b_wot')) {
      data.ipmPriceBWot = saveItemPriceDto.ipm_price_b_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_c_wot')) {
      data.ipmPriceCWot = saveItemPriceDto.ipm_price_c_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_d_wot')) {
      data.ipmPriceDWot = saveItemPriceDto.ipm_price_d_wot;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_a_markup_perc')) {
      data.ipmPriceAMarkupPerc = saveItemPriceDto.ipm_price_a_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_b_markup_perc')) {
      data.ipmPriceBMarkupPerc = saveItemPriceDto.ipm_price_b_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_c_markup_perc')) {
      data.ipmPriceCMarkupPerc = saveItemPriceDto.ipm_price_c_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_price_d_markup_perc')) {
      data.ipmPriceDMarkupPerc = saveItemPriceDto.ipm_price_d_markup_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_max_price')) {
      data.ipmMaxPrice = saveItemPriceDto.ipm_max_price;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_min_price')) {
      data.ipmMinPrice = saveItemPriceDto.ipm_min_price;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_disc_perc')) {
      data.ipmDiscPerc = saveItemPriceDto.ipm_disc_perc;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_disc_qty')) {
      data.ipmDiscQty = saveItemPriceDto.ipm_disc_qty;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_addl_cess')) {
      data.ipmAddlCess = saveItemPriceDto.ipm_addl_cess;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_round_off')) {
      data.ipmRoundOff = saveItemPriceDto.ipm_round_off;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_loading_charge')) {
      data.ipmLoadingCharge = saveItemPriceDto.ipm_loading_charge;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_freight_charge')) {
      data.ipmFreightCharge = saveItemPriceDto.ipm_freight_charge;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_loyalty_points')) {
      data.ipmLoyaltyPoints = saveItemPriceDto.ipm_loyalty_points;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_uom_remarks')) {
      data.ipmUomRemarks = saveItemPriceDto.ipm_uom_remarks;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_cost_remarks')) {
      data.ipmCostRemarks = saveItemPriceDto.ipm_cost_remarks;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_is_active')) {
      data.ipmIsActive = saveItemPriceDto.ipm_is_active;
    }
    if (hasOwnProperty(saveItemPriceDto, 'ipm_sync_date')) {
      data.ipmSyncDate = this.parseOptionalDate(saveItemPriceDto.ipm_sync_date, 'ipm_sync_date');
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
      throwInventoryBadRequest<ItemPriceErrorDetail>('Validation failed', [
        {
          field: fieldName,
          code: ItemPriceErrorCode.DATE_INVALID,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }
    return parsedDate;
  }
  private toPayload(record: ItemPriceMaster): ItemPricePayload {
    return {
      ipm_id: record.ipmId,
      ipm_company_id: record.ipmCompanyId,
      ipm_branch_id: record.ipmBranchId,
      ipm_item_id: record.ipmItemId,
      ipm_uc_unit_id: record.ipmUcUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_sl_no: record.ipmSlNo,
      ipm_cost_price: toNumber(record.ipmCostPrice),
      ipm_cost_wot: toNumber(record.ipmCostWot),
      ipm_sales_price_a: toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: toNumber(record.ipmMaxPrice),
      ipm_bucket_mrp: toNullableNumber(record.ipmBucketMrp),
      ipm_bucket_sp: toNullableNumber(record.ipmBucketSp),
      ipm_min_price: toNumber(record.ipmMinPrice),
      ipm_disc_perc: toNumber(record.ipmDiscPerc),
      ipm_disc_qty: toNumber(record.ipmDiscQty),
      ipm_addl_cess: toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: toNumber(record.ipmRoundOff),
      ipm_loading_charge: toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: toNumber(record.ipmLoyaltyPoints),
      ipm_uom_remarks: record.ipmUomRemarks,
      ipm_cost_remarks: record.ipmCostRemarks,
      ipm_is_active: record.ipmIsActive,
      ipm_is_deleted: record.ipmIsDeleted,
      ipm_sync_date: record.ipmSyncDate ? record.ipmSyncDate.toISOString() : null,
      ipm_created_on: record.ipmCreatedOn.toISOString(),
      ipm_created_by: record.ipmCreatedBy,
      ipm_updated_on: record.ipmUpdatedOn ? record.ipmUpdatedOn.toISOString() : null,
      ipm_updated_by: record.ipmUpdatedBy,
    };
  }
  private buildDisplayName(record: ItemPriceMaster): string {
    const branchSegment = record.ipmBranchId ?? 'NO_BRANCH';
    const godownSegment = record.ipmGodownId ?? 'ALL_GODOWNS';
    return `${record.ipmItemId}:${record.ipmUcUnitId}:${branchSegment}:${godownSegment}`;
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
    throwOnUniqueConstraintError<ItemPriceErrorDetail>(error, 'Item price already exists', [
      {
        field: 'ipm_item_id',
        code: ItemPriceErrorCode.DUPLICATE,
        message: 'Duplicate item price configuration is not allowed',
      },
    ]);
    // ex_ipm_overlap: one price per company, branch, unit and bucket (MRP /
    // sale price) at a time. It replaced uq_item_price_master_scope, so this
    // is the same 409 that index used to raise.
    if (isExclusionConstraintError(error)) {
      throwInventoryConflict<ItemPriceErrorDetail>('Item price already exists', [
        {
          field: 'ipm_uc_unit_id',
          code: ItemPriceErrorCode.DUPLICATE,
          message:
            'This unit already has a price at this company, branch and MRP. Edit that row instead of adding another.',
        },
      ]);
    }
    const check = violatedCheckOf(error);
    if (check && CHECK_MESSAGES[check]) {
      throwUnprocessable<ItemPriceErrorDetail>('This price cannot be saved', [
        CHECK_MESSAGES[check],
      ]);
    }
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Invalid relation reference', [
        {
          field: 'request',
          code: ItemPriceErrorCode.REFERENCE_NOT_FOUND,
          message: 'Referenced company, branch, item, unit, base unit, or godown does not exist',
        },
      ]);
    }
  }
  private handleDeleteError(error: unknown): void {
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemPriceErrorDetail>('Cannot delete item price', [
        {
          field: 'ipm_id',
          code: ItemPriceErrorCode.IN_USE,
          message: 'Item price is referenced by related records',
        },
      ]);
    }
  }
}
