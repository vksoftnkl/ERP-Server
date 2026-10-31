export declare const BATCH_PREFIX_ERROR: {
    readonly DUPLICATE: "BATCH_PREFIX_DUPLICATE";
    readonly PREFIX_EMPTY: "BATCH_PREFIX_PREFIX_EMPTY";
    readonly DATE_INVALID: "BATCH_PREFIX_DATE_INVALID";
    readonly NOT_FOUND: "BATCH_PREFIX_NOT_FOUND";
};
export type BatchPrefixErrorCode = (typeof BATCH_PREFIX_ERROR)[keyof typeof BATCH_PREFIX_ERROR];
