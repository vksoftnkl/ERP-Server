/**
 * The vocabulary of `sales.loyalty_ledger`, `loyalty_member` and the coupon
 * tables, and the shapes `LoyaltyLedgerService` takes and returns.
 *
 * Two sign conventions live side by side here and getting them the wrong way
 * round is the single easiest mistake in this file:
 *
 *   POINTS  (`lld_points`)  — SIGNED. An EARN is positive, a REDEEM / GIFT /
 *                             EXPIRE is negative, and a reversal is the SAME
 *                             type with the opposite sign.
 *   COUPONS (`lct_amount`)  — an AMOUNT, always positive; the TYPE carries the
 *                             meaning, and only a reversal is negative.
 *
 * `ck_lld_sign` and `ck_lct_sign` enforce both, so a row with the wrong sign
 * is refused by the database — but with a message nobody can read.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Vocabularies — each mirrors a CHECK constraint, and must stay in step
// ═══════════════════════════════════════════════════════════════════════════

/** `ck_lld_txn_type` */
export type LoyaltyTxnType =
  | 'EARN'
  | 'REDEEM'
  | 'GIFT'
  | 'EXPIRE'
  | 'ADJUST'
  | 'TRANSFER'
  | 'OPENING';

/**
 * The three types `consume()` may write. They differ in what the customer got:
 * REDEEM is money and needs a tender row (`ck_lld_redeem_tender`), GIFT is
 * stock and must NOT have one (`ck_lld_gift_no_tender`), EXPIRE is nobody.
 */
export type LoyaltyConsumeType = Extract<LoyaltyTxnType, 'REDEEM' | 'GIFT' | 'EXPIRE'>;

/** `ck_lld_src_module` */
export type LoyaltySrcModule = 'SALES' | 'ACCOUNTS' | 'POS' | 'SERVICE' | 'OTHER';

/** `ck_lld_src_doc_type` */
export type LoyaltySrcDocType =
  | 'SALE_BILL'
  | 'SALE_RETURN'
  | 'SALES_ORDER'
  | 'RECEIPT'
  | 'LOYALTY_ADJUST'
  | 'GIFT_REDEEM'
  | 'EXPIRY_RUN'
  | 'OTHER';

/** `ck_lct_txn_type` */
export type CouponTxnType = 'REDEEM' | 'TOPUP' | 'CANCEL' | 'EXPIRE';

/** `ck_lcp_status` */
export type CouponStatus = 'ISSUED' | 'PARTIAL' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED' | 'BLOCKED';

/** `ck_lmb_status` */
export type LoyaltyMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MERGED';

/** `lsc_apply_on` — what the earning base is measured over. */
export type LoyaltyApplyOn = 'BILL_AMOUNT' | 'BILL_QTY' | 'ITEM_AMOUNT' | 'ITEM_QTY';

/** `ck_lsc_calc_on` — which of the line's three amounts is the base. */
export type LoyaltyAmountType = 'GROSS_AMOUNT' | 'NET_AMOUNT' | 'TAXABLE_AMOUNT';

/** `lsc_expiry_basis` — how a lot's lapse date is derived at earn time. */
export type LoyaltyExpiryBasis =
  | 'EARN_DATE'
  | 'MONTH_END'
  | 'YEAR_END'
  | 'SCHEME_END_DATE'
  | 'NONE';

/** `lsc_rounding_method` */
export type LoyaltyRounding = 'ROUND' | 'FLOOR' | 'CEIL' | 'NONE';

/** `lsc_return_mode` — what a sale return does to the points the bill awarded. */
export type LoyaltyReturnMode = 'REVERSE' | 'IGNORE';

// ═══════════════════════════════════════════════════════════════════════════
//  The reads (§3.4c)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One spendable lot, in FIFO order.
 *
 * `lotId` + `lotAccYear` together are the key: `loyalty_ledger` is partitioned
 * by the year of the EVENT, so a July redemption of April points sits in a
 * different partition from the lot it draws on and the year must travel with
 * the id.
 */
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

/** What the tender panel and `party-context` show (flow §5.8 "Preview"). */
export interface LoyaltyPreview {
  memberId: string | null;
  /** `lmb_balance_points` — what the customer HOLDS. Display this. */
  balance: number;
  /** What may be spent today. Redeem against THIS, never against `balance`. */
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

// ═══════════════════════════════════════════════════════════════════════════
//  The write shape — what the ONE private writer takes (§3.4b)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single `sales.loyalty_ledger` row, as the service composes it.
 *
 * Deliberately NOT the Prisma model type: the generated columns
 * (`lld_lot_balance`) and the trigger-shaped caches must be impossible to pass
 * in, and a caller that could name them would eventually write one.
 */
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
  /** SIGNED. `ck_lld_sign` decides which sign each type may carry. */
  points: number;
  txnDate: string;
  txnTime?: string | null;

  /** The lot this row draws on. Required for REDEEM / GIFT / EXPIRE. */
  lotId?: string | null;
  lotAccYear?: string | null;

  /** Lot identity, on EARN / OPENING rows only (`ck_lld_lot_dates`). */
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

/** The composite key a lot recompute needs. */
export interface LoyaltyLotKey {
  lotId: string;
  lotAccYear: string;
}

/** What `consume()` was given beyond the three positional arguments. */
export interface LoyaltyConsumeOptions {
  branchId: string;
  accYear: string;
  txnDate: string;
  /** Rupees per point. 0 for GIFT and EXPIRE — nobody was paid in money. */
  rate?: number;
  srcModule?: LoyaltySrcModule;
  srcDocType?: LoyaltySrcDocType;
  srcDocId?: string | null;
  srcAccYear?: string | null;
  srcDocRefno?: string | null;
  /** `acc_tender_detail` type 10. REDEEM must have it; GIFT must not. */
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

// ═══════════════════════════════════════════════════════════════════════════
//  The earn source — what `earn()` needs to know about a bill
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One eligible line, flattened.
 *
 * `allowLoyalty` is `inventory.item_master.item_allow_loyalty`, and it is 3.0's
 * rule carried forward: a line whose item is marked no-loyalty earns nothing
 * however generous the scheme is.
 */
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
  /** For `loyalty_scheme_item` matching by `ck_lsi_kind`. */
  groupId: string | null;
  categoryId: string | null;
  brandId: string | null;
  sectionId: string | null;
}

/**
 * The document, as the loyalty engine sees it. An adapter shape on purpose:
 * `earn()` must work for a bill loaded from the database and for a bill the
 * `/validate` dry run has only in memory, and neither may need the other's
 * plumbing.
 */
export interface LoyaltyBillSource {
  docId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  custId: string;
  docDate: string;
  docRefno: string | null;
  docType: LoyaltySrcDocType;
  /** `sb_bill_type` — the scheme's `lsc_bill_type` filters on CASH / CREDIT. */
  billType: string | null;
  memberId: string | null;
  /** Bill-level charges; earned on only when `lsc_earn_on_charges`. */
  chargesAmt: number;
  /**
   * The rupees this bill settled with points. Excluded from the base unless
   * `lsc_earn_with_redeem` — otherwise points earn points.
   */
  redeemedAmount: number;
  custGroupId?: string | null;
  lines: LoyaltyBillLine[];
}

/** What `earn()` returns — the caller writes the snapshot columns from it. */
export interface LoyaltyEarnResult {
  memberId: string | null;
  schemeId: string | null;
  points: number;
  baseAmount: number;
  baseQty: number;
  rowsWritten: number;
  expiresOn: string | null;
  activeFrom: string | null;
  /** Per line, for `sbi_loyalty_points` / `sbi_loyalty_pv`. */
  lines: { lineNo: number; points: number; pv: number }[];
  /** Why zero, when zero — the till shows it rather than a blank panel. */
  reason?: string;
}

/** The resolved scheme, with only what the engine reads off it. */
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
  /** `lsc_item_scope` — ALL, or only the items `loyalty_scheme_item` names. */
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
