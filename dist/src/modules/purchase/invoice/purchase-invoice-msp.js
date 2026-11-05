"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savedMinPrice = savedMinPrice;
exports.shownMinPrice = shownMinPrice;
const client_1 = require("@prisma/client");
const r2 = (v) => new client_1.Prisma.Decimal(v).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
function savedMinPrice(typed) {
    return typed === null || typed === undefined ? null : r2(typed);
}
function shownMinPrice(typed, current) {
    return savedMinPrice(typed) ?? current ?? null;
}
//# sourceMappingURL=purchase-invoice-msp.js.map