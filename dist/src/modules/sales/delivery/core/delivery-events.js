"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryEventQty = deliveryEventQty;
exports.lineFigures = lineFigures;
const client_1 = require("@prisma/client");
const Z = new client_1.Prisma.Decimal(0);
function deliveryEventQty(kind, qty, base) {
    if (!qty.greaterThan(0) || !base.greaterThan(0)) {
        throw new Error(`deliveryEventQty: ${kind} needs a positive qty (got ${qty.toString()} / ${base.toString()})`);
    }
    switch (kind) {
        case 'GIVEN':
        case 'CLEANUP':
            return { settleQty: qty, settleBaseQty: base, outQty: qty, outBaseQty: base };
        case 'CANCEL':
        case 'GOODS_BACK':
            return {
                settleQty: qty.negated(),
                settleBaseQty: base.negated(),
                outQty: qty.negated(),
                outBaseQty: base.negated(),
            };
        case 'RETURN':
            return { settleQty: qty, settleBaseQty: base, outQty: Z, outBaseQty: Z };
        case 'RETURN_CANCEL':
            return { settleQty: qty.negated(), settleBaseQty: base.negated(), outQty: Z, outBaseQty: Z };
    }
}
function lineFigures(billed, events) {
    const settled = events.reduce((a, e) => a.plus(e.settleQty), Z);
    const given = events.reduce((a, e) => a.plus(e.outQty), Z);
    return { settled, given, pending: billed.minus(settled) };
}
//# sourceMappingURL=delivery-events.js.map