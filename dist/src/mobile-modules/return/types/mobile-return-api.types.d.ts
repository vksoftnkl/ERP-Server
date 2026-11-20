import type { UserWording } from '../../../common/error-wording/error-wording';
export type MobileReturnCondition = 'RESTOCK' | 'DAMAGED' | 'EXPIRED' | 'SCRAP';
export type MobileReturnSettleMode = 'ADJUST' | 'ADVANCE';
export interface MobileReturnReason {
    reasonId: string;
    code: string;
    name: string;
    defaultCondition: MobileReturnCondition | null;
    refundCharges: boolean | null;
    isClaim: boolean;
    sortOrder: number;
}
export interface MobileReturnGodown {
    godownId: string;
    name: string;
    isDefault: boolean;
}
export interface MobileReturnSettings {
    returnWindowDays: number;
    freeReturnAllowed: boolean;
    settleDefault: MobileReturnSettleMode | null;
    expiredLotDays: number | null;
    billDays: number;
}
export interface MobileReturnOptions {
    companyId: string;
    branchId: string;
    reasons: MobileReturnReason[];
    godowns: MobileReturnGodown[];
    settings: MobileReturnSettings;
    rights: {
        create: boolean;
        post: boolean;
    } | null;
}
export interface MobileReturnBillLine {
    billItemId: string;
    accYear: string;
    lineNo: number;
    itemId: string;
    itemName: string | null;
    itemUnitId: string;
    unitName: string | null;
    toBaseFactor: number | null;
    billQty: number | null;
    billQtyBase: number | null;
    returnedQtyBase: number | null;
    qtyLeftBase: number | null;
    onOtherDraftsBase: number | null;
    ratePreTaxBase: string | null;
    rate: string | null;
    taxPerc: string;
    cgstPerc: string;
    sgstPerc: string;
    igstPerc: string;
    lotId: string | null;
    batchNo: string | null;
    expiryDate: string | null;
    godownId: string;
    isFree: boolean;
    allowReturn: boolean;
}
export type MobileReturnBillStatus = 'NONE' | 'PARTIAL' | 'FULL';
export interface MobileReturnBill {
    sbId: string;
    accYear: string;
    refno: string | null;
    date: string;
    custId: string | null;
    branchId: string;
    billAmount: string;
    due: string;
    payMode: string | null;
    returnedAmt: string;
    returnStatus: MobileReturnBillStatus;
    lines: MobileReturnBillLine[];
}
export interface MobileReturnBillLinesPayload {
    asOf: string;
    billDays: number;
    since: string;
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    companyId: string;
    branchId: string;
    bills: MobileReturnBill[];
}
export type MobileReturnOutcome = 'POSTED' | 'HELD' | 'SENT_BACK';
export interface MobileReturnNote {
    code: string;
    message: string;
    field: string | null;
    line: number | null;
    user?: UserWording;
    [detail: string]: unknown;
}
export interface MobileReturnAdjusted {
    billId: string;
    billAccYear: string;
    refno: string | null;
    amount: string;
}
export type MobileReturnReplanReason = 'BILL_SETTLED' | 'BILL_REDUCED' | 'NOTE_SMALLER' | 'FREED_MONEY';
export interface MobileReturnReplanned {
    billId: string;
    billAccYear: string;
    refno: string | null;
    from: string;
    to: string;
    reason: MobileReturnReplanReason;
}
export interface MobileReturnApproval {
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    note: string | null;
}
export interface MobileReturnLineResult {
    sriLineNo: number;
    sriSplitNo: number;
    sriId: string;
    rateSource: string | null;
    taxableAmt: string;
    taxAmt: string;
    netAmt: string;
    bucket: string | null;
}
export interface MobileReturnCreateResult {
    duplicate: boolean;
    srId: string;
    srClientUuid: string;
    srReturnRefno: string | null;
    srMobileRefno: string | null;
    srAccYear: string;
    srBranchId: string;
    srStatus: string;
    status: MobileReturnOutcome;
    srReturnAmt: string;
    totals: {
        goods: string;
        tax: string;
        chargesNet: string;
        roundOff: string;
        creditNote: string;
    };
    settlement: {
        mode: string | null;
        credited: string;
        settleStatus: string | null;
        adjusted: MobileReturnAdjusted[];
    };
    lines: MobileReturnLineResult[];
    held: MobileReturnNote | null;
    refusal: MobileReturnNote | null;
    refusals: MobileReturnNote[];
    warnings: MobileReturnNote[];
    replanned: MobileReturnReplanned[];
    approval: MobileReturnApproval | null;
}
export interface MobileReturnDeleteResult {
    deleted: boolean;
    srClientUuid: string;
    srId: string | null;
    srReturnRefno: string | null;
    duplicate: boolean;
}
export type MobileReturnRowStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'DELETED';
export interface MobileReturnStatus {
    srClientUuid: string;
    srId: string;
    srAccYear: string;
    srReturnRefno: string | null;
    status: MobileReturnRowStatus;
    approval: MobileReturnApproval | null;
    revisionNo: number;
    srReturnAmt: string;
    settleStatus: string | null;
    adjusted: MobileReturnAdjusted[];
    cancelledOn: string | null;
    cancelReason: string | null;
    updatedOn: string;
}
export interface MobileReturnStatusPayload {
    asOf: string;
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    companyId: string;
    returns: MobileReturnStatus[];
}
