"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemStockBalanceService = void 0;
const common_1 = require("@nestjs/common");
const loose_search_1 = require("../../../common/search/loose-search");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const DEFAULT_BATCH_OPTION_LIMIT = 50;
const MAX_BATCH_OPTION_LIMIT = 100;
let ItemStockBalanceService = class ItemStockBalanceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getByScope(queryDto) {
        const unitFactorsByUnitId = await this.getItemPriceUnitFactors(queryDto.isb_item_id, queryDto.isb_unit_id);
        const holdings = await this.holdings({
            accYear: queryDto.isb_acc_year,
            companyId: queryDto.isb_company_id,
            branchId: queryDto.isb_branch_id,
            godownId: queryDto.isb_godown_id,
            itemId: queryDto.isb_item_id,
            bucket: queryDto.isb_stock_bucket ?? null,
        });
        if (holdings.length === 0) {
            this.throwItemStockBalanceNotFound(queryDto);
        }
        if (unitFactorsByUnitId.size === 0) {
            this.throwItemPriceMasterNotFound(queryDto.isb_item_id, queryDto.isb_unit_id);
        }
        const unitFactor = this.getUnitFactorForStockUnit(queryDto, unitFactorsByUnitId);
        const byBucket = new Map();
        for (const row of holdings) {
            byBucket.set(row.sbl_bucket, [...(byBucket.get(row.sbl_bucket) ?? []), row]);
        }
        return [...byBucket.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([bucket, rows]) => this.toPayload(queryDto, bucket, rows, unitFactor));
    }
    async getBulkList(queryDto) {
        const limit = Math.min(parseInt(queryDto.limit ?? '500', 10) || 500, 2000);
        const hasItemFilter = queryDto.item_group_id ||
            queryDto.item_brand_id ||
            queryDto.item_section_id ||
            queryDto.item_category_id;
        let filteredItemIds = null;
        if (hasItemFilter) {
            const itemFilterWhere = { itemIsDeleted: false };
            if (queryDto.item_group_id)
                itemFilterWhere.itemGroupId = queryDto.item_group_id;
            if (queryDto.item_brand_id)
                itemFilterWhere.itemBrandId = queryDto.item_brand_id;
            if (queryDto.item_section_id)
                itemFilterWhere.itemSectionId = queryDto.item_section_id;
            if (queryDto.item_category_id)
                itemFilterWhere.itemCategoryId = queryDto.item_category_id;
            const matchedItems = await this.prisma.itemMaster.findMany({
                where: itemFilterWhere,
                select: { itemId: true },
            });
            if (matchedItems.length === 0)
                return [];
            filteredItemIds = matchedItems.map((i) => i.itemId);
        }
        const stockType = queryDto.stock_type ?? 'ALL';
        const rows = await this.prisma.$queryRaw `
      SELECT b.sbl_item_id, b.sbl_godown_id,
             MAX(iuc.iuc_unit_id::text)::uuid                                       AS base_unit_id,
             MAX(b.sbl_base_uom_id::text)::uuid                                     AS base_iuc_id,
             SUM(b.sbl_on_hand_qty)                                                  AS closing_qty,
             SUM(b.sbl_free_in_qty - b.sbl_free_out_qty)                             AS free_closing_qty,
             -- Notes 92: every lot of a tracked item carries its OWN rate, so the
             -- item's figure is Σ value ÷ Σ quantity over its holdings, not one
             -- lot's rate. With nothing on hand, the highest rate still on the
             -- rows — a sold-out item still knows what it cost.
             CASE WHEN SUM(b.sbl_on_hand_qty) > 0
                  THEN ROUND(SUM(b.sbl_stock_value)     / SUM(b.sbl_on_hand_qty), 6)
                  ELSE MAX(b.sbl_avg_cost_rate) END                                    AS avg_cost_rate,
             CASE WHEN SUM(b.sbl_on_hand_qty) > 0
                  THEN ROUND(SUM(b.sbl_stock_value_wot) / SUM(b.sbl_on_hand_qty), 6)
                  ELSE MAX(b.sbl_avg_cost_rate_wot) END                                AS avg_cost_rate_wot,
             MAX(NULLIF(slt.slt_track_signature, 'N'))                               AS tracking
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbl_base_uom_id
       WHERE b.sbl_company_id = ${queryDto.isb_company_id}::uuid
         AND b.sbl_branch_id  = ${queryDto.isb_branch_id}::uuid
         AND b.sbl_is_deleted = false
         AND (${filteredItemIds}::uuid[] IS NULL OR b.sbl_item_id = ANY(${filteredItemIds}::uuid[]))
         AND (${queryDto.isb_godown_id ?? null}::uuid IS NULL OR b.sbl_godown_id = ${queryDto.isb_godown_id ?? null}::uuid)
         AND (${queryDto.isb_stock_bucket ?? null}::text IS NULL OR b.sbl_bucket = ${queryDto.isb_stock_bucket ?? null}::text)
       GROUP BY b.sbl_item_id, b.sbl_godown_id
      HAVING CASE ${stockType}::text
               WHEN 'ZERO'     THEN SUM(b.sbl_on_hand_qty) = 0
               WHEN 'NEGATIVE' THEN SUM(b.sbl_on_hand_qty) < 0
               ELSE true END
       ORDER BY b.sbl_item_id, b.sbl_godown_id
       LIMIT ${limit}
    `;
        if (rows.length === 0)
            return [];
        const allItemIds = [...new Set(rows.map((s) => s.sbl_item_id))];
        const allUnitIds = [
            ...new Set(rows.map((s) => s.base_unit_id).filter((u) => !!u)),
        ];
        const allGodownIds = [...new Set(rows.map((s) => s.sbl_godown_id))];
        const [items, units, godowns, priceMasters] = await Promise.all([
            this.prisma.itemMaster.findMany({
                where: { itemId: { in: allItemIds }, itemIsDeleted: false },
                select: {
                    itemId: true,
                    itemNameEn: true,
                    itemCode: true,
                    itemDefaultBarcode: true,
                    itemBaseUnitId: true,
                },
            }),
            allUnitIds.length
                ? this.prisma.unit.findMany({
                    where: { unit_id: { in: allUnitIds } },
                    select: { unit_id: true, unit_name: true },
                })
                : Promise.resolve([]),
            this.prisma.godownLocation.findMany({
                where: { gdlId: { in: allGodownIds } },
                select: { gdlId: true, gdlName: true },
            }),
            this.prisma.itemPriceMaster.findMany({
                where: {
                    ipmItemId: { in: allItemIds },
                    ipmIsDeleted: false,
                    ipmBucketMrp: null,
                    ipmBucketSp: null,
                },
                select: {
                    ipmItemId: true,
                    ipmId: true,
                    ipmUcUnitId: true,
                    ipmGodownId: true,
                    ipmCostPrice: true,
                    ipmCostWot: true,
                    ipmMaxPrice: true,
                    itemUnitConversion: {
                        select: {
                            iucUnitId: true,
                            iucBaseUnitId: true,
                            iucToBaseFactor: true,
                            iucUnitFactor: true,
                        },
                    },
                },
            }),
        ]);
        if (items.length === 0)
            return [];
        const itemsById = new Map(items.map((i) => [i.itemId, i]));
        const unitsById = new Map(units.map((u) => [u.unit_id, u.unit_name]));
        const godownsById = new Map(godowns.map((g) => [g.gdlId, g.gdlName]));
        const priceByItemUnitGodown = new Map();
        const priceByItemUnit = new Map();
        for (const pm of priceMasters) {
            const unitId = pm.itemUnitConversion.iucUnitId;
            const godownKey = `${pm.ipmItemId}:${unitId}:${pm.ipmGodownId}`;
            if (!priceByItemUnitGodown.has(godownKey))
                priceByItemUnitGodown.set(godownKey, pm);
            const fallbackKey = `${pm.ipmItemId}:${unitId}`;
            if (!priceByItemUnit.has(fallbackKey))
                priceByItemUnit.set(fallbackKey, pm);
        }
        return rows
            .filter((s) => itemsById.has(s.sbl_item_id))
            .map((balance) => {
            const item = itemsById.get(balance.sbl_item_id);
            const unitId = balance.base_unit_id ?? item.itemBaseUnitId ?? '';
            const price = priceByItemUnitGodown.get(`${balance.sbl_item_id}:${unitId}:${balance.sbl_godown_id}`) ??
                priceByItemUnit.get(`${balance.sbl_item_id}:${unitId}`) ??
                null;
            const toBaseFactor = 1;
            const closingQty = this.toNumber(balance.closing_qty);
            const freeClosingQty = this.toNumber(balance.free_closing_qty);
            return {
                isb_item_id: balance.sbl_item_id,
                item_name: item.itemNameEn,
                item_code: item.itemCode ?? null,
                item_default_barcode: item.itemDefaultBarcode ?? null,
                isb_unit_id: unitId,
                unit_name: unitsById.get(unitId) ?? '',
                isb_base_unit_id: unitId || null,
                isb_price_master_id: price?.ipmId ?? null,
                isb_godown_id: balance.sbl_godown_id,
                godown_name: godownsById.get(balance.sbl_godown_id) ?? null,
                isb_to_base_factor: toBaseFactor,
                book_qty: closingQty,
                book_base_qty: closingQty,
                book_free_qty: freeClosingQty,
                book_free_base_qty: freeClosingQty,
                avg_stock_rate: this.toNumber(balance.avg_cost_rate),
                avg_stock_rate_wot: this.toNumber(balance.avg_cost_rate_wot),
                mrp: this.toNumber(price?.ipmMaxPrice ?? 0),
                cost_price: this.toNumber(price?.ipmCostPrice ?? 0),
                cost_wot: this.toNumber(price?.ipmCostWot ?? 0),
                tracking_type: balance.tracking ? 'LOT' : 'NONE',
            };
        });
    }
    async getBatchOptionsByScope(queryDto) {
        const unitFactorsByUnitId = await this.getItemPriceUnitFactors(queryDto.ibs_item_id, queryDto.ibs_unit_id);
        const unitFactor = unitFactorsByUnitId.get(queryDto.ibs_unit_id) ?? 1;
        const search = queryDto.search?.trim() || null;
        const holdings = await this.holdings({
            accYear: queryDto.ibs_acc_year,
            companyId: queryDto.ibs_company_id,
            branchId: queryDto.ibs_branch_id,
            godownId: queryDto.ibs_godown_id,
            itemId: queryDto.ibs_item_id,
            bucket: queryDto.ibs_stock_bucket ?? null,
            search,
            onHandOnly: true,
            limit: this.resolveBatchOptionLimit(queryDto.limit),
        });
        return holdings.map((row) => this.toBatchOptionPayload(queryDto.ibs_unit_id, row, unitFactor));
    }
    async getPriceMasterByItemAndUnit(itemId, unitId) {
        const records = await this.prisma.itemPriceMaster.findMany({
            where: {
                ipmItemId: itemId,
                ipmIsDeleted: false,
                OR: [
                    { ipmId: unitId },
                    { ipmUcUnitId: unitId },
                    { itemUnitConversion: { iucUnitId: unitId } },
                ],
            },
            include: { itemUnitConversion: true },
            orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
        });
        if (records.length === 0) {
            this.throwItemPriceMasterNotFound(itemId, unitId);
        }
        return records.map((record) => this.toItemPricePayload(record));
    }
    async holdings(scope) {
        return this.prisma.$queryRaw `
      SELECT b.sbl_id, b.sbl_company_id, b.sbl_branch_id, b.sbl_godown_id, b.sbl_item_id, b.sbl_lot_id,
             b.sbl_base_uom_id, iuc.iuc_unit_id AS base_unit_id, b.sbl_bucket,
             b.sbl_in_qty, b.sbl_out_qty, b.sbl_free_in_qty, b.sbl_free_out_qty,
             b.sbl_on_hand_qty, b.sbl_reserved_qty, b.sbl_transit_in_qty, b.sbl_available_qty,
             b.sbl_avg_cost_rate, b.sbl_avg_cost_rate_wot, b.sbl_stock_value, b.sbl_stock_value_wot,
             b.sbl_last_in_date, b.sbl_last_out_date, b.sbl_sync_date,
             b.sbl_created_on, b.sbl_created_by, b.sbl_modified_on, b.sbl_modified_by,
             slt.slt_batch_no, slt.slt_mfg_date, slt.slt_expiry_date, slt.slt_mrp, slt.slt_serial_no,
             slt.slt_track_signature, slt.slt_first_inward_date,
             op.qty AS opening_qty, op.free_qty AS opening_free_qty,
             op.value AS opening_value, op.value_wot AS opening_value_wot
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbl_base_uom_id
        LEFT JOIN LATERAL (
          SELECT SUM(sml.sml_base_qty) AS qty, SUM(sml.sml_free_base_qty) AS free_qty,
                 SUM(sml.sml_cost_value) AS value, SUM(sml.sml_cost_value_wot) AS value_wot
            FROM stock.stock_ledger sml
           WHERE sml.sml_company_id = b.sbl_company_id AND sml.sml_branch_id = b.sbl_branch_id
             AND sml.sml_godown_id  = b.sbl_godown_id  AND sml.sml_item_id   = b.sbl_item_id
             AND sml.sml_lot_id     = b.sbl_lot_id     AND sml.sml_bucket    = b.sbl_bucket
             AND sml.sml_acc_year   = ${scope.accYear}::bpchar
             AND sml.sml_txn_type   = 'OPENING'
             AND sml.sml_is_deleted = false AND sml.sml_is_reversal = false
             AND NOT EXISTS (SELECT 1 FROM stock.stock_ledger rev
                              WHERE rev.sml_reverses_id = sml.sml_id AND rev.sml_acc_year = sml.sml_acc_year
                                AND rev.sml_is_reversal = true AND rev.sml_is_deleted = false)
        ) op ON true
       WHERE b.sbl_company_id = ${scope.companyId}::uuid
         AND b.sbl_branch_id  = ${scope.branchId}::uuid
         AND b.sbl_godown_id  = ${scope.godownId}::uuid
         AND b.sbl_item_id    = ${scope.itemId}::uuid
         AND b.sbl_is_deleted = false
         AND (${scope.bucket}::text IS NULL OR b.sbl_bucket = ${scope.bucket}::text)
         AND ${(0, loose_search_1.looseSearchSql)(['slt.slt_batch_no', 'slt.slt_serial_no'], scope.search)}
         AND (NOT ${scope.onHandOnly ?? false}::boolean OR b.sbl_on_hand_qty > 0)
       ORDER BY b.sbl_bucket, slt.slt_expiry_date NULLS LAST, slt.slt_batch_no, b.sbl_id
       LIMIT ${scope.limit ?? 10000}
    `;
    }
    toPayload(query, bucket, rows, unitFactor) {
        const sum = (pick) => rows.reduce((s, r) => s + this.toNumber(pick(r) ?? 0), 0);
        const first = rows[0];
        const closingQty = sum((r) => r.sbl_on_hand_qty);
        const openingQty = sum((r) => r.opening_qty);
        const openingValue = sum((r) => r.opening_value);
        const openingValueWot = sum((r) => r.opening_value_wot);
        const latest = (pick) => rows.reduce((acc, r) => {
            const d = pick(r);
            return d && (!acc || d > acc) ? d : acc;
        }, null);
        const tracked = rows.some((r) => r.slt_track_signature && r.slt_track_signature !== 'N');
        return {
            isb_id: rows.map((r) => r.sbl_id).sort()[0],
            isb_acc_year: query.isb_acc_year,
            isb_company_id: first.sbl_company_id,
            isb_branch_id: first.sbl_branch_id,
            isb_godown_id: first.sbl_godown_id,
            isb_item_id: first.sbl_item_id,
            isb_unit_id: query.isb_unit_id,
            isb_tracking_type: tracked ? 'LOT' : 'NONE',
            isb_stock_bucket: bucket,
            isb_opening_qty: openingQty,
            isb_in_qty: sum((r) => r.sbl_in_qty),
            isb_out_qty: sum((r) => r.sbl_out_qty),
            isb_closing_qty: closingQty,
            isb_opening_free_qty: sum((r) => r.opening_free_qty),
            isb_free_in_qty: sum((r) => r.sbl_free_in_qty),
            isb_free_out_qty: sum((r) => r.sbl_free_out_qty),
            isb_free_closing_qty: sum((r) => r.sbl_free_in_qty) - sum((r) => r.sbl_free_out_qty),
            isb_reserved_qty: sum((r) => r.sbl_reserved_qty),
            isb_transit_qty: sum((r) => r.sbl_transit_in_qty),
            isb_available_qty: sum((r) => r.sbl_available_qty),
            book_qty: this.calculateBookQty(closingQty, unitFactor),
            book_base_qty: closingQty,
            isb_opening_avg_rate: openingQty > 0 ? openingValue / openingQty : 0,
            isb_avg_stock_rate: closingQty > 0
                ? sum((r) => r.sbl_stock_value) / closingQty
                : this.toNumber(first.sbl_avg_cost_rate),
            isb_opening_value: openingValue,
            isb_stock_value: sum((r) => r.sbl_stock_value),
            isb_opening_avg_rate_wot: openingQty > 0 ? openingValueWot / openingQty : 0,
            isb_avg_stock_rate_wot: closingQty > 0
                ? sum((r) => r.sbl_stock_value_wot) / closingQty
                : this.toNumber(first.sbl_avg_cost_rate_wot),
            isb_opening_value_wot: openingValueWot,
            isb_stock_value_wot: sum((r) => r.sbl_stock_value_wot),
            isb_last_in_date: this.toIsoStringOrNull(latest((r) => r.sbl_last_in_date)),
            isb_last_out_date: this.toIsoStringOrNull(latest((r) => r.sbl_last_out_date)),
            isb_sync_date: this.toIsoStringOrNull(latest((r) => r.sbl_sync_date)),
            isb_created_on: rows
                .map((r) => r.sbl_created_on)
                .sort((a, b) => a.getTime() - b.getTime())[0]
                .toISOString(),
            isb_created_by: first.sbl_created_by,
            isb_updated_on: this.toIsoStringOrNull(latest((r) => r.sbl_modified_on)),
            isb_updated_by: first.sbl_modified_by,
        };
    }
    toBatchOptionPayload(unitId, row, unitFactor) {
        const closingQty = this.toNumber(row.sbl_on_hand_qty ?? 0);
        const freeClosingQty = this.toNumber(row.sbl_free_in_qty) - this.toNumber(row.sbl_free_out_qty);
        return {
            ibs_id: row.sbl_id,
            ibs_acc_year: '',
            ibs_company_id: row.sbl_company_id,
            ibs_branch_id: row.sbl_branch_id,
            ibs_godown_id: row.sbl_godown_id,
            ibs_item_id: row.sbl_item_id,
            ibs_unit_id: unitId,
            ibs_batch_id: row.sbl_lot_id,
            ibs_batch_no: row.slt_batch_no,
            ibs_mfg_batch_no: null,
            ibs_batch_date: this.toIsoStringOrNull(row.slt_first_inward_date),
            ibs_mfg_date: this.toIsoStringOrNull(row.slt_mfg_date),
            ibs_expiry_date: this.toIsoStringOrNull(row.slt_expiry_date),
            ibs_mrp: this.toNumber(row.slt_mrp ?? 0),
            ibs_barcode: null,
            ibs_serial_no: row.slt_serial_no,
            ibs_stock_bucket: row.sbl_bucket,
            ibs_closing_qty: closingQty,
            ibs_free_closing_qty: freeClosingQty,
            book_qty: this.calculateBookQty(closingQty, unitFactor),
            book_base_qty: closingQty,
            book_free_qty: this.calculateBookQty(freeClosingQty, unitFactor),
            book_free_base_qty: freeClosingQty,
            ibs_avg_stock_rate: this.toNumber(row.sbl_avg_cost_rate),
            ibs_avg_stock_rate_wot: this.toNumber(row.sbl_avg_cost_rate_wot),
        };
    }
    toItemPricePayload(record) {
        return {
            ipm_id: record.ipmId,
            ipm_company_id: record.ipmCompanyId,
            ipm_branch_id: record.ipmBranchId,
            ipm_item_id: record.ipmItemId,
            ipm_uc_unit_id: record.ipmUcUnitId,
            ipm_godown_id: record.ipmGodownId,
            ipm_sl_no: record.ipmSlNo,
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
            ipm_bucket_mrp: record.ipmBucketMrp === null ? null : this.toNumber(record.ipmBucketMrp),
            ipm_bucket_sp: record.ipmBucketSp === null ? null : this.toNumber(record.ipmBucketSp),
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
    async getItemPriceUnitFactors(itemId, unitId) {
        const records = await this.prisma.itemPriceMaster.findMany({
            where: {
                ipmItemId: itemId,
                ipmIsDeleted: false,
                OR: [
                    { ipmId: unitId },
                    { ipmUcUnitId: unitId },
                    { itemUnitConversion: { iucUnitId: unitId } },
                ],
            },
            select: {
                ipmId: true,
                ipmUcUnitId: true,
                itemUnitConversion: { select: { iucUnitId: true, iucUnitFactor: true } },
            },
            orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
        });
        const factorsByUnitId = new Map();
        for (const record of records) {
            const unitFactor = this.toNumber(record.itemUnitConversion.iucUnitFactor);
            if (!factorsByUnitId.has(record.ipmId)) {
                factorsByUnitId.set(record.ipmId, unitFactor);
            }
            if (!factorsByUnitId.has(record.ipmUcUnitId)) {
                factorsByUnitId.set(record.ipmUcUnitId, unitFactor);
            }
            if (!factorsByUnitId.has(record.itemUnitConversion.iucUnitId)) {
                factorsByUnitId.set(record.itemUnitConversion.iucUnitId, unitFactor);
            }
        }
        return factorsByUnitId;
    }
    getUnitFactorForStockUnit(queryDto, unitFactorsByUnitId) {
        const unitFactor = unitFactorsByUnitId.get(queryDto.isb_unit_id);
        if (unitFactor === undefined) {
            this.throwItemPriceMasterNotFound(queryDto.isb_item_id, queryDto.isb_unit_id);
        }
        return unitFactor;
    }
    calculateBookQty(closingQty, unitFactor) {
        return unitFactor > 0 ? closingQty / unitFactor : 0;
    }
    resolveBatchOptionLimit(value) {
        const parsed = Number.parseInt(value ?? '', 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return DEFAULT_BATCH_OPTION_LIMIT;
        }
        return Math.min(parsed, MAX_BATCH_OPTION_LIMIT);
    }
    toIsoStringOrNull(value) {
        return value ? value.toISOString() : null;
    }
    toNumber(value) {
        const parsed = Number(value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    throwItemStockBalanceNotFound(queryDto) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Item stock balance not found', [
            {
                field: 'scope',
                message: `No item stock balance found for acc year ${queryDto.isb_acc_year}, ` +
                    `company ${queryDto.isb_company_id}, branch ${queryDto.isb_branch_id}, ` +
                    `godown ${queryDto.isb_godown_id}, item ${queryDto.isb_item_id}, ` +
                    `unit ${queryDto.isb_unit_id}`,
            },
        ]));
    }
    throwItemPriceMasterNotFound(itemId, unitId) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Item price master not found', [
            {
                field: 'ipm_item_id',
                message: `No item price master found for item ${itemId} and unit ${unitId}`,
            },
        ]));
    }
    buildErrorResponse(message, errors = []) {
        return {
            success: false,
            message,
            errors,
        };
    }
};
exports.ItemStockBalanceService = ItemStockBalanceService;
exports.ItemStockBalanceService = ItemStockBalanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemStockBalanceService);
//# sourceMappingURL=itemstockBalanceService.js.map