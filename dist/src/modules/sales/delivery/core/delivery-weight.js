"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitKgOf = unitKgOf;
exports.lineWeightKg = lineWeightKg;
exports.unitKgText = unitKgText;
const client_1 = require("@prisma/client");
const Z = new client_1.Prisma.Decimal(0);
function unitKgOf(raw) {
    return (raw ?? Z).toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function lineWeightKg(qty, raw) {
    return qty.times(unitKgOf(raw)).toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function unitKgText(raw) {
    return unitKgOf(raw).toFixed(3);
}
//# sourceMappingURL=delivery-weight.js.map