"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUOTATION_STATUS_ACCEPTED = exports.QUOTATION_CONVERTED_DOC_TYPE_BILL = exports.QUOTATION_STATUS_CONVERTED = exports.QUOTATION_SRC_DOC_TYPE = exports.QUOTATION_STATUS_SRC_DOC_TYPE = exports.QUOTATION_STATUS_SRC_MODULE = exports.QUOTATION_CHARGE_DOC_TYPE = void 0;
const charge_enum_1 = require("../../../master/charge-master/types/charge-enum");
const txn_status_log_helper_1 = require("../../../../common/txn-status-log/txn-status-log.helper");
exports.QUOTATION_CHARGE_DOC_TYPE = charge_enum_1.ChargeDocType.QUOTATION;
exports.QUOTATION_STATUS_SRC_MODULE = txn_status_log_helper_1.TxnStatusSrcModule.SALES;
exports.QUOTATION_STATUS_SRC_DOC_TYPE = txn_status_log_helper_1.TxnStatusDocType.QUOTATION;
exports.QUOTATION_SRC_DOC_TYPE = txn_status_log_helper_1.TxnStatusDocType.QUOTATION;
exports.QUOTATION_STATUS_CONVERTED = 'CONVERTED';
exports.QUOTATION_CONVERTED_DOC_TYPE_BILL = txn_status_log_helper_1.TxnStatusDocType.SALE_BILL;
exports.QUOTATION_STATUS_ACCEPTED = 'ACCEPTED';
//# sourceMappingURL=quotation-api.types.js.map