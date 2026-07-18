import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemPriceMaster, ItemStockBalance, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import type { ItemPricePayload } from 'src/modules/Inventory/items-price-master/types/item-price-api.types';
import { GetItemBatchStockOptionsQueryDto } from './dto/get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import { GetBulkItemStockListQueryDto } from './dto/get-bulk-item-stock-list-query.dto';
import {
  BulkItemStockPayload,
  ItemBatchStockOptionPayload,
  ItemStockBalanceErrorDetail,
  ItemStockBalanceErrorResponse,
  ItemStockBalancePayload,
} from './types/item-stock-balance-api.types';

type ItemBatchStockWithBatchMaster = Prisma.ItemBatchStockGetPayload<{
  include: { batch: true };
}>;

const DEFAULT_BATCH_OPTION_LIMIT = 50;
const MAX_BATCH_OPTION_LIMIT = 100;
@Injectable()
export class ItemStockBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getByScope(
    queryDto: GetItemStockBalanceQueryDto,
  ): Promise<ItemStockBalancePayload[]> {
    const unitFactorsByUnitId = await this.getItemPriceUnitFactors(
      queryDto.isb_item_id,
      queryDto.isb_unit_id,
    );
    const stockUnitIds = Array.from(
      new Set([queryDto.isb_unit_id, ...unitFactorsByUnitId.keys()]),
    );
    const where: Prisma.ItemStockBalanceWhereInput = {
      isbAccYear: queryDto.isb_acc_year,
      isbCompanyId: queryDto.isb_company_id,
      isbBranchId: queryDto.isb_branch_id,
      isbGodownId: queryDto.isb_godown_id,
      isbItemId: queryDto.isb_item_id,
      isbUnitId: { in: stockUnitIds },
    };
    if (queryDto.isb_stock_bucket) {
      where.isbStockBucket = queryDto.isb_stock_bucket;
    }
    const records = await this.prisma.itemStockBalance.findMany({
      where,
      orderBy: [{ isbStockBucket: 'asc' }, { isbId: 'asc' }],
    });
    if (records.length === 0) {
      this.throwItemStockBalanceNotFound(queryDto);
    }
    if (unitFactorsByUnitId.size === 0) {
      this.throwItemPriceMasterNotFound(queryDto.isb_item_id, queryDto.isb_unit_id);
    }
    return records.map((record) =>
      this.toPayload(record, this.getUnitFactorForStockUnit(record, queryDto, unitFactorsByUnitId)),
    );
  }
  async getBulkList(queryDto: GetBulkItemStockListQueryDto): Promise<BulkItemStockPayload[]> {
    const limit = Math.min(parseInt(queryDto.limit ?? '500', 10) || 500, 2000);

    // Step 1: Resolve item IDs from item master filters first, so the stock
    // balance query can use them directly (avoids the limit cutting off items
    // that would have passed the filter).
    const hasItemFilter =
      queryDto.item_group_id ||
      queryDto.item_brand_id ||
      queryDto.item_section_id ||
      queryDto.item_category_id;

    let filteredItemIds: string[] | null = null;
    if (hasItemFilter) {
      const itemFilterWhere: Prisma.ItemMasterWhereInput = { itemIsDeleted: false };
      if (queryDto.item_group_id) itemFilterWhere.itemGroupId = queryDto.item_group_id;
      if (queryDto.item_brand_id) itemFilterWhere.itemBrandId = queryDto.item_brand_id;
      if (queryDto.item_section_id) itemFilterWhere.itemSectionId = queryDto.item_section_id;
      if (queryDto.item_category_id) itemFilterWhere.itemCategoryId = queryDto.item_category_id;
      const matchedItems = await this.prisma.itemMaster.findMany({
        where: itemFilterWhere,
        select: { itemId: true },
      });
      if (matchedItems.length === 0) return [];
      filteredItemIds = matchedItems.map((i) => i.itemId);
    }

    // Step 2: Query stock balances with resolved item IDs applied as a filter.
    const isbWhere: Prisma.ItemStockBalanceWhereInput = {
      isbAccYear: queryDto.isb_acc_year,
      isbCompanyId: queryDto.isb_company_id,
      isbBranchId: queryDto.isb_branch_id,
    };
    if (filteredItemIds) isbWhere.isbItemId = { in: filteredItemIds };
    if (queryDto.isb_godown_id) isbWhere.isbGodownId = queryDto.isb_godown_id;
    if (queryDto.isb_stock_bucket) isbWhere.isbStockBucket = queryDto.isb_stock_bucket;
    if (queryDto.stock_type === 'ZERO') {
      isbWhere.isbClosingQty = { equals: 0 };
    } else if (queryDto.stock_type === 'NEGATIVE') {
      isbWhere.isbClosingQty = { lt: 0 };
    }
    // ALL: no closing qty filter — all records for the resolved item IDs are returned

    const stockBalances = await this.prisma.itemStockBalance.findMany({
      where: isbWhere,
      orderBy: [{ isbItemId: 'asc' }, { isbUnitId: 'asc' }],
      take: limit,
    });
    if (stockBalances.length === 0) return [];

    // Step 3: Fetch item details, units, godowns, price masters in parallel.
    const allItemIds = [...new Set(stockBalances.map((s) => s.isbItemId))];
    const allUnitIds = [...new Set(stockBalances.map((s) => s.isbUnitId))];
    const allGodownIds = [...new Set(stockBalances.map((s) => s.isbGodownId))];

    const [items, units, godowns, priceMasters] = await Promise.all([
      this.prisma.itemMaster.findMany({
        where: { itemId: { in: allItemIds }, itemIsDeleted: false },
        select: { itemId: true, itemNameEn: true, itemCode: true, itemDefaultBarcode: true, itemBaseUnitId: true },
      }),
      this.prisma.unit.findMany({
        where: { unit_id: { in: allUnitIds } },
        select: { unit_id: true, unit_name: true },
      }),
      this.prisma.godownLocation.findMany({
        where: { gdlId: { in: allGodownIds } },
        select: { gdlId: true, gdlName: true },
      }),
      this.prisma.itemPriceMaster.findMany({
        where: { ipmItemId: { in: allItemIds }, ipmIsDeleted: false },
        select: { ipmItemId: true, ipmId: true, ipmUnitId: true, ipmGodownId: true, ipmBaseUnitId: true, ipmToBaseFactor: true, ipmUnitFactor: true, ipmCostPrice: true, ipmCostWot: true, ipmMaxPrice: true, itemUnitConversion: { select: { iucUnitId: true } } },
      }),
    ]);

    if (items.length === 0) return [];

    const itemsById = new Map(items.map((i) => [i.itemId, i]));
    const unitsById = new Map(units.map((u) => [u.unit_id, u.unit_name]));
    const godownsById = new Map(godowns.map((g) => [g.gdlId, g.gdlName]));

    // Primary key: item + unit + godown (exact match); fallback: item + unit (any godown).
    const priceByItemUnitGodown = new Map<string, (typeof priceMasters)[0]>();
    const priceByItemUnit = new Map<string, (typeof priceMasters)[0]>();
    for (const pm of priceMasters) {
      // Stock balances key off a raw unit_id; ipm_unit_id is an iuc_id, so the
      // index is built on the unit behind the price row's conversion.
      const unitId = pm.itemUnitConversion.iucUnitId;
      const godownKey = `${pm.ipmItemId}:${unitId}:${pm.ipmGodownId}`;
      if (!priceByItemUnitGodown.has(godownKey)) priceByItemUnitGodown.set(godownKey, pm);
      const fallbackKey = `${pm.ipmItemId}:${unitId}`;
      if (!priceByItemUnit.has(fallbackKey)) priceByItemUnit.set(fallbackKey, pm);
    }

    return stockBalances
      .filter((s) => itemsById.has(s.isbItemId))
      .map((balance) => {
        const item = itemsById.get(balance.isbItemId)!;
        const price =
          priceByItemUnitGodown.get(`${balance.isbItemId}:${balance.isbUnitId}:${balance.isbGodownId}`) ??
          priceByItemUnit.get(`${balance.isbItemId}:${balance.isbUnitId}`) ??
          null;
        const toBaseFactor = price
          ? this.toNumber(price.ipmToBaseFactor) || this.toNumber(price.ipmUnitFactor) || 1
          : 1;
        const closingQty = this.toNumber(balance.isbClosingQty);
        const freeClosingQty = this.toNumber(balance.isbFreeClosingQty);
        return {
          isb_item_id: balance.isbItemId,
          item_name: item.itemNameEn,
          item_code: item.itemCode ?? null,
          item_default_barcode: item.itemDefaultBarcode ?? null,
          isb_unit_id: balance.isbUnitId,
          unit_name: unitsById.get(balance.isbUnitId) ?? '',
          isb_base_unit_id: price?.ipmBaseUnitId ?? item.itemBaseUnitId ?? null,
          isb_price_master_id: price?.ipmId ?? null,
          isb_godown_id: balance.isbGodownId,
          godown_name: godownsById.get(balance.isbGodownId) ?? null,
          isb_to_base_factor: toBaseFactor,
          book_qty: toBaseFactor > 0 ? closingQty / toBaseFactor : 0,
          book_base_qty: closingQty,
          book_free_qty: toBaseFactor > 0 ? freeClosingQty / toBaseFactor : 0,
          book_free_base_qty: freeClosingQty,
          avg_stock_rate: this.toNumber(balance.isbAvgStockRate),
          avg_stock_rate_wot: this.toNumber(balance.isbAvgStockRateWot),
          mrp: this.toNumber(price?.ipmMaxPrice ?? 0),
          cost_price: this.toNumber(price?.ipmCostPrice ?? 0),
          cost_wot: this.toNumber(price?.ipmCostWot ?? 0),
          tracking_type: balance.isbTrackingType ?? 'NONE',
        };
      });
  }

  async getBatchOptionsByScope(
    queryDto: GetItemBatchStockOptionsQueryDto,
  ): Promise<ItemBatchStockOptionPayload[]> {
    const unitFactorsByUnitId = await this.getItemPriceUnitFactors(
      queryDto.ibs_item_id,
      queryDto.ibs_unit_id,
    );
    const stockUnitIds = Array.from(
      new Set([queryDto.ibs_unit_id, ...unitFactorsByUnitId.keys()]),
    );
    const where: Prisma.ItemBatchStockWhereInput = {
      ibsAccYear: queryDto.ibs_acc_year,
      ibsCompanyId: queryDto.ibs_company_id,
      ibsBranchId: queryDto.ibs_branch_id,
      ibsGodownId: queryDto.ibs_godown_id,
      ibsItemId: queryDto.ibs_item_id,
      ibsUnitId: { in: stockUnitIds },
      ibsIsActive: true,
      ibsIsDeleted: false,
    };
    if (queryDto.ibs_stock_bucket) {
      where.ibsStockBucket = queryDto.ibs_stock_bucket;
    }
    const normalizedSearch = queryDto.search?.trim();
    if (normalizedSearch) {
      const contains = { contains: normalizedSearch, mode: 'insensitive' as const };
      where.OR = [
        { ibsBatchNo: contains },
        { ibsSerialNo: contains },
        { batch: { is: { btmBatchNo: contains } } },
        { batch: { is: { btmMfgBatchNo: contains } } },
        { batch: { is: { btmBarcode: contains } } },
      ];
    }
    const records = await this.prisma.itemBatchStock.findMany({
      where,
      include: { batch: true },
      orderBy: [{ ibsBatchNo: 'asc' }, { ibsBatchId: 'asc' }],
      take: this.resolveBatchOptionLimit(queryDto.limit),
    });
    const fallbackUnitFactor = unitFactorsByUnitId.get(queryDto.ibs_unit_id) ?? 1;
    return records.map((record) =>
      this.toBatchOptionPayload(
        record,
        unitFactorsByUnitId.get(record.ibsUnitId) ?? fallbackUnitFactor,
      ),
    );
  }
  async getPriceMasterByItemAndUnit(
    itemId: string,
    unitId: string,
  ): Promise<ItemPricePayload[]> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: itemId,
        ipmIsDeleted: false,
        // ipm_unit_id holds an iuc_id, so a caller-supplied unit_id matches
        // through the conversion row rather than the column itself.
        OR: [
          { ipmId: unitId },
          { ipmUnitId: unitId },
          { itemUnitConversion: { iucUnitId: unitId } },
        ],
      },
      orderBy: [{ ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
    });
    if (records.length === 0) {
      this.throwItemPriceMasterNotFound(itemId, unitId);
    }
    return records.map((record) => this.toItemPricePayload(record));
  }
  private toPayload(record: ItemStockBalance, unitFactor = 1): ItemStockBalancePayload {
    const closingQty = this.toNumber(record.isbClosingQty);
    return {
      isb_id: record.isbId,
      isb_acc_year: record.isbAccYear,
      isb_company_id: record.isbCompanyId,
      isb_branch_id: record.isbBranchId,
      isb_godown_id: record.isbGodownId,
      isb_item_id: record.isbItemId,
      isb_unit_id: record.isbUnitId,
      isb_tracking_type: record.isbTrackingType,
      isb_stock_bucket: record.isbStockBucket,
      isb_opening_qty: this.toNumber(record.isbOpeningQty),
      isb_in_qty: this.toNumber(record.isbInQty),
      isb_out_qty: this.toNumber(record.isbOutQty),
      isb_closing_qty: closingQty,
      isb_opening_free_qty: this.toNumber(record.isbOpeningFreeQty),
      isb_free_in_qty: this.toNumber(record.isbFreeInQty),
      isb_free_out_qty: this.toNumber(record.isbFreeOutQty),
      isb_free_closing_qty: this.toNumber(record.isbFreeClosingQty),
      isb_reserved_qty: this.toNumber(record.isbReservedQty),
      isb_transit_qty: this.toNumber(record.isbTransitQty),
      isb_available_qty: this.toNumber(record.isbAvailableQty),
      book_qty: this.calculateBookQty(closingQty, unitFactor),
      book_base_qty: closingQty,
      isb_opening_avg_rate: this.toNumber(record.isbOpeningAvgRate),
      isb_avg_stock_rate: this.toNumber(record.isbAvgStockRate),
      isb_opening_value: this.toNumber(record.isbOpeningValue),
      isb_stock_value: this.toNumber(record.isbStockValue),
      isb_opening_avg_rate_wot: this.toNumber(record.isbOpeningAvgRateWot),
      isb_avg_stock_rate_wot: this.toNumber(record.isbAvgStockRateWot),
      isb_opening_value_wot: this.toNumber(record.isbOpeningValueWot),
      isb_stock_value_wot: this.toNumber(record.isbStockValueWot),
      isb_last_in_date: record.isbLastInDate ? record.isbLastInDate.toISOString() : null,
      isb_last_out_date: record.isbLastOutDate ? record.isbLastOutDate.toISOString() : null,
      isb_sync_date: record.isbSyncDate ? record.isbSyncDate.toISOString() : null,
      isb_created_on: record.isbCreatedOn.toISOString(),
      isb_created_by: record.isbCreatedBy,
      isb_updated_on: record.isbUpdatedOn ? record.isbUpdatedOn.toISOString() : null,
      isb_updated_by: record.isbUpdatedBy,
    };
  }
  private toBatchOptionPayload(
    record: ItemBatchStockWithBatchMaster,
    unitFactor = 1,
  ): ItemBatchStockOptionPayload {
    const closingQty = this.toNumber(record.ibsClosingQty);
    const freeClosingQty = this.toNumber(record.ibsFreeClosingQty);
    const mfgDate = record.ibsMfgDate ?? record.batch.btmMfgDate;
    const expiryDate = record.ibsExpiryDate ?? record.batch.btmExpiryDate;
    return {
      ibs_id: record.ibsId,
      ibs_acc_year: record.ibsAccYear,
      ibs_company_id: record.ibsCompanyId,
      ibs_branch_id: record.ibsBranchId,
      ibs_godown_id: record.ibsGodownId,
      ibs_item_id: record.ibsItemId,
      ibs_unit_id: record.ibsUnitId,
      ibs_batch_id: record.ibsBatchId,
      ibs_batch_no: record.ibsBatchNo ?? record.batch.btmBatchNo ?? null,
      ibs_mfg_batch_no: record.batch.btmMfgBatchNo ?? null,
      ibs_batch_date: this.toIsoStringOrNull(record.batch.btmBatchDate),
      ibs_mfg_date: this.toIsoStringOrNull(mfgDate),
      ibs_expiry_date: this.toIsoStringOrNull(expiryDate),
      ibs_mrp: this.toNumber(record.ibsMrp),
      ibs_barcode: record.batch.btmBarcode ?? null,
      ibs_serial_no: record.ibsSerialNo ?? null,
      ibs_stock_bucket: record.ibsStockBucket,
      ibs_closing_qty: closingQty,
      ibs_free_closing_qty: freeClosingQty,
      book_qty: this.calculateBookQty(closingQty, unitFactor),
      book_base_qty: closingQty,
      book_free_qty: this.calculateBookQty(freeClosingQty, unitFactor),
      book_free_base_qty: freeClosingQty,
      ibs_avg_stock_rate: this.toNumber(record.ibsAvgStockRate),
      ibs_avg_stock_rate_wot: this.toNumber(record.ibsAvgStockRate),
    };
  }
  private toItemPricePayload(record: ItemPriceMaster): ItemPricePayload {
    return {
      ipm_id: record.ipmId,
      ipm_company_id: record.ipmCompanyId,
      ipm_branch_id: record.ipmBranchId,
      ipm_item_id: record.ipmItemId,
      ipm_unit_id: record.ipmUnitId,
      ipm_godown_id: record.ipmGodownId,
      ipm_base_unit_id: record.ipmBaseUnitId,
      ipm_to_base_factor: this.toNumber(record.ipmToBaseFactor),
      ipm_unit_slno: record.ipmUnitSlno,
      ipm_unit_factor: this.toNumber(record.ipmUnitFactor),
      ipm_is_default_unit: record.ipmIsDefaultUnit,
      ipm_is_big_unit: record.ipmIsBigUnit,
      ipm_is_base_unit: record.ipmIsBaseUnit,
      ipm_cost_price: this.toNumber(record.ipmCostPrice),
      ipm_cost_wot: this.toNumber(record.ipmCostWot),
      ipm_sales_price_a: this.toNumber(record.ipmSalesPriceA),
      ipm_sales_price_b: this.toNumber(record.ipmSalesPriceB),
      ipm_sales_price_c: this.toNumber(record.ipmSalesPriceC),
      ipm_sales_price_d: this.toNumber(record.ipmSalesPriceD),
      ipm_price_a_wot: this.toNumber(record.ipmPriceAWot),
      ipm_price_b_wot: this.toNumber(record.ipmPriceBWot),
      ipm_price_c_wot: this.toNumber(record.ipmPriceCWot),
      ipm_price_d_wot: this.toNumber(record.ipmPriceDWot),
      ipm_price_a_markup_perc: this.toNumber(record.ipmPriceAMarkupPerc),
      ipm_price_b_markup_perc: this.toNumber(record.ipmPriceBMarkupPerc),
      ipm_price_c_markup_perc: this.toNumber(record.ipmPriceCMarkupPerc),
      ipm_price_d_markup_perc: this.toNumber(record.ipmPriceDMarkupPerc),
      ipm_max_price: this.toNumber(record.ipmMaxPrice),
      ipm_min_price: this.toNumber(record.ipmMinPrice),
      ipm_disc_perc: this.toNumber(record.ipmDiscPerc),
      ipm_disc_qty: this.toNumber(record.ipmDiscQty),
      ipm_addl_cess: this.toNumber(record.ipmAddlCess),
      ipm_profit_type: record.ipmProfitType,
      ipm_round_off: this.toNumber(record.ipmRoundOff),
      ipm_loading_charge: this.toNumber(record.ipmLoadingCharge),
      ipm_freight_charge: this.toNumber(record.ipmFreightCharge),
      ipm_loyalty_points: this.toNumber(record.ipmLoyaltyPoints),
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
  private async getItemPriceUnitFactors(
    itemId: string,
    unitId: string,
  ): Promise<Map<string, number>> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: itemId,
        ipmIsDeleted: false,
        OR: [
          { ipmId: unitId },
          { ipmUnitId: unitId },
          { itemUnitConversion: { iucUnitId: unitId } },
        ],
      },
      select: {
        ipmId: true,
        ipmUnitId: true,
        ipmUnitFactor: true,
        itemUnitConversion: { select: { iucUnitId: true } },
      },
      orderBy: [{ ipmUnitSlno: 'asc' }, { ipmId: 'asc' }],
    });
    const factorsByUnitId = new Map<string, number>();
    for (const record of records) {
      const unitFactor = this.toNumber(record.ipmUnitFactor);
      if (!factorsByUnitId.has(record.ipmId)) {
        factorsByUnitId.set(record.ipmId, unitFactor);
      }
      if (!factorsByUnitId.has(record.ipmUnitId)) {
        factorsByUnitId.set(record.ipmUnitId, unitFactor);
      }
      // Stock rows are keyed by raw unit_id, so index the factor under that too.
      if (!factorsByUnitId.has(record.itemUnitConversion.iucUnitId)) {
        factorsByUnitId.set(record.itemUnitConversion.iucUnitId, unitFactor);
      }
    }
    return factorsByUnitId;
  }
  private getUnitFactorForStockUnit(
    record: ItemStockBalance,
    queryDto: GetItemStockBalanceQueryDto,
    unitFactorsByUnitId: Map<string, number>,
  ): number {
    const unitFactor =
      unitFactorsByUnitId.get(record.isbUnitId) ??
      unitFactorsByUnitId.get(queryDto.isb_unit_id);
    if (unitFactor === undefined) {
      this.throwItemPriceMasterNotFound(record.isbItemId, record.isbUnitId);
    }
    return unitFactor;
  }
  private calculateBookQty(closingQty: number, unitFactor: number): number {
    return unitFactor > 0 ? closingQty / unitFactor : 0;
  }
  private resolveBatchOptionLimit(value: string | undefined): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_BATCH_OPTION_LIMIT;
    }
    return Math.min(parsed, MAX_BATCH_OPTION_LIMIT);
  }
  private toIsoStringOrNull(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }
  private toNumber(value: Prisma.Decimal | number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  private throwItemStockBalanceNotFound(queryDto: GetItemStockBalanceQueryDto): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item stock balance not found', [
        {
          field: 'scope',
          message:
            `No item stock balance found for acc year ${queryDto.isb_acc_year}, ` +
            `company ${queryDto.isb_company_id}, branch ${queryDto.isb_branch_id}, ` +
            `godown ${queryDto.isb_godown_id}, item ${queryDto.isb_item_id}, ` +
            `unit ${queryDto.isb_unit_id}`,
        },
      ]),
    );
  }
  private throwItemPriceMasterNotFound(itemId: string, unitId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item price master not found', [
        {
          field: 'ipm_item_id',
          message: `No item price master found for item ${itemId} and unit ${unitId}`,
        },
      ]),
    );
  }
  private buildErrorResponse(
    message: string,
    errors: ItemStockBalanceErrorDetail[] = [],
  ): ItemStockBalanceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}
