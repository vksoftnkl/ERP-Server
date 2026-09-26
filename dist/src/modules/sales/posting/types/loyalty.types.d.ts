export type LoyaltyTxnType = 'EARN' | 'REDEEM' | 'GIFT' | 'EXPIRE' | 'ADJUST' | 'TRANSFER' | 'OPENING';
export type LoyaltyConsumeType = Extract<LoyaltyTxnType, 'REDEEM' | 'GIFT' | 'EXPIRE'>;
export type LoyaltySrcModule = 'SALES' | 'ACCOUNTS' | 'POS' | 'SERVICE' | 'OTHER';
export type LoyaltySrcDocType = 'SALE_BILL' | 'SALE_RETURN' | 'SALES_ORDER' | 'RECEIPT' | 'LOYALTY_ADJUST' | 'GIFT_REDEEM' | 'EXPIRY_RUN' | 'OTHER';
export type CouponTxnType = 'REDEEM' | 'TOPUP' | 'CANCEL' | 'EXPIRE';
export type CouponStatus = 'ISSUED' | 'PARTIAL' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED' | 'BLOCKED';
export type LoyaltyMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MERGED';
export type LoyaltyApplyOn = 'BILL_AMOUNT' | 'BILL_QTY' | 'ITEM_AMOUNT' | 'ITEM_QTY';
export type LoyaltyAmountType = 'GROSS_AMOUNT' | 'NET_AMOUNT' | 'TAXABLE_AMOUNT';
export type LoyaltyExpiryBasis = 'EARN_DATE' | 'MONTH_END' | 'YEAR_END' | 'SCHEME_END_DATE' | 'NONE';
export type LoyaltyRounding = 'ROUND' | 'FLOOR' | 'CEIL' | 'NONE';
export type LoyaltyReturnMode = 'REVERSE' | 'IGNORE';
export interface LoyaltyLot {
    lotId: string;
    lotAccYear: string;
    lotBalance: number;
    expiresOn: string | null;
    activeFrom: string | null;
    txnDate: string;
    lscId: string | null;
    branchId: string;
}
export interface LoyaltyPreview {
    memberId: string | null;
    balance: number;
    redeemable: number;
    rate: number;
    minPoints: number;
    maxPoints: number | null;
    maxRedeemAmount: number | null;
    multiple: number | null;
    earnPreview: number;
    schemeId: string | null;
    schemeName: string | null;
    allowPointRedeem: boolean;
}
export interface LoyaltyLedgerRowInput {
    compId: string;
    branchId: string;
    tenantId?: string | null;
    accYear: string;
    memberId: string;
    custId: string;
    lscId?: string | null;
    lssId?: string | null;
    lsiId?: string | null;
    txnType: LoyaltyTxnType;
    rowNo: number;
    points: number;
    txnDate: string;
    txnTime?: string | null;
    lotId?: string | null;
    lotAccYear?: string | null;
    expiresOn?: string | null;
    activeFrom?: string | null;
    srcModule?: LoyaltySrcModule | null;
    srcDocType?: LoyaltySrcDocType | null;
    srcDocId?: string | null;
    srcAccYear?: string | null;
    srcDocRefno?: string | null;
    srcRowNo?: number | null;
    baseAmount?: number;
    baseQty?: number;
    rate?: number;
    factor?: number;
    moneyValue?: number;
    tenderId?: string | null;
    tenderAccYear?: string | null;
    reversalOfId?: string | null;
    reversalOfAccYear?: string | null;
    reversalReason?: string | null;
    approvedBy?: string | null;
    userId?: string | null;
    sessionId?: string | null;
    deviceId?: string | null;
    remarks?: string | null;
    createdBy?: string | null;
}
export interface LoyaltyLotKey {
    lotId: string;
    lotAccYear: string;
}
export interface LoyaltyConsumeOptions {
    branchId: string;
    accYear: string;
    txnDate: string;
    rate?: number;
    srcModule?: LoyaltySrcModule;
    srcDocType?: LoyaltySrcDocType;
    srcDocId?: string | null;
    srcAccYear?: string | null;
    srcDocRefno?: string | null;
    tenderId?: string | null;
    tenderAccYear?: string | null;
    lscId?: string | null;
    remarks?: string | null;
    createdBy?: string | null;
    userId?: string | null;
    sessionId?: string | null;
    deviceId?: string | null;
    approvedBy?: string | null;
}
export interface LoyaltyBillLine {
    lineNo: number;
    itemId: string;
    unitId: string | null;
    qty: number;
    grossAmt: number;
    netAmt: number;
    taxableAmt: number;
    isFree: boolean;
    allowLoyalty: boolean;
    groupId: string | null;
    categoryId: string | null;
    brandId: string | null;
    sectionId: string | null;
}
export interface LoyaltyBillSource {
    docId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    custId: string;
    docDate: string;
    docRefno: string | null;
    docType: LoyaltySrcDocType;
    billType: string | null;
    memberId: string | null;
    chargesAmt: number;
    redeemedAmount: number;
    custGroupId?: string | null;
    lines: LoyaltyBillLine[];
}
export interface LoyaltyEarnResult {
    memberId: string | null;
    schemeId: string | null;
    points: number;
    baseAmount: number;
    baseQty: number;
    rowsWritten: number;
    expiresOn: string | null;
    activeFrom: string | null;
    lines: {
        lineNo: number;
        points: number;
        pv: number;
    }[];
    reason?: string;
}
export interface LoyaltyScheme {
    lscId: string;
    code: string;
    name: string;
    type: string;
    priority: number;
    applyOn: LoyaltyApplyOn;
    amountType: LoyaltyAmountType;
    includeTax: boolean;
    billType: string;
    itemScope: 'ALL' | 'LIST';
    branchScope: 'ALL' | 'LIST';
    custScope: 'ALL' | 'LIST';
    minBillAmount: number;
    maxEarnPoints: number | null;
    earnOnDiscounted: boolean;
    earnOnCharges: boolean;
    earnWithRedeem: boolean;
    rounding: LoyaltyRounding;
    pointsDecimals: number;
    allowPointRedeem: boolean;
    redeemValuePerPoint: number;
    minRedeemPoints: number;
    maxRedeemPoints: number | null;
    maxRedeemPerc: number | null;
    redeemMinBillAmount: number;
    redeemMultiple: number | null;
    redeemTenderId: string | null;
    expiryBasis: LoyaltyExpiryBasis;
    pointsValidDays: number | null;
    activationDays: number;
    returnMode: LoyaltyReturnMode;
    startDate: string | null;
    endDate: string | null;
    poolMode: string | null;
    allowCrossBranchRedeem: boolean;
}
