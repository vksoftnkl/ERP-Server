"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSaleLinePrice = resolveSaleLinePrice;
exports.pricedBuckets = pricedBuckets;
exports.provisionalBucket = provisionalBucket;
exports.rankedQtySlabs = rankedQtySlabs;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const item_price_utils_1 = require("../../master-lookup/utils/item-price.utils");
const stock_voucher_posting_helper_1 = require("../../stocks/stock-voucher/stock-voucher-posting.helper");
const qty_slab_rules_1 = require("../items-qty-price-master/qty-slab.rules");
const price_resolver_1 = require("./price-resolver");
async function resolveSaleLinePrice(client, query) {
    const companyId = query.companyId ?? null;
    const branchId = query.branchId ?? null;
    const docDate = query.docDate.slice(0, 10);
    const [item, priceRows] = await Promise.all([
        client.itemMaster.findFirst({
            where: {
                itemId: query.itemId,
                ...(branchId ? { OR: [{ itemBranchId: branchId }, { itemBranchId: null }] } : {}),
                itemIsDeleted: false,
            },
        }),
        client.itemPriceMaster.findMany({
            where: {
                ipmItemId: query.itemId,
                AND: [
                    ...(branchId ? [{ OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }] }] : []),
                    ...(companyId ? [{ OR: [{ ipmCompanyId: companyId }, { ipmCompanyId: null }] }] : []),
                ],
                ipmIsDeleted: false,
            },
            include: { itemUnitConversion: { include: { unit: true } } },
            orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
        }),
    ]);
    if (!item) {
        return { ok: false, reason: 'ITEM_NOT_FOUND' };
    }
    const caller = { companyId, branchId };
    const liveRows = (0, price_resolver_1.livePriceRows)(priceRows, docDate, caller);
    const unitPick = (0, item_price_utils_1.selectUnitRate)(liveRows, item.itemRetailItem, query.unitId ?? undefined);
    if (!unitPick) {
        return { ok: false, reason: 'PRICE_NOT_FOUND' };
    }
    const unitRows = liveRows.filter((row) => row.ipmUcUnitId === unitPick.ipmUcUnitId);
    const [policy] = await (0, stock_voucher_posting_helper_1.readBucketTrackFlags)(client, [
        {
            itemId: query.itemId,
            companyId: companyId ?? item.itemCompanyId,
            branchId: branchId ?? item.itemBranchId,
        },
    ], docDate);
    const values = await lineBucketValues(client, query);
    if (!values) {
        return { ok: false, reason: 'LOT_NOT_FOUND' };
    }
    const key = (0, stock_voucher_posting_helper_1.bucketKeyFor)(policy, values);
    const resolved = (0, price_resolver_1.resolveEffectivePrice)(unitRows, key, docDate, caller) ??
        provisionalBucket(unitRows, key, docDate, caller);
    if (!resolved) {
        return {
            ok: false,
            reason: 'BUCKET_PRICE_NOT_FOUND',
            key,
            priced: pricedBuckets(unitRows, docDate, caller).map(({ key: k }) => k),
        };
    }
    const rate = resolved.row;
    const headline = (0, price_resolver_1.resolveEffectivePrice)(unitRows, price_resolver_1.HEADLINE_KEY, docDate, caller);
    const custRate = query.customerId && headline
        ? await client.custItemRate.findFirst({
            where: {
                csrUnitRateId: headline.row.ipmId,
                csrCustomerId: query.customerId,
                csrIsDeleted: false,
                csrIsActive: true,
            },
        })
        : null;
    const basePrice = (0, item_price_utils_1.priceForLevel)(rate, query.priceLevel);
    const customerDiscQty = custRate && query.priceLevel >= 1 && query.priceLevel <= 4 ? (0, module_service_utils_1.toNumber)(custRate.csrDiscQty) : 0;
    return {
        ok: true,
        item,
        caller,
        unitRows,
        policy,
        key,
        resolved,
        rate,
        custRate,
        basePrice,
        customerDiscQty,
        salesPrice: basePrice - customerDiscQty,
    };
}
async function lineBucketValues(client, query) {
    if (!query.lotId) {
        return { mrp: query.mrp ?? null, salePrice: query.salePrice ?? null };
    }
    const lot = await client.stockLot.findFirst({
        where: { sltId: query.lotId, sltItemId: query.itemId },
        select: { sltMrp: true, sltSalePrice: true },
    });
    if (!lot) {
        return null;
    }
    return { mrp: (0, module_service_utils_1.toNullableNumber)(lot.sltMrp), salePrice: (0, module_service_utils_1.toNullableNumber)(lot.sltSalePrice) };
}
function pricedBuckets(unitRows, docDate, caller) {
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
        .sort((a, b) => (b.key.mrp ?? -1) - (a.key.mrp ?? -1) || (b.key.salePrice ?? -1) - (a.key.salePrice ?? -1));
}
function provisionalBucket(unitRows, key, docDate, caller) {
    if (!(0, price_resolver_1.isHeadlineKey)(key)) {
        return null;
    }
    return pricedBuckets(unitRows, docDate, caller)[0]?.answer ?? null;
}
async function rankedQtySlabs(client, query, settings) {
    if (query.priceLevel < 1 || query.priceLevel > 4) {
        return [];
    }
    const rows = await client.itemQtyPrice.findMany({
        where: {
            iqpItemId: query.itemId,
            iqpItemUnitId: query.iucId,
            iqpIsDeleted: false,
            iqpIsActive: true,
        },
        orderBy: [{ iqpFromQty: 'asc' }, { iqpId: 'asc' }],
    });
    const ranked = (0, qty_slab_rules_1.slabsFor)(rows.map(qty_slab_rules_1.qtySlabOf), {
        companyId: query.companyId ?? null,
        branchId: query.branchId ?? null,
        partyId: query.partyId ?? null,
        priceLevel: query.priceLevel,
        onDate: query.onDate,
    });
    if (!ranked.length) {
        return [];
    }
    if (settings) {
        const effective = await settings.resolveEffective({
            companyId: query.companyId ?? undefined,
            branchId: query.branchId ?? undefined,
        });
        if (!(0, qty_slab_rules_1.isApplyQtyPricesOn)(effective)) {
            return [];
        }
    }
    return ranked;
}
//# sourceMappingURL=sale-line-price.js.map