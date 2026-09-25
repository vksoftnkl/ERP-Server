"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEQUE_TENDER_TYPE_ID = void 0;
exports.syncOrderPdcRegister = syncOrderPdcRegister;
exports.cancelOrderPdcRegister = cancelOrderPdcRegister;
const pdc_register_helper_1 = require("../posting/pdc-register.helper");
var pdc_register_helper_2 = require("../posting/pdc-register.helper");
Object.defineProperty(exports, "CHEQUE_TENDER_TYPE_ID", { enumerable: true, get: function () { return pdc_register_helper_2.CHEQUE_TENDER_TYPE_ID; } });
const ORDER_SRC_MODULE = 'SALES';
const ORDER_SRC_DOC_TYPE = 'SALES_ORDER';
const TENDER_REMOVED_CANCEL_REASON = 'Cheque no longer tendered on the sale order';
const ORDER_UNPOSTED_CANCEL_REASON = 'Sale order no longer holds tendered money';
const ORDER_DELETED_CANCEL_REASON = 'Sale order deleted';
const ORDER_RULES = {
    label: 'order',
    refuseBackdated: true,
    checkDateWindow: false,
};
async function syncOrderPdcRegister(tx, order, tenders, voucher, actor, now) {
    return (0, pdc_register_helper_1.syncDocPdcRegister)(tx, toPdcDocument(order), ORDER_RULES, tenders, voucher, actor, now, {
        removedReason: TENDER_REMOVED_CANCEL_REASON,
    });
}
async function cancelOrderPdcRegister(tx, order, reason, statusBy, actor, now) {
    return (0, pdc_register_helper_1.cancelDocPdcRegister)(tx, {
        srcModule: ORDER_SRC_MODULE,
        srcDocType: ORDER_SRC_DOC_TYPE,
        docId: order.soId,
        accYear: order.soAccYear,
    }, ORDER_RULES, reason === 'deleted' ? ORDER_DELETED_CANCEL_REASON : ORDER_UNPOSTED_CANCEL_REASON, reason === 'deleted', statusBy, actor, now);
}
function toPdcDocument(order) {
    return {
        srcModule: ORDER_SRC_MODULE,
        srcDocType: ORDER_SRC_DOC_TYPE,
        docId: order.soId,
        companyId: order.soCompanyId,
        branchId: order.soBranchId,
        tenantId: order.soTenantId,
        accYear: order.soAccYear,
        refno: order.soOrderRefno,
        docDate: order.soOrderDate,
        partyId: order.soCustId,
        partyName: order.soCustName,
        salesmanId: order.soSalesmanId?.[0] ?? null,
        userId: order.soUserId,
    };
}
//# sourceMappingURL=order-pdc-posting.helper.js.map