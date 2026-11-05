export declare const LedgerMapErrorCode: {
    readonly ROLE_ALREADY_MAPPED: "LEDGER_MAP_ROLE_ALREADY_MAPPED";
    readonly NOT_FOUND: "LEDGER_MAP_NOT_FOUND";
    readonly ROLE_IN_USE: "LEDGER_MAP_ROLE_IN_USE";
    readonly ROLE_CHANGED: "LEDGER_MAP_ROLE_CHANGED";
    readonly UNKNOWN_ROLE: "LEDGER_MAP_UNKNOWN_ROLE";
    readonly LEDGER_DELETED: "LEDGER_MAP_LEDGER_DELETED";
    readonly LEDGER_INACTIVE: "LEDGER_MAP_LEDGER_INACTIVE";
    readonly SCOPED_MAPPING: "LEDGER_MAP_SCOPED_MAPPING";
};
export type LedgerMapErrorCode = (typeof LedgerMapErrorCode)[keyof typeof LedgerMapErrorCode];
