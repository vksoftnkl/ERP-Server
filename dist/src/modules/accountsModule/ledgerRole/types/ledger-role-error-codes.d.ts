export declare const LedgerRoleErrorCode: {
    readonly UNKNOWN_ROLE: "LEDGER_ROLE_UNKNOWN_ROLE";
    readonly LEDGER_NOT_FOUND: "LEDGER_ROLE_LEDGER_NOT_FOUND";
    readonly WRONG_LEDGER_TYPE: "LEDGER_ROLE_WRONG_LEDGER_TYPE";
    readonly WRONG_DUTY_HEAD: "LEDGER_ROLE_WRONG_DUTY_HEAD";
    readonly WRONG_GROUP_NATURE: "LEDGER_ROLE_WRONG_GROUP_NATURE";
    readonly LEDGER_NOT_GLOBAL: "LEDGER_ROLE_LEDGER_NOT_GLOBAL";
    readonly NOT_MAPPED: "LEDGER_ROLE_NOT_MAPPED";
};
export type LedgerRoleErrorCode = (typeof LedgerRoleErrorCode)[keyof typeof LedgerRoleErrorCode];
