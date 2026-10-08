"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceLookup = void 0;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const master_lookup_constants_1 = require("../master-lookup.constants");
const item_price_utils_1 = require("../utils/item-price.utils");
const price_resolver_1 = require("../../Inventory/items-price-master/price-resolver");
const price_bucket_service_1 = require("../../Inventory/items-price-master/price-bucket.service");
const stock_voucher_posting_helper_1 = require("../../stocks/stock-voucher/stock-voucher-posting.helper");
const loading_charge_utils_1 = require("../utils/loading-charge.utils");
const sale_line_godown_utils_1 = require("../../../common/utils/sale-line-godown.utils");
const TAX_LEDGER_ROLES = {
    sales_ledger_id: 'SALES',
    sgst_output_ledger_id: 'OUTPUT_SGST',
    cgst_output_ledger_id: 'OUTPUT_CGST',
    igst_output_ledger_id: 'OUTPUT_IGST',
    cess_output_ledger_id: 'OUTPUT_CESS',
};
class ItemPriceLookup {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async refreshItemPriceLookup(query) {
        return {
            item_id: query.item_id,
            iuc_id: await this.resolveNextIucId(query.item_id, query.iuc_id),
        };
    }
    async resolveNextIucId(itemId, iucId) {
        const rows = await this.prisma.itemUnitConversion.findMany({
            where: { iucItemId: itemId, iucIsDeleted: false },
            orderBy: [{ iucUnitSlno: 'asc' }, { iucId: 'asc' }],
            select: { iucId: true, iucUnitId: true },
        });
        return (0, item_price_utils_1.nextIucIdInCycle)(rows, iucId);
    }
    async resolveLoadingCharge(query, rate) {
        const loadingType = query.loading_type ?? master_lookup_constants_1.DEFAULT_LOADING_TYPE;
        if (loadingType === 'manual') {
            return {
                loading_charge: null,
                resolved_weight: null,
            };
        }
        if (loadingType === 'item_basis') {
            const charge = (0, module_service_utils_1.toNumber)(rate.ipmLoadingCharge);
            return {
                loading_charge: charge > 0 ? charge : null,
                resolved_weight: null,
            };
        }
        const { company_id, branch_id } = query;
        if (!company_id || !branch_id) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                {
                    field: company_id ? 'branch_id' : 'company_id',
                    message: "loading_type 'auto' requires both company_id and branch_id",
                },
            ]);
        }
        const weight = (0, loading_charge_utils_1.resolveLoadingWeight)(rate.itemUnitConversion.iucUomWeight);
        if (weight === null) {
            (0, module_service_utils_1.throwMasterBadRequest)('Validation failed', [
                {
                    field: 'item_id',
                    message: `loading_type 'auto' needs a weight: the item's unit conversion carries no UOM weight to match a slab on`,
                },
            ]);
        }
        const slabs = await this.prisma.saleLoadingCharge.findMany({
            where: {
                ilcIsDeleted: false,
                ilcIsActive: true,
                ilcFromWeight: { lte: weight },
                ilcToWeight: { gt: weight },
                AND: [
                    { OR: [{ ilcCompId: company_id }, { ilcCompId: null }] },
                    { OR: [{ ilcBranchId: branch_id }, { ilcBranchId: null }] },
                ],
            },
            select: { ilcId: true, ilcCompId: true, ilcBranchId: true, ilcLoadChrg: true },
            orderBy: { ilcId: 'asc' },
        });
        const slab = (0, loading_charge_utils_1.selectLoadingSlab)(slabs, company_id, branch_id);
        const resolvedWeight = (0, module_service_utils_1.toNumber)(weight);
        if (!slab) {
            return {
                loading_charge: null,
                resolved_weight: resolvedWeight,
            };
        }
        return {
            loading_charge: (0, module_service_utils_1.toNullableNumber)(slab.ilcLoadChrg),
            resolved_weight: resolvedWeight,
        };
    }
    resolveFreightCharge(query, rate) {
        if ((query.freight_type ?? master_lookup_constants_1.DEFAULT_FREIGHT_TYPE) === 'manual') {
            return null;
        }
        const charge = (0, module_service_utils_1.toNumber)(rate.ipmFreightCharge);
        return charge > 0 ? charge : null;
    }
    async resolveTaxLedgers(taxId, query) {
        const requests = Object.values(TAX_LEDGER_ROLES).map((role) => ({ role, taxId }));
        const resolved = await (0, ledger_map_helper_1.resolveRoleLedgers)(this.prisma, requests, {
            companyId: query.company_id ?? null,
            branchId: query.branch_id ?? null,
            where: 'item_price_lookup',
        });
        const entries = Object.entries(TAX_LEDGER_ROLES).map(([field, role]) => [
            field,
            resolved.get((0, ledger_map_helper_1.roleLedgerKey)({ role, taxId }))?.ledgerId ?? null,
        ]);
        return Object.fromEntries(entries);
    }
    async lineBucketValues(query) {
        if (!query.lot_id) {
            return { mrp: query.mrp ?? null, salePrice: query.sale_price ?? null };
        }
        const lot = await this.prisma.stockLot.findFirst({
            where: { sltId: query.lot_id, sltItemId: query.item_id },
            select: { sltMrp: true, sltSalePrice: true },
        });
        if (!lot) {
            (0, module_service_utils_1.throwMasterNotFound)('Lot not found', 'lot_id', `No lot ${query.lot_id} found for item ${query.item_id}`);
        }
        return { mrp: (0, module_service_utils_1.toNullableNumber)(lot.sltMrp), salePrice: (0, module_service_utils_1.toNullableNumber)(lot.sltSalePrice) };
    }
    pricedBuckets(unitRows, docDate, caller) {
        const keys = [];
        for (const row of (0, price_resolver_1.livePriceRows)(unitRows, docDate, caller)) {
            const key = (0, price_resolver_1.bucketKeyOfRow)(row);
            if (!(0, price_resolver_1.isHeadlineKey)(key) && !keys.some((known) => (0, price_resolver_1.sameBucket)(known, key))) {
                keys.push(key);
            }
        }
        return keys
            .map((key) => {
            const answer = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, docDate, caller);
            return { key, row: answer.row, answer };
        })
            .sort((a, b) => (b.key.mrp ?? -1) - (a.key.mrp ?? -1) ||
            (b.key.salePrice ?? -1) - (a.key.salePrice ?? -1));
    }
    provisionalBucket(unitRows, key, docDate, caller) {
        if (!(0, price_resolver_1.isHeadlineKey)(key)) {
            return null;
        }
        return this.pricedBuckets(unitRows, docDate, caller)[0]?.answer ?? null;
    }
    async resolveStockBuckets(query, policy, unitRows, docDate, caller) {
        const company = query.company_id ?? null;
        const branch = query.branch_id ?? null;
        const holdings = await this.prisma.$queryRaw `
      SELECT b.sbl_mrp AS "mrp", b.sbl_sale_price AS "salePrice",
             SUM(b.sbl_available_qty) AS "qty"
        FROM stock.stock_balance b
       WHERE b.sbl_item_id = ${query.item_id}::uuid
         AND b.sbl_is_deleted = false
         AND b.sbl_bucket = 'SALEABLE'
         AND (${company}::uuid IS NULL OR b.sbl_company_id = ${company}::uuid)
         AND (${branch}::uuid IS NULL OR b.sbl_branch_id = ${branch}::uuid)
       GROUP BY b.sbl_mrp, b.sbl_sale_price
      HAVING SUM(b.sbl_available_qty) > 0
       ORDER BY b.sbl_mrp DESC NULLS LAST, b.sbl_sale_price DESC NULLS LAST`;
        const merged = [];
        for (const holding of holdings) {
            const key = (0, stock_voucher_posting_helper_1.bucketKeyFor)(policy, {
                mrp: (0, module_service_utils_1.toNullableNumber)(holding.mrp),
                salePrice: (0, module_service_utils_1.toNullableNumber)(holding.salePrice),
            });
            const qty = (0, module_service_utils_1.toNumber)(holding.qty ?? 0);
            const same = merged.find((entry) => (0, price_resolver_1.sameBucket)(entry.key, key));
            if (same) {
                same.qty += qty;
            }
            else {
                merged.push({ key, qty });
            }
        }
        if (!merged.length) {
            merged.push(...this.pricedBuckets(unitRows, docDate, caller).map(({ key }) => ({ key, qty: 0 })));
        }
        return merged.map(({ key, qty }) => {
            const answer = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, docDate, caller);
            const row = answer?.row;
            return {
                mrp: key.mrp,
                sale_price: key.salePrice,
                available_qty: qty,
                price_source: answer?.source ?? null,
                price_scope: answer?.scope ?? null,
                price_row_id: row?.ipmId ?? null,
                sales_price: row ? (0, item_price_utils_1.priceForLevel)(row, query.price_level) : 0,
                sales_price_a: row ? (0, module_service_utils_1.toNumber)(row.ipmSalesPriceA) : 0,
                sales_price_b: row ? (0, module_service_utils_1.toNumber)(row.ipmSalesPriceB) : 0,
                sales_price_c: row ? (0, module_service_utils_1.toNumber)(row.ipmSalesPriceC) : 0,
                sales_price_d: row ? (0, module_service_utils_1.toNumber)(row.ipmSalesPriceD) : 0,
                max_price: row ? (0, module_service_utils_1.toNumber)(row.ipmMaxPrice) : (key.mrp ?? 0),
                min_price: row ? (0, module_service_utils_1.toNumber)(row.ipmMinPrice) : 0,
            };
        });
    }
    async getItemPriceLookup(query) {
        const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
        const priceLevel = query.price_level;
        const regional = query.regional ?? false;
        const docDate = query.doc_date?.slice(0, 10) ?? (0, price_bucket_service_1.todayIso)();
        const [itemRecord, priceRows] = await Promise.all([
            this.prisma.itemMaster.findFirst({
                where: {
                    itemId: item_id,
                    ...(branch_id ? { OR: [{ itemBranchId: branch_id }, { itemBranchId: null }] } : {}),
                    itemIsDeleted: false,
                },
            }),
            this.prisma.itemPriceMaster.findMany({
                where: {
                    ipmItemId: item_id,
                    AND: [
                        ...(branch_id ? [{ OR: [{ ipmBranchId: branch_id }, { ipmBranchId: null }] }] : []),
                        ...(company_id ? [{ OR: [{ ipmCompanyId: company_id }, { ipmCompanyId: null }] }] : []),
                    ],
                    ipmIsDeleted: false,
                },
                include: { itemUnitConversion: { include: { unit: true } } },
                orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
            }),
        ]);
        if (!itemRecord) {
            (0, module_service_utils_1.throwMasterNotFound)('Item not found', 'item_id', `No active item found for id ${item_id}`);
        }
        const caller = { companyId: company_id ?? null, branchId: branch_id ?? null };
        const liveRows = (0, price_resolver_1.livePriceRows)(priceRows, docDate, caller);
        const unitPick = (0, item_price_utils_1.selectUnitRate)(liveRows, itemRecord.itemRetailItem, unit_id);
        if (!unitPick) {
            (0, module_service_utils_1.throwMasterNotFound)('Item price not found', unit_id ? 'unit_id' : 'item_id', unit_id
                ? `No active price row found for item ${item_id} and unit ${unit_id}`
                : `No active price row configured for item ${item_id}`);
        }
        const unitRows = liveRows.filter((row) => row.ipmUcUnitId === unitPick.ipmUcUnitId);
        const [policy] = await (0, stock_voucher_posting_helper_1.readBucketTrackFlags)(this.prisma, [
            {
                itemId: item_id,
                companyId: company_id ?? itemRecord.itemCompanyId,
                branchId: branch_id ?? itemRecord.itemBranchId,
            },
        ], docDate);
        const key = (0, stock_voucher_posting_helper_1.bucketKeyFor)(policy, await this.lineBucketValues(query));
        const resolved = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, docDate, caller) ??
            this.provisionalBucket(unitRows, key, docDate, caller);
        if (!resolved) {
            const priced = this.pricedBuckets(unitRows, docDate, caller).map(({ key: k }) => k.mrp !== null ? `MRP ${k.mrp}` : `sale price ${k.salePrice}`);
            (0, module_service_utils_1.throwMasterNotFound)('Item price not found', key.mrp !== null
                ? 'mrp'
                : key.salePrice !== null
                    ? 'sale_price'
                    : unit_id
                        ? 'unit_id'
                        : 'item_id', `No active price row for item ${item_id} at ${key.mrp !== null
                ? `MRP ${key.mrp}`
                : key.salePrice !== null
                    ? `sale price ${key.salePrice}`
                    : 'this unit'}, and no headline row to fall back to` +
                (priced.length ? `. Priced: ${priced.join(', ')}.` : '.'));
        }
        const rate = resolved.row;
        const headline = (0, price_resolver_1.resolveEffectivePrice)(unitRows, price_resolver_1.HEADLINE_KEY, docDate, caller);
        const godownId = query.godown_id ??
            rate.ipmGodownId ??
            (branch_id ? await (0, sale_line_godown_utils_1.branchDefaultGodownId)(this.prisma, branch_id) : null);
        const unit = rate.itemUnitConversion.unit;
        const rateUnitId = rate.itemUnitConversion.iucUnitId;
        const [godown, tax, company, custRate, reorder, stockSum, loading] = await Promise.all([
            godownId
                ? this.prisma.godownLocation.findFirst({ where: { gdlId: godownId } })
                : Promise.resolve(null),
            itemRecord.itemDefaultTaxId
                ? this.prisma.taxRateMaster.findFirst({
                    where: { taxId: itemRecord.itemDefaultTaxId, taxIsDeleted: false },
                })
                : Promise.resolve(null),
            company_id
                ? this.prisma.company.findFirst({ where: { compId: company_id } })
                : Promise.resolve(null),
            customer_id && headline
                ? this.prisma.custItemRate.findFirst({
                    where: {
                        csrUnitRateId: headline.row.ipmId,
                        csrCustomerId: customer_id,
                        csrIsDeleted: false,
                        csrIsActive: true,
                    },
                })
                : Promise.resolve(null),
            this.prisma.itemReorder.findFirst({
                where: { irItemId: item_id, irUcUnitId: rate.ipmUcUnitId, irIsDeleted: false },
            }),
            acccyear
                ? this.prisma.$queryRaw `
            SELECT SUM(b.sbl_on_hand_qty) AS qty
              FROM stock.stock_balance b
             WHERE b.sbl_item_id = ${item_id}::uuid
               AND b.sbl_is_deleted = false
               AND (${company_id ?? null}::uuid IS NULL OR b.sbl_company_id = ${company_id ?? null}::uuid)
               AND (${branch_id ?? null}::uuid IS NULL OR b.sbl_branch_id = ${branch_id ?? null}::uuid)
               AND (${godownId ?? null}::uuid IS NULL OR b.sbl_godown_id = ${godownId ?? null}::uuid)`
                : Promise.resolve(null),
            this.resolveLoadingCharge(query, rate),
        ]);
        const taxLedgers = await this.resolveTaxLedgers(tax?.taxId ?? null, query);
        const buckets = policy.trackMrp || policy.trackSalePrice
            ? await this.resolveStockBuckets(query, policy, unitRows, docDate, caller)
            : [];
        const gstApplicable = company_id ? (company?.compGstApplicable ?? false) : true;
        const basePrice = (0, item_price_utils_1.priceForLevel)(rate, priceLevel);
        const customerDiscQty = custRate && priceLevel >= 1 && priceLevel <= 4 ? (0, module_service_utils_1.toNumber)(custRate.csrDiscQty) : 0;
        const salesPrice = basePrice - customerDiscQty;
        const itemName = regional
            ? (itemRecord.itemNameTa ?? itemRecord.itemNameEn)
            : itemRecord.itemNameEn;
        const stock = stockSum ? (0, module_service_utils_1.toNullableNumber)(stockSum[0]?.qty ?? 0) : null;
        const reorderQty = reorder ? (0, module_service_utils_1.toNumber)(reorder.irMinLevel) - (stock ?? 0) : null;
        const allowNegativeStock = itemRecord.itemIsService
            ? true
            : !(godown?.gdlNegativeStock === false &&
                company?.compNegStkApl === false &&
                itemRecord.itemAllowNegStock === false);
        return {
            item_id: itemRecord.itemId,
            item_uc_id: rate.itemUnitConversion.iucId,
            godown_id: godownId ?? null,
            godown_name: godown?.gdlName ?? '',
            item_code: itemRecord.itemCode,
            item_name: itemName,
            item_com_code: itemRecord.itemSku,
            barcode: itemRecord.itemDefaultBarcode,
            allow_promo: itemRecord.itemAllowPromo,
            add_freight: itemRecord.itemAllowFreight,
            item_group_id: itemRecord.itemGroupId,
            item_category_id: itemRecord.itemCategoryId,
            item_brand_id: itemRecord.itemBrandId,
            item_section_id: itemRecord.itemSectionId,
            weigh_scale: itemRecord.itemWeighScale,
            batch_config: itemRecord.itemBatchConfig,
            service_item: itemRecord.itemIsService ? 'Y' : 'N',
            allow_negative_stock: allowNegativeStock,
            price_level: priceLevel,
            sales_price: salesPrice,
            cost_price: (0, module_service_utils_1.toNumber)(rate.ipmCostPrice),
            cost_wot: (0, module_service_utils_1.toNumber)(rate.ipmCostWot),
            min_price: (0, module_service_utils_1.toNumber)(rate.ipmMinPrice),
            max_price: (0, module_service_utils_1.toNumber)(rate.ipmMaxPrice),
            price_source: resolved.source,
            price_scope: resolved.scope,
            price_row_id: rate.ipmId,
            buckets,
            disc_perc: (0, module_service_utils_1.toNumber)(rate.ipmDiscPerc),
            disc_qty: (0, module_service_utils_1.toNumber)(rate.ipmDiscQty),
            sch_discount: null,
            addl_cess: (0, module_service_utils_1.toNumber)(rate.ipmAddlCess),
            unit_name: unit?.unit_name ?? null,
            base_unit_id: rate.itemUnitConversion.iucBaseUnitId,
            base_factor: (0, module_service_utils_1.toNumber)(rate.itemUnitConversion.iucToBaseFactor),
            iuc_uom_weight: (0, module_service_utils_1.toNumber)(rate.itemUnitConversion.iucUomWeight),
            decimal_count: unit?.unit_decimal_count ?? 0,
            ...loading,
            freight_charge: this.resolveFreightCharge(query, rate),
            loyalty_pv: itemRecord.itemAllowLoyalty ? (0, module_service_utils_1.toNumber)(rate.ipmLoyaltyPoints) : 0,
            stock,
            reorder_qty: reorderQty,
            item_incl_tax: itemRecord.itemInclTax,
            tax_id: tax?.taxId ?? null,
            hsn_code: itemRecord.itemHsnCode ?? null,
            gst_rate: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxRatePerc) : 0,
            cess_perc: gstApplicable && tax && ['PERCENT', 'BOTH'].includes(tax.taxCessBasis)
                ? (0, module_service_utils_1.toNumber)(tax.taxCessPerc)
                : 0,
            cess_unit: gstApplicable && tax && ['PER_UNIT', 'BOTH'].includes(tax.taxCessBasis)
                ? (0, module_service_utils_1.toNumber)(tax.taxCessPerUnit)
                : 0,
            sgst_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxSgstPerc ?? 0) : 0,
            cgst_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxCgstPerc ?? 0) : 0,
            igst_perc: gstApplicable && tax ? (0, module_service_utils_1.toNumber)(tax.taxIgstPerc ?? 0) : 0,
            ...taxLedgers,
        };
    }
}
exports.ItemPriceLookup = ItemPriceLookup;
//# sourceMappingURL=item-price.lookup.js.map