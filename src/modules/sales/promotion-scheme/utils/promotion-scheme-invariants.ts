import { PromotionSchemeErrorDetail } from '../types/promotion-scheme-api.types';
import {
  PRM_APPLY_ON,
  PRM_BENEFITS,
  PRM_BILL_TYPES,
  PRM_CALC_ON,
  PRM_CODE_PATTERN,
  PRM_SCOPES,
  PRM_STACK_MODES,
  PRM_STATUSES,
  PRI_KINDS,
  PRM_WEEKDAYS_PATTERN,
  PRP_KINDS,
} from './promotion-scheme.utils';

/**
 * The CHECK constraints of sales.promotion_scheme and its four child tables,
 * one function each.
 *
 * The table carries none of them — 20260821081000_add_promotion_scheme creates
 * the columns and the foreign keys and stops there, deliberately, so that a
 * rejected campaign comes back as a field-addressed 400 rather than a Postgres
 * error string the screen cannot place on an input. This file is therefore not
 * a second line of defence; it is the only one.
 *
 * Every function is named after the constraint it replaces and returns the
 * errors it found rather than throwing, so one bad payload is answered with
 * every problem in it at once instead of the first.
 */

// ══ sales.promotion_scheme — the header ══════════════════════════════════════

/** The header as it will exist AFTER this request: the stored row overlaid with whatever is being written. */
export interface EffectiveScheme {
  prmCode: string;
  prmStatus: string;
  prmApplyOn: string;
  prmBenefit: string;
  prmStackMode: string;
  prmCalcOnAmountType: string;
  prmBillType: string;
  prmBranchScope: string;
  prmCustScope: string;
  prmItemScope: string;
  prmPriority: number;
  prmMinBillAmount: number;
  prmMinQty: number;
  prmMaxBenefitPerBill: number;
  prmMaxUsesTotal: number;
  prmMaxUsesPerCust: number;
  prmBudgetAmount: number;
  prmStartDate: Date;
  prmEndDate: Date;
  prmValidFromTime: Date | null;
  prmValidToTime: Date | null;
  prmValidWeekdays: string | null;
  prmApprovedBy: string | null;
}

export type SchemeInvariant = (scheme: EffectiveScheme) => PromotionSchemeErrorDetail[];

const ok: PromotionSchemeErrorDetail[] = [];

const vocabulary = (
  field: string,
  value: string,
  allowed: readonly string[],
): PromotionSchemeErrorDetail[] =>
  allowed.includes(value)
    ? ok
    : [{ field, message: `${field} must be one of ${allowed.join(', ')}` }];

const notNegative = (field: string, value: number | null): PromotionSchemeErrorDetail[] =>
  value === null || (Number.isFinite(value) && value >= 0)
    ? ok
    : [{ field, message: `${field} must be 0 or more` }];

const inRange = (
  field: string,
  value: number,
  minimum: number,
  maximum: number,
): PromotionSchemeErrorDetail[] =>
  Number.isFinite(value) && value >= minimum && value <= maximum
    ? ok
    : [{ field, message: `${field} must be between ${minimum} and ${maximum}` }];

const greaterThanZero = (field: string, value: number): PromotionSchemeErrorDetail[] =>
  Number.isFinite(value) && value > 0
    ? ok
    : [{ field, message: `${field} must be greater than 0` }];

const wholeBetween = (
  field: string,
  value: number,
  minimum: number,
  maximum: number,
): PromotionSchemeErrorDetail[] =>
  Number.isInteger(value) && value >= minimum && value <= maximum
    ? ok
    : [
        {
          field,
          message: `${field} must be a whole number between ${minimum} and ${maximum}`,
        },
      ];

// ─── shape ────────────────────────────────────────────────────────────────────

/** ck_prm_code_shape — prm_code ~ '^[A-Za-z0-9_-]+$' */
export const ckPrmCodeShape: SchemeInvariant = (s) =>
  PRM_CODE_PATTERN.test(s.prmCode)
    ? ok
    : [
        {
          field: 'prm_code',
          message: 'prm_code may contain only letters, digits, underscore and hyphen',
        },
      ];

// ─── vocabularies ─────────────────────────────────────────────────────────────

/** ck_prm_status */
export const ckPrmStatus: SchemeInvariant = (s) =>
  vocabulary('prm_status', s.prmStatus, PRM_STATUSES);

/** ck_prm_apply_on */
export const ckPrmApplyOn: SchemeInvariant = (s) =>
  vocabulary('prm_apply_on', s.prmApplyOn, PRM_APPLY_ON);

/** ck_prm_benefit */
export const ckPrmBenefit: SchemeInvariant = (s) =>
  vocabulary('prm_benefit', s.prmBenefit, PRM_BENEFITS);

/** ck_prm_stack_mode */
export const ckPrmStackMode: SchemeInvariant = (s) =>
  vocabulary('prm_stack_mode', s.prmStackMode, PRM_STACK_MODES);

/** ck_prm_calc_on */
export const ckPrmCalcOn: SchemeInvariant = (s) =>
  vocabulary('prm_calc_on_amount_type', s.prmCalcOnAmountType, PRM_CALC_ON);

/** ck_prm_bill_type */
export const ckPrmBillType: SchemeInvariant = (s) =>
  vocabulary('prm_bill_type', s.prmBillType, PRM_BILL_TYPES);

/** ck_prm_branch_scope */
export const ckPrmBranchScope: SchemeInvariant = (s) =>
  vocabulary('prm_branch_scope', s.prmBranchScope, PRM_SCOPES);

/** ck_prm_cust_scope */
export const ckPrmCustScope: SchemeInvariant = (s) =>
  vocabulary('prm_cust_scope', s.prmCustScope, PRM_SCOPES);

/** ck_prm_item_scope */
export const ckPrmItemScope: SchemeInvariant = (s) =>
  vocabulary('prm_item_scope', s.prmItemScope, PRM_SCOPES);

// ─── the benefit/trigger pairing ──────────────────────────────────────────────

/**
 * ck_prm_fixed_price_scope — a FIXED_PRICE offer priced off the whole bill is
 * meaningless: there is no line to reprice. It needs an item trigger.
 *
 * The DDL comment above this constraint says "FIXED_PRICE or FREE_ITEM", but
 * the constraint body only ever tested FIXED_PRICE. This follows the body, so
 * behaviour is unchanged; a FREE_ITEM scheme on a bill-level trigger is still
 * accepted, as it always was.
 */
export const ckPrmFixedPriceScope: SchemeInvariant = (s) =>
  s.prmBenefit !== 'FIXED_PRICE' || ['ITEM_QTY', 'ITEM_AMOUNT'].includes(s.prmApplyOn)
    ? ok
    : [
        {
          field: 'prm_apply_on',
          message:
            'A FIXED_PRICE benefit needs an item trigger (ITEM_QTY or ITEM_AMOUNT) — there is no ' +
            'line to reprice on a bill-level scheme',
        },
      ];

// ─── the validity window ──────────────────────────────────────────────────────

/** ck_prm_dates — prm_end_date >= prm_start_date */
export const ckPrmDates: SchemeInvariant = (s) =>
  s.prmEndDate.getTime() >= s.prmStartDate.getTime()
    ? ok
    : [{ field: 'prm_end_date', message: 'prm_end_date must be on or after prm_start_date' }];

/**
 * ck_prm_time_pair — both ends of the window or neither.
 *
 * Deliberately NO "to >= from": 22:00 to 04:00 is a late-night offer, not a
 * typo, and the engine reads from > to as "spans midnight".
 */
export const ckPrmTimePair: SchemeInvariant = (s) =>
  (s.prmValidFromTime === null) === (s.prmValidToTime === null)
    ? ok
    : [
        {
          field: 'prm_valid_to_time',
          message: 'Send both prm_valid_from_time and prm_valid_to_time, or neither',
        },
      ];

/** ck_prm_weekdays — shape, not vocabulary: three-letter day names, comma separated. */
export const ckPrmWeekdays: SchemeInvariant = (s) =>
  s.prmValidWeekdays === null || PRM_WEEKDAYS_PATTERN.test(s.prmValidWeekdays)
    ? ok
    : [
        {
          field: 'prm_valid_weekdays',
          message: 'prm_valid_weekdays must be comma-separated MON,TUE,WED,THU,FRI,SAT,SUN',
        },
      ];

// ─── numbers ──────────────────────────────────────────────────────────────────

/** ck_prm_priority — prm_priority BETWEEN 1 AND 9 */
export const ckPrmPriority: SchemeInvariant = (s) =>
  wholeBetween('prm_priority', s.prmPriority, 1, 9);

/** ck_prm_thresholds — prm_min_bill_amount >= 0 AND prm_min_qty >= 0 */
export const ckPrmThresholds: SchemeInvariant = (s) => [
  ...notNegative('prm_min_bill_amount', s.prmMinBillAmount),
  ...notNegative('prm_min_qty', s.prmMinQty),
];

/** ck_prm_caps — the four ceilings are 0 (uncapped) or more. */
export const ckPrmCaps: SchemeInvariant = (s) => [
  ...notNegative('prm_max_benefit_per_bill', s.prmMaxBenefitPerBill),
  ...notNegative('prm_max_uses_total', s.prmMaxUsesTotal),
  ...notNegative('prm_max_uses_per_cust', s.prmMaxUsesPerCust),
  ...notNegative('prm_budget_amount', s.prmBudgetAmount),
];

// ─── approval ─────────────────────────────────────────────────────────────────

/** ck_prm_approved — prm_status <> 'APPROVED' OR prm_approved_by IS NOT NULL */
export const ckPrmApproved: SchemeInvariant = (s) =>
  s.prmStatus !== 'APPROVED' || s.prmApprovedBy
    ? ok
    : [
        {
          field: 'prm_approved_by',
          message: 'prm_approved_by is required once prm_status is APPROVED',
        },
      ];

/**
 * The whole set, keyed by the constraint each one stands in for. Ordered as the
 * DDL orders them so the two can be read side by side.
 */
export const SCHEME_INVARIANTS: ReadonlyMap<string, SchemeInvariant> = new Map([
  ['ck_prm_code_shape', ckPrmCodeShape],
  ['ck_prm_status', ckPrmStatus],
  ['ck_prm_apply_on', ckPrmApplyOn],
  ['ck_prm_benefit', ckPrmBenefit],
  ['ck_prm_stack_mode', ckPrmStackMode],
  ['ck_prm_calc_on', ckPrmCalcOn],
  ['ck_prm_bill_type', ckPrmBillType],
  ['ck_prm_branch_scope', ckPrmBranchScope],
  ['ck_prm_cust_scope', ckPrmCustScope],
  ['ck_prm_item_scope', ckPrmItemScope],
  ['ck_prm_fixed_price_scope', ckPrmFixedPriceScope],
  ['ck_prm_dates', ckPrmDates],
  ['ck_prm_time_pair', ckPrmTimePair],
  ['ck_prm_weekdays', ckPrmWeekdays],
  ['ck_prm_priority', ckPrmPriority],
  ['ck_prm_thresholds', ckPrmThresholds],
  ['ck_prm_caps', ckPrmCaps],
  ['ck_prm_approved', ckPrmApproved],
]);

/** Runs every invariant and returns everything wrong with the header, not just the first thing. */
export function collectSchemeInvariantErrors(
  scheme: EffectiveScheme,
): PromotionSchemeErrorDetail[] {
  return [...SCHEME_INVARIANTS.values()].flatMap((invariant) => invariant(scheme));
}

// ══ sales.promotion_scheme_party — the party grid ════════════════════════════
//
// Same story as the header: the table carries none of these, so they are the
// only thing standing between the till and a scope row it cannot rank.

/** One party row as it will exist AFTER this request. */
export interface EffectivePartyRow {
  prpSlno: number;
  prpKind: string;
  prpMatchPriority: number;
}

export type PartyInvariant = (row: EffectivePartyRow) => PromotionSchemeErrorDetail[];

/** ck_prp_kind */
export const ckPrpKind: PartyInvariant = (r) => vocabulary('prp_kind', r.prpKind, PRP_KINDS);

/** ck_prp_slno — prp_slno > 0 */
export const ckPrpSlno: PartyInvariant = (r) =>
  Number.isInteger(r.prpSlno) && r.prpSlno > 0
    ? ok
    : [{ field: 'prp_slno', message: 'prp_slno must be a whole number greater than 0' }];

/**
 * ck_prp_match_priority — prp_match_priority BETWEEN 0 AND 9.
 *
 * Narrowest wins, so this is the column that decides which of several rows
 * reaching one customer actually applies. Seeded by kind when omitted:
 * CUSTOMER 4, AREA 3, CITY 2, CUSTOMER_GROUP 1 — CITY sits below area because a
 * city contains many areas, so an AREA rule is the more specific statement.
 */
export const ckPrpMatchPriority: PartyInvariant = (r) =>
  wholeBetween('prp_match_priority', r.prpMatchPriority, 0, 9);

/** The party set, keyed by the constraint each one stands in for. */
export const PARTY_INVARIANTS: ReadonlyMap<string, PartyInvariant> = new Map([
  ['ck_prp_kind', ckPrpKind],
  ['ck_prp_slno', ckPrpSlno],
  ['ck_prp_match_priority', ckPrpMatchPriority],
]);

/** Runs every party invariant and returns everything wrong with the row. */
export function collectPartyInvariantErrors(row: EffectivePartyRow): PromotionSchemeErrorDetail[] {
  return [...PARTY_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}

// ══ sales.promotion_scheme_item — the item grid ══════════════════════════════

/** One item row as it will exist AFTER this request. */
export interface EffectiveItemRow {
  priSlno: number;
  priKind: string;
  priUnitId: string | null;
  priIsExclude: boolean;
  priDiscPerc: number;
  priDiscQty: number;
  priDiscAmt: number;
  priMinQty: number;
  priFactor: number;
  priMaxBenefit: number;
  priMatchPriority: number;
}

export type ItemInvariant = (row: EffectiveItemRow) => PromotionSchemeErrorDetail[];

/** ck_pri_kind */
export const ckPriKind: ItemInvariant = (r) => vocabulary('pri_kind', r.priKind, PRI_KINDS);

/**
 * ck_pri_unit — (pri_kind = 'ITEM') = (pri_unit_id IS NOT NULL). A biconditional,
 * not a permission.
 *
 * Required on an ITEM row, because "10 of item X" is not a quantity until you
 * say ten of WHAT: ten pieces, ten boxes and ten cases are three different
 * offers, and pri_min_qty is meaningless without one. The bill line the
 * promotion lands on always carries a unit, so a rule that omits one cannot be
 * compared against the line it must match.
 *
 * Forbidden on every other kind, because a unit belongs to ONE item — it is a
 * row of item_unit_conversion, keyed to an item. On a BRAND or CATEGORY row it
 * would silently claim to apply to items that do not define it.
 */
export const ckPriUnit: ItemInvariant = (r) =>
  (r.priKind === 'ITEM') === (r.priUnitId !== null)
    ? ok
    : [
        {
          field: 'pri_unit_id',
          message:
            r.priKind === 'ITEM'
              ? 'pri_unit_id is required on an ITEM row — a quantity is meaningless without a unit'
              : `pri_unit_id must be null on an ${r.priKind} row — a unit belongs to one item`,
        },
      ];

/** ck_pri_one_rate — one way of saying a discount, not three at once. */
export const ckPriOneRate: ItemInvariant = (r) =>
  Number(r.priDiscPerc !== 0) + Number(r.priDiscQty !== 0) + Number(r.priDiscAmt !== 0) <= 1
    ? ok
    : [
        {
          field: 'pri_disc_perc',
          message: 'Set at most one of pri_disc_perc, pri_disc_qty, pri_disc_amt',
        },
      ];

/**
 * ck_pri_exclude — an exclusion gives nothing, so a rate on it would be a
 * contradiction somebody would eventually try to read.
 */
export const ckPriExclude: ItemInvariant = (r) =>
  !r.priIsExclude ||
  (r.priDiscPerc === 0 && r.priDiscQty === 0 && r.priDiscAmt === 0 && r.priFactor === 1)
    ? ok
    : [
        {
          field: 'pri_is_exclude',
          message: 'An exclude row gives nothing — leave every rate at 0 and pri_factor at 1',
        },
      ];

/** ck_pri_values — the six numeric bounds, reported per column. */
export const ckPriValues: ItemInvariant = (r) => [
  ...inRange('pri_disc_perc', r.priDiscPerc, 0, 100),
  ...notNegative('pri_disc_qty', r.priDiscQty),
  ...notNegative('pri_disc_amt', r.priDiscAmt),
  ...notNegative('pri_min_qty', r.priMinQty),
  ...greaterThanZero('pri_factor', r.priFactor),
  ...notNegative('pri_max_benefit', r.priMaxBenefit),
];

/** ck_pri_slno — pri_slno > 0 */
export const ckPriSlno: ItemInvariant = (r) =>
  Number.isInteger(r.priSlno) && r.priSlno > 0
    ? ok
    : [{ field: 'pri_slno', message: 'pri_slno must be a whole number greater than 0' }];

/**
 * ck_pri_match_priority — BETWEEN 0 AND 9. Most specific wins; seeded by kind
 * when omitted: ITEM 4, ITEM_BRAND 3, ITEM_CATEGORY 2, ITEM_SECTION 1,
 * ITEM_GROUP 0.
 */
export const ckPriMatchPriority: ItemInvariant = (r) =>
  wholeBetween('pri_match_priority', r.priMatchPriority, 0, 9);

/** The item set, keyed by the constraint each one stands in for. */
export const ITEM_INVARIANTS: ReadonlyMap<string, ItemInvariant> = new Map([
  ['ck_pri_kind', ckPriKind],
  ['ck_pri_unit', ckPriUnit],
  ['ck_pri_one_rate', ckPriOneRate],
  ['ck_pri_exclude', ckPriExclude],
  ['ck_pri_values', ckPriValues],
  ['ck_pri_slno', ckPriSlno],
  ['ck_pri_match_priority', ckPriMatchPriority],
]);

/** Runs every item invariant and returns everything wrong with the row. */
export function collectItemInvariantErrors(row: EffectiveItemRow): PromotionSchemeErrorDetail[] {
  return [...ITEM_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}

// ══ sales.promotion_scheme_slab — the offer bands ════════════════════════════

/** One band as it will exist AFTER this request. */
export interface EffectiveSlabRow {
  prsSlno: number;
  prsBenefit: string;
  prsExceeds: number;
  prsUpto: number | null;
  prsEach: number;
  prsIsRepeat: boolean;
  prsMaxRepeats: number;
  prsFreeItemId: string | null;
  prsFreeUnitId: string | null;
  prsFreeQty: number;
  prsDiscPerc: number;
  prsDiscQty: number;
  prsDiscAmt: number;
  prsFixedPrice: number | null;
  prsMaxBenefitAmt: number;
}

export type SlabInvariant = (row: EffectiveSlabRow) => PromotionSchemeErrorDetail[];

/** ck_prs_band — prs_exceeds >= 0 AND (prs_upto IS NULL OR prs_upto > prs_exceeds) */
export const ckPrsBand: SlabInvariant = (r) => [
  ...notNegative('prs_exceeds', r.prsExceeds),
  ...(r.prsUpto === null || r.prsUpto > r.prsExceeds
    ? ok
    : [{ field: 'prs_upto', message: 'prs_upto must be greater than prs_exceeds' }]),
];

/** ck_prs_each — prs_each > 0, prs_max_repeats >= 0, and repeats only mean something when repeating. */
export const ckPrsEach: SlabInvariant = (r) => [
  ...greaterThanZero('prs_each', r.prsEach),
  ...notNegative('prs_max_repeats', r.prsMaxRepeats),
  ...(r.prsIsRepeat || r.prsMaxRepeats === 0
    ? ok
    : [
        {
          field: 'prs_max_repeats',
          message: 'prs_max_repeats only means something when prs_is_repeat is true',
        },
      ]),
];

/** ck_prs_amounts — every band figure within its bound, reported per column. */
export const ckPrsAmounts: SlabInvariant = (r) => [
  ...notNegative('prs_free_qty', r.prsFreeQty),
  ...inRange('prs_disc_perc', r.prsDiscPerc, 0, 100),
  ...notNegative('prs_disc_qty', r.prsDiscQty),
  ...notNegative('prs_disc_amt', r.prsDiscAmt),
  ...notNegative('prs_fixed_price', r.prsFixedPrice),
  ...notNegative('prs_max_benefit_amt', r.prsMaxBenefitAmt),
];

/**
 * ck_prs_free_unit_pair — a free item needs the unit it is issued in, or the
 * bill line cannot be built without a conversion lookup the till may not be
 * able to make.
 */
export const ckPrsFreeUnitPair: SlabInvariant = (r) =>
  (r.prsFreeItemId === null) === (r.prsFreeUnitId === null)
    ? ok
    : [
        {
          field: 'prs_free_unit_id',
          message: 'A free item needs the unit it is issued in — send both or neither',
        },
      ];

/**
 * ck_prs_benefit_columns — the benefit column matches the benefit, and every
 * other one is empty, so a band can never be read two ways.
 *
 * prs_benefit itself mirrors the header's prm_benefit; the composite foreign
 * key fk_prs_scheme_benefit is what holds those two together, and the service
 * answers 400 before Postgres has to.
 */
export const ckPrsBenefitColumns: SlabInvariant = (r) => {
  const noDiscounts = r.prsDiscPerc === 0 && r.prsDiscQty === 0 && r.prsDiscAmt === 0;
  const noFree = r.prsFreeItemId === null && r.prsFreeQty === 0;

  switch (r.prsBenefit) {
    case 'FREE_ITEM':
      return [
        ...(r.prsFreeItemId !== null && r.prsFreeQty > 0
          ? ok
          : [
              {
                field: 'prs_free_item_id',
                message: 'A FREE_ITEM band needs prs_free_item_id and prs_free_qty greater than 0',
              },
            ]),
        ...(noDiscounts && r.prsFixedPrice === null
          ? ok
          : [
              {
                field: 'prs_benefit',
                message: 'A FREE_ITEM band must leave the discount and fixed-price columns empty',
              },
            ]),
      ];
    case 'DISC_PERC':
      return [
        ...(r.prsDiscPerc > 0
          ? ok
          : [
              {
                field: 'prs_disc_perc',
                message: 'A DISC_PERC band needs prs_disc_perc greater than 0',
              },
            ]),
        ...(noFree && r.prsDiscQty === 0 && r.prsDiscAmt === 0 && r.prsFixedPrice === null
          ? ok
          : [
              {
                field: 'prs_benefit',
                message: 'A DISC_PERC band must leave every other benefit column empty',
              },
            ]),
      ];
    case 'DISC_AMT':
      return [
        // Exactly one of flat or per-unit — the SQL writes this as <> on two
        // booleans, which is XOR.
        ...(r.prsDiscAmt > 0 !== r.prsDiscQty > 0
          ? ok
          : [
              {
                field: 'prs_disc_amt',
                message:
                  'A DISC_AMT band needs exactly one of prs_disc_amt (flat) or prs_disc_qty ' +
                  '(per unit)',
              },
            ]),
        ...(noFree && r.prsDiscPerc === 0 && r.prsFixedPrice === null
          ? ok
          : [
              {
                field: 'prs_benefit',
                message:
                  'A DISC_AMT band must leave the free-item, percentage and price columns empty',
              },
            ]),
      ];
    case 'FIXED_PRICE':
      return [
        ...(r.prsFixedPrice !== null
          ? ok
          : [{ field: 'prs_fixed_price', message: 'A FIXED_PRICE band needs prs_fixed_price' }]),
        ...(noFree && noDiscounts
          ? ok
          : [
              {
                field: 'prs_benefit',
                message: 'A FIXED_PRICE band must leave the free-item and discount columns empty',
              },
            ]),
      ];
    default:
      // The DDL's ELSE false: an unknown benefit fails the constraint outright.
      return [{ field: 'prs_benefit', message: `Unknown benefit ${r.prsBenefit}` }];
  }
};

/** ck_prs_slno — prs_slno > 0 */
export const ckPrsSlno: SlabInvariant = (r) =>
  Number.isInteger(r.prsSlno) && r.prsSlno > 0
    ? ok
    : [{ field: 'prs_slno', message: 'prs_slno must be a whole number greater than 0' }];

/** The slab set, keyed by the constraint each one stands in for. */
export const SLAB_INVARIANTS: ReadonlyMap<string, SlabInvariant> = new Map([
  ['ck_prs_band', ckPrsBand],
  ['ck_prs_each', ckPrsEach],
  ['ck_prs_amounts', ckPrsAmounts],
  ['ck_prs_free_unit_pair', ckPrsFreeUnitPair],
  ['ck_prs_benefit_columns', ckPrsBenefitColumns],
  ['ck_prs_slno', ckPrsSlno],
]);

/** Runs every slab invariant and returns everything wrong with the band. */
export function collectSlabInvariantErrors(row: EffectiveSlabRow): PromotionSchemeErrorDetail[] {
  return [...SLAB_INVARIANTS.values()].flatMap((invariant) => invariant(row));
}
