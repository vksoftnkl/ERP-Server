"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANCEL_REASON_MAX_LENGTH = exports.BOUNCE_REASON_MAX_LENGTH = exports.DEFAULT_BOUNCE_REASONS = exports.ChequeSettingKey = exports.DEPOSIT_SLIP_PRINT_PURPOSE_CODE = exports.BOUNCE_CHARGE_SRC_DOC_TYPE = exports.CHEQUE_SRC_DOC_TYPE = exports.CHEQUE_SRC_MODULE = exports.RECEIPT_VOUCHER_TYPE_CODE = exports.BOUNCE_VOUCHER_TYPE_CODE = exports.CLEARING_VOUCHER_TYPE_CODE = exports.ChequeLedgerRole = exports.STALE_AFTER_DAYS = exports.ChequeDueBucket = exports.RETURN_ACTIONS = exports.RETURNABLE_STATUSES = exports.REPLACEABLE_STATUSES = exports.REPRESENTABLE_STATUSES = exports.BOUNCEABLE_STATUSES = exports.CLEARABLE_STATUSES = exports.DEPOSITABLE_STATUSES = void 0;
const receipt_enum_1 = require("../../receipt/types/receipt-enum");
exports.DEPOSITABLE_STATUSES = [receipt_enum_1.PdcStatus.HELD];
exports.CLEARABLE_STATUSES = [receipt_enum_1.PdcStatus.DEPOSITED];
exports.BOUNCEABLE_STATUSES = [receipt_enum_1.PdcStatus.DEPOSITED];
exports.REPRESENTABLE_STATUSES = [receipt_enum_1.PdcStatus.BOUNCED];
exports.REPLACEABLE_STATUSES = [receipt_enum_1.PdcStatus.BOUNCED, receipt_enum_1.PdcStatus.HELD];
exports.RETURNABLE_STATUSES = [receipt_enum_1.PdcStatus.HELD];
exports.RETURN_ACTIONS = [receipt_enum_1.PdcStatus.RETURNED, receipt_enum_1.PdcStatus.CANCELLED];
var ChequeDueBucket;
(function (ChequeDueBucket) {
    ChequeDueBucket["FUTURE"] = "FUTURE";
    ChequeDueBucket["DUE_TODAY"] = "DUE_TODAY";
    ChequeDueBucket["OVERDUE"] = "OVERDUE";
    ChequeDueBucket["STALE"] = "STALE";
})(ChequeDueBucket || (exports.ChequeDueBucket = ChequeDueBucket = {}));
exports.STALE_AFTER_DAYS = 92;
var ChequeLedgerRole;
(function (ChequeLedgerRole) {
    ChequeLedgerRole["BOUNCE_CHARGES_RECOVERED"] = "BOUNCE_CHARGES_RECOVERED";
    ChequeLedgerRole["BANK_CHARGES"] = "BANK_CHARGES";
})(ChequeLedgerRole || (exports.ChequeLedgerRole = ChequeLedgerRole = {}));
exports.CLEARING_VOUCHER_TYPE_CODE = 'ChqClr';
exports.BOUNCE_VOUCHER_TYPE_CODE = 'ChqBnc';
exports.RECEIPT_VOUCHER_TYPE_CODE = 'Rct';
exports.CHEQUE_SRC_MODULE = 'ACCOUNTS';
exports.CHEQUE_SRC_DOC_TYPE = 'PDC';
exports.BOUNCE_CHARGE_SRC_DOC_TYPE = 'CHEQUE_BOUNCE_CHARGE';
exports.DEPOSIT_SLIP_PRINT_PURPOSE_CODE = 'CHEQUE_DEPOSIT_SLIP';
var ChequeSettingKey;
(function (ChequeSettingKey) {
    ChequeSettingKey["BOUNCE_CHARGE_TO_PARTY"] = "accounts.bounce_charge_to_party";
    ChequeSettingKey["BOUNCE_REASONS"] = "accounts.bounce_reasons";
})(ChequeSettingKey || (exports.ChequeSettingKey = ChequeSettingKey = {}));
exports.DEFAULT_BOUNCE_REASONS = [
    'Funds insufficient',
    'Payment stopped by drawer',
    'Signature differs',
    'Account closed',
    'Post-dated presented early',
    'Stale',
    'Other',
];
exports.BOUNCE_REASON_MAX_LENGTH = 150;
exports.CANCEL_REASON_MAX_LENGTH = 250;
//# sourceMappingURL=cheque-enum.js.map