"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PURCHASE_INVOICE_MENU = void 0;
exports.holdsOfBills = holdsOfBills;
exports.assertPaymentHoldCleared = assertPaymentHoldCleared;
const common_1 = require("@nestjs/common");
const rights_1 = require("../../../common/posting/rights");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
exports.PURCHASE_INVOICE_MENU = 24;
async function holdsOfBills(tx, ablIds) {
    if (!ablIds.length)
        return new Map();
    const rows = await tx.$queryRaw `
    SELECT b.abl_id, p.pi_id, p.pi_acc_year, p.pi_company_id, p.pi_branch_id, p.pi_refno, p.pi_supplier_inv_no, p.pi_hold_reason
      FROM accounts.acc_bill_balance b
      JOIN purchase.pur_invoice p ON p.pi_id = b.abl_src_doc_id AND p.pi_acc_year = b.abl_src_acc_year
     WHERE b.abl_id = ANY(${ablIds}::uuid[]) AND b.abl_src_module = 'PURCHASE' AND b.abl_src_doc_type = 'PURCHASE_BILL'
       AND p.pi_payment_hold AND NOT p.pi_is_deleted`;
    return new Map(rows.map((r) => [r.abl_id, {
            ablId: r.abl_id, piId: r.pi_id, accYear: r.pi_acc_year, companyId: r.pi_company_id, branchId: r.pi_branch_id,
            refno: r.pi_refno, supplierInvNo: r.pi_supplier_inv_no, reason: r.pi_hold_reason,
        }]));
}
async function assertPaymentHoldCleared(tx, bills, userId, paymentRef) {
    const holds = await holdsOfBills(tx, bills.map((b) => b.billId));
    if (!holds.size)
        return;
    const rights = userId ? await (0, rights_1.loadRights)(tx, userId, exports.PURCHASE_INVOICE_MENU) : null;
    const canOverride = !!rights?.override;
    const held = bills.filter((b) => holds.has(b.billId));
    if (!canOverride) {
        const errors = held.map((b) => {
            const h = holds.get(b.billId);
            return { field: b.field, code: 'PUR_PAYMENT_HOLD',
                message: `Bill ${h.refno} (supplier invoice ${h.supplierInvNo}) is on payment hold${h.reason ? `: ${h.reason}` : ''}. Release it in Purchase Entry first — releasing needs the Override right there.` };
        });
        throw new common_1.HttpException({ success: false, message: errors[0].message, errors }, common_1.HttpStatus.CONFLICT);
    }
    for (const b of held) {
        const h = holds.get(b.billId);
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, srcModule: txn_status_log_helper_1.TxnStatusSrcModule.PURCHASE, srcDocType: txn_status_log_helper_1.TxnStatusDocType.PURCHASE_BILL,
            srcDocId: h.piId, srcDocRefno: h.refno, event: txn_status_log_helper_1.TxnStatusEvent.HOLD_OVERRIDE, fromStatus: 'POSTED', toStatus: 'POSTED',
            changedBy: userId ?? 'SYSTEM', remarks: `Paid while on hold, in ${paymentRef} (override right)${h.reason ? ` — hold: ${h.reason}` : ''}`,
        });
    }
}
//# sourceMappingURL=purchase-hold.js.map