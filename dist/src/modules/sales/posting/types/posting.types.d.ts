export declare const SALES_ERROR_CODES: {
    readonly BILL_POSTED: "SALES_BILL_POSTED";
    readonly BILL_CANCELLED: "SALES_BILL_CANCELLED";
    readonly REVISION_STALE: "SALES_REVISION_STALE";
    readonly AMEND_OFF: "SALES_AMEND_OFF";
    readonly RIGHT_POST: "SALES_RIGHT_POST";
    readonly RIGHT_CANCEL: "SALES_RIGHT_CANCEL";
    readonly RIGHT_AMEND: "SALES_RIGHT_AMEND";
    readonly RIGHT_OVERRIDE: "SALES_RIGHT_OVERRIDE";
    readonly RIGHT_RETENDER: "SALES_RETENDER_RIGHT";
    readonly RETURN_LOCKS_BILL: "SALES_RETURN_LOCKS_BILL";
    readonly ALLOCATION_LOCKS_BILL: "SALES_ALLOCATION_LOCKS_BILL";
    readonly IRN_LIVE: "SALES_IRN_LIVE";
    readonly EWB_LIVE: "SALES_EWB_LIVE";
    readonly DECLARED_LOCKED: "GST_DECLARED_LOCKED";
    readonly IRN_WINDOW_PASSED: "SALES_IRN_WINDOW_PASSED";
    readonly EWB_WINDOW_PASSED: "SALES_EWB_WINDOW_PASSED";
    readonly IRN_CANCEL_FAILED: "GST_IRN_CANCEL_FAILED";
    readonly EWB_EXPIRED: "GST_EWB_EXPIRED";
    readonly CREDIT_NOTE_CUTOFF: "GST_CREDIT_NOTE_CUTOFF";
    readonly ORDER_DELIVERED: "SALES_ORDER_DELIVERED";
    readonly ORDER_LINE_DELIVERED: "SALES_ORDER_LINE_DELIVERED";
    readonly ORDER_CONFIRMED: "SALES_ORDER_CONFIRMED";
    readonly ORDER_NOT_OPEN: "SALES_ORDER_NOT_OPEN";
    readonly RESERVE_SHORT: "SALES_RESERVE_SHORT";
    readonly DC_PURPOSE_NOT_ALLOWED: "SALES_DC_PURPOSE_NOT_ALLOWED";
    readonly DC_REQUIRES_ORDER: "SALES_DC_REQUIRES_ORDER";
    readonly DC_LINE_OVER_ORDER: "SALES_DC_LINE_OVER_ORDER";
    readonly DC_BILLED: "SALES_DC_BILLED";
    readonly DC_RETURNED: "SALES_DC_RETURNED";
    readonly DCR_OVER_OPEN: "SALES_DCR_OVER_OPEN";
    readonly DCR_DC_NOT_POSTED: "SALES_DCR_DC_NOT_POSTED";
    readonly RETURN_OVER_QTY: "SALES_RETURN_OVER_QTY";
    readonly RETURN_BILL_NOT_POSTED: "SALES_RETURN_BILL_NOT_POSTED";
    readonly RETURN_ITEM_NOT_ALLOWED: "SALES_RETURN_ITEM_NOT_ALLOWED";
    readonly FREE_RETURN_OFF: "SALES_FREE_RETURN_OFF";
    readonly RETURN_WINDOW: "SALES_RETURN_WINDOW";
    readonly CN_APPLIED: "SALES_CN_APPLIED";
    readonly DOC_POSTED: "SALES_DOC_POSTED";
    readonly DOC_CANCELLED: "SALES_DOC_CANCELLED";
    readonly DOC_NOT_DRAFT: "SALES_DOC_NOT_DRAFT";
    readonly NOT_FOUND: "SALES_NOT_FOUND";
    readonly DAY_CLOSED: "SALES_DAY_CLOSED";
    readonly YEAR_LOCKED: "SALES_YEAR_LOCKED";
    readonly BACKDATE: "SALES_BACKDATE";
    readonly CASH_LIMIT: "SALES_CASH_LIMIT";
    readonly PAN_REQUIRED: "SALES_PAN_REQUIRED";
    readonly HSN_DIGITS: "HSN_DIGITS";
    readonly CREDIT_LIMIT: "SALES_CREDIT_LIMIT";
    readonly RATE_BELOW_MIN: "SALES_RATE_BELOW_MIN";
    readonly DISC_CAP: "SALES_DISC_CAP";
    readonly TENDER_DAILY_LIMIT: "SALES_TENDER_DAILY_LIMIT";
    readonly TENDER_MIN_MAX: "SALES_TENDER_MIN_MAX";
    readonly LOYALTY_CAP: "SALES_LOYALTY_CAP";
    readonly PROMO_NOT_LIVE: "SALES_PROMO_NOT_LIVE";
    readonly DC_LINE_OVER: "SALES_DC_LINE_OVER";
    readonly CHARGE_OVER_CARRY: "SALES_CHARGE_OVER_CARRY";
    readonly ORDER_LINE_OVER: "SALES_ORDER_LINE_OVER";
    readonly STOCK_NEGATIVE: "SALES_STOCK_NEGATIVE";
    readonly EWAY_TRANSPORT_MISSING: "SALES_EWAY_TRANSPORT_MISSING";
    readonly DELIVERY_ORDER: "SALES_DELIVERY_ORDER";
    readonly TEMP_CREDIT_DETAILS_MISSING: "SALES_TEMP_CREDIT_DETAILS_MISSING";
    readonly TEMP_CREDIT_DAYS: "SALES_TEMP_CREDIT_DAYS";
    readonly TEMP_CREDIT_AMOUNT: "SALES_TEMP_CREDIT_AMOUNT";
    readonly TEMP_CREDIT_OPEN: "SALES_TEMP_CREDIT_OPEN";
    readonly RETENDER_AMOUNT_MISMATCH: "SALES_RETENDER_AMOUNT_MISMATCH";
    readonly RETENDER_PDC_MOVED: "SALES_RETENDER_PDC_MOVED";
    readonly SALESMAN_INVALID: "SALES_SALESMAN_INVALID";
    readonly STOCK_QTY_MISMATCH: "SALES_STOCK_QTY_MISMATCH";
    readonly AMOUNT_MISMATCH: "SALES_AMOUNT_MISMATCH";
    readonly DEVICE_UNREGISTERED: "SALES_DEVICE_UNREGISTERED";
};
export type SalesErrorCode = (typeof SALES_ERROR_CODES)[keyof typeof SALES_ERROR_CODES];
export type SalesErrorCodeLike = SalesErrorCode | (string & {});
export type SalesWarningLevel = 'INFO' | 'WARN' | 'REFUSE';
export interface SalesStatutoryRef {
    code: string;
    value: number | string | null;
    effectiveFrom: string;
    isCompanyOverride: boolean;
}
export interface SalesWarning {
    code: SalesErrorCodeLike;
    level: SalesWarningLevel;
    message: string;
    field?: string;
    line?: number;
    overridable: boolean;
    statutory?: SalesStatutoryRef;
}
export interface SalesRefusal {
    code: SalesErrorCodeLike;
    message: string;
    field?: string;
    line?: number;
    statutory?: SalesStatutoryRef;
}
export interface SalesGuardContext {
    warnings: SalesWarning[];
    refusals: SalesRefusal[];
    overrides: string[];
    canOverride: boolean;
    throwOnRefusal: boolean;
    dryRun: boolean;
}
export declare function createGuardContext(opts?: Partial<SalesGuardContext>): SalesGuardContext;
export type GstDocStatus = 'NA' | 'PENDING' | 'GENERATED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';
export interface PostingIrnBlock {
    status: GstDocStatus;
    number: string | null;
    ackNo: string | null;
    ackOn: string | null;
    message: string | null;
}
export interface PostingEwbBlock {
    status: GstDocStatus;
    number: string | null;
    generatedOn: string | null;
    validUpto: string | null;
    message: string | null;
    vehicleNo: string | null;
}
export interface PostingBlock {
    voucherId: string | null;
    voucherRefno: string | null;
    postedOn: string | null;
    registerId: string | null;
    cogsAmt: number;
    loyaltyEarned: number;
    loyaltyRedeemed: number;
    irn: PostingIrnBlock;
    ewb: PostingEwbBlock;
}
export interface LocksBlock {
    returns: number;
    allocations: number;
    dayClosed: boolean;
    irnLive: boolean;
    ewbLive: boolean;
    irnCancelWindowUntil: string | null;
    ewbValidUpto: string | null;
    editable: {
        document: boolean;
        transportBand: boolean;
        purpose?: boolean;
    };
}
export interface RightsBlock {
    post: boolean;
    cancel: boolean;
    amend: boolean;
    override: boolean;
    retender: boolean;
}
