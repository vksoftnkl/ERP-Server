"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSaleBillOfCheque = findSaleBillOfCheque;
exports.moveSaleBillSettlement = moveSaleBillSettlement;
exports.moveSaleBillHeader = moveSaleBillHeader;
const client_1 = require("@prisma/client");
const receipt_utils_1 = require("../receipt/receipt.utils");
const SALE_BILL_SRC_MODULE = 'SALES';
const SALE_BILL_SRC_DOC_TYPE = 'SALE_BILL';
async function findSaleBillOfCheque(tx, cheque) {
    if (!cheque.apdTenderId) {
        return null;
    }
    const [row] = await tx.$queryRaw `
    SELECT b.sb_id, b.sb_acc_year, l.abl_id, l.abl_acc_year,
           (SELECT SUM(a.abj_amount) FROM accounts.acc_bill_adjustment a
             WHERE a.abj_bill_id = l.abl_id AND a.abj_bill_acc_year = l.abl_acc_year
               AND a.abj_tender_id = t.td_id AND a.abj_adj_type = 'ALLOCATION'
               AND a.abj_reversal_of_id IS NULL AND a.abj_is_deleted = false) AS counter_amount
      FROM accounts.acc_tender_detail t
      JOIN sales.sale_bill b
        ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
      JOIN accounts.acc_bill_balance l
        ON l.abl_src_doc_id = b.sb_id AND l.abl_acc_year = b.sb_acc_year
       AND l.abl_src_doc_type = ${SALE_BILL_SRC_DOC_TYPE} AND l.abl_is_deleted = false
     WHERE t.td_id = ${cheque.apdTenderId}::uuid
       AND t.td_src_module = ${SALE_BILL_SRC_MODULE} AND t.td_src_doc_type = ${SALE_BILL_SRC_DOC_TYPE}
       AND b.sb_status = 'POSTED'
     LIMIT 1`;
    if (!row) {
        return null;
    }
    return {
        sbId: row.sb_id,
        sbAccYear: row.sb_acc_year.trim(),
        ablId: row.abl_id,
        ablAccYear: row.abl_acc_year.trim(),
        hasCounterRow: row.counter_amount !== null,
        counterAmount: new client_1.Prisma.Decimal(row.counter_amount ?? 0),
    };
}
async function moveSaleBillSettlement(tx, link, delta, settledOn, actor) {
    const now = new Date();
    await tx.$queryRaw `
    SELECT sb_id FROM sales.sale_bill
     WHERE sb_id = ${link.sbId}::uuid AND sb_acc_year = ${link.sbAccYear}::char(9)
       FOR UPDATE`;
    const [abl] = await tx.$queryRaw `
    WITH locked AS (
      SELECT abl_id, abl_acc_year, abl_alloc_amount
        FROM accounts.acc_bill_balance
       WHERE abl_id = ${link.ablId}::uuid AND abl_acc_year = ${link.ablAccYear}::char(9)
         FOR UPDATE
    )
    UPDATE accounts.acc_bill_balance l
       SET abl_alloc_amount = GREATEST(0, LEAST(l.abl_bill_amount - l.abl_disc_amount - l.abl_writeoff_amount,
                                                l.abl_alloc_amount + ${delta}::numeric)),
           abl_settled_on = CASE
                              WHEN GREATEST(0, LEAST(l.abl_bill_amount - l.abl_disc_amount - l.abl_writeoff_amount,
                                                     l.abl_alloc_amount + ${delta}::numeric))
                                   >= l.abl_bill_amount - l.abl_disc_amount - l.abl_writeoff_amount
                              THEN COALESCE(l.abl_settled_on, ${settledOn}::date)
                              ELSE NULL END,
           abl_modified_on = ${now},
           abl_modified_by = ${actor}
      FROM locked
     WHERE l.abl_id = locked.abl_id AND l.abl_acc_year = locked.abl_acc_year
    RETURNING l.abl_bill_type, l.abl_doc_refno, l.abl_doc_date, l.abl_due_date, l.abl_bill_amount,
              (l.abl_bill_amount - l.abl_alloc_amount - l.abl_disc_amount - l.abl_writeoff_amount)
                AS abl_pending_amount,
              locked.abl_alloc_amount AS old_alloc, l.abl_alloc_amount AS new_alloc`;
    const moved = new client_1.Prisma.Decimal(abl.new_alloc).minus(abl.old_alloc);
    await moveSaleBillHeader(tx, link, moved, now);
    return {
        billId: link.ablId,
        billAccYear: link.ablAccYear,
        billType: abl.abl_bill_type,
        docRefno: abl.abl_doc_refno,
        docDate: (0, receipt_utils_1.toDateString)(abl.abl_doc_date) ?? '',
        dueDate: (0, receipt_utils_1.toDateString)(abl.abl_due_date),
        billAmount: (0, receipt_utils_1.toAmount)(abl.abl_bill_amount),
        pendingAmount: (0, receipt_utils_1.toAmount)(abl.abl_pending_amount),
        settledByThisCheque: (0, receipt_utils_1.toAmount)(moved.abs()),
    };
}
async function moveSaleBillHeader(tx, link, moved, now = new Date()) {
    await tx.$executeRaw `
    UPDATE sales.sale_bill
       SET sb_paid_amt    = GREATEST(0, sb_paid_amt + ${moved}::numeric),
           sb_balance_amt = sb_bill_amt - GREATEST(0, sb_paid_amt + ${moved}::numeric),
           sb_pay_status  = CASE
                              WHEN sb_bill_amt - GREATEST(0, sb_paid_amt + ${moved}::numeric) <= 0.005 THEN 'PAID'
                              WHEN GREATEST(0, sb_paid_amt + ${moved}::numeric) > 0 THEN 'PARTIAL'
                              ELSE 'UNPAID' END,
           sb_modified_on = ${now}
     WHERE sb_id = ${link.sbId}::uuid AND sb_acc_year = ${link.sbAccYear}::char(9)`;
}
//# sourceMappingURL=sale-bill-cheque.helper.js.map