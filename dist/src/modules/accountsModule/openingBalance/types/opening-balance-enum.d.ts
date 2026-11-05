export declare enum OpeningSource {
    CARRY_FORWARD = "CARRY_FORWARD",
    MANUAL = "MANUAL",
    MIGRATION = "MIGRATION"
}
export declare enum OpeningDrCr {
    DEBIT = "D",
    CREDIT = "C"
}
export declare enum BillDrCr {
    DEBIT = "DR",
    CREDIT = "CR"
}
export declare const BALANCE_SHEET_NATURES: readonly ["Assets", "Liabilities"];
export declare const PROFIT_AND_LOSS_NATURES: readonly ["Income", "Expenses"];
export declare enum OpeningLedgerRole {
    OPENING_DIFFERENCE = "OPENING_DIFFERENCE",
    RETAINED_EARNINGS = "RETAINED_EARNINGS"
}
export declare const POSTED_VOUCHER_STATUS = "POSTED";
export declare const OPENING_SRC_MODULE = "ACCOUNTS";
export declare const OPENING_SRC_DOC_TYPE = "OPENING_BALANCE";
export declare const OPENING_BILL_TYPE = "OPENING";
export declare enum FiscalYearStatus {
    OPEN = "OPEN",
    CLOSED = "CLOSED",
    LOCKED = "LOCKED"
}
export declare enum OpeningStaleReason {
    VOUCHER_POSTED = "VOUCHER_POSTED",
    VOUCHER_CANCELLED = "VOUCHER_CANCELLED",
    SOURCE_OPENING_EDITED = "SOURCE_OPENING_EDITED",
    YEAR_REOPENED = "YEAR_REOPENED",
    MANUAL = "MANUAL"
}
