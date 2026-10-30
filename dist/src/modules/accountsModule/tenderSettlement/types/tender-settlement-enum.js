"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPORT_MAX_LINES = exports.IMPORT_MAX_BYTES = exports.NONCASH_REASON_CATEGORY = exports.SETTLEMENT_ERROR_STATUS = exports.SettlementErrorCode = exports.WriteOffTreatment = exports.SettlementResolution = exports.SettlementMatchRule = exports.SettlementMatchStatus = exports.SettlementLineKind = exports.SettlementImportStatus = exports.SettlementSource = exports.TenderSettingKey = exports.SettlementRole = exports.MDR_FROM_STATEMENT_DOC_TYPES = exports.WRITE_OFF_SRC_DOC_TYPE = exports.RESOLVE_SRC_DOC_TYPE = exports.SETTLEMENT_SRC_DOC_TYPE = exports.SETTLEMENT_SRC_MODULE = exports.WRITE_OFF_VOUCHER_TYPE_CODE = exports.SETTLEMENT_VOUCHER_TYPE_CODE = exports.SETTLEMENT_RIGHT_PREFIX = exports.SETTLEMENT_MENU_ID = void 0;
exports.SETTLEMENT_MENU_ID = 278;
exports.SETTLEMENT_RIGHT_PREFIX = 'TSET';
exports.SETTLEMENT_VOUCHER_TYPE_CODE = 'TSet';
exports.WRITE_OFF_VOUCHER_TYPE_CODE = 'TVar';
exports.SETTLEMENT_SRC_MODULE = 'ACCOUNTS';
exports.SETTLEMENT_SRC_DOC_TYPE = 'TENDER_SETTLEMENT';
exports.RESOLVE_SRC_DOC_TYPE = 'SETTLEMENT_RESOLVE';
exports.WRITE_OFF_SRC_DOC_TYPE = 'NONCASH_WRITE_OFF';
exports.MDR_FROM_STATEMENT_DOC_TYPES = [
    'SALE_BILL',
    'SALE_RETURN',
    'SALES_ORDER',
];
exports.SettlementRole = {
    TENDER_SUSPENSE: 'TENDER_SUSPENSE',
    BANK_CHARGES: 'BANK_CHARGES',
    GST_ON_CHARGES_PENDING: 'GST_ON_CHARGES_PENDING',
    WRITE_OFF: 'WRITE_OFF',
};
var TenderSettingKey;
(function (TenderSettingKey) {
    TenderSettingKey["DUPLICATE_REF"] = "tender.duplicate_ref";
    TenderSettingKey["CLOSE_BY_TERMINAL"] = "tender.close_by_terminal";
    TenderSettingKey["MATCH_WINDOW_MINUTES"] = "tender.match_window_minutes";
    TenderSettingKey["MATCH_AMOUNT_TOLERANCE"] = "tender.match_amount_tolerance";
    TenderSettingKey["SETTLE_GRACE_DAYS"] = "tender.settle_grace_days";
})(TenderSettingKey || (exports.TenderSettingKey = TenderSettingKey = {}));
var SettlementSource;
(function (SettlementSource) {
    SettlementSource["CARD"] = "CARD";
    SettlementSource["UPI"] = "UPI";
    SettlementSource["WALLET"] = "WALLET";
    SettlementSource["BANK"] = "BANK";
})(SettlementSource || (exports.SettlementSource = SettlementSource = {}));
var SettlementImportStatus;
(function (SettlementImportStatus) {
    SettlementImportStatus["IMPORTED"] = "IMPORTED";
    SettlementImportStatus["MATCHED"] = "MATCHED";
    SettlementImportStatus["POSTED"] = "POSTED";
    SettlementImportStatus["VOIDED"] = "VOIDED";
})(SettlementImportStatus || (exports.SettlementImportStatus = SettlementImportStatus = {}));
var SettlementLineKind;
(function (SettlementLineKind) {
    SettlementLineKind["SALE"] = "SALE";
    SettlementLineKind["REFUND"] = "REFUND";
    SettlementLineKind["CHARGEBACK"] = "CHARGEBACK";
    SettlementLineKind["FEE"] = "FEE";
    SettlementLineKind["ADJUSTMENT"] = "ADJUSTMENT";
})(SettlementLineKind || (exports.SettlementLineKind = SettlementLineKind = {}));
var SettlementMatchStatus;
(function (SettlementMatchStatus) {
    SettlementMatchStatus["UNMATCHED"] = "UNMATCHED";
    SettlementMatchStatus["SUGGESTED"] = "SUGGESTED";
    SettlementMatchStatus["MATCHED"] = "MATCHED";
    SettlementMatchStatus["IGNORED"] = "IGNORED";
    SettlementMatchStatus["RESOLVED"] = "RESOLVED";
})(SettlementMatchStatus || (exports.SettlementMatchStatus = SettlementMatchStatus = {}));
var SettlementMatchRule;
(function (SettlementMatchRule) {
    SettlementMatchRule["REF"] = "REF";
    SettlementMatchRule["AUTH"] = "AUTH";
    SettlementMatchRule["AMOUNT_TIME"] = "AMOUNT_TIME";
    SettlementMatchRule["MANUAL"] = "MANUAL";
})(SettlementMatchRule || (exports.SettlementMatchRule = SettlementMatchRule = {}));
var SettlementResolution;
(function (SettlementResolution) {
    SettlementResolution["LINKED"] = "LINKED";
    SettlementResolution["REFUNDED"] = "REFUNDED";
    SettlementResolution["INCOME"] = "INCOME";
    SettlementResolution["SUSPENSE"] = "SUSPENSE";
})(SettlementResolution || (exports.SettlementResolution = SettlementResolution = {}));
var WriteOffTreatment;
(function (WriteOffTreatment) {
    WriteOffTreatment["RECOVER"] = "RECOVER";
    WriteOffTreatment["SUSPENSE"] = "SUSPENSE";
    WriteOffTreatment["LOSS"] = "LOSS";
})(WriteOffTreatment || (exports.WriteOffTreatment = WriteOffTreatment = {}));
var SettlementErrorCode;
(function (SettlementErrorCode) {
    SettlementErrorCode["FILE_DUPLICATE"] = "SETTLEMENT_FILE_DUPLICATE";
    SettlementErrorCode["FORMAT_MISSING"] = "SETTLEMENT_FORMAT_MISSING";
    SettlementErrorCode["FORMAT_INVALID"] = "SETTLEMENT_FORMAT_INVALID";
    SettlementErrorCode["FILE_INVALID"] = "SETTLEMENT_FILE_INVALID";
    SettlementErrorCode["OTHER_STORE"] = "SETTLEMENT_OTHER_STORE";
    SettlementErrorCode["TERMINAL_UNKNOWN"] = "SETTLEMENT_TERMINAL_UNKNOWN";
    SettlementErrorCode["BANK_MISSING"] = "SETTLEMENT_BANK_MISSING";
    SettlementErrorCode["TD_ALREADY_MATCHED"] = "SETTLEMENT_TD_ALREADY_MATCHED";
    SettlementErrorCode["TD_NOT_CANDIDATE"] = "SETTLEMENT_TD_NOT_CANDIDATE";
    SettlementErrorCode["NOT_BALANCED"] = "SETTLEMENT_NOT_BALANCED";
    SettlementErrorCode["SUGGESTIONS_OPEN"] = "SETTLEMENT_SUGGESTIONS_OPEN";
    SettlementErrorCode["STATE"] = "SETTLEMENT_STATE";
    SettlementErrorCode["POSTED_LOCKED"] = "SETTLEMENT_POSTED_LOCKED";
    SettlementErrorCode["NOT_FOUND"] = "SETTLEMENT_NOT_FOUND";
    SettlementErrorCode["WRITE_OFF_NEEDS_APPROVAL"] = "NONCASH_WRITE_OFF_NEEDS_APPROVAL";
    SettlementErrorCode["RESOLVE_NEEDS_APPROVAL"] = "SETTLEMENT_RESOLVE_NEEDS_APPROVAL";
    SettlementErrorCode["LEDGER_INVALID"] = "SETTLEMENT_LEDGER_INVALID";
    SettlementErrorCode["LEDGER_UNMAPPED"] = "SETTLEMENT_LEDGER_UNMAPPED";
    SettlementErrorCode["REASON_INVALID"] = "SETTLEMENT_REASON_INVALID";
})(SettlementErrorCode || (exports.SettlementErrorCode = SettlementErrorCode = {}));
exports.SETTLEMENT_ERROR_STATUS = {
    [SettlementErrorCode.FILE_DUPLICATE]: 409,
    [SettlementErrorCode.FORMAT_MISSING]: 422,
    [SettlementErrorCode.FORMAT_INVALID]: 422,
    [SettlementErrorCode.FILE_INVALID]: 422,
    [SettlementErrorCode.OTHER_STORE]: 422,
    [SettlementErrorCode.TERMINAL_UNKNOWN]: 422,
    [SettlementErrorCode.BANK_MISSING]: 422,
    [SettlementErrorCode.TD_ALREADY_MATCHED]: 409,
    [SettlementErrorCode.TD_NOT_CANDIDATE]: 422,
    [SettlementErrorCode.NOT_BALANCED]: 422,
    [SettlementErrorCode.SUGGESTIONS_OPEN]: 409,
    [SettlementErrorCode.STATE]: 409,
    [SettlementErrorCode.POSTED_LOCKED]: 409,
    [SettlementErrorCode.NOT_FOUND]: 404,
    [SettlementErrorCode.WRITE_OFF_NEEDS_APPROVAL]: 403,
    [SettlementErrorCode.RESOLVE_NEEDS_APPROVAL]: 403,
    [SettlementErrorCode.LEDGER_INVALID]: 422,
    [SettlementErrorCode.LEDGER_UNMAPPED]: 422,
    [SettlementErrorCode.REASON_INVALID]: 422,
};
exports.NONCASH_REASON_CATEGORY = 'NONCASH';
exports.IMPORT_MAX_BYTES = 10 * 1024 * 1024;
exports.IMPORT_MAX_LINES = 20_000;
//# sourceMappingURL=tender-settlement-enum.js.map