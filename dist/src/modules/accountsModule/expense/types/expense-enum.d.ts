export declare const EXPENSE_MENU_ID = 277;
export declare const EXPENSE_VOUCHER_TYPE_CODE = "ExpV";
export declare const EXPENSE_PRINT_PURPOSE_CODE = "EXPENSE_VOUCHER";
export declare const EXPENSE_LIST_GRID_NAME = "MAIN LIST - EXPENSE VOUCHERS";
export declare const EXPENSE_RIGHT_PREFIX = "EXP";
export declare const EXPENSE_SRC_DOC_TYPE = "EXPENSE";
export declare const EXPENSE_GROUP_NATURE = "Expenses";
export declare const EXPENSE_REASON_CATEGORY = "EXPENSE";
export declare const EXPENSE_GST_BILL_ABOVE_KEY = "accounts.expense_gst_bill_above";
export declare const EXPENSE_LINES_MAX = 50;
export declare const EXPENSE_TENDERS_MAX = 10;
export declare enum ExpenseErrorCode {
    TOTAL_MISMATCH = "EXPENSE_TOTAL_MISMATCH",
    LEDGER_NOT_EXPENSE = "EXPENSE_LEDGER_NOT_EXPENSE",
    PARTY_INVALID = "EXPENSE_PARTY_INVALID",
    GST_INCOMPLETE = "EXPENSE_GST_INCOMPLETE",
    GST_RATE_MISSING = "EXPENSE_GST_RATE_MISSING",
    GST_LEDGER_UNMAPPED = "EXPENSE_GST_LEDGER_UNMAPPED",
    GST_BILL_MISSING = "EXPENSE_GST_BILL_MISSING",
    TENDER_NOT_ALLOWED = "EXPENSE_TENDER_NOT_ALLOWED",
    NO_LINES = "EXPENSE_NO_LINES"
}
export declare enum ExpenseStatus {
    DRAFT = "DRAFT",
    POSTED = "POSTED",
    CANCELLED = "CANCELLED"
}
export declare enum ExpenseMoneyFrom {
    DRAWER = "DRAWER",
    SAFE = "SAFE",
    LEDGER = "LEDGER"
}
