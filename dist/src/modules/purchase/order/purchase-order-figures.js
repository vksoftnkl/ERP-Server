"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poGoodsValue = poGoodsValue;
exports.poFigures = poFigures;
const client_1 = require("@prisma/client");
const purchase_calc_1 = require("../common/purchase-calc");
const D = (v) => new client_1.Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const r6 = (v) => v.toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP);
function poGoodsValue(lines, interState) {
    const g = (0, purchase_calc_1.calcPurchase)({ interState, roundOffStep: 0, lines });
    return { taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: g.igst, cess: g.cess, value: g.taxable.plus(g.cgst).plus(g.sgst).plus(g.igst).plus(g.cess) };
}
function poFigures(calc, lines) {
    const out = calc.lines.map((o, i) => {
        const tax = o.cgst.plus(o.sgst).plus(o.igst).plus(o.cess);
        const inQty = D(lines[i]?.qty).plus(D(lines[i]?.freeQty));
        return {
            key: o.key, gross: o.gross, discAmt: o.discAmt, netGross: o.netGross,
            chrgBeforeTax: o.chrgBeforeTax, chrgAfterTax: o.chrgAfterTax, offbillShare: o.offbillShare,
            taxable: o.taxable, gstPct: o.gstPct, tax, total: o.total, amount: o.total.plus(o.chrgAfterTax),
            landedValue: o.landedValue,
            landedCost: inQty.isZero() ? ZERO : r6(o.landedValue.dividedBy(inQty)),
            landedCostIncl: inQty.isZero() ? ZERO : r6(o.landedValue.plus(tax).dividedBy(inQty)),
        };
    });
    const sum = (f) => out.reduce((a, l) => a.plus(f(l)), ZERO);
    const taxable = sum((l) => l.taxable), tax = sum((l) => l.tax), net = taxable.plus(tax);
    const chrgBeforeTax = sum((l) => l.chrgBeforeTax);
    const chargesTotal = calc.charges.reduce((a, c) => a.plus(c.amount), ZERO);
    const chargesEstimate = chargesTotal.minus(chrgBeforeTax).plus(calc.chargeTax);
    return {
        lines: out,
        totals: {
            gross: calc.gross, netGross: sum((l) => l.netGross), chrgBeforeTax, taxable, tax, net,
            chrgAfterTax: sum((l) => l.chrgAfterTax), chargeTax: calc.chargeTax, offbill: calc.offbillCharges, chargesTotal, chargesEstimate,
            amount: sum((l) => l.amount), landedValue: sum((l) => l.landedValue), poTotal: net.plus(chargesEstimate),
        },
    };
}
//# sourceMappingURL=purchase-order-figures.js.map