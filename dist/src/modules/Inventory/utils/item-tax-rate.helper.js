"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveItemTaxRates = resolveItemTaxRates;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
async function resolveItemTaxRates(tx, itemIds, asOf = new Date()) {
    const ids = [...new Set(itemIds)];
    if (!ids.length) {
        return new Map();
    }
    const asOfDate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
    const items = await tx.itemMaster.findMany({
        where: { itemId: { in: ids } },
        select: { itemId: true, itemDefaultTaxId: true, itemInclTax: true },
    });
    const history = await tx.itemTaxHistory.findMany({
        where: {
            ithItemId: { in: ids },
            ithEffectiveFrom: { lte: asOfDate },
            OR: [{ ithEffectiveTo: null }, { ithEffectiveTo: { gte: asOfDate } }],
        },
        orderBy: [{ ithItemId: 'asc' }, { ithEffectiveFrom: 'desc' }],
        select: { ithItemId: true, ithTaxId: true },
    });
    const historyTaxId = new Map();
    for (const row of history) {
        if (!historyTaxId.has(row.ithItemId)) {
            historyTaxId.set(row.ithItemId, row.ithTaxId);
        }
    }
    const taxIds = [
        ...new Set([
            ...historyTaxId.values(),
            ...items.map((item) => item.itemDefaultTaxId).filter((id) => !!id),
        ].filter(Boolean)),
    ];
    const taxes = taxIds.length
        ? await tx.taxRateMaster.findMany({
            where: { taxId: { in: taxIds } },
            select: {
                taxId: true,
                taxRatePerc: true,
                taxCessBasis: true,
                taxAcessBasis: true,
            },
        })
        : [];
    const taxById = new Map(taxes.map((tax) => [tax.taxId, tax]));
    const result = new Map();
    for (const item of items) {
        const taxId = historyTaxId.get(item.itemId) ?? item.itemDefaultTaxId ?? null;
        const tax = taxId ? taxById.get(taxId) : undefined;
        result.set(item.itemId, {
            itemId: item.itemId,
            taxId,
            taxPerc: tax ? (0, module_service_utils_1.toNumber)(tax.taxRatePerc) : 0,
            inclTax: item.itemInclTax,
            hasCess: tax ? tax.taxCessBasis !== 'NONE' || tax.taxAcessBasis !== 'NONE' : false,
        });
    }
    return result;
}
//# sourceMappingURL=item-tax-rate.helper.js.map