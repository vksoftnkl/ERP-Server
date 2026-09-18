export declare enum VoucherStatus {
    DRAFT = "DRAFT",
    APPROVED = "APPROVED",
    POSTED = "POSTED",
    CANCELLED = "CANCELLED"
}
export declare enum VoucherDeviceType {
    PC = "PC",
    WEB = "WEB",
    MOBILE = "MOBILE",
    POS = "POS",
    DESKTOP = "DESKTOP"
}
export declare const VOUCHER_STATUSES: readonly VoucherStatus[];
export declare enum DrCr {
    DR = "DR",
    CR = "CR"
}
export declare enum BillType {
    SALES = "SALES",
    PURCHASE = "PURCHASE",
    SALES_RETURN = "SALES_RETURN",
    PURCHASE_RETURN = "PURCHASE_RETURN",
    OPENING = "OPENING",
    ADVANCE = "ADVANCE",
    INTEREST = "INTEREST",
    JOURNAL = "JOURNAL"
}
export declare enum BillStatus {
    OPEN = "OPEN",
    PARTIAL = "PARTIAL",
    CLOSED = "CLOSED"
}
export declare const RECEIVABLE_BILL_TYPES: readonly BillType[];
export declare const CREDIT_BILL_TYPES: readonly BillType[];
export declare enum BillAdjType {
    ALLOCATION = "ALLOCATION",
    ADVANCE_ADJUST = "ADVANCE_ADJUST",
    NOTE_ADJUST = "NOTE_ADJUST",
    DISCOUNT = "DISCOUNT",
    WRITEOFF = "WRITEOFF",
    TRANSFER = "TRANSFER"
}
export declare const ALLOCATING_ADJ_TYPES: readonly BillAdjType[];
export declare enum BillSettlementMode {
    CASH = "CASH",
    CARD = "CARD",
    UPI = "UPI",
    WALLET = "WALLET",
    CHEQUE = "CHEQUE",
    BANK = "BANK",
    CREDIT_NOTE = "CREDIT_NOTE",
    ADVANCE = "ADVANCE",
    LOYALTY = "LOYALTY",
    VOUCHER = "VOUCHER",
    JOURNAL = "JOURNAL",
    DISCOUNT = "DISCOUNT",
    WRITEOFF = "WRITEOFF",
    MIXED = "MIXED",
    TDS = "TDS",
    CLAIM = "CLAIM"
}
export declare enum PdcTraType {
    RECEIVED = "R",
    PAID = "P"
}
export declare enum PdcInstrumentType {
    CHEQUE = "CHEQUE",
    DD = "DD",
    PAY_ORDER = "PAY_ORDER",
    ECS = "ECS",
    NACH = "NACH",
    UPI_MANDATE = "UPI_MANDATE"
}
export declare enum PdcStatus {
    HELD = "HELD",
    DEPOSITED = "DEPOSITED",
    CLEARED = "CLEARED",
    BOUNCED = "BOUNCED",
    RETURNED = "RETURNED",
    CANCELLED = "CANCELLED",
    REPLACED = "REPLACED"
}
export declare const CANCELLABLE_PDC_STATUSES: readonly PdcStatus[];
export declare enum PdcPostingMode {
    ON_RECEIPT = "ON_RECEIPT",
    ON_CLEARING = "ON_CLEARING"
}
export declare const CHEQUE_TENDER_TYPE_ID = 5;
export declare enum ReceiptLedgerRole {
    TDS_RECEIVABLE = "TDS_RECEIVABLE",
    BANK_CHARGES = "BANK_CHARGES",
    SURCHARGE_RECOVERED = "SURCHARGE_RECOVERED",
    CLAIMS_ALLOWED = "CLAIMS_ALLOWED",
    INTEREST_INCOME = "INTEREST_INCOME",
    DISCOUNT_ALLOWED = "DISCOUNT_ALLOWED",
    WRITE_OFF = "WRITE_OFF",
    TCS_PAYABLE = "TCS_PAYABLE"
}
export declare const ROLE_SIDE: Readonly<Record<ReceiptLedgerRole, DrCr>>;
export declare const ROLE_SETTLEMENT_MODE: Readonly<Partial<Record<string, BillSettlementMode>>>;
export declare const FREE_LEDGER_SETTLEMENT_MODE = BillSettlementMode.JOURNAL;
export declare enum ReceiptSettingKey {
    PDC_POSTING_MODE = "accounts.pdc_posting_mode",
    BILL_SORT = "accounts.receipt_bill_sort",
    SALESMAN_MANDATORY = "accounts.receipt_salesman_mandatory",
    WRITEOFF_APPROVAL_ABOVE = "accounts.writeoff_approval_above",
    TCS_BASIS = "accounts.tcs_basis",
    PPD_SLABS = "accounts.ppd_slabs",
    ALLOW_POSTED_AMEND = "accounts.allow_posted_amend"
}
export declare enum ReceiptBillSort {
    DUE_DATE = "DUE_DATE",
    BILL_DATE = "BILL_DATE"
}
export declare enum TcsBasis {
    RECEIPT = "RECEIPT",
    SALES = "SALES"
}
export declare const RECEIPT_VOUCHER_TYPE_CODE = "Rct";
export declare const RECEIPT_SRC_MODULE = "ACCOUNTS";
export declare const RECEIPT_SRC_DOC_TYPE = "RECEIPT";
export declare const ADVANCE_SRC_DOC_TYPE = "RECEIPT_ADVANCE";
export declare const RECEIPT_PRINT_PURPOSE_CODE = "RECEIPT_VOUCHER";
