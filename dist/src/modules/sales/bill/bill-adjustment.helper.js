"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncBillAdjustments = syncBillAdjustments;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const CREDIT_ROUTING = {
    ADVANCE: { adjType: 'ADVANCE_ADJUST', settlementMode: 'ADVANCE' },
    SALES_RETURN: { adjType: 'NOTE_ADJUST', settlementMode: 'CREDIT_NOTE' },
};
const CREDIT_SIDE = 'CR';
const INVOICE_MOVEMENT = 'CR';
const CREDIT_MOVEMENT = 'DR';
const REVERSAL_REASON = 'Bill re-saved with a different settlement';
async function syncBillAdjustments(tx, ctx, adjustments, actor, now) {
    if (adjustments === undefined) {
        return { action: 'unchanged', adjustments: await readLiveAdjustments(tx, ctx.billId) };
    }
    const requested = normalizeRequest(adjustments);
    const live = await readLiveAdjustments(tx, ctx.billId);
    if (matches(live, requested)) {
        return { action: 'unchanged', adjustments: live };
    }
    if (live.length > 0) {
        await reverseAll(tx, ctx, actor, now);
    }
    const posted = await postAll(tx, ctx, requested, actor, now);
    await settleInvoiceAllocation(tx, ctx, posted, actor, now);
    const action = live.length === 0 ? 'posted' : posted.length === 0 ? 'reversed' : 'replaced';
    return { action, adjustments: posted };
}
function normalizeRequest(adjustments) {
    const merged = new Map();
    for (const [index, adjustment] of adjustments.entries()) {
        const amount = new client_1.Prisma.Decimal(adjustment.amount);
        if (amount.lessThanOrEqualTo(0)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                {
                    field: `adjustments[${index}].amount`,
                    message: `An adjustment must be for a positive amount; got ${amount.toString()}.`,
                },
            ]);
        }
        const existing = merged.get(adjustment.againstBillId);
        if (!existing) {
            merged.set(adjustment.againstBillId, { ...adjustment, amount: amount.toNumber() });
            continue;
        }
        if (existing.againstBillAccYear !== adjustment.againstBillAccYear) {
            (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                {
                    field: `adjustments[${index}].againstBillAccYear`,
                    message: `Credit ${adjustment.againstBillId} is named twice with two different accounting ` +
                        `years (${existing.againstBillAccYear} and ${adjustment.againstBillAccYear}).`,
                },
            ]);
        }
        existing.amount = new client_1.Prisma.Decimal(existing.amount).plus(amount).toNumber();
    }
    return [...merged.values()];
}
function matches(live, requested) {
    if (live.length !== requested.length) {
        return false;
    }
    const byCredit = new Map(live.map((row) => [row.againstBillId, row]));
    return requested.every((adjustment) => {
        const row = byCredit.get(adjustment.againstBillId);
        return (row !== undefined &&
            row.againstBillAccYear === adjustment.againstBillAccYear &&
            row.amount.equals(new client_1.Prisma.Decimal(adjustment.amount)));
    });
}
async function readLiveAdjustments(tx, billId) {
    const rows = await tx.accBillAdjustment.findMany({
        where: {
            abjBillId: billId,
            abjIsDeleted: false,
            abjAgainstBillId: { not: null },
            abjReversalOfId: null,
        },
        select: {
            abjId: true,
            abjAgainstBillId: true,
            abjAgainstBillAccYear: true,
            abjAmount: true,
            abjAdjType: true,
            abjSettlementMode: true,
        },
        orderBy: { abjRowNo: 'asc' },
    });
    if (rows.length === 0) {
        return [];
    }
    const reversed = new Set((await tx.accBillAdjustment.findMany({
        where: { abjReversalOfId: { in: rows.map((row) => row.abjId) }, abjIsDeleted: false },
        select: { abjReversalOfId: true },
    })).map((row) => row.abjReversalOfId));
    return rows
        .filter((row) => !reversed.has(row.abjId))
        .map((row) => ({
        againstBillId: row.abjAgainstBillId,
        againstBillAccYear: row.abjAgainstBillAccYear,
        amount: row.abjAmount,
        adjType: row.abjAdjType,
        settlementMode: row.abjSettlementMode ?? '',
    }));
}
async function reverseAll(tx, ctx, actor, now) {
    const rows = await tx.accBillAdjustment.findMany({
        where: {
            abjIsDeleted: false,
            abjReversalOfId: null,
            abjAgainstBillId: { not: null },
            OR: [{ abjBillId: ctx.billId }, { abjAgainstBillId: ctx.billId }],
        },
        select: {
            abjId: true,
            abjAccYear: true,
            abjBillId: true,
            abjBillAccYear: true,
            abjAgainstBillId: true,
            abjAgainstBillAccYear: true,
            abjAmount: true,
            abjAdjType: true,
            abjSettlementMode: true,
            abjSettlementLedgerId: true,
            abjDrCr: true,
            abjRowNo: true,
        },
    });
    const alreadyReversed = new Set((await tx.accBillAdjustment.findMany({
        where: { abjReversalOfId: { in: rows.map((row) => row.abjId) }, abjIsDeleted: false },
        select: { abjReversalOfId: true },
    })).map((row) => row.abjReversalOfId));
    let rowNo = await nextRowNo(tx, ctx.billId);
    for (const row of rows) {
        if (alreadyReversed.has(row.abjId)) {
            continue;
        }
        await tx.accBillAdjustment.create({
            data: {
                abjCompanyId: ctx.companyId,
                abjBranchId: ctx.branchId,
                abjTenantId: ctx.tenantId,
                abjAccYear: ctx.accYear,
                abjBillId: row.abjBillId,
                abjBillAccYear: row.abjBillAccYear,
                abjAgainstBillId: row.abjAgainstBillId,
                abjAgainstBillAccYear: row.abjAgainstBillAccYear,
                abjPartyId: ctx.partyId,
                abjRowNo: rowNo++,
                abjAdjType: row.abjAdjType,
                abjAdjDate: ctx.adjDate,
                abjDrCr: row.abjDrCr,
                abjAmount: row.abjAmount.negated(),
                abjSettlementMode: row.abjSettlementMode,
                abjSettlementLedgerId: row.abjSettlementLedgerId,
                abjReversalOfId: row.abjId,
                abjReversalReason: REVERSAL_REASON,
                abjUserId: ctx.userId,
                abjSessionId: ctx.sessionId,
                abjCreatedOn: now,
                abjCreatedBy: actor,
            },
        });
        if (row.abjBillId !== ctx.billId) {
            await addToAllocation(tx, { ablId: row.abjBillId, ablAccYear: row.abjBillAccYear }, row.abjAmount.negated(), actor, now);
        }
    }
}
async function postAll(tx, ctx, requested, actor, now) {
    const posted = [];
    let rowNo = await nextRowNo(tx, ctx.billId);
    for (const [index, adjustment] of requested.entries()) {
        const amount = new client_1.Prisma.Decimal(adjustment.amount);
        const credit = await lockCredit(tx, ctx, adjustment, index);
        const routing = deriveRouting(credit, index);
        ensureCreditCovers(credit, amount, index);
        await tx.accBillAdjustment.create({
            data: {
                ...commonColumns(ctx, routing, actor, now),
                abjBillId: ctx.billId,
                abjBillAccYear: ctx.billAccYear,
                abjAgainstBillId: credit.ablId,
                abjAgainstBillAccYear: credit.ablAccYear,
                abjRowNo: rowNo++,
                abjDrCr: INVOICE_MOVEMENT,
                abjAmount: amount,
                abjRemarks: adjustment.remarks ?? null,
            },
        });
        await tx.accBillAdjustment.create({
            data: {
                ...commonColumns(ctx, routing, actor, now),
                abjBillId: credit.ablId,
                abjBillAccYear: credit.ablAccYear,
                abjAgainstBillId: ctx.billId,
                abjAgainstBillAccYear: ctx.billAccYear,
                abjRowNo: rowNo++,
                abjDrCr: CREDIT_MOVEMENT,
                abjAmount: amount,
                abjRemarks: adjustment.remarks ?? null,
            },
        });
        await addToAllocation(tx, credit, amount, actor, now);
        posted.push({
            againstBillId: credit.ablId,
            againstBillAccYear: credit.ablAccYear,
            amount,
            adjType: routing.adjType,
            settlementMode: routing.settlementMode,
        });
    }
    return posted;
}
function commonColumns(ctx, routing, actor, now) {
    return {
        abjCompanyId: ctx.companyId,
        abjBranchId: ctx.branchId,
        abjTenantId: ctx.tenantId,
        abjAccYear: ctx.accYear,
        abjPartyId: ctx.partyId,
        abjAdjType: routing.adjType,
        abjAdjDate: ctx.adjDate,
        abjSettlementMode: routing.settlementMode,
        abjUserId: ctx.userId,
        abjSessionId: ctx.sessionId,
        abjCreatedOn: now,
        abjCreatedBy: actor,
    };
}
async function lockCredit(tx, ctx, adjustment, index) {
    const rows = await tx.$queryRaw `
    SELECT abl_id, abl_acc_year, abl_bill_type, abl_dr_cr, abl_party_id,
           abl_doc_refno, abl_pending_amount, abl_alloc_amount
    FROM   accounts.acc_bill_balance
    WHERE  abl_id       = ${adjustment.againstBillId}::uuid
      AND  abl_acc_year = ${adjustment.againstBillAccYear}::bpchar
      AND  abl_company_id = ${ctx.companyId}::uuid
      AND  abl_is_deleted = false
      AND  abl_is_active  = true
    FOR UPDATE
  `;
    const credit = rows[0];
    if (!credit) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
            {
                field: `adjustments[${index}].againstBillId`,
                message: `No open credit ${adjustment.againstBillId} in accounting year ` +
                    `${adjustment.againstBillAccYear} for this company. Re-open the adjustment panel and pick again.`,
            },
        ]);
    }
    if (credit.abl_party_id !== ctx.partyId) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
            {
                field: `adjustments[${index}].againstBillId`,
                message: `Credit ${credit.abl_doc_refno ?? credit.abl_id} belongs to a different party.`,
            },
        ]);
    }
    if (credit.abl_dr_cr.trim() !== CREDIT_SIDE) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
            {
                field: `adjustments[${index}].againstBillId`,
                message: `${credit.abl_doc_refno ?? credit.abl_id} is a ${credit.abl_dr_cr.trim()} balance — the ` +
                    'party owes it, so it cannot settle this bill.',
            },
        ]);
    }
    return {
        ablId: credit.abl_id,
        ablAccYear: credit.abl_acc_year,
        ablBillType: credit.abl_bill_type,
        ablDrCr: credit.abl_dr_cr,
        ablPartyId: credit.abl_party_id,
        ablDocRefno: credit.abl_doc_refno,
        ablPendingAmount: credit.abl_pending_amount,
        ablAllocAmount: credit.abl_alloc_amount,
    };
}
function deriveRouting(credit, index) {
    const routing = CREDIT_ROUTING[credit.ablBillType];
    if (!routing) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
            {
                field: `adjustments[${index}].againstBillId`,
                message: `${credit.ablDocRefno ?? credit.ablId} is a ${credit.ablBillType} balance. Only ` +
                    `${Object.keys(CREDIT_ROUTING).join(' and ')} credits can be adjusted against a sale bill.`,
            },
        ]);
    }
    return routing;
}
function ensureCreditCovers(credit, amount, index) {
    if (credit.ablPendingAmount.greaterThanOrEqualTo(amount)) {
        return;
    }
    (0, module_service_utils_1.throwSalesConflict)('Bill cannot be saved', [
        {
            field: `adjustments[${index}].amount`,
            message: `Credit ${credit.ablDocRefno ?? credit.ablId} has only ` +
                `${credit.ablPendingAmount.toString()} left, but ${amount.toString()} was adjusted ` +
                'against it. Another counter may have used it — re-open the adjustment panel.',
        },
    ]);
}
async function addToAllocation(tx, bill, delta, actor, now) {
    await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
        data: {
            ablAllocAmount: { increment: delta },
            ablModifiedOn: now,
            ablModifiedBy: actor,
        },
    });
}
async function settleInvoiceAllocation(tx, ctx, posted, actor, now) {
    const adjusted = posted.reduce((total, row) => total.plus(row.amount), new client_1.Prisma.Decimal(0));
    const allocated = ctx.paidAmount.plus(adjusted);
    if (allocated.greaterThan(ctx.billAmount)) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
            {
                field: 'adjustments',
                message: `${ctx.paidAmount.toString()} tendered plus ${adjusted.toString()} adjusted comes to ` +
                    `${allocated.toString()}, which is more than the bill's ${ctx.billAmount.toString()}. ` +
                    'Adjusted credits must not also be counted in sbPaidAmt.',
            },
        ]);
    }
    await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: ctx.billId, ablAccYear: ctx.billAccYear } },
        data: {
            ablAllocAmount: allocated,
            ablModifiedOn: now,
            ablModifiedBy: actor,
        },
    });
}
async function nextRowNo(tx, billId) {
    const highest = await tx.accBillAdjustment.aggregate({
        where: { abjBillId: billId },
        _max: { abjRowNo: true },
    });
    return (highest._max.abjRowNo ?? 0) + 1;
}
//# sourceMappingURL=bill-adjustment.helper.js.map