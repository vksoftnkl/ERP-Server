export declare const LedgerBankErrorCode: {
    readonly NOT_FOUND: "LEDGER_BANK_NOT_FOUND";
    readonly FIELD_EMPTY: "LEDGER_BANK_FIELD_EMPTY";
    readonly DUPLICATE_ACCOUNT_NO: "LEDGER_BANK_DUPLICATE_ACCOUNT_NO";
    readonly INVALID_REFERENCE: "LEDGER_BANK_INVALID_REFERENCE";
    readonly LEDGER_NOT_FOUND: "LEDGER_BANK_LEDGER_NOT_FOUND";
    readonly COMPANY_NOT_FOUND: "LEDGER_BANK_COMPANY_NOT_FOUND";
    readonly COMPANY_MISMATCH: "LEDGER_BANK_COMPANY_MISMATCH";
};
export type LedgerBankErrorCode = (typeof LedgerBankErrorCode)[keyof typeof LedgerBankErrorCode];
