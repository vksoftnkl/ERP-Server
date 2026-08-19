"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BILL_STATUS_POSTED = exports.BILL_STATUS_SRC_DOC_TYPE = exports.BILL_STATUS_SRC_MODULE = exports.BILL_TENDER_AUDIT = exports.BILL_TENDER_DR_CR = exports.BILL_TENDER_SRC_DOC_TYPE = exports.BILL_TENDER_SRC_MODULE = exports.BILL_CHARGE_AUDIT = exports.BILL_CHARGE_DOC_TYPE = void 0;
const charge_enum_1 = require("../../../master/charge-master/types/charge-enum");
const tender_detail_api_types_1 = require("../../../accountsModule/tenderDetail/types/tender-detail-api.types");
const txn_status_log_helper_1 = require("../../../../common/txn-status-log/txn-status-log.helper");
exports.BILL_CHARGE_DOC_TYPE = charge_enum_1.ChargeDocType.INVOICE;
exports.BILL_CHARGE_AUDIT = {
    tableName: 'txn_charge_detail',
    screenName: 'Sale Bill',
    entityName: 'Bill charge',
};
exports.BILL_TENDER_SRC_MODULE = tender_detail_api_types_1.TenderSrcModule.SALES;
exports.BILL_TENDER_SRC_DOC_TYPE = tender_detail_api_types_1.TenderSrcDocType.SALE_BILL;
exports.BILL_TENDER_DR_CR = tender_detail_api_types_1.TenderDrCr.DR;
exports.BILL_TENDER_AUDIT = {
    tableName: 'acc_tender_detail',
    screenName: 'Sale Bill',
    entityName: 'Bill tender',
};
exports.BILL_STATUS_SRC_MODULE = txn_status_log_helper_1.TxnStatusSrcModule.SALES;
exports.BILL_STATUS_SRC_DOC_TYPE = txn_status_log_helper_1.TxnStatusDocType.SALE_BILL;
exports.BILL_STATUS_POSTED = 'POSTED';
//# sourceMappingURL=bill-api.types.js.map