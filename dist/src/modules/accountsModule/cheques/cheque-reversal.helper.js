"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseChequeAdjustments = reverseChequeAdjustments;
exports.allocationsReversedBy = allocationsReversedBy;
exports.cascadeAdvances = cascadeAdvances;
const client_1 = require("@prisma/client");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_utils_1 = require("../receipt/receipt.utils");
async function loadChequeAdjustments(tx, cheque) {
    const rows = await tx.accBillAdjustment.findMany({
        where: {
            abjChequeId: cheque.apdId,
            abjChequeAccYear: cheque.apdAccYear,
            abjIsDeleted: false,
        },
        orderBy: [{ abjVoucherId: 'asc' }, { abjRowNo: 'asc' }],
    });
    const reversals = rows.filter((row) => row.abjReversalOfId !== null);
    const alreadyReversed = new Set(reversals.map((row) => row.abjReversalOfId));
    return {
        standing: rows.filter((row) => row.abjReversalOfId === null && !alreadyReversed.has(row.abjId)),
        reversals,
    };
}
async function reverseChequeAdjustments(tx, cheque, scope, startRowNo = 1) {
    const { standing } = await loadChequeAdjustments(tx, cheque);
    const nextRowNo = await writeReversals(tx, standing, scope, startRowNo);
    const amountByBill = new Map();
    for (const row of standing) {
        const k = `${row.abjBillId}|${row.abjBillAccYear}`;
        amountByBill.set(k, (amountByBill.get(k) ?? new client_1.Prisma.Decimal(0)).plus(row.abjAmount));
    }
    return {
        bills: standing.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear })),
        count: standing.length,
        amountByBill,
        nextRowNo,
    };
}
const SETTLEMENT_ADJ_TYPES = [
    receipt_enum_1.BillAdjType.ALLOCATION,
    receipt_enum_1.BillAdjType.DISCOUNT,
    receipt_enum_1.BillAdjType.WRITEOFF,
    receipt_enum_1.BillAdjType.ROUND_OFF,
];
async function allocationsReversedBy(tx, cheque, bounce) {
    const reversed = await tx.accBillAdjustment.findMany({
        where: {
            abjChequeId: cheque.apdId,
            abjChequeAccYear: cheque.apdAccYear,
            abjIsDeleted: false,
            abjReversalOfId: { not: null },
            abjVoucherId: bounce.voucherId,
            abjVoucherAccYear: bounce.accYear,
            abjAdjType: { in: [...SETTLEMENT_ADJ_TYPES] },
        },
        orderBy: [{ abjRowNo: 'asc' }],
    });
    const byBill = new Map();
    for (const row of reversed) {
        const key = `${row.abjBillId}|${row.abjBillAccYear}`;
        let entry = byBill.get(key);
        if (!entry) {
            entry = {
                billId: row.abjBillId,
                billAccYear: row.abjBillAccYear,
                amount: receipt_utils_1.ZERO,
                discount: receipt_utils_1.ZERO,
                writeoff: receipt_utils_1.ZERO,
                roundoff: receipt_utils_1.ZERO,
                writeoffApprovedBy: null,
            };
            byBill.set(key, entry);
        }
        const amount = row.abjAmount.negated();
        switch (row.abjAdjType) {
            case receipt_enum_1.BillAdjType.ALLOCATION:
                entry.amount = entry.amount.plus(amount);
                break;
            case receipt_enum_1.BillAdjType.DISCOUNT:
                entry.discount = entry.discount.plus(amount);
                break;
            case receipt_enum_1.BillAdjType.WRITEOFF:
                entry.writeoff = entry.writeoff.plus(amount);
                entry.writeoffApprovedBy = row.abjApprovedBy ?? entry.writeoffApprovedBy;
                break;
            case receipt_enum_1.BillAdjType.ROUND_OFF:
                entry.roundoff = entry.roundoff.plus(amount);
                break;
            default:
                break;
        }
    }
    return [...byBill.values()];
}
async function cascadeAdvances(tx, cheque, scope, startRowNo = 1) {
    const report = {
        advanceBillsRemoved: [],
        advanceApplicationsReversed: 0,
        advancesLeftMixed: [],
    };
    const bills = [];
    let rowNo = startRowNo;
    if (!cheque.apdVoucherId || !cheque.apdVoucherAccYear) {
        return { report, bills, nextRowNo: rowNo };
    }
    const advances = await tx.accBillBalance.findMany({
        where: {
            ablVoucherId: cheque.apdVoucherId,
            ablAccYear: cheque.apdVoucherAccYear,
            ablBillType: receipt_enum_1.BillType.ADVANCE,
            ablIsDeleted: false,
        },
        select: { ablId: true, ablAccYear: true, ablDocRefno: true },
    });
    if (advances.length === 0) {
        return { report, bills, nextRowNo: rowNo };
    }
    const soleSource = await isSoleMoneySource(tx, cheque);
    for (const advance of advances) {
        const ref = {
            billId: advance.ablId,
            billAccYear: advance.ablAccYear,
            docRefno: advance.ablDocRefno,
        };
        if (!soleSource) {
            report.advancesLeftMixed.push(ref);
            continue;
        }
        const applications = await tx.accBillAdjustment.findMany({
            where: {
                abjIsDeleted: false,
                abjReversalOfId: null,
                abjAdjType: { in: [receipt_enum_1.BillAdjType.ADVANCE_ADJUST, receipt_enum_1.BillAdjType.NOTE_ADJUST] },
                OR: [
                    { abjBillId: advance.ablId, abjBillAccYear: advance.ablAccYear },
                    { abjAgainstBillId: advance.ablId, abjAgainstBillAccYear: advance.ablAccYear },
                ],
            },
            orderBy: [{ abjVoucherId: 'asc' }, { abjRowNo: 'asc' }],
        });
        rowNo = await writeReversals(tx, applications, scope, rowNo);
        report.advanceApplicationsReversed += applications.length;
        for (const row of applications) {
            bills.push({ billId: row.abjBillId, accYear: row.abjBillAccYear });
        }
        await tx.accBillBalance.update({
            where: { ablId_ablAccYear: { ablId: advance.ablId, ablAccYear: advance.ablAccYear } },
            data: {
                ablIsDeleted: true,
                ablIsActive: false,
                ablModifiedOn: new Date(),
                ablModifiedBy: scope.actor,
            },
        });
        report.advanceBillsRemoved.push(ref);
    }
    return { report, bills, nextRowNo: rowNo };
}
async function isSoleMoneySource(tx, cheque) {
    const tenders = await tx.accTenderDetail.findMany({
        where: { tdSrcDocId: cheque.apdVoucherId, tdIsDeleted: false },
        select: { tdId: true },
    });
    if (tenders.some((tender) => tender.tdId !== cheque.apdTenderId)) {
        return false;
    }
    const siblings = await tx.accPdcRegister.count({
        where: {
            apdVoucherId: cheque.apdVoucherId,
            apdVoucherAccYear: cheque.apdVoucherAccYear,
            apdIsDeleted: false,
            NOT: { apdId: cheque.apdId },
        },
    });
    return siblings === 0;
}
async function writeReversals(tx, originals, scope, startRowNo) {
    if (originals.length === 0) {
        return startRowNo;
    }
    let rowNo = startRowNo;
    const rows = originals.map((row) => ({
        abjCompanyId: scope.companyId,
        abjBranchId: scope.branchId,
        abjTenantId: scope.tenantId,
        abjAccYear: scope.accYear,
        abjBillId: row.abjBillId,
        abjBillAccYear: row.abjBillAccYear,
        abjPartyId: row.abjPartyId,
        abjRowNo: rowNo++,
        abjAgainstBillId: row.abjAgainstBillId,
        abjAgainstBillAccYear: row.abjAgainstBillAccYear,
        abjVoucherId: scope.voucherId,
        abjVoucherAccYear: scope.accYear,
        abjAdjType: row.abjAdjType,
        abjAdjDate: row.abjAdjDate,
        abjIsPostDated: row.abjIsPostDated,
        abjDrCr: (0, receipt_utils_1.flipSide)(row.abjDrCr, receipt_enum_1.DrCr.DR, receipt_enum_1.DrCr.CR),
        abjAmount: row.abjAmount.negated(),
        abjSettlementMode: row.abjSettlementMode,
        abjSettlementLedgerId: row.abjSettlementLedgerId,
        abjTenderId: row.abjTenderId,
        abjTenderAccYear: row.abjTenderAccYear,
        abjChequeId: row.abjChequeId,
        abjChequeAccYear: row.abjChequeAccYear,
        abjApprovedBy: row.abjApprovedBy,
        abjReversalOfId: row.abjId,
        abjReversalReason: scope.reason.slice(0, 250),
        abjUserId: scope.userId,
        abjSessionId: scope.sessionId,
        abjCreatedBy: scope.actor,
    }));
    await tx.accBillAdjustment.createMany({ data: rows });
    return rowNo;
}
//# sourceMappingURL=cheque-reversal.helper.js.map