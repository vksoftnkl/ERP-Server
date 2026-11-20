"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileReceiptAdjustReason = exports.billKeyOf = exports.MOBILE_ROUNDOFF_MAX = void 0;
exports.assertPhoneLimits = assertPhoneLimits;
exports.reconcilePhonePlan = reconcilePhonePlan;
exports.adjustedAgainstPlan = adjustedAgainstPlan;
const client_1 = require("@prisma/client");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const ppd_slab_1 = require("../../modules/accountsModule/receipt/ppd-slab");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const ZERO = new client_1.Prisma.Decimal(0);
exports.MOBILE_ROUNDOFF_MAX = new client_1.Prisma.Decimal('0.99');
const billKeyOf = (row) => `${row.billId}|${row.billAccYear.trim()}`;
exports.billKeyOf = billKeyOf;
const sumOf = (values) => values.reduce((total, value) => total.plus(value), ZERO);
const settles = (line) => line.amount.plus(line.discount).plus(line.roundoff);
function assertPhoneLimits(lines, billsNow, receiptDate, slabs) {
    lines.forEach((line, index) => {
        const bill = billsNow.get((0, exports.billKeyOf)(line));
        const refno = bill?.docRefno ?? line.billId;
        if (line.roundoff.greaterThan(exports.MOBILE_ROUNDOFF_MAX)) {
            (0, module_shared_utils_1.throwUnprocessable)('Round-off too big', [
                {
                    field: `allocations.${index}.roundoff`,
                    code: mobile_error_codes_1.MobileErrorCode.RECEIPT_ROUNDOFF_TOO_BIG,
                    message: `Round-off ${line.roundoff.toFixed(2)} on bill ${refno} is more than ` +
                        `${exports.MOBILE_ROUNDOFF_MAX.toFixed(2)}. A phone rounds off paise only.`,
                },
            ]);
        }
        if (!bill || !bill.live || line.discount.lessThanOrEqualTo(0)) {
            return;
        }
        const limit = (0, ppd_slab_1.suggestPpdDiscount)({
            docDate: bill.docDate,
            onDate: receiptDate,
            pendingAmount: client_1.Prisma.Decimal.max(bill.pending, settles(line)),
            slabs,
        });
        if (line.discount.greaterThan(limit)) {
            (0, module_shared_utils_1.throwUnprocessable)('Discount above the prompt-payment slab', [
                {
                    field: `allocations.${index}.discount`,
                    code: mobile_error_codes_1.MobileErrorCode.RECEIPT_DISCOUNT_ABOVE_PPD,
                    message: `Discount ${line.discount.toFixed(2)} on bill ${refno} is more than the ` +
                        `${limit.toFixed(2)} the prompt-payment slabs allow on ` +
                        `${receiptDate.toISOString().slice(0, 10)}.`,
                },
            ]);
        }
    });
}
function reconcilePhonePlan(input) {
    let freed = ZERO;
    const lines = [];
    for (const line of input.lines) {
        const bill = input.billsNow.get((0, exports.billKeyOf)(line));
        if (!bill || !bill.live) {
            freed = freed.plus(line.amount);
            continue;
        }
        const roundoff = client_1.Prisma.Decimal.min(line.roundoff, bill.pending);
        const discount = client_1.Prisma.Decimal.min(line.discount, bill.pending.minus(roundoff));
        const room = bill.pending.minus(discount).minus(roundoff);
        const amount = client_1.Prisma.Decimal.min(line.amount, room);
        freed = freed.plus(line.amount.minus(amount));
        lines.push({
            billId: line.billId,
            billAccYear: line.billAccYear,
            amount,
            discount,
            roundoff,
        });
    }
    let creditLost = ZERO;
    const credits = input.credits.map((credit) => {
        const now = input.creditsNow.get((0, exports.billKeyOf)(credit));
        const held = now && now.live ? now.held : ZERO;
        const amount = client_1.Prisma.Decimal.min(credit.amount, held);
        creditLost = creditLost.plus(credit.amount.minus(amount));
        return { billId: credit.billId, billAccYear: credit.billAccYear, amount };
    });
    const pool = input.money.plus(sumOf(credits.map((credit) => credit.amount)));
    const excess = sumOf(lines.map((line) => line.amount)).minus(pool);
    let giveBack = client_1.Prisma.Decimal.min(client_1.Prisma.Decimal.max(excess, ZERO), creditLost);
    for (let index = lines.length - 1; index >= 0 && giveBack.greaterThan(0); index -= 1) {
        const take = client_1.Prisma.Decimal.min(lines[index].amount, giveBack);
        lines[index] = { ...lines[index], amount: lines[index].amount.minus(take) };
        giveBack = giveBack.minus(take);
    }
    const room = client_1.Prisma.Decimal.max(pool.minus(sumOf(lines.map((line) => line.amount))), ZERO);
    let spread = input.fillAll ? room : client_1.Prisma.Decimal.min(freed, room);
    const byKey = new Map(lines.map((line, index) => [(0, exports.billKeyOf)(line), index]));
    for (const bill of input.openOrder) {
        if (spread.lessThanOrEqualTo(0)) {
            break;
        }
        if (!bill.live) {
            continue;
        }
        const index = byKey.get((0, exports.billKeyOf)(bill));
        const used = index === undefined ? ZERO : settles(lines[index]);
        const left = bill.pending.minus(used);
        if (left.lessThanOrEqualTo(0)) {
            continue;
        }
        const take = client_1.Prisma.Decimal.min(left, spread);
        if (index === undefined) {
            byKey.set((0, exports.billKeyOf)(bill), lines.length);
            lines.push({
                billId: bill.billId,
                billAccYear: bill.billAccYear,
                amount: take,
                discount: ZERO,
                roundoff: ZERO,
            });
        }
        else {
            lines[index] = { ...lines[index], amount: lines[index].amount.plus(take) };
        }
        spread = spread.minus(take);
    }
    const allocations = lines.filter((line) => settles(line).greaterThan(0));
    const allocated = sumOf(allocations.map((line) => line.amount));
    let over = sumOf(credits.map((credit) => credit.amount)).minus(allocated);
    for (let index = credits.length - 1; index >= 0 && over.greaterThan(0); index -= 1) {
        const take = client_1.Prisma.Decimal.min(credits[index].amount, over);
        credits[index] = { ...credits[index], amount: credits[index].amount.minus(take) };
        over = over.minus(take);
    }
    const creditsApplied = credits.filter((credit) => credit.amount.greaterThan(0));
    return {
        allocations,
        creditsApplied,
        onAccount: input.money
            .plus(sumOf(creditsApplied.map((credit) => credit.amount)))
            .minus(allocated),
    };
}
var MobileReceiptAdjustReason;
(function (MobileReceiptAdjustReason) {
    MobileReceiptAdjustReason["BILL_SETTLED"] = "BILL_SETTLED";
    MobileReceiptAdjustReason["BILL_REDUCED"] = "BILL_REDUCED";
    MobileReceiptAdjustReason["CREDIT_REDUCED"] = "CREDIT_REDUCED";
    MobileReceiptAdjustReason["PDC_ON_CLEARING"] = "PDC_ON_CLEARING";
})(MobileReceiptAdjustReason || (exports.MobileReceiptAdjustReason = MobileReceiptAdjustReason = {}));
function adjustedAgainstPlan(plan, settled, docRefnoOf) {
    const out = [];
    for (const line of plan.lines) {
        const key = (0, exports.billKeyOf)(line);
        const got = settled.bills.get(key) ?? { amount: ZERO, discount: ZERO, roundoff: ZERO };
        const lessMoney = got.amount.lessThan(line.amount);
        const lessReduction = got.discount
            .plus(got.roundoff)
            .lessThan(line.discount.plus(line.roundoff));
        if (!lessMoney && !lessReduction) {
            continue;
        }
        out.push({
            billId: line.billId,
            billAccYear: line.billAccYear.trim(),
            docRefno: docRefnoOf(key),
            planned: line.amount.toFixed(2),
            applied: got.amount.toFixed(2),
            reason: settles(got).isZero()
                ? MobileReceiptAdjustReason.BILL_SETTLED
                : MobileReceiptAdjustReason.BILL_REDUCED,
        });
    }
    for (const credit of plan.credits) {
        const key = (0, exports.billKeyOf)(credit);
        const got = settled.credits.get(key) ?? ZERO;
        if (!got.lessThan(credit.amount)) {
            continue;
        }
        out.push({
            billId: credit.billId,
            billAccYear: credit.billAccYear.trim(),
            docRefno: docRefnoOf(key),
            planned: credit.amount.toFixed(2),
            applied: got.toFixed(2),
            reason: MobileReceiptAdjustReason.CREDIT_REDUCED,
        });
    }
    return out;
}
//# sourceMappingURL=mobile-receipt-plan.js.map