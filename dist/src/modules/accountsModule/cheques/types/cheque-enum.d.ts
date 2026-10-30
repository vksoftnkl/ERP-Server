import { PdcStatus } from '../../receipt/types/receipt-enum';
export declare const DEPOSITABLE_STATUSES: readonly PdcStatus[];
export declare const CLEARABLE_STATUSES: readonly PdcStatus[];
export declare const BOUNCEABLE_STATUSES: readonly PdcStatus[];
export declare const REPRESENTABLE_STATUSES: readonly PdcStatus[];
export declare const REPLACEABLE_STATUSES: readonly PdcStatus[];
export declare const RETURNABLE_STATUSES: readonly PdcStatus[];
export declare const RETURN_ACTIONS: readonly PdcStatus[];
export declare enum ChequeDueBucket {
    FUTURE = "FUTURE",
    DUE_TODAY = "DUE_TODAY",
    OVERDUE = "OVERDUE",
    STALE = "STALE"
}
export declare const STALE_AFTER_DAYS = 92;
export declare enum ChequeLedgerRole {
    BOUNCE_CHARGES_RECOVERED = "BOUNCE_CHARGES_RECOVERED",
    BANK_CHARGES = "BANK_CHARGES"
}
export declare const CLEARING_VOUCHER_TYPE_CODE = "ChqClr";
export declare const BOUNCE_VOUCHER_TYPE_CODE = "ChqBnc";
export declare const RECEIPT_VOUCHER_TYPE_CODE = "Rct";
export declare const CHEQUE_SRC_MODULE = "ACCOUNTS";
export declare const CHEQUE_SRC_DOC_TYPE = "PDC";
export declare const BOUNCE_CHARGE_SRC_DOC_TYPE = "CHEQUE_BOUNCE_CHARGE";
export declare const DEPOSIT_SLIP_PRINT_PURPOSE_CODE = "CHEQUE_DEPOSIT_SLIP";
export declare enum ChequeSettingKey {
    BOUNCE_CHARGE_TO_PARTY = "accounts.bounce_charge_to_party",
    BOUNCE_REASONS = "accounts.bounce_reasons"
}
export declare const DEFAULT_BOUNCE_REASONS: readonly string[];
export declare const BOUNCE_REASON_MAX_LENGTH = 150;
export declare const CANCEL_REASON_MAX_LENGTH = 250;
