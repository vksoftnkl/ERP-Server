export declare const CHQ: {
    readonly ALLOCATION_WRONG: "CHQ_ALLOCATION_WRONG";
    readonly REASON_REQUIRED: "CHQ_REASON_REQUIRED";
    readonly BANK_MISSING: "CHQ_BANK_MISSING";
    readonly BOUNCED_ONCE: "CHQ_BOUNCED_ONCE";
    readonly STALE: "CHQ_STALE";
    readonly DATE_TOO_FAR: "CHQ_DATE_TOO_FAR";
    readonly DATE_TOO_EARLY: "CHQ_DATE_TOO_EARLY";
    readonly DATE_FUTURE: "CHQ_DATE_FUTURE";
    readonly BANK_WRONG: "CHQ_BANK_WRONG";
    readonly ALREADY_DONE: "CHQ_ALREADY_DONE";
};
export type ChqErrorCode = (typeof CHQ)[keyof typeof CHQ];
