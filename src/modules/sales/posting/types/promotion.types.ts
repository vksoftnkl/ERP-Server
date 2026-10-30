/** `ck_pru_benefit` — five values, and DISC_PER_ITEM is one of them. */
export type PromotionBenefit =
  | 'FREE_ITEM'
  | 'DISC_PERC'
  | 'DISC_AMT'
  | 'DISC_PER_ITEM'
  | 'FIXED_PRICE';

/** `ck_pru_src_doc_type` — a quotation and an order tally here too, not only a bill. */
export type PromotionSrcDocType =
  | 'SALE_BILL'
  | 'SALE_RETURN'
  | 'SALES_ORDER'
  | 'SALE_QUOTATION'
  | 'OTHER';

/** The document, as the usage tally sees it. */
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

/**
 * What ONE scheme gave on this document.
 *
 * `benefitAmt` and `freeQty` are written as absolute values — `ck_pru_sign`
 * owns the direction, and a caller that pre-negated them would write a row the
 * constraint refuses.
 */
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

/** The three caps, and whether each has been reached chain-wide. */
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
