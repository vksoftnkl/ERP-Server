"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseChequeAdjustments = reverseChequeAdjustments;
exports.cascadeAdvances = cascadeAdvances;
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_utils_1 = require("../receipt/receipt.utils");
async function reverseChequeAdjustments(tx, cheque, scope, startRowNo = 1) {
    const originals = await tx.accBillAdjustment.findMany({
        where: {
            abjChequeId: cheque.apdId,
            abjChequeAccYear: cheque.apdAccYear,
            abjIsDeleted: false,
            abjReversalOfId: null,
        },
        orderBy: [{ abjVoucherId: 'asc' }, { abjRowNo: 'asc' }],
    });
    const nextRowNo = await writeReversals(tx, originals, scope, startRowNo);
    return {
        bills: originals.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear })),
        count: originals.length,
        nextRowNo,
    };
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