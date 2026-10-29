export type PromotionBenefit = 'FREE_ITEM' | 'DISC_PERC' | 'DISC_AMT' | 'DISC_PER_ITEM' | 'FIXED_PRICE';
export type PromotionSrcDocType = 'SALE_BILL' | 'SALE_RETURN' | 'SALES_ORDER' | 'SALE_QUOTATION' | 'OTHER';
export interface PromotionUsageDoc {
    docId: string;
    accYear: string;
    companyId: string;
    branchId: string | null;
    custId: string | null;
    custGroupId?: string | null;
    docDate: string;
    docRefno?: string | null;
    docType: PromotionSrcDocType;
    billType?: string | null;
    srcModule?: 'SALES' | 'POS' | 'ACCOUNTS' | 'OTHER';
    userId?: string | null;
    deviceId?: string | null;
    createdBy?: string;
}
export interface PromotionApplied {
    schemeId: string;
    schemeCode?: string | null;
    schemeName?: string | null;
    benefit?: PromotionBenefit | null;
    baseAmount: number;
    baseQty: number;
    benefitAmt: number;
    freeQty: number;
    lineCount: number;
    couponId?: string | null;
    remarks?: string | null;
}
export interface PromotionCapReport {
    schemeId: string;
    uses: number;
    custUses: number;
    given: number;
    maxUses: number;
    maxPerCust: number;
    budget: number;
    usesExceeded: boolean;
    custUsesExceeded: boolean;
    budgetExceeded: boolean;
}
