import { BillAdjType, BillSettlementMode, BillType, DrCr, ReceiptBillSort } from '../../receipt/types/receipt-enum';
export { BillAdjType, BillSettlementMode, BillStatus, BillType, CANCELLABLE_PDC_STATUSES, CHEQUE_TENDER_TYPE_ID, DrCr, FREE_LEDGER_SETTLEMENT_MODE, PdcInstrumentType, PdcPostingMode, PdcStatus, PdcTraType, ReceiptBillSort as PaymentBillSort, VOUCHER_STATUSES, VoucherDeviceType, VoucherStatus, } from '../../receipt/types/receipt-enum';
export declare const PAYABLE_BILL_TYPES: readonly BillType[];
export declare const HELD_DEBIT_BILL_TYPES: readonly BillType[];
export declare enum PaymentLedgerRole {
    TDS_PAYABLE = "TDS_PAYABLE",
    BANK_CHARGES = "BANK_CHARGES",
    INTEREST_PAID = "INTEREST_PAID",
    BALANCES_WRITTEN_BACK = "BALANCES_WRITTEN_BACK",
    DISCOUNT_RECEIVED = "DISCOUNT_RECEIVED",
    ROUND_OFF = "ROUND_OFF",
    ADVANCE_PAID = "ADVANCE_PAID"
}
export declare const PAYMENT_ROLE_SIDE: Readonly<Partial<Record<PaymentLedgerRole, DrCr>>>;
export declare const PAYMENT_ROLE_SETTLEMENT_MODE: Readonly<Partial<Record<string, BillSettlementMode>>>;
export declare const PAYMENT_REDUCTION_ROLE: {
    readonly discount: PaymentLedgerRole.DISCOUNT_RECEIVED;
    readonly writeoff: PaymentLedgerRole.BALANCES_WRITTEN_BACK;
    readonly roundoff: PaymentLedgerRole.ROUND_OFF;
};
export declare function debitRouting(billType: BillType): {
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
};
export declare enum PaymentSettingKey {
    PDC_POSTING_MODE = "accounts.pdc_posting_mode",
    BILL_SORT = "accounts.receipt_bill_sort",
    SALESMAN_MANDATORY = "accounts.payment_salesman_mandatory",
    WRITEOFF_APPROVAL_ABOVE = "accounts.writeoff_approval_above",
    ALLOW_POSTED_AMEND = "accounts.allow_posted_amend"
}
export { ReceiptBillSort };
export declare const PAYMENT_VOUCHER_TYPE_CODE = "Pmt";
export declare const PAYMENT_MENU_ID = 100;
export declare const PAYMENT_SRC_MODULE = "ACCOUNTS";
export declare const PAYMENT_SRC_DOC_TYPE = "PAYMENT";
export declare const PAYMENT_ADVANCE_SRC_DOC_TYPE = "PAYMENT_ADVANCE";
