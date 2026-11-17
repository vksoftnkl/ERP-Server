"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.n = exports.signed = exports.zeroFigures = exports.baseOf = exports.PERCENT_FIGURES = exports.PER_UNIT_FIGURES = exports.ALL_PARTS = exports.QTY_PARTS = exports.FINE_PARTS = exports.MONEY_PARTS = exports.r6 = exports.r4 = exports.r3 = exports.r2 = exports.ONE = exports.ZERO = exports.D = void 0;
exports.resolveFactor = resolveFactor;
exports.zeroParts = zeroParts;
exports.addParts = addParts;
exports.mirrorParts = mirrorParts;
exports.scaleParts = scaleParts;
exports.convertPerUnit = convertPerUnit;
exports.mirrorBilledLines = mirrorBilledLines;
exports.emptiesBill = emptiesBill;
exports.resplitGst = resplitGst;
exports.lastSaleLine = lastSaleLine;
exports.todayPriceLine = todayPriceLine;
exports.basisOf = basisOf;
exports.basisTotals = basisTotals;
exports.mirrorCharges = mirrorCharges;
exports.roundOffFor = roundOffFor;
exports.totalsOf = totalsOf;
exports.everyChargeBack = everyChargeBack;
exports.cashDiscShare = cashDiscShare;
const client_1 = require("@prisma/client");
const D = (v) => new client_1.Prisma.Decimal(v === null || v === undefined || v === '' ? 0 : v);
exports.D = D;
exports.ZERO = (0, exports.D)(0);
exports.ONE = (0, exports.D)(1);
const HALF_UP = client_1.Prisma.Decimal.ROUND_HALF_UP;
const r2 = (v) => v.toDecimalPlaces(2, HALF_UP);
exports.r2 = r2;
const r3 = (v) => v.toDecimalPlaces(3, HALF_UP);
exports.r3 = r3;
const r4 = (v) => v.toDecimalPlaces(4, HALF_UP);
exports.r4 = r4;
const r6 = (v) => v.toDecimalPlaces(6, HALF_UP);
exports.r6 = r6;
function resolveFactor(lineFactor, unitFactor) {
    const own = (0, exports.D)(lineFactor);
    if (own.gt(0)) {
        return own;
    }
    const unit = (0, exports.D)(unitFactor);
    return unit.gt(0) ? unit : exports.ONE;
}
exports.MONEY_PARTS = [
    'grossAmt',
    'itemDiscAmt',
    'splDiscAmt',
    'schDiscAmt',
    'billSchAmt',
    'addlDisc1Amt',
    'addlDisc2Amt',
    'cashDiscAmt',
    'taxableAmt',
    'cgstAmt',
    'sgstAmt',
    'igstAmt',
    'cessAmt',
    'acessAmt',
    'cogsAmt',
];
exports.FINE_PARTS = ['netGross', 'chrgBeforeTax', 'loyaltyPv', 'loyaltyPoints'];
exports.QTY_PARTS = ['weightQty'];
exports.ALL_PARTS = [...exports.MONEY_PARTS, ...exports.FINE_PARTS, ...exports.QTY_PARTS];
const roundPart = (k, v) => exports.MONEY_PARTS.includes(k)
    ? (0, exports.r2)(v)
    : exports.FINE_PARTS.includes(k)
        ? (0, exports.r4)(v)
        : (0, exports.r3)(v);
function zeroParts() {
    return Object.fromEntries(exports.ALL_PARTS.map((k) => [k, exports.ZERO]));
}
function addParts(a, b) {
    return Object.fromEntries(exports.ALL_PARTS.map((k) => [k, a[k].plus(b[k])]));
}
exports.PER_UNIT_FIGURES = [
    'rate',
    'ratePreTax',
    'maxPrice',
    'minPrice',
    'actPrice',
    'itemDiscQty',
    'splDiscQty',
    'schDiscQty',
    'billSchQty',
    'cessPerUnit',
    'acessPerUnit',
];
exports.PERCENT_FIGURES = [
    'itemDiscPerc',
    'splDiscPerc',
    'schDiscPerc',
    'billSchPerc',
    'addlDisc1Perc',
    'addlDisc2Perc',
    'cashDiscPerc',
    'taxPerc',
    'cgstPerc',
    'sgstPerc',
    'igstPerc',
    'cessPerc',
    'acessPerc',
];
const baseOf = (l) => l.qty.times(l.factor);
exports.baseOf = baseOf;
function clampTo(share, remaining) {
    if (remaining.gte(0)) {
        return client_1.Prisma.Decimal.max(exports.ZERO, client_1.Prisma.Decimal.min(share, remaining));
    }
    return client_1.Prisma.Decimal.min(exports.ZERO, client_1.Prisma.Decimal.max(share, remaining));
}
function mirrorParts(bill, already, billBase, takeBase, empties) {
    const out = zeroParts();
    for (const k of exports.ALL_PARTS) {
        const remaining = bill[k].minus(already[k]);
        if (empties) {
            out[k] = remaining;
            continue;
        }
        const share = billBase.gt(0) ? roundPart(k, bill[k].times(takeBase).dividedBy(billBase)) : exports.ZERO;
        out[k] = clampTo(share, remaining);
    }
    return out;
}
function scaleParts(src, srcBase, takeBase) {
    const out = zeroParts();
    if (srcBase.lte(0)) {
        return out;
    }
    for (const k of exports.ALL_PARTS) {
        out[k] = roundPart(k, src[k].times(takeBase).dividedBy(srcBase));
    }
    return out;
}
function convertPerUnit(perUnit, billFactor, askFactor) {
    const same = billFactor.equals(askFactor);
    return Object.fromEntries(exports.PER_UNIT_FIGURES.map((k) => {
        const v = perUnit[k];
        if (v === null || same || billFactor.lte(0)) {
            return [k, v];
        }
        return [k, (0, exports.r4)(v.times(askFactor).dividedBy(billFactor))];
    }));
}
function lineTotals(parts) {
    const discAmt = parts.itemDiscAmt
        .plus(parts.splDiscAmt)
        .plus(parts.schDiscAmt)
        .plus(parts.billSchAmt)
        .plus(parts.addlDisc1Amt)
        .plus(parts.addlDisc2Amt)
        .plus(parts.cashDiscAmt);
    const taxAmt = parts.cgstAmt
        .plus(parts.sgstAmt)
        .plus(parts.igstAmt)
        .plus(parts.cessAmt)
        .plus(parts.acessAmt);
    return { discAmt, taxAmt, netAmt: parts.taxableAmt.plus(taxAmt) };
}
const NO_PER_UNIT = () => Object.fromEntries(exports.PER_UNIT_FIGURES.map((k) => [k, null]));
const NO_PERCENT = () => Object.fromEntries(exports.PERCENT_FIGURES.map((k) => [k, exports.ZERO]));
function mirrorBilledLines(bill, billLines, prior, asks) {
    const byId = new Map(billLines.map((l) => [l.billItemId, l]));
    const running = new Map();
    const ordered = [...asks].sort((a, b) => a.lineNo - b.lineNo || a.splitNo - b.splitNo);
    const out = [];
    for (const ask of ordered) {
        const bl = byId.get(ask.billItemId);
        if (!bl) {
            continue;
        }
        const billBase = (0, exports.baseOf)(bl);
        const before = prior.get(bl.billItemId) ?? { base: exports.ZERO, parts: zeroParts() };
        const ours = running.get(bl.billItemId) ?? { base: exports.ZERO, parts: zeroParts() };
        const already = addParts(before.parts, ours.parts);
        const leftBase = billBase.minus(before.base).minus(ours.base);
        const askBase = ask.qty.times(ask.factor);
        const overQty = askBase.gt(leftBase);
        const empties = !overQty && askBase.gt(0) && askBase.equals(leftBase);
        const parts = overQty || askBase.lte(0)
            ? zeroParts()
            : mirrorParts(bl.parts, already, billBase, askBase, empties);
        running.set(bl.billItemId, {
            base: ours.base.plus(overQty ? exports.ZERO : askBase),
            parts: addParts(ours.parts, parts),
        });
        const totals = lineTotals(parts);
        out.push({
            index: ask.index,
            lineNo: ask.lineNo,
            splitNo: ask.splitNo,
            billItemId: bl.billItemId,
            billAccYear: bl.accYear,
            billLineNo: bl.lineNo,
            itemId: bl.itemId,
            itemUnitId: ask.itemUnitId,
            qty: ask.qty,
            factor: ask.factor,
            qtyBase: askBase,
            parts,
            perUnit: convertPerUnit(bl.perUnit, bl.factor, ask.factor),
            percent: { ...bl.percent },
            copy: { ...bl.copy },
            ...totals,
            costPerBase: bl.parts.cogsAmt.gt(0) && billBase.gt(0) ? bl.parts.cogsAmt.dividedBy(billBase) : null,
            takesRemainder: empties,
            rateSource: {
                kind: 'BILL',
                sbRefno: bill.refno,
                sbDate: bill.date,
                billItemId: bl.billItemId,
                accYear: bl.accYear,
            },
            overQty,
            leftBaseBefore: leftBase,
        });
    }
    return out;
}
function emptiesBill(billLines, prior, lines) {
    if (billLines.length === 0 || lines.some((l) => l.overQty)) {
        return false;
    }
    const now = new Map();
    for (const l of lines) {
        if (l.billItemId) {
            now.set(l.billItemId, (now.get(l.billItemId) ?? exports.ZERO).plus(l.qtyBase));
        }
    }
    return billLines.every((bl) => (0, exports.baseOf)(bl)
        .minus(prior.get(bl.billItemId)?.base ?? exports.ZERO)
        .minus(now.get(bl.billItemId) ?? exports.ZERO)
        .lte(0));
}
function resplitGst(parts, percent, nature) {
    const inter = nature === 'INTER';
    const misplaced = inter
        ? parts.cgstAmt.plus(parts.sgstAmt).gt(0) || percent.cgstPerc.plus(percent.sgstPerc).gt(0)
        : parts.igstAmt.gt(0) || percent.igstPerc.gt(0);
    if (!misplaced) {
        return;
    }
    const rate = percent.taxPerc.gt(0)
        ? percent.taxPerc
        : percent.cgstPerc.plus(percent.sgstPerc).plus(percent.igstPerc);
    if (inter) {
        percent.igstPerc = rate;
        percent.cgstPerc = exports.ZERO;
        percent.sgstPerc = exports.ZERO;
        parts.igstAmt = (0, exports.r2)(parts.taxableAmt.times(rate).dividedBy(100));
        parts.cgstAmt = exports.ZERO;
        parts.sgstAmt = exports.ZERO;
    }
    else {
        const half = rate.dividedBy(2);
        percent.cgstPerc = half;
        percent.sgstPerc = half;
        percent.igstPerc = exports.ZERO;
        parts.cgstAmt = (0, exports.r2)(parts.taxableAmt.times(half).dividedBy(100));
        parts.sgstAmt = (0, exports.r2)(parts.taxableAmt.times(half).dividedBy(100));
        parts.igstAmt = exports.ZERO;
    }
}
function lastSaleLine(source, sourceBill, ask, nature) {
    const askBase = ask.qty.times(ask.factor);
    const parts = scaleParts(source.parts, (0, exports.baseOf)(source), askBase);
    parts.cogsAmt = exports.ZERO;
    parts.loyaltyPv = exports.ZERO;
    parts.loyaltyPoints = exports.ZERO;
    const percent = { ...source.percent };
    if (nature) {
        resplitGst(parts, percent, nature);
    }
    const totals = lineTotals(parts);
    return {
        index: ask.index,
        lineNo: ask.lineNo,
        splitNo: ask.splitNo,
        billItemId: null,
        billAccYear: null,
        billLineNo: null,
        itemId: ask.itemId,
        itemUnitId: ask.itemUnitId,
        qty: ask.qty,
        factor: ask.factor,
        qtyBase: askBase,
        parts,
        perUnit: convertPerUnit(source.perUnit, source.factor, ask.factor),
        percent,
        copy: {
            ...source.copy,
            lotId: null,
            batchNo: null,
            batchDate: null,
            expiryDate: null,
            serialNo: null,
            promoUsageId: null,
            qtyPriceId: null,
            schemeId: null,
            schemeName: null,
            isFree: false,
            freeType: null,
        },
        ...totals,
        costPerBase: null,
        takesRemainder: false,
        rateSource: {
            kind: 'LAST_SALE',
            sbRefno: sourceBill.refno,
            sbDate: sourceBill.date,
            billItemId: source.billItemId,
            accYear: source.accYear,
        },
        overQty: false,
        leftBaseBefore: null,
    };
}
function todayPriceLine(price, ask, nature) {
    const askBase = ask.qty.times(ask.factor);
    const parts = zeroParts();
    parts.grossAmt = (0, exports.r2)(ask.qty.times(price.rateWot));
    parts.netGross = (0, exports.r4)(parts.grossAmt);
    parts.taxableAmt = parts.grossAmt;
    const percent = NO_PERCENT();
    percent.taxPerc = price.taxPerc;
    percent.cessPerc = price.cessPerc;
    if (nature === 'INTER') {
        percent.igstPerc = price.taxPerc;
        parts.igstAmt = (0, exports.r2)(parts.taxableAmt.times(price.taxPerc).dividedBy(100));
    }
    else {
        const half = price.taxPerc.dividedBy(2);
        percent.cgstPerc = half;
        percent.sgstPerc = half;
        parts.cgstAmt = (0, exports.r2)(parts.taxableAmt.times(half).dividedBy(100));
        parts.sgstAmt = (0, exports.r2)(parts.taxableAmt.times(half).dividedBy(100));
    }
    parts.cessAmt = (0, exports.r2)(parts.taxableAmt.times(price.cessPerc).dividedBy(100));
    const perUnit = NO_PER_UNIT();
    perUnit.rate = (0, exports.r4)(price.rate);
    perUnit.ratePreTax = (0, exports.r4)(price.rateWot);
    return {
        index: ask.index,
        lineNo: ask.lineNo,
        splitNo: ask.splitNo,
        billItemId: null,
        billAccYear: null,
        billLineNo: null,
        itemId: ask.itemId,
        itemUnitId: ask.itemUnitId,
        qty: ask.qty,
        factor: ask.factor,
        qtyBase: askBase,
        parts,
        perUnit,
        percent,
        copy: {
            hsnCode: price.hsnCode,
            taxId: price.taxId,
            isTaxIncl: false,
            isFree: false,
            freeType: null,
            isService: false,
            schemeId: null,
            schemeName: null,
            priceLevel: price.priceLevel,
            eanCode: null,
            lotId: null,
            batchNo: null,
            batchDate: null,
            expiryDate: null,
            serialNo: null,
            salesmanId: null,
            promoUsageId: null,
            qtyPriceId: null,
            size: null,
            sizeUom: null,
        },
        ...lineTotals(parts),
        costPerBase: null,
        takesRemainder: false,
        rateSource: {
            kind: 'TODAY_PRICE',
            sbRefno: null,
            sbDate: null,
            billItemId: null,
            accYear: null,
        },
        overQty: false,
        leftBaseBefore: null,
    };
}
const GST_KEYS = ['cgst', 'sgst', 'igst', 'cess'];
const zeroFigures = () => ({
    amount: exports.ZERO,
    cgst: exports.ZERO,
    sgst: exports.ZERO,
    igst: exports.ZERO,
    cess: exports.ZERO,
});
exports.zeroFigures = zeroFigures;
function basisOf(method) {
    const m = (method ?? '').toUpperCase();
    if (m === 'QTY' || m === 'NET_QTY') {
        return 'QTY';
    }
    if (m === 'KG' || m === 'QTL' || m === 'TON') {
        return 'WEIGHT';
    }
    return 'VALUE';
}
function basisTotals(lines) {
    let qtyBase = exports.ZERO;
    let weight = exports.ZERO;
    let value = exports.ZERO;
    for (const l of lines) {
        qtyBase = qtyBase.plus(l.qtyBase);
        weight = weight.plus(l.parts.weightQty);
        value = value.plus(l.parts.netGross.gt(0) ? l.parts.netGross : l.parts.taxableAmt);
    }
    return { qtyBase, weight, value };
}
function pickBasis(basis, t) {
    return basis === 'QTY' ? t.qtyBase : basis === 'WEIGHT' ? t.weight : t.value;
}
function mirrorCharges(input) {
    return input.charges.map((c) => {
        const kind = c.beforeTax ? 'IN_LINES' : 'CARRIED';
        const sign = c.type === 'DEDUCT' ? -1 : 1;
        let basis = basisOf(c.method);
        if (pickBasis(basis, input.billBasis).lte(0)) {
            basis = input.billBasis.value.gt(0) ? 'VALUE' : 'QTY';
        }
        const cap = client_1.Prisma.Decimal.max(exports.ZERO, c.onBill.amount.minus(c.backBefore.amount));
        const billBasis = pickBasis(basis, input.billBasis);
        const retBasis = pickBasis(basis, input.returnBasis);
        const proposed = input.emptiesBill
            ? cap
            : billBasis.gt(0)
                ? client_1.Prisma.Decimal.min(cap, (0, exports.r2)(c.onBill.amount.times(retBasis).dividedBy(billBasis)))
                : exports.ZERO;
        const ask = input.asks.get(c.cdId);
        const role = (c.role ?? '').toUpperCase();
        const manual = kind === 'CARRIED' &&
            sign > 0 &&
            ((role === 'FREIGHT' && input.manual.freight) ||
                ((role === 'LOADING' || role === 'UNLOADING') && input.manual.loading));
        const giveBack = kind === 'IN_LINES' || sign < 0 ? true : (ask?.giveBack ?? input.defaultGiveBack);
        const typed = manual && ask?.amount !== undefined && ask?.amount !== null ? ask.amount : null;
        const overCap = typed !== null && typed.gt(cap);
        const amount = !giveBack ? exports.ZERO : typed !== null ? (overCap ? cap : (0, exports.r2)(typed)) : proposed;
        const back = (0, exports.zeroFigures)();
        back.amount = amount;
        const full = amount.equals(cap) && cap.gt(0);
        for (const k of GST_KEYS) {
            const left = client_1.Prisma.Decimal.max(exports.ZERO, c.onBill[k].minus(c.backBefore[k]));
            back[k] = full
                ? left
                : c.onBill.amount.gt(0)
                    ? client_1.Prisma.Decimal.min(left, (0, exports.r2)(c.onBill[k].times(amount).dividedBy(c.onBill.amount)))
                    : exports.ZERO;
        }
        return {
            bill: c,
            kind,
            sign,
            basis,
            giveBack,
            manual,
            cap,
            proposed,
            back,
            takesRemainder: input.emptiesBill && full,
            overCap,
            typed: typed !== null && giveBack,
        };
    });
}
const signed = (c, v) => (c.sign < 0 ? v.negated() : v);
exports.signed = signed;
function roundOffFor(subtotal, step) {
    if (step.lte(0)) {
        return exports.ZERO;
    }
    const rounded = subtotal.dividedBy(step).toDecimalPlaces(0, HALF_UP).times(step);
    return (0, exports.r2)(rounded.minus(subtotal));
}
function totalsOf(input) {
    const sum = (f) => input.lines.reduce((t, l) => t.plus(f(l)), exports.ZERO);
    const carried = input.charges.filter((c) => c.kind === 'CARRIED');
    const csum = (f) => carried.reduce((t, c) => t.plus(f(c)), exports.ZERO);
    const lineTaxable = sum((l) => l.parts.taxableAmt);
    const taxable = lineTaxable.plus(csum((c) => (c.bill.taxApl ? (0, exports.signed)(c, c.back.amount) : exports.ZERO)));
    const cgst = sum((l) => l.parts.cgstAmt).plus(csum((c) => (0, exports.signed)(c, c.back.cgst)));
    const sgst = sum((l) => l.parts.sgstAmt).plus(csum((c) => (0, exports.signed)(c, c.back.sgst)));
    const igst = sum((l) => l.parts.igstAmt).plus(csum((c) => (0, exports.signed)(c, c.back.igst)));
    const cess = sum((l) => l.parts.cessAmt).plus(csum((c) => (0, exports.signed)(c, c.back.cess)));
    const acess = sum((l) => l.parts.acessAmt);
    const goods = sum((l) => l.netAmt);
    const chargesNet = csum((c) => (0, exports.signed)(c, c.back.amount.plus(c.back.cgst).plus(c.back.sgst).plus(c.back.igst).plus(c.back.cess)));
    const byRole = (role) => csum((c) => ((c.bill.role ?? '').toUpperCase() === role ? (0, exports.signed)(c, c.back.amount) : exports.ZERO));
    const subtotal = goods.plus(chargesNet).minus(input.cashDisc);
    const takesBillRoundOff = input.billRoundOffLeft !== null && !subtotal.isZero();
    const roundOff = takesBillRoundOff
        ? input.billRoundOffLeft
        : roundOffFor(subtotal, input.roundOffStep);
    const itemDisc = sum((l) => l.parts.itemDiscAmt);
    const splDisc = sum((l) => l.parts.splDiscAmt);
    const schDisc = sum((l) => l.parts.schDiscAmt);
    const billSchDisc = sum((l) => l.parts.billSchAmt);
    return {
        gross: sum((l) => l.parts.grossAmt),
        itemDisc,
        splDisc,
        schDisc,
        billSchDisc,
        discAmt: sum((l) => l.discAmt).plus(input.cashDisc),
        cashDisc: input.cashDisc,
        taxable,
        cgst,
        sgst,
        igst,
        cess,
        acess,
        tax: cgst.plus(sgst).plus(igst).plus(cess).plus(acess),
        goods,
        chargesNet,
        otherAmt: csum((c) => (c.bill.taxApl ? exports.ZERO : (0, exports.signed)(c, c.back.amount))),
        freight: byRole('FREIGHT'),
        load: byRole('LOADING'),
        unload: byRole('UNLOADING'),
        roundOff,
        creditNote: subtotal.plus(roundOff),
        qty: sum((l) => l.qty),
        weight: sum((l) => l.parts.weightQty),
        cogs: sum((l) => l.parts.cogsAmt),
        takesBillRoundOff,
    };
}
function everyChargeBack(charges) {
    return charges.filter((c) => c.kind === 'CARRIED').every((c) => c.back.amount.equals(c.cap));
}
function cashDiscShare(input) {
    const left = client_1.Prisma.Decimal.max(exports.ZERO, input.billCashDisc.minus(input.priorCashDisc));
    if (input.emptiesBill) {
        return left;
    }
    if (input.billLineTaxable.lte(0)) {
        return exports.ZERO;
    }
    return client_1.Prisma.Decimal.min(left, (0, exports.r2)(input.billCashDisc.times(input.returnLineTaxable).dividedBy(input.billLineTaxable)));
}
const n = (v) => v === null || v === undefined ? null : Number(v.toString());
exports.n = n;
//# sourceMappingURL=sale-return-money.js.map