"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raiseBill = raiseBill;
exports.writeAllocations = writeAllocations;
exports.reverseVoucherAllocations = reverseVoucherAllocations;
exports.otherVoucherOnRaisedBills = otherVoucherOnRaisedBills;
const voucher_derive_1 = require("./voucher-derive");
async function raiseBill(tx, ctx, bill, legAvId) {
    const row = await tx.accBillBalance.create({
        data: {
            ablCompanyId: ctx.companyId,
            ablBranchId: ctx.branchId,
            ablTenantId: ctx.tenantId,
            ablAccYear: ctx.accYear,
            ablPartyId: bill.party.ledId,
            ablBillType: bill.billType,
            ablSrcModule: 'ACCOUNTS',
            ablSrcDocType: 'VOUCHER',
            ablSrcDocId: ctx.voucherId,
            ablSrcAccYear: ctx.accYear,
            ablVoucherId: ctx.voucherId,
            ablVoucherLineId: legAvId,
            ablVoucherTypeId: ctx.voucherTypeId,
            ablVoucherNo: ctx.voucherNo,
            ablVoucherDate: new Date(`${ctx.voucherDate}T00:00:00Z`),
            ablVoucherRefno: ctx.voucherRefno,
            ablDocRefno: bill.docRefno ?? ctx.voucherRefno,
            ablDocDate: new Date(`${ctx.docDate ?? ctx.voucherDate}T00:00:00Z`),
            ablDueDate: new Date(`${bill.dueDate}T00:00:00Z`),
            ablCreditDays: bill.dueDays,
            ablDrCr: bill.side,
            ablBillAmount: bill.amount,
            ablNarration: `${bill.billType} bill raised by voucher ${ctx.voucherRefno}`,
            ablCreatedBy: ctx.actor,
        },
        select: { ablId: true, ablAccYear: true },
    });
    return { billId: row.ablId, accYear: row.ablAccYear.trim(), lineRowNo: bill.lineRowNo };
}
async function writeAllocations(tx, ctx, allocations, raisedByLine, legAvIdByRow) {
    const touched = new Map();
    let rowNo = 0;
    const adjDate = new Date(`${ctx.voucherDate}T00:00:00Z`);
    const common = (a) => ({
        abjCompanyId: ctx.companyId,
        abjBranchId: ctx.branchId,
        abjTenantId: ctx.tenantId,
        abjAccYear: ctx.accYear,
        abjPartyId: a.party.ledId,
        abjVoucherId: ctx.voucherId,
        abjVoucherAccYear: ctx.accYear,
        abjVoucherLineId: legAvIdByRow.get(a.legRowNo) ?? null,
        abjAdjType: a.adjType,
        abjAdjDate: adjDate,
        abjSettlementMode: a.settlementMode,
        abjUserId: ctx.userId,
        abjSessionId: ctx.sessionId,
        abjCreatedOn: ctx.now,
        abjCreatedBy: ctx.actor,
    });
    for (const a of allocations) {
        const existing = { billId: a.bill.ablId, accYear: a.bill.ablAccYear };
        touched.set(`${existing.billId}|${existing.accYear}`, existing);
        if (a.adjType === 'ALLOCATION') {
            await tx.accBillAdjustment.create({
                data: {
                    ...common(a),
                    abjBillId: existing.billId,
                    abjBillAccYear: existing.accYear,
                    abjRowNo: ++rowNo,
                    abjDrCr: (0, voucher_derive_1.opposite)(a.bill.side),
                    abjAmount: a.amount,
                    abjAgainstBillId: null,
                    abjAgainstBillAccYear: null,
                },
            });
            continue;
        }
        const raised = raisedByLine.get(a.lineRowNo);
        if (!raised) {
            throw new Error(`voucher ${ctx.voucherRefno}: allocation on line ${a.lineRowNo} has no raised bill to pair with`);
        }
        touched.set(`${raised.billId}|${raised.accYear}`, raised);
        const raisedSide = (0, voucher_derive_1.opposite)(a.bill.side);
        await tx.accBillAdjustment.create({
            data: {
                ...common(a),
                abjBillId: raised.billId,
                abjBillAccYear: raised.accYear,
                abjAgainstBillId: existing.billId,
                abjAgainstBillAccYear: existing.accYear,
                abjRowNo: ++rowNo,
                abjDrCr: (0, voucher_derive_1.opposite)(raisedSide),
                abjAmount: a.amount,
            },
        });
        await tx.accBillAdjustment.create({
            data: {
                ...common(a),
                abjBillId: existing.billId,
                abjBillAccYear: existing.accYear,
                abjAgainstBillId: raised.billId,
                abjAgainstBillAccYear: raised.accYear,
                abjRowNo: ++rowNo,
                abjDrCr: (0, voucher_derive_1.opposite)(a.bill.side),
                abjAmount: a.amount,
            },
        });
    }
    return [...touched.values()];
}
async function reverseVoucherAllocations(tx, params) {
    const forward = await tx.accBillAdjustment.findMany({
        where: {
            abjVoucherId: params.voucherId,
            abjVoucherAccYear: params.accYear,
            abjIsDeleted: false,
            abjReversalOfId: null,
        },
        orderBy: { abjRowNo: 'asc' },
    });
    const reversed = new Set((await tx.accBillAdjustment.findMany({
        where: { abjReversalOfId: { in: forward.map((r) => r.abjId) }, abjIsDeleted: false },
        select: { abjReversalOfId: true },
    })).map((r) => r.abjReversalOfId));
    const rows = forward.filter((r) => !reversed.has(r.abjId));
    let rowNo = 0;
    for (const r of rows) {
        await tx.accBillAdjustment.create({
            data: {
                abjCompanyId: r.abjCompanyId,
                abjBranchId: r.abjBranchId,
                abjTenantId: r.abjTenantId,
                abjAccYear: r.abjAccYear,
                abjBillId: r.abjBillId,
                abjBillAccYear: r.abjBillAccYear,
                abjPartyId: r.abjPartyId,
                abjRowNo: ++rowNo,
                abjAgainstBillId: r.abjAgainstBillId,
                abjAgainstBillAccYear: r.abjAgainstBillAccYear,
                abjVoucherId: params.reversalVoucherId,
                abjVoucherAccYear: params.accYear,
                abjVoucherLineId: null,
                abjAdjType: r.abjAdjType,
                abjAdjDate: r.abjAdjDate,
                abjIsPostDated: r.abjIsPostDated,
                abjDrCr: r.abjDrCr.trim() === 'DR' ? 'CR' : 'DR',
                abjAmount: r.abjAmount.negated(),
                abjSettlementMode: r.abjSettlementMode,
                abjSettlementLedgerId: r.abjSettlementLedgerId,
                abjApprovedBy: r.abjApprovedBy,
                abjReversalOfId: r.abjId,
                abjReversalReason: params.reason.slice(0, 250),
                abjUserId: r.abjUserId,
                abjSessionId: r.abjSessionId,
                abjCreatedOn: params.now,
                abjCreatedBy: params.actor,
            },
        });
    }
    const touched = new Map();
    for (const r of forward) {
        touched.set(`${r.abjBillId}|${r.abjBillAccYear.trim()}`, {
            billId: r.abjBillId,
            accYear: r.abjBillAccYear.trim(),
        });
    }
    return { count: rows.length, touched: [...touched.values()] };
}
async function otherVoucherOnRaisedBills(tx, voucherId, accYear) {
    return tx.$queryRaw `
    SELECT DISTINCT h.avh_voucher_refno AS "voucherRefno", b.abl_doc_refno AS "billRefno"
      FROM accounts.acc_bill_balance b
      JOIN accounts.acc_bill_adjustment j
        ON (j.abj_bill_id = b.abl_id OR j.abj_against_bill_id = b.abl_id)
      LEFT JOIN accounts.acc_voucher_header h
        ON h.avh_voucher_id = j.abj_voucher_id AND h.avh_acc_year = j.abj_voucher_acc_year
     WHERE b.abl_voucher_id = ${voucherId}::uuid
       AND b.abl_acc_year   = ${accYear}::char(9)
       AND b.abl_is_deleted = false
       AND j.abj_is_deleted = false
       AND j.abj_reversal_of_id IS NULL
       AND j.abj_amount > 0
       AND (j.abj_voucher_id IS NULL OR j.abj_voucher_id <> ${voucherId}::uuid)
       AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x
                        WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)`;
}
//# sourceMappingURL=voucher-billwise.helper.js.map