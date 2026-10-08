import { PromotionLoyaltyPointsErrorDetail } from '../types/promotion-loyalty-points-api.types';
import {
  LSC_APPLY_ON,
  LSC_BILL_TYPES,
  LSC_CALC_ON,
  LSC_CODE_PATTERN,
  LSC_EXPIRY_BASES,
  LSC_POOL_MODES,
  LSC_RETURN_MODES,
  LSC_ROUNDING,
  LSC_SCOPES,
  LSC_STATUSES,
  LSC_TYPES,
  LSC_WEEKDAYS_PATTERN,
  LSI_KINDS,
  LSP_KINDS,
} from './loyalty.utils';

/**
 * The CHECK constraints of sales.loyalty_scheme and its five child tables, one
 * function each.
 *
 * Unlike promotion_scheme, the loyalty tables DO carry every one of these —
 * 20260831060000_replace_loyalty_scheme_tables creates them. So this file is a
 * FIRST line of defence, not the only one: the table is the last word, and this
 * is what turns "new row for relation violates check constraint
 * ck_lsc_redeem_rate" into a 400 naming lsc_redeem_value_per_point, which a
 * screen can put on an input.
 *
 * Every function is named after the constraint it mirrors and returns the errors
 * it found rather than throwing, so one bad payload is answered with every
 * problem in it at once instead of the first.
 */

// ══ sales.loyalty_scheme — the header ════════════════════════════════════════

/** The header as it will exist AFTER this request: the stored row overlaid with whatever is being written. */
export interface EffectiveScheme {
  lscCode: string;
  lscType: string;
  lscStatus: string;
  lscApplyOn: string;
  lscCalcOnAmountType: string;
  lscBillType: string;
  lscRoundingMethod: string;
  lscBranchScope: string;
  lscCustScope: string;
  lscItemScope: string;
  lscPoolMode: string;
  lscReturnMode: string;
  lscExpiryBasis: string;
  lscPriority: number;
  lscPointsDecimals: number;
  lscActivationDays: number;
  lscPointsValidDays: number;
  lscMinBillAmount: number;
  lscMaxEarnPoints: number;
  lscAllowPointRedeem: boolean;
  lscRedeemValuePerPoint: number;
  lscMinRedeemPoints: number;
  lscMaxRedeemPoints: number;
  lscMaxRedeemPerc: number;
  lscRedeemMinBillAmount: number;
  lscRedeemMultiple: number;
  lscStartDate: Date;
  lscEndDate: Date;
  lscValidFromTime: Date | null;
  lscValidToTime: Date | null;
  lscValidWeekdays: string | null;
  lscApprovedBy: string | null;
}

export type SchemeInvariant = (scheme: EffectiveScheme) => PromotionLoyaltyPointsErrorDetail[];

const ok: PromotionLoyaltyPointsErrorDetail[] = [];

const vocabulary = (
  field: string,
  value: string,
  allowed: readonly string[],
): PromotionLoyaltyPointsErrorDetail[] =>
  allowed.includes(value)
    ? ok
    : [{ field, message: `${field} must be one of ${allowed.join(', ')}` }];

const notNegative = (field: string, value: number | null): PromotionLoyaltyPointsErrorDetail[] =>
  value === null || (Number.isFinite(value) && value >= 0)
    ? ok
    : [{ field, message: `${field} must be 0 or more` }];

const inRange = (
  field: string,
  value: number,
  minimum: number,
  maximum: number,
): PromotionLoyaltyPointsErrorDetail[] =>
  Number.isFinite(value) && value >= minimum && value <= maximum
    ? ok
    : [{ field, message: `${field} must be between ${minimum} and ${maximum}` }];

const greaterThanZero = (field: string, value: number): PromotionLoyaltyPointsErrorDetail[] =>
  Number.isFinite(value) && value > 0
    ? ok
    : [{ field, message: `${field} must be greater than 0` }];

const wholeBetween = (
  field: string,
  value: number,
  minimum: number,
  maximum: number,
): PromotionLoyaltyPointsErrorDetail[] =>
  Number.isInteger(value) && value >= minimum && value <= maximum
    ? ok
    : [{ field, message: `${field} must be a whole number between ${minimum} and ${maximum}` }];

// ─── shape ────────────────────────────────────────────────────────────────────

/** ck_lsc_code_shape — lsc_code ~ '^[A-Za-z0-9_-]+$' */
export const ckLscCodeShape: SchemeInvariant = (s) =>
  LSC_CODE_PATTERN.test(s.lscCode)
    ? ok
    : [
        {
          field: 'lsc_code',
          message: 'lsc_code may contain only letters, digits, underscore and hyphen',
        },
      ];

// ─── vocabularies ─────────────────────────────────────────────────────────────

/** ck_lsc_type */
export const ckLscType: SchemeInvariant = (s) => vocabulary('lsc_type', s.lscType, LSC_TYPES);

/** ck_lsc_status */
export const ckLscStatus: SchemeInvariant = (s) =>
  vocabulary('lsc_status', s.lscStatus, LSC_STATUSES);

/** ck_lsc_apply_on */
export const ckLscApplyOn: SchemeInvariant = (s) =>
  vocabulary('lsc_apply_on', s.lscApplyOn, LSC_APPLY_ON);

/** ck_lsc_calc_on */
export const ckLscCalcOn: SchemeInvariant = (s) =>
  vocabulary('lsc_calc_on_amount_type', s.lscCalcOnAmountType, LSC_CALC_ON);

/** ck_lsc_bill_type */
export const ckLscBillType: SchemeInvariant = (s) =>
  vocabulary('lsc_bill_type', s.lscBillType, LSC_BILL_TYPES);

/** ck_lsc_rounding */
export const ckLscRounding: SchemeInvariant = (s) =>
  vocabulary('lsc_rounding_method', s.lscRoundingMethod, LSC_ROUNDING);

/** ck_lsc_branch_scope */
export const ckLscBranchScope: SchemeInvariant = (s) =>
  vocabulary('lsc_branch_scope', s.lscBranchScope, LSC_SCOPES);

/** ck_lsc_cust_scope */
export const ckLscCustScope: SchemeInvariant = (s) =>
  vocabulary('lsc_cust_scope', s.lscCustScope, LSC_SCOPES);

/** ck_lsc_item_scope */
export const ckLscItemScope: SchemeInvariant = (s) =>
  vocabulary('lsc_item_scope', s.lscItemScope, LSC_SCOPES);

/** ck_lsc_pool_mode */
export const ckLscPoolMode: SchemeInvariant = (s) =>
  vocabulary('lsc_pool_mode', s.lscPoolMode, LSC_POOL_MODES);

/** ck_lsc_return_mode */
export const ckLscReturnMode: SchemeInvariant = (s) =>
  vocabulary('lsc_return_mode', s.lscReturnMode, LSC_RETURN_MODES);

/** ck_lsc_expiry_basis */
export const ckLscExpiryBasis: SchemeInvariant = (s) =>
  vocabulary('lsc_expiry_basis', s.lscExpiryBasis, LSC_EXPIRY_BASES);

// ─── expiry ───────────────────────────────────────────────────────────────────

/**
 * ck_lsc_expiry_days — lsc_points_valid_days >= 0, and an EARN_DATE basis needs
 * a positive window: "expires N days after it was earned" with N = 0 would
 * expire every point the instant it was awarded.
 */
export const ckLscExpiryDays: SchemeInvariant = (s) => [
  ...notNegative('lsc_points_valid_days', s.lscPointsValidDays),
  ...(s.lscExpiryBasis !== 'EARN_DATE' || s.lscPointsValidDays > 0
    ? ok
    : [
        {
          field: 'lsc_points_valid_days',
          message:
            'lsc_points_valid_days must be greater than 0 when lsc_expiry_basis is EARN_DATE',
        },
      ]),
];

// ─── the validity window ──────────────────────────────────────────────────────

/** ck_lsc_dates — lsc_end_date >= lsc_start_date */
export const ckLscDates: SchemeInvariant = (s) =>
  s.lscEndDate.getTime() >= s.lscStartDate.getTime()
    ? ok
    : [{ field: 'lsc_end_date', message: 'lsc_end_date must be on or after lsc_start_date' }];

/**
 * ck_lsc_time_pair — both ends of the window or neither.
 *
 * Deliberately NO "to >= from": 22:22 to 04:44 is a late-night promotion, not a
 * typo, and the engine reads from > to as "spans midnight".
 */
export const ckLscTimePair: SchemeInvariant = (s) =>
  (s.lscValidFromTime === null) === (s.lscValidToTime === null)
    ? ok
    : [
        {
          field: 'lsc_valid_to_time',
          message: 'Send both lsc_valid_from_time and lsc_valid_to_time, or neither',
        },
      ];

/** ck_lsc_weekdays — shape, not vocabulary: three-letter day names, comma separated. */
export const ckLscWeekdays: SchemeInvariant = (s) =>
  s.lscValidWeekdays === null || LSC_WEEKDAYS_PATTERN.test(s.lscValidWeekdays)
    ? ok
    : [
        {
          field: 'lsc_valid_weekdays',
          message: 'lsc_valid_weekdays must be comma-separated MON,TUE,WED,THU,FRI,SAT,SUN',
        },
      ];

// ─── numbers ──────────────────────────────────────────────────────────────────

/** ck_lsc_priority — lsc_priority BETWEEN 1 AND 9 */
export const ckLscPriority: SchemeInvariant = (s) =>
  wholeBetween('lsc_priority', s.lscPriority, 1, 9);

/** ck_lsc_decimals — lsc_points_decimals BETWEEN 0 AND 4 */
export const ckLscDecimals: SchemeInvariant = (s) =>
  wholeBetween('lsc_points_decimals', s.lscPointsDecimals, 0, 4);

/** ck_lsc_activation — lsc_activation_days BETWEEN 0 AND 365 */
export const ckLscActivation: SchemeInvariant = (s) =>
  wholeBetween('lsc_activation_days', s.lscActivationDays, 0, 365);

/** ck_lsc_earn_limits */
export const ckLscEarnLimits: SchemeInvariant = (s) => [
  ...notNegative('lsc_min_bill_amount', s.lscMinBillAmount),
  ...notNegative('lsc_max_earn_points', s.lscMaxEarnPoints),
];

/** ck_lsc_redeem_limits */
export const ckLscRedeemLimits: SchemeInvariant = (s) => [
  ...notNegative('lsc_redeem_value_per_point', s.lscRedeemValuePerPoint),
  ...notNegative('lsc_min_redeem_points', s.lscMinRedeemPoints),
  ...notNegative('lsc_max_redeem_points', s.lscMaxRedeemPoints),
  ...notNegative('lsc_redeem_min_bill_amount', s.lscRedeemMinBillAmount),
  ...notNegative('lsc_redeem_multiple', s.lscRedeemMultiple),
  ...inRange('lsc_max_redeem_perc', s.lscMaxRedeemPerc, 0, 100),
];

/**
 * ck_lsc_redeem_rate — a scheme that redeems must say what a point is worth, or
 * the till has nothing to price the redemption with.
 */
export const ckLscRedeemRate: SchemeInvariant = (s) =>
  !s.lscAllowPointRedeem || s.lscRedeemValuePerPoint > 0
    ? ok
    : [
        {
          field: 'lsc_redeem_value_per_point',
          message:
            'lsc_redeem_value_per_point must be greater than 0 once lsc_allow_point_redeem is true',
        },
      ];

// ─── approval ─────────────────────────────────────────────────────────────────

/** ck_lsc_approved — lsc_status <> 'APPROVED' OR lsc_approved_by IS NOT NULL */
export const ckLscApproved: SchemeInvariant = (s) =>
  s.lscStatus !== 'APPROVED' || s.lscApprovedBy
    ? ok
    : [
        {
          field: 'lsc_approved_by',
          message: 'lsc_approved_by is required once lsc_status is APPROVED',
        },
      ];

/**
 * The whole set, keyed by the constraint each one mirrors. Ordered as the
 * migration orders them so the two can be read side by side.
 */
export const SCHEME_INVARIANTS: ReadonlyMap<string, SchemeInvariant> = new Map([
  ['ck_lsc_code_shape', ckLscCodeShape],
  ['ck_lsc_type', ckLscType],
  ['ck_lsc_status', ckLscStatus],
  ['ck_lsc_apply_on', ckLscApplyOn],
  ['ck_lsc_calc_on', ckLscCalcOn],
  ['ck_lsc_bill_type', ckLscBillType],
  ['ck_lsc_rounding', ckLscRounding],
  ['ck_lsc_branch_scope', ckLscBranchScope],
  ['ck_lsc_cust_scope', ckLscCustScope],
  ['ck_lsc_item_scope', ckLscItemScope],
  ['ck_lsc_pool_mode', ckLscPoolMode],
  ['ck_lsc_return_mode', ckLscReturnMode],
  ['ck_lsc_expiry_basis', ckLscExpiryBasis],
  ['ck_lsc_expiry_days', ckLscExpiryDays],
  ['ck_lsc_dates', ckLscDates],
  ['ck_lsc_time_pair', ckLscTimePair],
  ['ck_lsc_weekdays', ckLscWeekdays],
  ['ck_lsc_priority', ckLscPriority],
  ['ck_lsc_decimals', ckLscDecimals],
  ['ck_lsc_activation', ckLscActivation],
  ['ck_lsc_earn_limits', ckLscEarnLimits],
  ['ck_lsc_redeem_limits', ckLscRedeemLimits],
  ['ck_lsc_redeem_rate', ckLscRedeemRate],
  ['ck_lsc_approved', ckLscApproved],
]);

/** Runs every invariant and returns everything wrong with the header, not just the first thing. */
export function collectSchemeInvariantErrors(
  scheme: EffectiveScheme,
): PromotionLoyaltyPointsErrorDetail[] {
  return [...SCHEME_INVARIANTS.values()].flatMap((invariant) => invariant(scheme));
}

// ══ sales.loyalty_scheme_branch — the branch grid ════════════════════════════

export interface EffectiveBranchRow {
  lsbSlno: number;
}

export type BranchInvariant = (row: EffectiveBranchRow) => PromotionLoyaltyPointsErrorDetail[];

/** ck_lsb_slno — lsb_slno > 0 */
export const ckLsbSlno: BranchInvariant = (r) =>
  Number.isInteger(r.lsbSlno) && r.lsbSlno > 0
    ? ok
    : [{ field: 'lsb_slno', message: 'lsb_slno must be a whole number greater than 0' }];

export const BRANCH_INVARIANTS: ReadonlyMap<string, BranchInvariant> = new Map([
  ['ck_lsb_slno', ckLsbSlno],
]);

export function collectBranchInvariantErrors(
  row: EffectiveBranchRow,
): PromotionLoyaltyPointsErrorDetail[] {
  return [...BRANCH_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}

// ══ sales.loyalty_scheme_party — the party grid ══════════════════════════════

/** One party row as it will exist AFTER this request. */
export interface EffectivePartyRow {
  lspSlno: number;
  lspKind: string;
  lspMatchPriority: number;
}

export type PartyInvariant = (row: EffectivePartyRow) => PromotionLoyaltyPointsErrorDetail[];

/** ck_lsp_kind — CUSTOMER or CUSTOMER_GROUP; loyalty has no AREA or CITY. */
export const ckLspKind: PartyInvariant = (r) => vocabulary('lsp_kind', r.lspKind, LSP_KINDS);

/** ck_lsp_slno — lsp_slno > 0 */
export const ckLspSlno: PartyInvariant = (r) =>
  Number.isInteger(r.lspSlno) && r.lspSlno > 0
    ? ok
    : [{ field: 'lsp_slno', message: 'lsp_slno must be a whole number greater than 0' }];

/**
 * ck_lsp_match_priority — BETWEEN 0 AND 9. Narrowest wins, so this is the column
 * that decides which of several rows reaching one customer actually applies.
 * Seeded by kind when omitted: CUSTOMER 2, CUSTOMER_GROUP 1.
 */
export const ckLspMatchPriority: PartyInvariant = (r) =>
  wholeBetween('lsp_match_priority', r.lspMatchPriority, 0, 9);

export const PARTY_INVARIANTS: ReadonlyMap<string, PartyInvariant> = new Map([
  ['ck_lsp_kind', ckLspKind],
  ['ck_lsp_slno', ckLspSlno],
  ['ck_lsp_match_priority', ckLspMatchPriority],
]);

export function collectPartyInvariantErrors(
  row: EffectivePartyRow,
): PromotionLoyaltyPointsErrorDetail[] {
  return [...PARTY_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}

// ══ sales.loyalty_scheme_item — the item grid ════════════════════════════════

/** One item row as it will exist AFTER this request. */
export interface EffectiveItemRow {
  lsiSlno: number;
  lsiKind: string;
  lsiIsExclude: boolean;
  lsiFactor: number;
  lsiPoints: number;
  lsiMaxPoints: number;
  lsiMatchPriority: number;
}

export type ItemInvariant = (row: EffectiveItemRow) => PromotionLoyaltyPointsErrorDetail[];

/** ck_lsi_kind */
export const ckLsiKind: ItemInvariant = (r) => vocabulary('lsi_kind', r.lsiKind, LSI_KINDS);

/**
 * ck_lsi_exclude — an exclusion earns nothing, so a rate on it would be a
 * contradiction somebody would eventually try to read.
 */
export const ckLsiExclude: ItemInvariant = (r) =>
  !r.lsiIsExclude || (r.lsiPoints === 0 && r.lsiFactor === 1)
    ? ok
    : [
        {
          field: 'lsi_is_exclude',
          message: 'An exclude row earns nothing — leave lsi_points at 0 and lsi_factor at 1',
        },
      ];

/** ck_lsi_values — lsi_factor > 0, lsi_points >= 0, lsi_max_points >= 0. */
export const ckLsiValues: ItemInvariant = (r) => [
  ...greaterThanZero('lsi_factor', r.lsiFactor),
  ...notNegative('lsi_points', r.lsiPoints),
  ...notNegative('lsi_max_points', r.lsiMaxPoints),
];

/** ck_lsi_slno — lsi_slno > 0 */
export const ckLsiSlno: ItemInvariant = (r) =>
  Number.isInteger(r.lsiSlno) && r.lsiSlno > 0
    ? ok
    : [{ field: 'lsi_slno', message: 'lsi_slno must be a whole number greater than 0' }];

/**
 * ck_lsi_match_priority — BETWEEN 0 AND 9. Most specific wins; seeded by kind
 * when omitted: ITEM 4, ITEM_BRAND 3, ITEM_CATEGORY 2, ITEM_SECTION 1,
 * ITEM_GROUP 0.
 */
export const ckLsiMatchPriority: ItemInvariant = (r) =>
  wholeBetween('lsi_match_priority', r.lsiMatchPriority, 0, 9);

export const ITEM_INVARIANTS: ReadonlyMap<string, ItemInvariant> = new Map([
  ['ck_lsi_kind', ckLsiKind],
  ['ck_lsi_exclude', ckLsiExclude],
  ['ck_lsi_values', ckLsiValues],
  ['ck_lsi_slno', ckLsiSlno],
  ['ck_lsi_match_priority', ckLsiMatchPriority],
]);

export function collectItemInvariantErrors(
  row: EffectiveItemRow,
): PromotionLoyaltyPointsErrorDetail[] {
  return [...ITEM_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}

// ══ sales.loyalty_scheme_slab — the earn bands ═══════════════════════════════

/** One band as it will exist AFTER this request. */
export interface EffectiveSlabRow {
  lssSlno: number;
  lssExceeds: number;
  lssUpto: number | null;
  lssEach: number;
  lssPoints: number;
  lssFactor: number;
  lssMaxPoints: number;
}

export type SlabInvariant = (row: EffectiveSlabRow) => PromotionLoyaltyPointsErrorDetail[];

/** ck_lss_band — lss_exceeds >= 0 AND (lss_upto IS NULL OR lss_upto > lss_exceeds) */
export const ckLssBand: SlabInvariant = (r) => [
  ...notNegative('lss_exceeds', r.lssExceeds),
  ...(r.lssUpto === null || r.lssUpto > r.lssExceeds
    ? ok
    : [{ field: 'lss_upto', message: 'lss_upto must be greater than lss_exceeds' }]),
];

/** ck_lss_values — lss_each > 0, points >= 0, factor > 0, max_points >= 0. */
export const ckLssValues: SlabInvariant = (r) => [
  ...greaterThanZero('lss_each', r.lssEach),
  ...notNegative('lss_points', r.lssPoints),
  ...greaterThanZero('lss_factor', r.lssFactor),
  ...notNegative('lss_max_points', r.lssMaxPoints),
];

/** ck_lss_slno — lss_slno > 0 */
export const ckLssSlno: SlabInvariant = (r) =>
  Number.isInteger(r.lssSlno) && r.lssSlno > 0
    ? ok
    : [{ field: 'lss_slno', message: 'lss_slno must be a whole number greater than 0' }];

export const SLAB_INVARIANTS: ReadonlyMap<string, SlabInvariant> = new Map([
  ['ck_lss_band', ckLssBand],
  ['ck_lss_values', ckLssValues],
  ['ck_lss_slno', ckLssSlno],
]);

export function collectSlabInvariantErrors(
  row: EffectiveSlabRow,
): PromotionLoyaltyPointsErrorDetail[] {
  return [...SLAB_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}

// ══ sales.loyalty_scheme_gift — the gift catalogue ═══════════════════════════

/** One catalogue row as it will exist AFTER this request. */
export interface EffectiveGiftRow {
  lsgSlno: number;
  lsgItemQty: number;
  lsgRedeemPoints: number;
  lsgMaxQtyPerBill: number;
  lsgValidFrom: Date | null;
  lsgValidUpto: Date | null;
}

export type GiftInvariant = (row: EffectiveGiftRow) => PromotionLoyaltyPointsErrorDetail[];

/** ck_lsg_qty — lsg_item_qty > 0 AND lsg_max_qty_per_bill >= 0 */
export const ckLsgQty: GiftInvariant = (r) => [
  ...greaterThanZero('lsg_item_qty', r.lsgItemQty),
  ...notNegative('lsg_max_qty_per_bill', r.lsgMaxQtyPerBill),
];

/** ck_lsg_points — lsg_redeem_points >= 0 */
export const ckLsgPoints: GiftInvariant = (r) =>
  notNegative('lsg_redeem_points', r.lsgRedeemPoints);

/** ck_lsg_validity — an open-ended end is fine; an end before the start is not. */
export const ckLsgValidity: GiftInvariant = (r) =>
  r.lsgValidFrom === null ||
  r.lsgValidUpto === null ||
  r.lsgValidUpto.getTime() >= r.lsgValidFrom.getTime()
    ? ok
    : [{ field: 'lsg_valid_upto', message: 'lsg_valid_upto must be on or after lsg_valid_from' }];

/** ck_lsg_slno — lsg_slno > 0 */
export const ckLsgSlno: GiftInvariant = (r) =>
  Number.isInteger(r.lsgSlno) && r.lsgSlno > 0
    ? ok
    : [{ field: 'lsg_slno', message: 'lsg_slno must be a whole number greater than 0' }];

export const GIFT_INVARIANTS: ReadonlyMap<string, GiftInvariant> = new Map([
  ['ck_lsg_qty', ckLsgQty],
  ['ck_lsg_points', ckLsgPoints],
  ['ck_lsg_validity', ckLsgValidity],
  ['ck_lsg_slno', ckLsgSlno],
]);

export function collectGiftInvariantErrors(
  row: EffectiveGiftRow,
): PromotionLoyaltyPointsErrorDetail[] {
  return [...GIFT_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
