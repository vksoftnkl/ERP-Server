"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncBillPdcRegister = syncBillPdcRegister;
exports.cancelBillPdcRegister = cancelBillPdcRegister;
exports.assertBillPdcHeld = assertBillPdcHeld;
const client_1 = require("@prisma/client");
const pdc_register_helper_1 = require("../posting/pdc-register.helper");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const BILL_SRC_MODULE = 'SALES';
const BILL_SRC_DOC_TYPE = 'SALE_BILL';
const TENDER_REMOVED_CANCEL_REASON = 'Cheque no longer tendered on the sale bill';
const BILL_CANCELLED_REASON_PREFIX = 'Sale bill cancelled';
const BILL_RULES = {
    label: 'bill',
    refuseBackdated: false,
    checkDateWindow: true,
    onMoved: (row, change) => (0, sales_errors_1.throwSalesLocked)(`Cheque ${row.apdInstrumentNo} on this bill is ${row.apdStatus} in the cheque register, so ` +
        `it can no longer be ${change} from the bill. Settle it on the Cheques screen first ` +
        '(a bounced cheque is a bounce, not a bill edit).', posting_types_1.SALES_ERROR_CODES.BILL_PDC_MOVED, 'tenders'),
};
async function syncBillPdcRegister(tx, bill, voucher, actor, now, opts = {}) {
    const doc = toPdcDocument(bill);
    if (!doc) {
        return [];
    }
    const details = opts.details ?? {};
    const tenders = (await loadLiveTenders(tx, bill)).map((tender) => tender.tdId in details ? { ...tender, cheque: details[tender.tdId] } : tender);
    return (0, pdc_register_helper_1.syncDocPdcRegister)(tx, doc, BILL_RULES, tenders, voucher, actor, now, {
        keepStoredVoucher: opts.keepStoredVoucher,
        removedReason: TENDER_REMOVED_CANCEL_REASON,
    });
}
async function cancelBillPdcRegister(tx, bill, reason, actor, now) {
    return (0, pdc_register_helper_1.cancelDocPdcRegister)(tx, refOf(bill), BILL_RULES, `${BILL_CANCELLED_REASON_PREFIX}: ${reason}`, false, isUuid(bill.sbUserId) ? bill.sbUserId : null, actor, now);
}
async function assertBillPdcHeld(tx, bill) {
    await (0, pdc_register_helper_1.assertDocPdcHeld)(tx, refOf(bill), BILL_RULES);
}
function refOf(bill) {
    return {
        srcModule: BILL_SRC_MODULE,
        srcDocType: BILL_SRC_DOC_TYPE,
        docId: bill.sbId,
        accYear: bill.sbAccYear,
    };
}
function toPdcDocument(bill) {
    if (!bill.sbCustId) {
        return null;
    }
    return {
        ...refOf(bill),
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        refno: bill.sbBillRefno ?? bill.sbId,
        docDate: bill.sbBillDate,
        partyId: bill.sbCustId,
        partyName: bill.sbCustName,
        salesmanId: bill.sbSalesmanId?.[0] ?? null,
        userId: isUuid(bill.sbUserId) ? bill.sbUserId : null,
    };
}
async function loadLiveTenders(tx, bill) {
    const rows = await tx.$queryRaw `
    SELECT td_id, td_row_no, td_tender_type_id, td_total_amt, td_ref_no, td_instrument_date,
           td_bank_name, td_settle_ledger_id, td_notes
      FROM accounts.acc_tender_detail
     WHERE td_src_module = ${BILL_SRC_MODULE} AND td_src_doc_type = ${BILL_SRC_DOC_TYPE}
       AND td_src_doc_id = ${bill.sbId}::uuid AND td_acc_year = ${bill.sbAccYear}::char(9)
       AND td_is_deleted = false AND td_is_voided = false
       AND td_tender_type_id = ${pdc_register_helper_1.CHEQUE_TENDER_TYPE_ID}
     ORDER BY td_row_no`;
    return rows.map((row) => ({
        tdId: row.td_id,
        tdRowNo: Number(row.td_row_no),
        tdTenderTypeId: Number(row.td_tender_type_id),
        tdTotalAmt: new client_1.Prisma.Decimal(row.td_total_amt),
        tdRefNo: row.td_ref_no,
        tdInstrumentDate: row.td_instrument_date,
        tdBankName: row.td_bank_name,
        tdSettleLedgerId: row.td_settle_ledger_id,
        tdNotes: row.td_notes,
    }));
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=bill-pdc-posting.helper.js.map