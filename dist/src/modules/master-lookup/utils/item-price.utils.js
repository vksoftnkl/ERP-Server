"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preferBranchPriceRows = preferBranchPriceRows;
exports.selectUnitRate = selectUnitRate;
exports.nextIucIdInCycle = nextIucIdInCycle;
exports.priceForLevel = priceForLevel;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
function preferBranchPriceRows(priceRows, branchId) {
    if (!branchId)
        return priceRows;
    const byUnit = new Map();
    for (const row of priceRows) {
        const current = byUnit.get(row.ipmUcUnitId);
        if (!current || (current.ipmBranchId !== branchId && row.ipmBranchId === branchId)) {
            byUnit.set(row.ipmUcUnitId, row);
        }
    }
    return [...byUnit.values()];
}
function selectUnitRate(priceRows, isRetailItem, unitId) {
    if (priceRows.length === 0)
        return null;
    if (unitId) {
        return (priceRows.find((row) => row.itemUnitConversion.iucUnitId === unitId || row.ipmUcUnitId === unitId) ?? null);
    }
    return priceRows.reduce((best, row) => {
        const slno = row.itemUnitConversion.iucUnitSlno;
        const bestSlno = best.itemUnitConversion.iucUnitSlno;
        return isRetailItem ? (slno > bestSlno ? row : best) : slno < bestSlno ? row : best;
    }, priceRows[0]);
}
function nextIucIdInCycle(rows, requestedIucId) {
    if (rows.length === 0)
        return requestedIucId;
    const index = rows.findIndex((row) => row.iucId === requestedIucId || row.iucUnitId === requestedIucId);
    if (index === -1)
        return rows[0].iucId;
    return rows[(index + 1) % rows.length].iucId;
}
function priceForLevel(rate, priceLevel) {
    switch (priceLevel) {
        case 2:
            return (0, module_service_utils_1.toNumber)(rate.ipmSalesPriceB);
        case 3:
            return (0, module_service_utils_1.toNumber)(rate.ipmSalesPriceC);
        case 4:
            return (0, module_service_utils_1.toNumber)(rate.ipmSalesPriceD);
        case 5:
            return (0, module_service_utils_1.toNumber)(rate.ipmMaxPrice);
        case 6:
            return (0, module_service_utils_1.toNumber)(rate.ipmMinPrice);
        case 7:
            return (0, module_service_utils_1.toNumber)(rate.ipmCostPrice);
        case 1:
        default:
            return (0, module_service_utils_1.toNumber)(rate.ipmSalesPriceA);
    }
}
//# sourceMappingURL=item-price.utils.js.map