"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spread = spread;
exports.calcPurchase = calcPurchase;
exports.priceFromMarkup = priceFromMarkup;
exports.markupOf = markupOf;
exports.marginOf = marginOf;
exports.rateFromInclusiveCost = rateFromInclusiveCost;
const client_1 = require("@prisma/client");
const D = (v) => new client_1.Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const HUNDRED = D(100);
const r2 = (v) => v.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
const r6 = (v) => v.toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP);
const max0 = (v) => (v.isNegative() ? ZERO : v);
function spread(amount, weights) {
    const total = weights.reduce((a, w) => a.plus(w), ZERO);
    const out = weights.map(() => ZERO);
    if (total.isZero() || amount.isZero())
        return out;
    let last = -1;
    let given = ZERO;
    weights.forEach((w, i) => {
        if (w.isZero())
            return;
        out[i] = r2(amount.times(w).dividedBy(total));
        given = given.plus(out[i]);
        last = i;
    });
    if (last >= 0)
        out[last] = out[last].plus(amount.minus(given));
    return out;
}
function gst(taxable, pct, interState) {
    if (pct.isZero() || taxable.isZero())
        return { cgst: ZERO, sgst: ZERO, igst: ZERO };
    if (interState)
        return { cgst: ZERO, sgst: ZERO, igst: r2(taxable.times(pct).dividedBy(HUNDRED)) };
    const half = r2(taxable.times(pct).dividedBy(2).dividedBy(HUNDRED));
    return { cgst: half, sgst: half, igst: ZERO };
}
function calcPurchase(input) {
    const noTaxSupplier = input.supplierTaxMode === 'COMPOSITION' || input.supplierTaxMode === 'UNREGISTERED';
    const base = input.lines.map((l) => {
        const billed = D(l.billedQty);
        const damaged = D(l.damagedQty);
        const received = l.receivedQty === null || l.receivedQty === undefined ? max0(billed.minus(damaged)) : D(l.receivedQty);
        const rate = D(l.rate);
        const gross = r2(billed.times(rate));
        const discAmt = !D(l.discPct).isZero()
            ? r2(gross.times(D(l.discPct)).dividedBy(HUNDRED))
            : !D(l.discPerQty).isZero()
                ? r2(billed.times(D(l.discPerQty)))
                : r2(D(l.discAmt));
        const afterDisc = gross.minus(discAmt);
        const schAmt = !D(l.schPct).isZero()
            ? r2(afterDisc.times(D(l.schPct)).dividedBy(HUNDRED))
            : !D(l.schPerQty).isZero()
                ? r2(billed.times(D(l.schPerQty)))
                : r2(D(l.schAmt));
        const extraDiscAmt = r2(D(l.extraDiscAmt));
        const netGross = afterDisc.minus(schAmt).minus(extraDiscAmt);
        const itcClass = noTaxSupplier
            ? input.supplierTaxMode
            : (l.itcClass ?? 'ELIGIBLE');
        return { l, billed, received, damaged, free: D(l.freeQty), factor: D(l.toBaseFactor ?? 1), weight: D(l.weight),
            gross, discAmt, schAmt, extraDiscAmt, netGross, itcClass };
    });
    const sumNetGross = base.reduce((a, b) => a.plus(b.netGross), ZERO);
    const chargesOut = [];
    const share = new Map();
    base.forEach((b) => share.set(b.l.key, { before: ZERO, after: ZERO, offbill: ZERO, beforeNotLanding: ZERO, afterNotLanding: ZERO }));
    for (const c of input.charges ?? []) {
        const lines = base.filter((b) => !c.lineKeys || c.lineKeys.includes(b.l.key));
        const rate = D(c.rate);
        const qty = lines.reduce((a, b) => a.plus(b.billed), ZERO);
        const wt = lines.reduce((a, b) => a.plus(b.weight), ZERO);
        let amount;
        if (c.amount !== null && c.amount !== undefined && !D(c.amount).isZero())
            amount = r2(D(c.amount).abs());
        else if (c.method === 'FIXED')
            amount = r2(rate.abs());
        else if (c.method === 'PERCENT')
            amount = r2(lines.reduce((a, b) => a.plus(b.netGross), ZERO).times(rate).dividedBy(HUNDRED));
        else if (c.method === 'QTY' || c.method === 'NET_QTY')
            amount = r2(qty.times(rate));
        else if (c.method === 'KG')
            amount = r2(wt.times(rate));
        else if (c.method === 'QTL')
            amount = r2(wt.times(rate).dividedBy(100));
        else
            amount = r2(wt.times(rate).dividedBy(1000));
        const signed = c.type === 'DEDUCT' ? amount.negated() : amount;
        const weights = lines.map((b) => c.alloc === 'QTY' ? b.billed.times(b.factor) : c.alloc === 'WEIGHT' ? b.weight : b.netGross);
        const parts = spread(signed, weights.some((w) => !w.isZero()) ? weights : lines.map((b) => b.netGross));
        const lineShares = {};
        lines.forEach((b, i) => {
            lineShares[b.l.key] = parts[i];
            const s = share.get(b.l.key);
            if (!c.onBill)
                s.offbill = s.offbill.plus(parts[i]);
            else if (c.beforeTax) {
                s.before = s.before.plus(parts[i]);
                if (!c.landingCost)
                    s.beforeNotLanding = s.beforeNotLanding.plus(parts[i]);
            }
            else {
                s.after = s.after.plus(parts[i]);
                if (!c.landingCost)
                    s.afterNotLanding = s.afterNotLanding.plus(parts[i]);
            }
        });
        const own = c.onBill && !c.beforeTax && !noTaxSupplier && !D(c.taxPct).isZero()
            ? gst(signed, D(c.taxPct), input.interState)
            : { cgst: ZERO, sgst: ZERO, igst: ZERO };
        let payees = [];
        if (!c.onBill && c.payees && c.payees.length) {
            const fixed = c.payees.filter((p) => p.amount !== null && p.amount !== undefined);
            const given = fixed.reduce((a, p) => a.plus(r2(D(p.amount))), ZERO);
            const open = c.payees.filter((p) => p.amount === null || p.amount === undefined);
            const rest = spread(amount.minus(given), open.map(() => D(1)));
            payees = c.payees.map((p) => p.amount !== null && p.amount !== undefined
                ? { partyId: p.partyId, amount: r2(D(p.amount)) }
                : { partyId: p.partyId, amount: rest[open.indexOf(p)] });
        }
        chargesOut.push({ key: c.key, amount: signed, ...own, lineShares, payees });
    }
    const linesOut = base.map((b) => {
        const s = share.get(b.l.key);
        const taxable = b.netGross.plus(s.before);
        const taxed = !(b.itcClass === 'COMPOSITION' || b.itcClass === 'UNREGISTERED' || b.itcClass === 'RCM');
        const gstPct = taxed ? D(b.l.gstPct) : ZERO;
        const t = gst(taxable, gstPct, input.interState);
        const cess = taxed
            ? r2(taxable.times(D(b.l.cessPct)).dividedBy(HUNDRED).plus(b.billed.times(D(b.l.cessPerUnit))))
            : ZERO;
        const tax = t.cgst.plus(t.sgst).plus(t.igst).plus(cess);
        const total = taxable.plus(tax);
        const short = max0(b.billed.minus(b.received).minus(b.damaged));
        const allowance = b.received.times(D(b.l.shortagePct)).dividedBy(HUNDRED);
        const absorbed = short.isZero() || short.greaterThan(allowance) ? ZERO : short;
        const pending = short.minus(absorbed);
        let eligible = ZERO, pendingTax = ZERO, ineligible = ZERO;
        if (!b.billed.isZero() && !tax.isZero()) {
            const pendingPart = r2(tax.times(pending).dividedBy(b.billed));
            const lostPart = r2(tax.times(absorbed).dividedBy(b.billed));
            if (b.itcClass === 'INELIGIBLE' || b.itcClass === 'BLOCKED_17_5') {
                ineligible = tax.minus(pendingPart);
                pendingTax = pendingPart;
            }
            else {
                pendingTax = pendingPart;
                ineligible = lostPart;
                eligible = tax.minus(pendingPart).minus(lostPart);
            }
        }
        const shortValue = b.billed.isZero() ? ZERO : r2(taxable.times(pending).dividedBy(b.billed));
        const landedValue = r2(taxable.minus(s.beforeNotLanding).plus(s.after.minus(s.afterNotLanding)).plus(s.offbill).plus(ineligible).minus(shortValue));
        const inQtyBase = b.received.plus(b.damaged).plus(b.free).times(b.factor);
        const landedCostWot = inQtyBase.isZero() ? ZERO : r6(landedValue.dividedBy(inQtyBase));
        return {
            key: b.l.key, gross: b.gross, discAmt: b.discAmt, schAmt: b.schAmt, extraDiscAmt: b.extraDiscAmt, netGross: b.netGross,
            chrgBeforeTax: s.before, chrgAfterTax: s.after, offbillShare: s.offbill, taxable, gstPct, ...t, cess, total,
            shortQty: short, absorbedShortQty: absorbed, pendingShortQty: pending, itcClass: b.itcClass,
            itcEligible: eligible, itcPending: pendingTax, itcIneligible: ineligible, shortValue, landedValue, landedCostWot,
        };
    });
    const sum = (f) => linesOut.reduce((a, l) => a.plus(f(l)), ZERO);
    const onBillAfter = chargesOut
        .filter((c, i) => (input.charges ?? [])[i].onBill && !(input.charges ?? [])[i].beforeTax)
        .reduce((a, c) => a.plus(c.amount), ZERO);
    const chargeTax = chargesOut.reduce((a, c) => a.plus(c.cgst).plus(c.sgst).plus(c.igst), ZERO);
    const offbill = chargesOut.filter((c, i) => !(input.charges ?? [])[i].onBill).reduce((a, c) => a.plus(c.amount), ZERO);
    const tcs = r2(D(input.tcsAmount));
    const raw = sum((l) => l.total).plus(onBillAfter).plus(chargeTax).plus(tcs);
    const step = D(input.roundOffStep ?? 1);
    const rounded = step.isZero() ? raw : raw.dividedBy(step).toDecimalPlaces(0, client_1.Prisma.Decimal.ROUND_HALF_UP).times(step);
    const itcChargeTax = chargeTax;
    return {
        lines: linesOut,
        charges: chargesOut,
        gross: sum((l) => l.gross),
        discount: sum((l) => l.discAmt.plus(l.schAmt).plus(l.extraDiscAmt)),
        taxable: sum((l) => l.taxable),
        cgst: sum((l) => l.cgst),
        sgst: sum((l) => l.sgst),
        igst: sum((l) => l.igst),
        cess: sum((l) => l.cess),
        chargesOnBill: onBillAfter.plus(sum((l) => l.chrgBeforeTax)),
        chargeTax,
        tcs,
        roundOff: r2(rounded.minus(raw)),
        netPayable: r2(rounded),
        offbillCharges: offbill,
        shortValue: sum((l) => l.shortValue),
        itcEligible: sum((l) => l.itcEligible).plus(itcChargeTax),
        itcPending: sum((l) => l.itcPending),
        itcIneligible: sum((l) => l.itcIneligible),
    };
}
function priceFromMarkup(costWot, markupPct, step) {
    const raw = D(costWot).times(HUNDRED.plus(D(markupPct))).dividedBy(HUNDRED);
    const st = D(step ?? 0);
    return st.isZero() ? r2(raw) : r2(raw.dividedBy(st).toDecimalPlaces(0, client_1.Prisma.Decimal.ROUND_HALF_UP).times(st));
}
function markupOf(costWot, sellWot) {
    const c = D(costWot);
    return c.isZero() ? ZERO : D(sellWot).minus(c).times(HUNDRED).dividedBy(c).toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function marginOf(costWot, sellWot) {
    const s = D(sellWot);
    return s.isZero() ? ZERO : s.minus(D(costWot)).times(HUNDRED).dividedBy(s).toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function rateFromInclusiveCost(costIncl, gstPct, cessPct, cessPerUnit) {
    const div = HUNDRED.plus(D(gstPct)).plus(D(cessPct)).dividedBy(HUNDRED);
    return r6(D(costIncl).minus(D(cessPerUnit)).dividedBy(div));
}
//# sourceMappingURL=purchase-calc.js.map