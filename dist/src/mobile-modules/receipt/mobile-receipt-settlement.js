"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moneyForBills = moneyForBills;
exports.fillOldestFirst = fillOldestFirst;
const client_1 = require("@prisma/client");
const ZERO = new client_1.Prisma.Decimal(0);
function moneyForBills(tenders, otherLines) {
    const money = tenders.reduce((total, t) => total.plus(t.tdAmount), ZERO);
    const extras = otherLines
        .filter((line) => line.drCr === 'CR')
        .reduce((total, line) => total.plus(line.amount), ZERO);
    return money.minus(extras);
}
function fillOldestFirst(bills, pool) {
    const allocations = [];
    const seen = new Set();
    let left = pool.greaterThan(0) ? pool : ZERO;
    for (const bill of bills) {
        if (left.lessThanOrEqualTo(0)) {
            break;
        }
        const key = `${bill.billId}|${bill.billAccYear}`;
        if (seen.has(key) || bill.pending.lessThanOrEqualTo(0)) {
            continue;
        }
        seen.add(key);
        const take = client_1.Prisma.Decimal.min(left, bill.pending);
        allocations.push({ billId: bill.billId, billAccYear: bill.billAccYear, amount: take });
        left = left.minus(take);
    }
    return { allocations, onAccount: left };
}
//# sourceMappingURL=mobile-receipt-settlement.js.map