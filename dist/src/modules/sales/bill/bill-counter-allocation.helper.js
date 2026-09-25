"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCounterAllocations = syncCounterAllocations;
exports.retireCounterAllocations = retireCounterAllocations;
const client_1 = require("@prisma/client");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const SETTLEMENT_MODE_BY_TYPE = {
    [sales_doc_utils_1.TENDER_TYPE.CASH]: 'CASH',
    [sales_doc_utils_1.TENDER_TYPE.CARD]: 'CARD',
    [sales_doc_utils_1.TENDER_TYPE.UPI]: 'UPI',
    [sales_doc_utils_1.TENDER_TYPE.WALLET]: 'WALLET',
    [sales_doc_utils_1.TENDER_TYPE.CHEQUE]: 'CHEQUE',
    [sales_doc_utils_1.TENDER_TYPE.BANK]: 'BANK',
    [sales_doc_utils_1.TENDER_TYPE.RRN]: 'BANK',
    [sales_doc_utils_1.TENDER_TYPE.LOYALTY]: 'LOYALTY',
    [sales_doc_utils_1.TENDER_TYPE.VOUCHER]: 'VOUCHER',
};
const NOT_SETTLING = [sales_doc_utils_1.TENDER_TYPE.CREDIT, sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT];
const INVOICE_MOVEMENT = 'CR';
const COUNTER_REMARKS = 'Paid at the counter';
const DROPPED_REMARKS = 'Tender no longer on the bill';
const ZERO = new client_1.Prisma.Decimal(0);
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
async function syncCounterAllocations(tx, scope) {
    const tenders = await loadTenders(tx, scope.bill);
    const settling = tenders.filter((t) => !t.td_is_deleted &&
        !t.td_is_voided &&
        !NOT_SETTLING.includes(Number(t.td_tender_type_id)) &&
        new client_1.Prisma.Decimal(t.td_amount).greaterThan(0));
    const settlingIds = new Set(settling.map((t) => t.td_id));
    const rows = await loadCounterRows(tx, scope.abl, tenders.map((t) => t.td_id));
    const stale = rows.filter((r) => r.abj_reversal_of_id === null && !settlingIds.has(r.abj_tender_id));
    if (stale.length > 0) {
        const ids = stale.map((r) => r.abj_id);
        await tx.accBillAdjustment.updateMany({
            where: {
                OR: [{ abjId: { in: ids } }, { abjReversalOfId: { in: ids } }],
                abjIsDeleted: false,
            },
            data: {
                abjIsDeleted: true,
                abjRemarks: DROPPED_REMARKS,
                abjModifiedOn: scope.now,
                abjModifiedBy: scope.actor,
            },
        });
    }
    const hasRow = new Set(rows.filter((r) => r.abj_reversal_of_id === null).map((r) => r.abj_tender_id));
    const missing = settling.filter((t) => !hasRow.has(t.td_id));
    const result = { added: [], dropped: stale.length, capped: [] };
    if (missing.length === 0) {
        return result;
    }
    let headroom = await headroomOf(tx, scope);
    let rowNo = await nextRowNo(tx, scope.abl.ablId);
    const userId = uuidOr(scope.bill.sbUserId, uuidOr(scope.actor, NIL_UUID));
    for (const t of missing) {
        const wanted = new client_1.Prisma.Decimal(t.td_amount);
        const amount = client_1.Prisma.Decimal.min(wanted, headroom);
        if (amount.lessThan(wanted)) {
            result.capped.push({ tdId: t.td_id, wanted, written: client_1.Prisma.Decimal.max(amount, ZERO) });
        }
        if (amount.lessThanOrEqualTo(0)) {
            continue;
        }
        const voucher = scope.voucherFor(t.td_id);
        const created = await tx.accBillAdjustment.create({
            data: {
                abjCompanyId: scope.bill.sbCompanyId,
                abjBranchId: scope.bill.sbBranchId,
                abjTenantId: scope.bill.sbTenantId,
                abjAccYear: voucher?.accYear ?? scope.bill.sbAccYear,
                abjBillId: scope.abl.ablId,
                abjBillAccYear: scope.abl.ablAccYear,
                abjPartyId: scope.partyId,
                abjRowNo: rowNo++,
                abjVoucherId: voucher?.voucherId ?? null,
                abjVoucherAccYear: voucher ? voucher.accYear : null,
                abjAdjType: 'ALLOCATION',
                abjAdjDate: scope.bill.sbBillDate,
                abjDrCr: INVOICE_MOVEMENT,
                abjAmount: amount,
                abjSettlementMode: SETTLEMENT_MODE_BY_TYPE[Number(t.td_tender_type_id)] ?? 'MIXED',
                abjTenderId: t.td_id,
                abjTenderAccYear: t.td_acc_year,
                abjChequeId: t.apd_id,
                abjChequeAccYear: t.apd_id ? t.apd_acc_year : null,
                abjIsPostDated: false,
                abjRemarks: COUNTER_REMARKS,
                abjUserId: userId,
                abjSessionId: uuidOr(scope.bill.sbSessionId, null),
                abjCreatedOn: scope.now,
                abjCreatedBy: scope.actor,
            },
            select: { abjId: true },
        });
        result.added.push({ abjId: created.abjId, tdId: t.td_id, amount, chequeId: t.apd_id });
        headroom = headroom.minus(amount);
    }
    return result;
}
async function retireCounterAllocations(tx, bill, abl, actor, now) {
    const tenders = await loadTenders(tx, bill);
    const rows = await loadCounterRows(tx, abl, tenders.map((t) => t.td_id));
    if (rows.length === 0) {
        return 0;
    }
    const { count } = await tx.accBillAdjustment.updateMany({
        where: { abjId: { in: rows.map((r) => r.abj_id) }, abjIsDeleted: false },
        data: { abjIsDeleted: true, abjModifiedOn: now, abjModifiedBy: actor },
    });
    return count;
}
async function loadTenders(tx, bill) {
    return tx.$queryRaw `
    SELECT t.td_id, t.td_acc_year, t.td_row_no, t.td_tender_type_id, t.td_amount,
           t.td_is_voided, t.td_is_deleted, p.apd_id, p.apd_acc_year
      FROM accounts.acc_tender_detail t
      LEFT JOIN LATERAL (
        SELECT p.apd_id, p.apd_acc_year FROM accounts.acc_pdc_register p
         WHERE p.apd_tender_id = t.td_id AND p.apd_is_deleted = false
           AND p.apd_status <> 'CANCELLED'
         LIMIT 1) p ON true
     WHERE t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
       AND t.td_src_doc_id = ${bill.sbId}::uuid AND t.td_acc_year = ${bill.sbAccYear}::char(9)
     ORDER BY t.td_row_no`;
}
async function loadCounterRows(tx, abl, tenderIds) {
    if (tenderIds.length === 0) {
        return [];
    }
    return tx.$queryRaw `
    SELECT abj_id, abj_tender_id, abj_reversal_of_id
      FROM accounts.acc_bill_adjustment
     WHERE abj_bill_id = ${abl.ablId}::uuid AND abj_bill_acc_year = ${abl.ablAccYear}::char(9)
       AND abj_adj_type = 'ALLOCATION' AND abj_is_deleted = false
       AND abj_tender_id = ANY(${tenderIds}::uuid[])`;
}
async function headroomOf(tx, scope) {
    const [row] = await tx.$queryRaw `
    SELECT b.abl_bill_amount - b.abl_disc_amount - b.abl_writeoff_amount
           - COALESCE((SELECT SUM(a.abj_amount) FROM accounts.acc_bill_adjustment a
                        WHERE a.abj_bill_id = b.abl_id AND a.abj_bill_acc_year = b.abl_acc_year
                          AND a.abj_is_deleted = false
                          AND a.abj_adj_type IN ('ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER')), 0)
           AS room
      FROM accounts.acc_bill_balance b
     WHERE b.abl_id = ${scope.abl.ablId}::uuid AND b.abl_acc_year = ${scope.abl.ablAccYear}::char(9)`;
    const room = new client_1.Prisma.Decimal(row?.room ?? 0);
    const limited = scope.cap ? client_1.Prisma.Decimal.min(room, scope.cap) : room;
    return client_1.Prisma.Decimal.max(limited, ZERO);
}
async function nextRowNo(tx, billId) {
    const highest = await tx.accBillAdjustment.aggregate({
        where: { abjBillId: billId },
        _max: { abjRowNo: true },
    });
    return (highest._max.abjRowNo ?? 0) + 1;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOr(v, fallback) {
    return v && UUID.test(v) ? v : fallback;
}
//# sourceMappingURL=bill-counter-allocation.helper.js.map