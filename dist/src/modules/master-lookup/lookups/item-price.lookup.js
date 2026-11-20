"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceLookup = void 0;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const master_lookup_constants_1 = require("../master-lookup.constants");
const master_lookup_error_codes_1 = require("../types/master-lookup-error-codes");
const item_price_utils_1 = require("../utils/item-price.utils");
const price_resolver_1 = require("../../Inventory/items-price-master/price-resolver");
const price_bucket_service_1 = require("../../Inventory/items-price-master/price-bucket.service");
const sale_line_price_1 = require("../../Inventory/items-price-master/sale-line-price");
const stock_voucher_posting_helper_1 = require("../../stocks/stock-voucher/stock-voucher-posting.helper");
const loading_charge_utils_1 = require("../utils/loading-charge.utils");
const sale_line_godown_utils_1 = require("../../../common/utils/sale-line-godown.utils");
const qty_slab_rules_1 = require("../../Inventory/items-qty-price-master/qty-slab.rules");
const TAX_LEDGER_ROLES = {
    sales_ledger_id: 'SALES',
    sgst_output_ledger_id: 'OUTPUT_SGST',
    cgst_output_ledger_id: 'OUTPUT_CGST',
    igst_output_ledger_id: 'OUTPUT_IGST',
    cess_output_ledger_id: 'OUTPUT_CESS',
};
class ItemPriceLookup {
    prisma;
    settings;
    constructor(prisma, settings) {
        this.prisma = prisma;
        this.settings = settings;
    }
    async resolveQtySlabs(query, iucId, docDate) {
        const ranked = await (0, sale_line_price_1.rankedQtySlabs)(this.prisma, {
            itemId: query.item_id,
            iucId,
            companyId: query.company_id ?? null,
            branchId: query.branch_id ?? null,
            partyId: query.customer_id ?? null,
            priceLevel: query.price_level,
            onDate: docDate,
        }, this.settings);
        const amount = (value) => (value === null ? null : value.toNumber());
        return ranked.map((slab) => ({
            iqp_id: slab.iqpId,
            from_qty: slab.fromQty.toNumber(),
            to_qty: amount(slab.toQty),
            price_mode: slab.priceMode,
            disc_pct: amount(slab.discPct),
            flat_off: amount(slab.flatOff),
            price: amount(slab.price),
            is_tax_incl: slab.isTaxIncl,
            price_level: slab.priceLevel,
            party_id: slab.partyId,
            branch_id: slab.branchId,
            company_id: slab.companyId,
            effective_from: slab.effectiveFrom,
            effective_to: slab.effectiveTo,
            specificity: (0, qty_slab_rules_1.slabSpecificity)(slab),
        }));
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
                    code: master_lookup_error_codes_1.MasterLookupErrorCode.LOADING_SCOPE_REQUIRED,
                },
            ]);
        }
        const weight = (0, loading_charge_utils_1.resolveLoadingWeight)(rate.itemUnitConversion.iucUomWeight);
        if (weight === null) {
            return {
                loading_charge: null,
                resolved_weight: null,
            };
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
        if ((query.freight_type ?? master_lookup_constants_1.DEFAULT_FREIGHT_TYPE) !== 'item_basis') {
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
            merged.push(...(0, sale_line_price_1.pricedBuckets)(unitRows, docDate, caller).map(({ key }) => ({ key, qty: 0 })));
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
    throwPriceMiss(answer, query) {
        const { item_id, unit_id } = query;
        switch (answer.reason) {
            case 'ITEM_NOT_FOUND':
                return (0, module_service_utils_1.throwMasterNotFound)('Item not found', 'item_id', `No active item found for id ${item_id}`, master_lookup_error_codes_1.MasterLookupErrorCode.ITEM_NOT_FOUND);
            case 'PRICE_NOT_FOUND':
                return (0, module_service_utils_1.throwMasterNotFound)('Item price not found', unit_id ? 'unit_id' : 'item_id', unit_id
                    ? `No active price row found for item ${item_id} and unit ${unit_id}`
                    : `No active price row configured for item ${item_id}`, master_lookup_error_codes_1.MasterLookupErrorCode.PRICE_NOT_FOUND);
            case 'LOT_NOT_FOUND':
                return (0, module_service_utils_1.throwMasterNotFound)('Lot not found', 'lot_id', `No lot ${query.lot_id} found for item ${item_id}`, master_lookup_error_codes_1.MasterLookupErrorCode.LOT_NOT_FOUND);
            case 'BUCKET_PRICE_NOT_FOUND': {
                const { key } = answer;
                const priced = answer.priced.map((k) => k.mrp !== null ? `MRP ${k.mrp}` : `sale price ${k.salePrice}`);
                return (0, module_service_utils_1.throwMasterNotFound)('Item price not found', key.mrp !== null
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
                    (priced.length ? `. Priced: ${priced.join(', ')}.` : '.'), master_lookup_error_codes_1.MasterLookupErrorCode.BUCKET_PRICE_NOT_FOUND);
            }
        }
    }
    async getItemPriceLookup(query) {
        const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
        const priceLevel = query.price_level;
        const regional = query.regional ?? false;
        const docDate = query.doc_date?.slice(0, 10) ?? (0, price_bucket_service_1.todayIso)();
        const answer = await (0, sale_line_price_1.resolveSaleLinePrice)(this.prisma, {
            itemId: item_id,
            unitId: unit_id ?? null,
            companyId: company_id ?? null,
            branchId: branch_id ?? null,
            customerId: customer_id ?? null,
            priceLevel,
            docDate,
            mrp: query.mrp ?? null,
            salePrice: query.sale_price ?? null,
            lotId: query.lot_id ?? null,
        });
        if (!answer.ok) {
            this.throwPriceMiss(answer, query);
        }
        const { item: itemRecord, caller, unitRows, policy, resolved, rate } = answer;
        const godownId = query.godown_id ??
            rate.ipmGodownId ??
            (branch_id ? await (0, sale_line_godown_utils_1.branchDefaultGodownId)(this.prisma, branch_id) : null);
        const unit = rate.itemUnitConversion.unit;
        const rateUnitId = rate.itemUnitConversion.iucUnitId;
        const [godown, tax, company, reorder, stockSum, loading] = await Promise.all([
            godownId
                ? this.prisma.godownLocation.findFirst({ where: { gdlId: godownId } })
                : Promise.resolve(null),
            itemRecord.itemDefaultTaxId
                ? this.prisma.taxRateMaster.findFirst({
                    where: { taxId: itemRecord.itemDefaultTaxId, taxIsDeleted: false },
                })
                : Promise.resolve(null),
            company_id
                ? this.prisma.company.findFirst({
                    where: { compId: company_id },
                    select: { compGstApplicable: true, compNegStkApl: true },
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
        const qtySlabs = await this.resolveQtySlabs(query, rate.itemUnitConversion.iucId, docDate);
        const gstApplicable = company_id ? (company?.compGstApplicable ?? false) : true;
        const salesPrice = answer.salesPrice;
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
            qty_slabs: qtySlabs,
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