export declare const LOYALTY_STATUS_ERROR: {
    readonly NO_MENU_RIGHT: "NO_MENU_RIGHT";
    readonly BRANCH_NOT_IN_COMPANY: "BRANCH_NOT_IN_COMPANY";
    readonly SCHEME_NOT_IN_COMPANY: "SCHEME_NOT_IN_COMPANY";
    readonly MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND";
    readonly RANGE_REVERSED: "RANGE_REVERSED";
    readonly RANGE_TOO_LARGE: "RANGE_TOO_LARGE";
    readonly BAD_SORT: "BAD_SORT";
};
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MERGED';
export interface BestGift {
    lsgId: string;
    itemId: string;
    name: string;
    points: number;
    qty: number;
}
export interface MemberItem {
    memberId: string;
    custId: string;
    cardNo: string | null;
    customerName: string | null;
    mobile: string | null;
    lscId: string | null;
    schemeName: string | null;
    status: MemberStatus;
    earned: number;
    redeemed: number;
    expired: number;
    gift: number;
    adjusted: number;
    balance: number;
    redeemable: number;
    cooling: number;
    lapsed: number;
    value: string | null;
    nextExpiryOn: string | null;
    nextExpiryPoints: number;
    bestGift: BestGift | null;
    eligible: boolean;
    lastActivityOn: string | null;
    enrolledOn: string;
    branchId: string | null;
    branchName: string | null;
}
export interface MembersSummary {
    members: number;
    active: number;
    suspended: number;
    outstanding: number;
    outstandingValue: string;
    earnedInPeriod: number;
    earnedBills: number;
    redeemedInPeriod: number;
    redeemedValue: string;
    giftEligible: number;
    giftsLowOnStock: number;
    expiring30Points: number;
    expiring30Members: number;
}
export interface MembersPayload {
    asOn: string;
    items: MemberItem[];
    total: number;
    summary: MembersSummary;
}
export interface StatementRow {
    lldId: string;
    accYear: string;
    txnDate: string;
    txnTime: string | null;
    txnType: string;
    srcDocType: string | null;
    srcDocId: string | null;
    srcAccYear: string | null;
    srcDocRefno: string | null;
    lscId: string | null;
    schemeName: string | null;
    reason: string;
    baseAmount: string;
    points: number;
    runningBalance: number;
    expiresOn: string | null;
    activeFrom: string | null;
    isReversal: boolean;
    reversalOfId: string | null;
    lotId: string | null;
}
export interface StatementPayload {
    memberId: string;
    from: string | null;
    to: string;
    opening: number;
    rows: StatementRow[];
    closing: number;
}
export type LotState = 'REDEEMABLE' | 'COOLING' | 'LAPSED';
export interface MemberLot {
    lotId: string;
    accYear: string;
    txnType: string;
    earnedOn: string;
    srcDocRefno: string | null;
    lscId: string | null;
    points: number;
    used: number;
    left: number;
    expiresOn: string | null;
    activeFrom: string | null;
    state: LotState;
}
export interface MemberCard {
    memberId: string;
    custId: string;
    customerName: string | null;
    cardNo: string | null;
    mobile: string | null;
    enrolledOn: string;
    lifetimeBillAmt: string;
    lifetimeBillCnt: number;
    lastEarnOn: string | null;
    lastRedeemOn: string | null;
    lastActivityOn: string | null;
    status: MemberStatus;
    blockReason: string | null;
    lscId: string | null;
    schemeName: string | null;
    branchId: string | null;
    branchName: string | null;
}
export interface SchemeRedeemRules {
    allowPointRedeem: boolean;
    allowGiftRedeem: boolean;
    redeemValuePerPoint: string | null;
    minRedeemPoints: number;
    maxRedeemPoints: number;
    redeemMultiple: number;
    maxRedeemPerc: number;
    activationDays: number;
    pointsValidDays: number;
}
export interface MemberPayload {
    asOn: string;
    card: MemberCard;
    balance: number;
    redeemable: number;
    cooling: number;
    coolingFrom: string | null;
    lapsed: number;
    lots: MemberLot[];
    bestGift: BestGift | null;
    eligible: boolean;
    tenderValue: string | null;
    rules: SchemeRedeemRules | null;
    unlotted: number;
}
export interface ExpiringItem {
    memberId: string;
    custId: string;
    customerName: string | null;
    cardNo: string | null;
    mobile: string | null;
    lscId: string | null;
    schemeName: string | null;
    status: MemberStatus;
    expiresOn: string;
    daysLeft: number;
    points: number;
    value: string | null;
    balance: number;
    balanceAfter: number;
    lastActivityOn: string | null;
    branchId: string | null;
    branchName: string | null;
}
export interface ExpiringBucket {
    label: string;
    fromDay: number;
    toDay: number;
    points: number;
    members: number;
}
export interface ExpiringSummary {
    buckets: ExpiringBucket[];
    valueAtRisk: string;
    members: number;
    points: number;
}
export interface ExpiringPayload {
    asOn: string;
    withinDays: number;
    items: ExpiringItem[];
    total: number;
    summary: ExpiringSummary;
}
export interface CalendarWeek {
    weekStart: string;
    points: number;
    members: number;
}
export interface CalendarPayload {
    asOn: string;
    days: number;
    weeks: CalendarWeek[];
}
export interface SchemeItem {
    lscId: string;
    schemeName: string;
    schemeCode: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    pointsValidTill: string | null;
    branchId: string | null;
    branchName: string | null;
    month: string | null;
    holders: number | null;
    bills: number;
    opening: number;
    earned: number;
    redeemed: number;
    gift: number;
    expired: number;
    adjusted: number;
    outstanding: number;
    value: string | null;
    usedPct: number | null;
}
export interface SchemesSummary {
    bills: number;
    opening: number;
    earned: number;
    redeemed: number;
    gift: number;
    expired: number;
    adjusted: number;
    outstanding: number;
    value: string;
}
export interface SchemesPayload {
    asOn: string;
    from: string;
    to: string;
    splitBy: string;
    items: SchemeItem[];
    total: number;
    summary: SchemesSummary;
}
export interface SchemeMonth {
    month: string;
    earned: number;
    redeemedPlusGift: number;
    expired: number;
    adjusted: number;
    partial: boolean;
}
export interface MonthlyPayload {
    lscId: string;
    schemeName: string;
    from: string;
    to: string;
    months: SchemeMonth[];
}
export interface GiftItem {
    lsgId: string;
    slno: number;
    itemId: string;
    itemName: string;
    itemQty: number;
    points: number;
    repeat: boolean;
    maxQtyPerBill: number | null;
    stockCheck: boolean;
    validFrom: string | null;
    validUpto: string | null;
    isActive: boolean;
    eligibleMembers: number;
    issuedInPeriod: number;
    inStock: string | null;
}
export interface GiftsPayload {
    asOn: string;
    lscId: string;
    schemeName: string;
    from: string;
    to: string;
    gifts: GiftItem[];
}
export interface ExportPayload {
    tab: string;
    format: string;
    asOn: string;
    printedAs: string;
    companyName: string | null;
    branchName: string | null;
    totalRows: number;
    rows: unknown[];
    summary: unknown;
}
