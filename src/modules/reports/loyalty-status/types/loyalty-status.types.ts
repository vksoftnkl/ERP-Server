/**
 * Response shapes of reports/loyalty-status (plan 2026-10-05 §5). Points are
 * NUMBERS (the ledger keeps four decimals; schemes usually round to whole
 * points). Money is a STRING with two decimals, never a float, and NULL where
 * the plan says the client shows "—".
 */

/** §8 — the refusals only the service can make. */
export const LOYALTY_STATUS_ERROR = {
  NO_MENU_RIGHT: 'NO_MENU_RIGHT',
  BRANCH_NOT_IN_COMPANY: 'BRANCH_NOT_IN_COMPANY',
  SCHEME_NOT_IN_COMPANY: 'SCHEME_NOT_IN_COMPANY',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  RANGE_REVERSED: 'RANGE_REVERSED',
  RANGE_TOO_LARGE: 'RANGE_TOO_LARGE',
  BAD_SORT: 'BAD_SORT',
} as const;

export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MERGED';

export interface BestGift {
  lsgId: string;
  itemId: string;
  name: string;
  points: number;
  /** floor(redeemable / points) when the gift repeats, capped by lsg_max_qty_per_bill; else 1. */
  qty: number;
}

// ─── §5.1 members ────────────────────────────────────────────────────────────

export interface MemberItem {
  memberId: string;
  custId: string;
  cardNo: string | null;
  customerName: string | null;
  /** lmb_mobile, else cus_phone1. */
  mobile: string | null;
  lscId: string | null;
  schemeName: string | null;
  status: MemberStatus;
  /** Lifetime lmb_earned_points, or the period's sum when earnedFrom / earnedTo were sent. */
  earned: number;
  redeemed: number;
  expired: number;
  gift: number;
  adjusted: number;
  balance: number;
  redeemable: number;
  cooling: number;
  /** Open lots already past their expiry that the nightly sweep has not written off yet. */
  lapsed: number;
  /** redeemable × rate, each lot at its own scheme's rate (D4). NULL = no scheme prices points. */
  value: string | null;
  nextExpiryOn: string | null;
  nextExpiryPoints: number;
  bestGift: BestGift | null;
  /** bestGift present AND status ACTIVE. */
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

// ─── §5.2 statement ──────────────────────────────────────────────────────────

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
  /** lld_remarks, else built from type + scheme (+ tender ₹ / approver). */
  reason: string;
  baseAmount: string;
  points: number;
  runningBalance: number;
  expiresOn: string | null;
  activeFrom: string | null;
  isReversal: boolean;
  reversalOfId: string | null;
  /** The lot this row drew on (REDEEM / GIFT / EXPIRE / negative ADJUST). */
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

// ─── §5.3 member card ────────────────────────────────────────────────────────

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
  /** Exactly LoyaltyLedgerService.redeemable() for this member and day (D1 a). */
  redeemable: number;
  cooling: number;
  coolingFrom: string | null;
  lapsed: number;
  lots: MemberLot[];
  bestGift: BestGift | null;
  eligible: boolean;
  /** redeemable × rate, per lot (D4). */
  tenderValue: string | null;
  rules: SchemeRedeemRules | null;
  /** balance − Σ lots.left — the F1 gap; the client shows it only when ≠ 0. */
  unlotted: number;
}

// ─── §5.4 expiring ───────────────────────────────────────────────────────────

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
  /** Distinct members — one who lapses on two dates counts once. */
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
  /** Monday. */
  weekStart: string;
  points: number;
  members: number;
}

export interface CalendarPayload {
  asOn: string;
  days: number;
  weeks: CalendarWeek[];
}

// ─── §5.6 schemes ────────────────────────────────────────────────────────────

export interface SchemeItem {
  lscId: string;
  schemeName: string;
  schemeCode: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  /** For a CLOSED / ended scheme: MAX lld_expires_on of its open lots; NULL when a lot never expires. */
  pointsValidTill: string | null;
  /** splitBy = scheme_branch */
  branchId: string | null;
  branchName: string | null;
  /** splitBy = scheme_month — 'YYYY-MM' */
  month: string | null;
  /** Members whose outstanding on this scheme is > 0, as on `to`. NULL on scheme_month. Does not total. */
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
  /** (redeemed + gift) / earned; NULL when earned = 0. */
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
  /** 'YYYY-MM' */
  month: string;
  earned: number;
  redeemedPlusGift: number;
  expired: number;
  adjusted: number;
  /** `to` falls inside this month. */
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
  /** ACTIVE members of the scheme whose redeemable ≥ this gift's points — against ITS points, not the best gift. */
  eligibleMembers: number;
  /** Σ lgd_qty of CONFIRMED gift redemptions in [from, to]. */
  issuedInPeriod: number;
  /** Σ sbl_available_qty (SALEABLE) for the item in branchId / all branches; NULL when lsg_stock_check is off. */
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

// ─── §5.9 export ─────────────────────────────────────────────────────────────

export interface ExportPayload {
  tab: string;
  format: string;
  asOn: string;
  /** Every filter that was applied, as one line — 3.0's `iconditions`, the mockups' "Printed as:". */
  printedAs: string;
  companyName: string | null;
  branchName: string | null;
  totalRows: number;
  rows: unknown[];
  summary: unknown;
}
