"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALE_ORDER_SRC_DOC_TYPE = exports.SALE_ORDER_CANCEL_SRC_MODULES = exports.SALE_ORDER_DOC_TYPES = exports.SALE_ORDER_STATUS_SRC_DOC_TYPE = exports.SALE_ORDER_STATUS_SRC_MODULE = exports.SALE_ORDER_TENDER_AUDIT = exports.SALE_ORDER_TENDER_DR_CR = exports.SALE_ORDER_TENDER_SRC_DOC_TYPE = exports.SALE_ORDER_TENDER_SRC_MODULE = exports.SALE_ORDER_CHARGE_AUDIT = exports.SALE_ORDER_CHARGE_DOC_TYPE = void 0;
const charge_enum_1 = require("../../../master/charge-master/types/charge-enum");
const tender_detail_api_types_1 = require("../../../accountsModule/tenderDetail/types/tender-detail-api.types");
const txn_status_log_helper_1 = require("../../../../common/txn-status-log/txn-status-log.helper");
exports.SALE_ORDER_CHARGE_DOC_TYPE = charge_enum_1.ChargeDocType.ORDER;
exports.SALE_ORDER_CHARGE_AUDIT = {
    tableName: 'txn_charge_detail',
    screenName: 'Sale Order',
    entityName: 'Order charge',
};
exports.SALE_ORDER_TENDER_SRC_MODULE = tender_detail_api_types_1.TenderSrcModule.SALES;
exports.SALE_ORDER_TENDER_SRC_DOC_TYPE = tender_detail_api_types_1.TenderSrcDocType.SALES_ORDER;
exports.SALE_ORDER_TENDER_DR_CR = tender_detail_api_types_1.TenderDrCr.DR;
exports.SALE_ORDER_TENDER_AUDIT = {
    tableName: 'acc_tender_detail',
    screenName: 'Sale Order',
    entityName: 'Order tender',
};
exports.SALE_ORDER_STATUS_SRC_MODULE = txn_status_log_helper_1.TxnStatusSrcModule.SALES;
exports.SALE_ORDER_STATUS_SRC_DOC_TYPE = txn_status_log_helper_1.TxnStatusDocType.SALES_ORDER;
exports.SALE_ORDER_DOC_TYPES = ['SALES_ORDER', 'BOOKING', 'CUSTOM_ORDER'];
exports.SALE_ORDER_CANCEL_SRC_MODULES = [
    exports.SALE_ORDER_STATUS_SRC_MODULE,
    ...exports.SALE_ORDER_DOC_TYPES,
];
exports.SALE_ORDER_SRC_DOC_TYPE = exports.SALE_ORDER_STATUS_SRC_DOC_TYPE;
//# sourceMappingURL=sale-order-api.types.js.map