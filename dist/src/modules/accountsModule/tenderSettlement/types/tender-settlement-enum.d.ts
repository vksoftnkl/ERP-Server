export declare const SETTLEMENT_MENU_ID = 278;
export declare const SETTLEMENT_RIGHT_PREFIX = "TSET";
export declare const SETTLEMENT_VOUCHER_TYPE_CODE = "TSet";
export declare const WRITE_OFF_VOUCHER_TYPE_CODE = "TVar";
export declare const SETTLEMENT_SRC_MODULE = "ACCOUNTS";
export declare const SETTLEMENT_SRC_DOC_TYPE = "TENDER_SETTLEMENT";
export declare const RESOLVE_SRC_DOC_TYPE = "SETTLEMENT_RESOLVE";
export declare const WRITE_OFF_SRC_DOC_TYPE = "NONCASH_WRITE_OFF";
export declare const MDR_FROM_STATEMENT_DOC_TYPES: readonly string[];
export declare const SettlementRole: {
    readonly TENDER_SUSPENSE: "TENDER_SUSPENSE";
    readonly BANK_CHARGES: "BANK_CHARGES";
    readonly GST_ON_CHARGES_PENDING: "GST_ON_CHARGES_PENDING";
    readonly WRITE_OFF: "WRITE_OFF";
};
export declare enum TenderSettingKey {
    DUPLICATE_REF = "tender.duplicate_ref",
    CLOSE_BY_TERMINAL = "tender.close_by_terminal",
    MATCH_WINDOW_MINUTES = "tender.match_window_minutes",
    MATCH_AMOUNT_TOLERANCE = "tender.match_amount_tolerance",
    SETTLE_GRACE_DAYS = "tender.settle_grace_days"
}
export declare enum SettlementSource {
    CARD = "CARD",
    UPI = "UPI",
    WALLET = "WALLET",
    BANK = "BANK"
}
export declare enum SettlementImportStatus {
    IMPORTED = "IMPORTED",
    MATCHED = "MATCHED",
    POSTED = "POSTED",
    VOIDED = "VOIDED"
}
export declare enum SettlementLineKind {
    SALE = "SALE",
    REFUND = "REFUND",
    CHARGEBACK = "CHARGEBACK",
    FEE = "FEE",
    ADJUSTMENT = "ADJUSTMENT"
}
export declare enum SettlementMatchStatus {
    UNMATCHED = "UNMATCHED",
    SUGGESTED = "SUGGESTED",
    MATCHED = "MATCHED",
    IGNORED = "IGNORED",
    RESOLVED = "RESOLVED"
}
export declare enum SettlementMatchRule {
    REF = "REF",
    AUTH = "AUTH",
    AMOUNT_TIME = "AMOUNT_TIME",
    MANUAL = "MANUAL"
}
export declare enum SettlementResolution {
    LINKED = "LINKED",
    REFUNDED = "REFUNDED",
    INCOME = "INCOME",
    SUSPENSE = "SUSPENSE"
}
export declare enum WriteOffTreatment {
    RECOVER = "RECOVER",
    SUSPENSE = "SUSPENSE",
    LOSS = "LOSS"
}
export declare enum SettlementErrorCode {
    FILE_DUPLICATE = "SETTLEMENT_FILE_DUPLICATE",
    FORMAT_MISSING = "SETTLEMENT_FORMAT_MISSING",
    FORMAT_INVALID = "SETTLEMENT_FORMAT_INVALID",
    FILE_INVALID = "SETTLEMENT_FILE_INVALID",
    OTHER_STORE = "SETTLEMENT_OTHER_STORE",
    TERMINAL_UNKNOWN = "SETTLEMENT_TERMINAL_UNKNOWN",
    BANK_MISSING = "SETTLEMENT_BANK_MISSING",
    TD_ALREADY_MATCHED = "SETTLEMENT_TD_ALREADY_MATCHED",
    TD_NOT_CANDIDATE = "SETTLEMENT_TD_NOT_CANDIDATE",
    NOT_BALANCED = "SETTLEMENT_NOT_BALANCED",
    SUGGESTIONS_OPEN = "SETTLEMENT_SUGGESTIONS_OPEN",
    STATE = "SETTLEMENT_STATE",
    POSTED_LOCKED = "SETTLEMENT_POSTED_LOCKED",
    NOT_FOUND = "SETTLEMENT_NOT_FOUND",
    WRITE_OFF_NEEDS_APPROVAL = "NONCASH_WRITE_OFF_NEEDS_APPROVAL",
    RESOLVE_NEEDS_APPROVAL = "SETTLEMENT_RESOLVE_NEEDS_APPROVAL",
    LEDGER_INVALID = "SETTLEMENT_LEDGER_INVALID",
    LEDGER_UNMAPPED = "SETTLEMENT_LEDGER_UNMAPPED",
    REASON_INVALID = "SETTLEMENT_REASON_INVALID"
}
export declare const SETTLEMENT_ERROR_STATUS: Readonly<Record<SettlementErrorCode, number>>;
export declare const NONCASH_REASON_CATEGORY = "NONCASH";
export declare const IMPORT_MAX_BYTES: number;
export declare const IMPORT_MAX_LINES = 20000;
