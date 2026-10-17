"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveVoucherTotals = deriveVoucherTotals;
const client_1 = require("@prisma/client");
const ZERO = new client_1.Prisma.Decimal(0);
async function deriveVoucherTotals(client, voucherId, accYear) {
    const legs = await client.accVoucher.findMany({
        where: { avVoucherId: voucherId, avAccYear: accYear, avIsDeleted: false },
        select: { avDrCr: true, avAmount: true },
    });
    let totalDebit = ZERO;
    let totalCredit = ZERO;
    for (const leg of legs) {
        if (leg.avDrCr === 'DR') {
            totalDebit = totalDebit.plus(leg.avAmount);
        }
        else {
            totalCredit = totalCredit.plus(leg.avAmount);
        }
    }
    totalDebit = totalDebit.toDecimalPlaces(2);
    totalCredit = totalCredit.toDecimalPlaces(2);
    return { totalDebit, totalCredit, difference: totalDebit.minus(totalCredit) };
}
//# sourceMappingURL=voucher-totals.helper.js.map