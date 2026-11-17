"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFUND_REF_TYPES = exports.REFUND_TENDER_TYPES = void 0;
exports.roundPoints = roundPoints;
exports.sharesOf = sharesOf;
exports.loyaltyBackOf = loyaltyBackOf;
exports.proRataBack = proRataBack;
exports.refundableOf = refundableOf;
exports.checkRefund = checkRefund;
exports.startTenders = startTenders;
exports.proposeAdjust = proposeAdjust;
exports.checkAdjust = checkAdjust;
exports.defaultSettleMode = defaultSettleMode;
exports.schemeShorts = schemeShorts;
exports.buildSettlement = buildSettlement;
exports.settlementJson = settlementJson;
const client_1 = require("@prisma/client");
const posting_types_1 = require("../posting/types/posting.types");
const sale_return_money_1 = require("./sale-return-money");
exports.REFUND_TENDER_TYPES = [1, 3, 6];
exports.REFUND_REF_TYPES = [3, 6];
const TYPE = { CASH: 1, LOYALTY: 10, VOUCHER: 11 };
const ON_ACCOUNT = [7, 8, 9];
const min = (a, b) => client_1.Prisma.Decimal.min(a, b);
const max0 = (a) => client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, a);
function roundPoints(v, rounding, decimals) {
    const dp = Math.max(0, Math.min(4, Math.trunc(decimals)));
    switch ((rounding ?? 'ROUND').toUpperCase()) {
        case 'NONE':
            return (0, sale_return_money_1.r4)(v);
        case 'FLOOR':
            return v.toDecimalPlaces(dp, client_1.Prisma.Decimal.ROUND_FLOOR);
        case 'CEIL':
            return v.toDecimalPlaces(dp, client_1.Prisma.Decimal.ROUND_CEIL);
        default:
            return v.toDecimalPlaces(dp, client_1.Prisma.Decimal.ROUND_HALF_UP);
    }
}
function sharesOf(input) {
    const none = { pointsBackAmt: sale_return_money_1.ZERO, points: sale_return_money_1.ZERO, rate: sale_return_money_1.ZERO, voucherShare: sale_return_money_1.ZERO };
    if (input.billAmt.lte(0) || input.creditNote.lte(0)) {
        return none;
    }
    const share = (paid, prior, room) => {
        const left = max0(paid.minus(prior));
        const want = input.emptiesBill
            ? left
            : min(left, (0, sale_return_money_1.r2)(input.creditNote.times(paid).dividedBy(input.billAmt)));
        return min(want, max0(room));
    };
    const rate = input.billPointsUnits.gt(0)
        ? input.billPoints.dividedBy(input.billPointsUnits)
        : sale_return_money_1.ZERO;
    let pointsBackAmt = share(input.billPoints, input.priorPointsBackAmt, input.creditNote);
    let points = rate.gt(0) ? (0, sale_return_money_1.r4)(pointsBackAmt.dividedBy(rate)) : sale_return_money_1.ZERO;
    if (rate.gt(0) && pointsBackAmt.gt(0) && input.pointsDecimals != null) {
        const leftMoney = max0(input.billPoints.minus(input.priorPointsBackAmt));
        const leftUnits = max0(input.billPointsUnits.minus(input.priorPoints ?? sale_return_money_1.ZERO));
        if (input.emptiesBill && pointsBackAmt.equals(leftMoney)) {
            points = leftUnits;
        }
        else {
            const dp = Math.max(0, Math.min(4, Math.trunc(input.pointsDecimals)));
            const step = new client_1.Prisma.Decimal(1).dividedBy(new client_1.Prisma.Decimal(10).pow(dp));
            points = min(leftUnits, pointsBackAmt.dividedBy(rate).toDecimalPlaces(dp, client_1.Prisma.Decimal.ROUND_HALF_UP));
            const cap = min(leftMoney, input.creditNote);
            while (points.gt(0) && (0, sale_return_money_1.r2)(points.times(rate)).gt(cap)) {
                points = max0(points.minus(step));
            }
            pointsBackAmt = (0, sale_return_money_1.r2)(points.times(rate));
        }
    }
    const voucherShare = share(input.billVoucher, input.priorVoucherShare, input.creditNote.minus(pointsBackAmt));
    return { pointsBackAmt, points, rate: (0, sale_return_money_1.r4)(rate), voucherShare };
}
function loyaltyBackOf(input) {
    if (input.earned.lte(0) || (input.rule?.returnMode ?? '').toUpperCase() === 'IGNORE') {
        return sale_return_money_1.ZERO;
    }
    const left = max0(input.earned.minus(input.priorReversed));
    if (input.emptiesBill) {
        return left;
    }
    if (input.billLineTaxable.lte(0)) {
        return sale_return_money_1.ZERO;
    }
    const raw = input.earned.times(client_1.Prisma.Decimal.min((0, sale_return_money_1.D)(1), max0(input.lineTaxable).dividedBy(input.billLineTaxable)));
    const rounded = input.rule ? roundPoints(raw, input.rule.rounding, input.rule.decimals) : (0, sale_return_money_1.r4)(raw);
    return min(left, rounded);
}
function proRataBack(input) {
    const left = max0(input.onBill.minus(input.prior));
    if (input.emptiesBill) {
        return left;
    }
    if (input.whole.lte(0)) {
        return sale_return_money_1.ZERO;
    }
    const raw = input.onBill.times(input.part).dividedBy(input.whole);
    return min(left, input.scale === 4 ? (0, sale_return_money_1.r4)(raw) : (0, sale_return_money_1.r2)(raw));
}
function refundableOf(input) {
    const fromNote = max0(input.creditNote.minus(input.pointsBackAmt).minus(input.voucherShare));
    return input.cap === null ? fromNote : min(fromNote, max0(input.cap));
}
function checkRefund(tenders, refundable) {
    const issues = [];
    let total = sale_return_money_1.ZERO;
    for (const t of tenders) {
        if (t.amount.lte(0)) {
            continue;
        }
        total = total.plus(t.amount);
        if (!exports.REFUND_TENDER_TYPES.includes(t.tenderTypeId)) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_REFUND_TENDER,
                message: `Refund row ${t.index + 1}: tender type ${t.tenderTypeId} — a refund goes out as cash, UPI or bank transfer only`,
                field: `tenders[${t.index}].tdTenderTypeId`,
            });
        }
        else if (exports.REFUND_REF_TYPES.includes(t.tenderTypeId) && !(t.refNo ?? '').trim()) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_REFUND_REF,
                message: `Refund row ${t.index + 1}: a UPI or bank refund needs its reference number`,
                field: `tenders[${t.index}].tdRefNo`,
            });
        }
    }
    if (total.gt(refundable)) {
        issues.push({
            level: 'REFUSE',
            code: posting_types_1.SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID,
            message: `The refund of ${total.toFixed(2)} is more than the ${refundable.toFixed(2)} this note may pay out in money`,
            field: 'tenders',
            params: { value: refundable.toFixed(2) },
        });
    }
    return issues;
}
function startTenders(billRows, refundable) {
    const rows = billRows.filter((r) => exports.REFUND_TENDER_TYPES.includes(r.tenderTypeId) && r.amount.gt(0));
    if (refundable.lte(0)) {
        return [];
    }
    if (rows.length === 0) {
        return [
            {
                tenderId: null,
                tenderTypeId: TYPE.CASH,
                name: 'Cash',
                ledgerId: null,
                amount: (0, sale_return_money_1.n)(refundable),
            },
        ];
    }
    const total = rows.reduce((t, r) => t.plus(r.amount), sale_return_money_1.ZERO);
    let left = refundable;
    return rows.map((r, i) => {
        const amount = i === rows.length - 1 ? left : min(left, (0, sale_return_money_1.r2)(refundable.times(r.amount).dividedBy(total)));
        left = left.minus(amount);
        return {
            tenderId: r.tenderId,
            tenderTypeId: r.tenderTypeId,
            name: r.name,
            ledgerId: r.ledgerId,
            amount: (0, sale_return_money_1.n)(amount),
        };
    });
}
function proposeAdjust(bills, adjustable, thisSbId) {
    let left = max0(adjustable);
    return bills.map((bill) => {
        const amount = min(left, bill.pending);
        left = left.minus(amount);
        return { bill, isThisBill: isThis(bill, thisSbId), amount };
    });
}
const isThis = (b, sbId) => !!sbId && b.srcDocType === 'SALE_BILL' && b.srcDocId === sbId;
function checkAdjust(asks, bills, adjustable, thisSbId, closed = new Map()) {
    const byId = new Map(bills.map((b) => [b.ablId, b]));
    const issues = [];
    const merged = new Map();
    let total = sale_return_money_1.ZERO;
    for (const a of asks) {
        if (a.amount.lte(0)) {
            continue;
        }
        const shut = closed.get(a.ablId);
        if (shut && !byId.has(a.ablId)) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.YEAR_LOCKED,
                message: `Adjust row ${a.index + 1}: bill ${shut.refno ?? shut.ablId} is in ${shut.ablAccYear}, a closed year — it cannot be adjusted now`,
                field: 'adjustments',
                params: { bill: shut.refno ?? '', year: shut.ablAccYear },
            });
            continue;
        }
        const bill = byId.get(a.ablId);
        if (!bill || bill.ablAccYear !== a.ablAccYear.trim()) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_ADJUST_STALE,
                message: `Adjust row ${a.index + 1}: bill ${a.ablId} is no longer an open bill of this customer`,
                field: `adjustments[${a.index}].ablId`,
            });
            continue;
        }
        if (a.dueNow !== null && !a.dueNow.equals(bill.pending)) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_ADJUST_STALE,
                message: `Adjust row ${a.index + 1}: bill ${bill.refno ?? bill.ablId} owes ${bill.pending.toFixed(2)} now, not the ${a.dueNow.toFixed(2)} shown`,
                field: `adjustments[${a.index}].dueNow`,
            });
        }
        const line = merged.get(bill.ablId) ?? {
            bill,
            isThisBill: isThis(bill, thisSbId),
            amount: sale_return_money_1.ZERO,
        };
        line.amount = line.amount.plus((0, sale_return_money_1.r2)(a.amount));
        merged.set(bill.ablId, line);
        total = total.plus((0, sale_return_money_1.r2)(a.amount));
    }
    for (const line of merged.values()) {
        if (line.amount.gt(line.bill.pending)) {
            issues.push({
                level: 'REFUSE',
                code: posting_types_1.SALES_ERROR_CODES.RETURN_ADJUST_OVER,
                message: `Bill ${line.bill.refno ?? line.bill.ablId} is given ${line.amount.toFixed(2)} but owes ${line.bill.pending.toFixed(2)}`,
                field: 'adjustments',
            });
        }
    }
    if (total.gt(adjustable)) {
        issues.push({
            level: 'REFUSE',
            code: posting_types_1.SALES_ERROR_CODES.RETURN_ADJUST_OVER,
            message: `The split adjusts ${total.toFixed(2)}, more than the ${adjustable.toFixed(2)} this note can adjust`,
            field: 'adjustments',
        });
    }
    return { lines: [...merged.values()], issues };
}
function defaultSettleMode(setting, ctx) {
    const s = (setting ?? 'ADJUST').toUpperCase();
    if (s === 'ADVANCE') {
        return 'ADVANCE';
    }
    return ctx.adjustable && ctx.billDue.gt(0) ? 'ADJUST' : 'ADVANCE';
}
function schemeShorts(money, schemes) {
    if (money.emptiesBill || money.billLines.length === 0) {
        return [];
    }
    const back = new Map();
    for (const l of money.lines) {
        if (l.billItemId && !l.overQty) {
            back.set(l.billItemId, (back.get(l.billItemId) ?? sale_return_money_1.ZERO).plus(l.qtyBase));
        }
    }
    const leftShare = (billItemId, base) => {
        if (base.lte(0)) {
            return sale_return_money_1.ZERO;
        }
        const gone = (money.prior.get(billItemId)?.base ?? sale_return_money_1.ZERO).plus(back.get(billItemId) ?? sale_return_money_1.ZERO);
        return max0(base.minus(gone)).dividedBy(base);
    };
    const out = [];
    for (const scheme of schemes.values()) {
        const lines = money.billLines.filter((l) => l.copy.schemeId === scheme.prmId);
        if (lines.length === 0) {
            continue;
        }
        const paid = lines.filter((l) => !l.copy.isFree);
        const byValue = (scheme.applyOn ?? '').toUpperCase() === 'BILL_AMOUNT';
        const valueOf = (l) => scheme.includeTax ? l.netAmt : l.parts.taxableAmt;
        const pool = byValue ? money.billLines.filter((l) => !l.copy.isFree) : paid;
        const before = pool.reduce((t, l) => t.plus(byValue ? valueOf(l) : (0, sale_return_money_1.baseOf)(l)), sale_return_money_1.ZERO);
        const after = pool.reduce((t, l) => t.plus((byValue ? valueOf(l) : (0, sale_return_money_1.baseOf)(l)).times(leftShare(l.billItemId, (0, sale_return_money_1.baseOf)(l)))), sale_return_money_1.ZERO);
        const floor = (() => {
            const lowest = scheme.slabs.length
                ? scheme.slabs.reduce((m, s) => (s.exceeds.lt(m) ? s.exceeds : m), scheme.slabs[0].exceeds)
                : null;
            const minimum = byValue ? scheme.minBillAmount : scheme.minQty;
            return { lowest, minimum };
        })();
        const reaches = (x) => (floor.lowest === null || x.gt(floor.lowest)) &&
            (floor.minimum.lte(0) || x.gte(floor.minimum));
        if (floor.lowest === null && floor.minimum.lte(0)) {
            continue;
        }
        if (!reaches(before) || reaches(after)) {
            continue;
        }
        let kept = sale_return_money_1.ZERO;
        for (const l of paid) {
            kept = kept.plus(l.parts.schDiscAmt.plus(l.parts.billSchAmt).times(leftShare(l.billItemId, (0, sale_return_money_1.baseOf)(l))));
        }
        for (const l of lines.filter((x) => x.copy.isFree)) {
            const perBase = l.factor.gt(0)
                ? (l.perUnit.ratePreTax ?? l.perUnit.rate ?? l.perUnit.actPrice ?? sale_return_money_1.ZERO).dividedBy(l.factor)
                : sale_return_money_1.ZERO;
            kept = kept.plus(perBase.times((0, sale_return_money_1.baseOf)(l)).times(leftShare(l.billItemId, (0, sale_return_money_1.baseOf)(l))));
        }
        kept = (0, sale_return_money_1.r2)(kept);
        if (kept.lte(0)) {
            continue;
        }
        out.push({
            schemeId: scheme.prmId,
            kind: `${scheme.applyOn ?? ''}/${scheme.benefit ?? ''}`,
            keptValue: kept,
            text: `${scheme.name ?? scheme.code ?? 'Scheme'}: after this return the bill has ` +
                `${byValue ? (0, sale_return_money_1.r2)(after).toFixed(2) : (0, sale_return_money_1.r3)(after).toString()} left, below the scheme's ` +
                `${byValue ? 'amount' : 'qty'}; the customer keeps ${kept.toFixed(2)} of its benefit`,
        });
    }
    return out;
}
async function buildSettlement(reader, c, money, input) {
    const issues = [];
    const mode = (input.mode ?? 'ADJUST').toUpperCase() || 'ADJUST';
    const creditNote = money.totals.creditNote;
    const bill = money.bill;
    const prior = money.priorHeader;
    const lineTaxable = money.lines.reduce((t, l) => t.plus(l.parts.taxableAmt), sale_return_money_1.ZERO);
    const billLineTaxable = money.billLines.reduce((t, l) => t.plus(l.parts.taxableAmt), sale_return_money_1.ZERO);
    let shares = { pointsBackAmt: sale_return_money_1.ZERO, points: sale_return_money_1.ZERO, rate: sale_return_money_1.ZERO, voucherShare: sale_return_money_1.ZERO };
    let paidInMoney = sale_return_money_1.ZERO;
    let billRows = [];
    let agentCommBack = sale_return_money_1.ZERO;
    let loyaltyReverse = sale_return_money_1.ZERO;
    if (bill && prior) {
        billRows = await reader.billTenderRows(c, bill);
        const rules = await reader.billLoyaltyRules(c, bill);
        const sumOf = (types) => billRows
            .filter((r) => types.includes(r.tenderTypeId))
            .reduce((t, r) => t.plus(r.amount), sale_return_money_1.ZERO);
        const points = sumOf([TYPE.LOYALTY]);
        const units = billRows
            .filter((r) => r.tenderTypeId === TYPE.LOYALTY)
            .reduce((t, r) => t.plus(r.unitsUsed), sale_return_money_1.ZERO);
        paidInMoney = billRows
            .filter((r) => ![TYPE.LOYALTY, TYPE.VOUCHER, ...ON_ACCOUNT].includes(r.tenderTypeId))
            .reduce((t, r) => t.plus(r.amount), sale_return_money_1.ZERO);
        shares = sharesOf({
            creditNote,
            billAmt: bill.billAmt,
            billPoints: points,
            billPointsUnits: units,
            billVoucher: sumOf([TYPE.VOUCHER]),
            priorPointsBackAmt: prior.pointsBackAmt,
            priorVoucherShare: prior.voucherShare,
            emptiesBill: money.emptiesBill,
            pointsDecimals: rules.redeem?.decimals ?? null,
            priorPoints: prior.pointsBack,
        });
        agentCommBack = proRataBack({
            onBill: bill.agentCommAmt,
            prior: prior.agentComm,
            part: lineTaxable,
            whole: billLineTaxable,
            emptiesBill: money.emptiesBill,
        });
        loyaltyReverse = loyaltyBackOf({
            earned: bill.loyaltyEarnPoints,
            priorReversed: prior.loyaltyReversed,
            lineTaxable,
            billLineTaxable,
            emptiesBill: money.emptiesBill,
            rule: rules.earn,
        });
    }
    const adjustable = !!bill && bill.branchId === input.branchId;
    if (mode === 'ADJUST' && !adjustable) {
        issues.push({
            level: 'REFUSE',
            code: posting_types_1.SALES_ERROR_CODES.RETURN_SETTLE_MODE,
            message: bill
                ? "This return is against another branch's bill — settle it by credit note or refund"
                : 'ADJUST needs a bill to adjust against — this return is not against a bill',
            field: 'srSettleMode',
        });
    }
    let adjust = null;
    let refund = null;
    const afterShares = max0(creditNote.minus(shares.pointsBackAmt));
    const zeroNote = creditNote.isZero();
    if (zeroNote && mode === 'CASH') {
        issues.push(...checkRefund(input.tenders, sale_return_money_1.ZERO));
    }
    if (!zeroNote && mode === 'ADJUST' && adjustable && input.custId) {
        const all = await reader.openBills(c, {
            companyId: input.companyId,
            branchId: input.branchId,
            partyId: input.custId,
            firstSbId: bill.sbId,
            sort: input.billSort,
            lock: input.lock,
            addBack: input.unwound?.bills ?? null,
        });
        const shut = await reader.closedYears(c, input.companyId, all.map((b) => b.ablAccYear));
        const bills = all.filter((b) => !shut.has(b.ablAccYear));
        const closed = new Map(all.filter((b) => shut.has(b.ablAccYear)).map((b) => [b.ablId, b]));
        let lines;
        if (input.adjustments) {
            const checked = checkAdjust(input.adjustments, bills, afterShares, bill.sbId, closed);
            issues.push(...checked.issues);
            const named = new Map(checked.lines.map((l) => [l.bill.ablId, l]));
            lines = bills.map((b) => named.get(b.ablId) ?? { bill: b, isThisBill: isThis(b, bill.sbId), amount: sale_return_money_1.ZERO });
        }
        else {
            lines = proposeAdjust(bills, afterShares, bill.sbId);
        }
        const adjusted = lines.reduce((t, l) => t.plus(l.amount), sale_return_money_1.ZERO);
        adjust = {
            lines,
            adjustable: afterShares,
            adjusted,
            leftAsCredit: max0(afterShares.minus(adjusted)),
            proposed: !input.adjustments,
        };
    }
    if (!zeroNote && mode === 'CASH') {
        const receivedLater = bill && prior ? await reader.receivedLater(c, bill) : sale_return_money_1.ZERO;
        paidInMoney = paidInMoney.plus(receivedLater);
        const cap = bill && prior ? max0(paidInMoney.minus(prior.refund)) : null;
        const refundable = refundableOf({
            creditNote,
            pointsBackAmt: shares.pointsBackAmt,
            voucherShare: shares.voucherShare,
            cap,
        });
        issues.push(...checkRefund(input.tenders, refundable));
        const refunded = input.tenders
            .filter((t) => exports.REFUND_TENDER_TYPES.includes(t.tenderTypeId))
            .reduce((t, x) => t.plus(max0(x.amount)), sale_return_money_1.ZERO);
        refund = {
            paidInMoney,
            receivedLater,
            refundedBefore: prior?.refund ?? sale_return_money_1.ZERO,
            cap,
            refundable,
            tenders: [...input.tenders],
            refunded: min(refunded, afterShares),
            cashOut: input.tenders
                .filter((t) => t.tenderTypeId === TYPE.CASH)
                .reduce((t, x) => t.plus(max0(x.amount)), sale_return_money_1.ZERO),
            leftAsCredit: max0(afterShares.minus(refunded)),
            start: startTenders(billRows, refundable),
        };
    }
    const credited = creditNote
        .minus(shares.pointsBackAmt)
        .minus(refund?.refunded ?? sale_return_money_1.ZERO)
        .minus(adjust?.adjusted ?? sale_return_money_1.ZERO);
    const schemeIds = money.billLines.map((l) => l.copy.schemeId).filter((x) => !!x);
    const promoCheck = schemeIds.length
        ? schemeShorts(money, await reader.schemes(c, schemeIds))
        : [];
    for (const s of promoCheck) {
        issues.push({
            level: 'WARN',
            code: posting_types_1.SALES_ERROR_CODES.RETURN_SCHEME_SHORT,
            message: s.text,
            field: 'items',
            params: { value: s.keptValue.toFixed(2) },
        });
    }
    let customerBalance = null;
    if (input.custId) {
        const unwound = input.unwound && input.unwound.partyId === input.custId ? input.unwound.balance : sale_return_money_1.ZERO;
        const before = (await reader.customerBalance(c, input.companyId, input.custId)).plus(unwound);
        customerBalance = {
            before,
            after: before
                .minus(creditNote)
                .plus(refund?.refunded ?? sale_return_money_1.ZERO)
                .plus(shares.pointsBackAmt),
        };
    }
    return {
        mode,
        creditNote,
        shares,
        memberId: bill?.loyaltyMemberId ?? null,
        agentCommBack,
        loyaltyReverse,
        adjust,
        refund,
        credited,
        customerBalance,
        promoCheck,
        issues,
    };
}
function settlementJson(p) {
    return {
        mode: p.mode,
        creditNote: (0, sale_return_money_1.n)(p.creditNote),
        pointsBackAmt: (0, sale_return_money_1.n)(p.shares.pointsBackAmt),
        voucherShare: (0, sale_return_money_1.n)(p.shares.voucherShare),
        credited: (0, sale_return_money_1.n)(p.credited),
        adjust: p.adjust
            ? {
                proposed: p.adjust.proposed,
                adjustable: (0, sale_return_money_1.n)(p.adjust.adjustable),
                adjusted: (0, sale_return_money_1.n)(p.adjust.adjusted),
                leftAsCredit: (0, sale_return_money_1.n)(p.adjust.leftAsCredit),
                bills: p.adjust.lines.map((l) => ({
                    ablId: l.bill.ablId,
                    ablAccYear: l.bill.ablAccYear,
                    refno: l.bill.refno,
                    billType: l.bill.billType,
                    srcDocType: l.bill.srcDocType,
                    srcDocId: l.bill.srcDocId,
                    srcAccYear: l.bill.srcAccYear,
                    docDate: l.bill.docDate,
                    dueDate: l.bill.dueDate,
                    billAmount: (0, sale_return_money_1.n)(l.bill.billAmount),
                    dueNow: (0, sale_return_money_1.n)(l.bill.pending),
                    adjustNow: (0, sale_return_money_1.n)(l.amount),
                    dueAfter: (0, sale_return_money_1.n)(l.bill.pending.minus(l.amount)),
                    isThisBill: l.isThisBill,
                })),
            }
            : null,
        refund: p.refund
            ? {
                paidInMoney: (0, sale_return_money_1.n)(p.refund.paidInMoney),
                receivedLater: (0, sale_return_money_1.n)(p.refund.receivedLater),
                refundedBefore: (0, sale_return_money_1.n)(p.refund.refundedBefore),
                cap: (0, sale_return_money_1.n)(p.refund.cap),
                refundable: (0, sale_return_money_1.n)(p.refund.refundable),
                refunded: (0, sale_return_money_1.n)(p.refund.refunded),
                cashOut: (0, sale_return_money_1.n)(p.refund.cashOut),
                leftAsCredit: (0, sale_return_money_1.n)(p.refund.leftAsCredit),
                startTenders: p.refund.start,
            }
            : null,
    };
}
//# sourceMappingURL=sale-return-settlement.js.map