"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOBILE_RETURN_DEFAULT_BILL_DAYS = exports.isHeldCode = exports.MOBILE_RETURN_HELD_CODES = void 0;
exports.replanAdjust = replanAdjust;
exports.refusalsOf = refusalsOf;
exports.outcomeOf = outcomeOf;
exports.phoneApprovalStatus = phoneApprovalStatus;
exports.billReturnStatus = billReturnStatus;
exports.billDaysOf = billDaysOf;
exports.phoneCondition = phoneCondition;
exports.phoneSettleDefault = phoneSettleDefault;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ZERO = new client_1.Prisma.Decimal(0);
const r2 = (v) => v.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
const min = (a, b) => (a.lessThan(b) ? a : b);
const keyOf = (billId, accYear) => `${billId}|${accYear.trim()}`;
function replanAdjust(input) {
    const open = new Map(input.bills.map((b) => [keyOf(b.ablId, b.ablAccYear), b]));
    const asked = new Map();
    for (const row of input.rows) {
        const amount = r2(row.amount);
        if (amount.lte(0)) {
            continue;
        }
        const key = keyOf(row.billId, row.billAccYear);
        const seen = asked.get(key);
        asked.set(key, {
            billId: row.billId,
            billAccYear: row.billAccYear.trim(),
            amount: (seen?.amount ?? ZERO).plus(amount),
        });
    }
    const final = new Map();
    const reasons = new Map();
    let freed = ZERO;
    for (const [key, row] of asked) {
        const bill = open.get(key);
        if (!bill) {
            final.set(key, ZERO);
            reasons.set(key, 'BILL_SETTLED');
            freed = freed.plus(row.amount);
            continue;
        }
        const give = min(row.amount, bill.pending);
        if (give.lessThan(row.amount)) {
            reasons.set(key, give.isZero() ? 'BILL_SETTLED' : 'BILL_REDUCED');
            freed = freed.plus(row.amount.minus(give));
        }
        final.set(key, give);
    }
    const adjustable = client_1.Prisma.Decimal.max(ZERO, input.adjustable);
    let total = [...final.values()].reduce((t, v) => t.plus(v), ZERO);
    if (total.gt(adjustable)) {
        let over = total.minus(adjustable);
        for (const key of [...final.keys()].reverse()) {
            if (over.lte(0)) {
                break;
            }
            const has = final.get(key);
            const cut = min(has, over);
            if (cut.gt(0)) {
                final.set(key, has.minus(cut));
                reasons.set(key, 'NOTE_SMALLER');
                over = over.minus(cut);
            }
        }
        total = adjustable;
        freed = ZERO;
    }
    let leftover = min(freed, adjustable.minus(total));
    const refilled = [];
    for (const bill of input.bills) {
        if (leftover.lte(0)) {
            break;
        }
        const key = keyOf(bill.ablId, bill.ablAccYear);
        const has = final.get(key) ?? ZERO;
        const add = min(bill.pending.minus(has), leftover);
        if (add.lte(0)) {
            continue;
        }
        if (!final.has(key)) {
            refilled.push(key);
        }
        final.set(key, has.plus(add));
        reasons.set(key, 'FREED_MONEY');
        leftover = leftover.minus(add);
    }
    const order = [...asked.keys(), ...refilled];
    const asks = [];
    const replanned = [];
    for (const key of order) {
        const [billId, billAccYear] = key.split('|');
        const amount = final.get(key) ?? ZERO;
        if (amount.gt(0)) {
            asks.push({
                index: asks.length,
                ablId: billId,
                ablAccYear: billAccYear,
                amount,
                dueNow: null,
            });
        }
        const from = asked.get(key)?.amount ?? ZERO;
        const reason = reasons.get(key);
        if (reason && !from.equals(amount)) {
            replanned.push({
                billId,
                billAccYear,
                refno: open.get(key)?.refno ?? null,
                from: from.toFixed(2),
                to: amount.toFixed(2),
                reason,
            });
        }
    }
    return { asks, replanned };
}
exports.MOBILE_RETURN_HELD_CODES = new Set([
    'TILL_APPROVAL_REQUIRED',
    'SALES_RETURN_WINDOW',
    'GST_CREDIT_NOTE_CUTOFF',
    'SALES_RETURN_LOT_EXPIRED',
    'SALES_RETURN_NO_PRICE',
    'SALES_RETURN_SCHEME_SHORT',
    'SALES_RIGHT_POST',
]);
const isHeldCode = (code) => exports.MOBILE_RETURN_HELD_CODES.has(code) || code.startsWith('TILL_SESSION_');
exports.isHeldCode = isHeldCode;
function refusalsOf(error) {
    if (!(error instanceof common_1.HttpException)) {
        return null;
    }
    const status = error.getStatus();
    if (status < 400 || status >= 500) {
        return null;
    }
    const body = error.getResponse();
    const errors = isRecord(body) && Array.isArray(body.errors) ? body.errors : [];
    const notes = errors.filter(isRecord).flatMap((e) => {
        if (typeof e.code !== 'string' || e.code === '') {
            return [];
        }
        const { user: _user, ...detail } = e;
        void _user;
        return [
            {
                ...detail,
                code: e.code,
                message: typeof e.message === 'string' ? e.message : error.message,
                field: typeof e.field === 'string' ? e.field : null,
                line: typeof e.line === 'number' ? e.line : null,
            },
        ];
    });
    return notes.length > 0 ? notes : null;
}
function outcomeOf(refusals) {
    const fix = refusals.find((r) => !(0, exports.isHeldCode)(r.code));
    return fix ? { status: 'SENT_BACK', first: fix } : { status: 'HELD', first: refusals[0] };
}
function phoneApprovalStatus(tapStatus) {
    switch (tapStatus) {
        case 'PENDING':
            return 'PENDING';
        case 'APPROVED':
            return 'APPROVED';
        case 'REJECTED':
        case 'EXPIRED':
            return 'REJECTED';
        default:
            return null;
    }
}
function billReturnStatus(status) {
    return status === 'FULL' ? 'FULL' : status === 'PARTIAL' ? 'PARTIAL' : 'NONE';
}
exports.MOBILE_RETURN_DEFAULT_BILL_DAYS = 90;
function billDaysOf(returnWindowDays) {
    return returnWindowDays > 0 ? Math.trunc(returnWindowDays) : exports.MOBILE_RETURN_DEFAULT_BILL_DAYS;
}
function phoneCondition(condition) {
    const c = (condition ?? '').trim().toUpperCase();
    return c === 'RESTOCK' || c === 'DAMAGED' || c === 'EXPIRED' || c === 'SCRAP' ? c : null;
}
function phoneSettleDefault(value) {
    const v = (value ?? '').trim().toUpperCase();
    if (!v) {
        return null;
    }
    return v === 'ADVANCE' ? 'ADVANCE' : 'ADJUST';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=mobile-return-plan.js.map