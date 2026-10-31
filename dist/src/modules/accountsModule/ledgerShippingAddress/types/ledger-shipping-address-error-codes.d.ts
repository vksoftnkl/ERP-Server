export declare const LedgerShippingAddressErrorCode: {
    readonly NOT_FOUND: "SHIPPING_NOT_FOUND";
    readonly ID_REQUIRED: "SHIPPING_ID_REQUIRED";
    readonly DUPLICATE: "SHIPPING_DUPLICATE";
    readonly LEDGER_NOT_FOUND: "SHIPPING_LEDGER_NOT_FOUND";
    readonly COMPANY_NOT_FOUND: "SHIPPING_COMPANY_NOT_FOUND";
    readonly BRANCH_NOT_FOUND: "SHIPPING_BRANCH_NOT_FOUND";
    readonly ADDR_TYPE_INVALID: "SHIPPING_ADDR_TYPE_INVALID";
    readonly STATE_CODE_INVALID: "SHIPPING_STATE_CODE_INVALID";
    readonly PIN_INVALID: "SHIPPING_PIN_INVALID";
    readonly GSTIN_REQUIRED: "SHIPPING_GSTIN_REQUIRED";
    readonly GSTIN_INVALID: "SHIPPING_GSTIN_INVALID";
};
export type LedgerShippingAddressErrorCode = (typeof LedgerShippingAddressErrorCode)[keyof typeof LedgerShippingAddressErrorCode];
