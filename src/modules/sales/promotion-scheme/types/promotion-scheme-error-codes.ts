/**
 * Notes 119 / 127 §5 — every refusal of the Promotion Scheme master
 * (/promotion-schemes) carries one of these as `errors[].code`; the client words
 * its box by the code alone. One meaning per code: a site with a new meaning
 * gets a new member, never an old one.
 */
export enum PromotionSchemeErrorCode {
  // ─── field shape (the service's own checks, before the invariants) ─────────
  /** A required field (code, name, date, a grid row's scope id, …) was missing or blank. */
  FIELD_REQUIRED = 'PROMO_SCHEME_FIELD_REQUIRED',
  /** An id field was not a valid uuid. */
  INVALID_UUID = 'PROMO_SCHEME_INVALID_UUID',
  /** A number was not a number, or below the least value the field takes. */
  NUMBER_BELOW_MINIMUM = 'PROMO_SCHEME_NUMBER_BELOW_MINIMUM',
  /** A number was above the most the field takes. */
  NUMBER_ABOVE_MAXIMUM = 'PROMO_SCHEME_NUMBER_ABOVE_MAXIMUM',
  /** A field that takes a whole number got a fraction. */
  NOT_WHOLE_NUMBER = 'PROMO_SCHEME_NOT_WHOLE_NUMBER',
  /** A date field was not a YYYY-MM-DD date. */
  INVALID_DATE = 'PROMO_SCHEME_INVALID_DATE',
  /** A time field was not HH:mm or HH:mm:ss. */
  INVALID_TIME = 'PROMO_SCHEME_INVALID_TIME',
  /** prm_approved_on was not a valid date-time. */
  INVALID_DATETIME = 'PROMO_SCHEME_INVALID_DATETIME',

  // ─── scheme rules (promotion-scheme-invariants.ts — the table has no CHECKs) ──
  /** A vocabulary field (status, trigger, benefit, scope, kind, …) held a value outside its list. */
  VALUE_NOT_ALLOWED = 'PROMO_SCHEME_VALUE_NOT_ALLOWED',
  /** An amount, quantity, cap or limit field was below 0. */
  NEGATIVE_VALUE = 'PROMO_SCHEME_NEGATIVE_VALUE',
  /** A factor or "each" field was 0 or less where it must be above 0. */
  NOT_ABOVE_ZERO = 'PROMO_SCHEME_NOT_ABOVE_ZERO',
  /** A bounded field (priority, match priority, discount %) was outside its range. */
  OUT_OF_RANGE = 'PROMO_SCHEME_OUT_OF_RANGE',
  /** prm_code held a character other than letters, digits, underscore and hyphen. */
  CODE_SHAPE = 'PROMO_SCHEME_CODE_SHAPE',
  /** A FIXED_PRICE benefit on a bill-level trigger (it needs ITEM_QTY or ITEM_AMOUNT). */
  FIXED_PRICE_NEEDS_ITEM_TRIGGER = 'PROMO_SCHEME_FIXED_PRICE_NEEDS_ITEM_TRIGGER',
  /** prm_end_date falls before prm_start_date. */
  END_BEFORE_START = 'PROMO_SCHEME_END_BEFORE_START',
  /** Only one of prm_valid_from_time / prm_valid_to_time was sent. */
  TIME_PAIR_INCOMPLETE = 'PROMO_SCHEME_TIME_PAIR_INCOMPLETE',
  /** prm_valid_weekdays was not a comma list of MON…SUN. */
  WEEKDAYS_INVALID = 'PROMO_SCHEME_WEEKDAYS_INVALID',
  /** prm_status is APPROVED with no prm_approved_by. */
  APPROVER_REQUIRED = 'PROMO_SCHEME_APPROVER_REQUIRED',
  /** A grid row's serial number (prp/pri/prs_slno) was not a whole number above 0. */
  SLNO_INVALID = 'PROMO_SCHEME_SLNO_INVALID',
  /** An ITEM row came without pri_unit_id. */
  ITEM_UNIT_REQUIRED = 'PROMO_SCHEME_ITEM_UNIT_REQUIRED',
  /** A non-ITEM row (brand, group, …) came with a pri_unit_id. */
  ITEM_UNIT_NOT_ALLOWED = 'PROMO_SCHEME_ITEM_UNIT_NOT_ALLOWED',
  /** An item row set more than one of pri_disc_perc / pri_disc_qty / pri_disc_amt. */
  ITEM_MORE_THAN_ONE_RATE = 'PROMO_SCHEME_ITEM_MORE_THAN_ONE_RATE',
  /** An exclude item row carried a rate or a factor other than 1. */
  EXCLUDE_ROW_GIVES = 'PROMO_SCHEME_EXCLUDE_ROW_GIVES',
  /** A slab's prs_upto was not above its prs_exceeds. */
  SLAB_BAND_INVALID = 'PROMO_SCHEME_SLAB_BAND_INVALID',
  /** A slab set prs_max_repeats without prs_is_repeat. */
  SLAB_REPEATS_WITHOUT_REPEAT = 'PROMO_SCHEME_SLAB_REPEATS_WITHOUT_REPEAT',
  /** A slab named a free item without its unit, or a unit without the item. */
  SLAB_FREE_UNIT_PAIR = 'PROMO_SCHEME_SLAB_FREE_UNIT_PAIR',
  /** A slab lacks the value its benefit needs (free item + qty, %, flat-or-per-unit amount, price). */
  SLAB_BENEFIT_VALUE_MISSING = 'PROMO_SCHEME_SLAB_BENEFIT_VALUE_MISSING',
  /** A slab filled a benefit column that belongs to another benefit. */
  SLAB_OTHER_BENEFIT_FILLED = 'PROMO_SCHEME_SLAB_OTHER_BENEFIT_FILLED',
  /** A slab's prs_benefit differs from the scheme's prm_benefit. */
  SLAB_BENEFIT_MISMATCH = 'PROMO_SCHEME_SLAB_BENEFIT_MISMATCH',
  /** prm_benefit changed while slab bands exist and no retyped `slabs` came with it. */
  BENEFIT_CHANGE_WITH_SLABS = 'PROMO_SCHEME_BENEFIT_CHANGE_WITH_SLABS',

  // ─── lookups and clashes ────────────────────────────────────────────────────
  /** The promotion scheme (prm_id) does not exist or was deleted. */
  SCHEME_NOT_FOUND = 'PROMO_SCHEME_NOT_FOUND',
  /** The customer asked about in an eligibility check does not exist or was deleted. */
  CUSTOMER_NOT_FOUND = 'PROMO_SCHEME_CUSTOMER_NOT_FOUND',
  /** A grid row id (prb/prp/pri/prs_id) is not a live row of this scheme. */
  SCHEME_ROW_NOT_FOUND = 'PROMO_SCHEME_ROW_NOT_FOUND',
  /** Another live scheme of the company already uses this prm_code. */
  CODE_EXISTS = 'PROMO_SCHEME_CODE_EXISTS',
  /** Two approved EXCLUSIVE schemes would overlap on branch, trigger, priority and dates. */
  EXCLUSIVE_CLASH = 'PROMO_SCHEME_EXCLUSIVE_CLASH',
  /** Two rows of one grid in the same request name the same scope. */
  DUPLICATE_ROW_SCOPE = 'PROMO_SCHEME_DUPLICATE_ROW_SCOPE',
  /** The database refused the write as a duplicate (a unique index). */
  DUPLICATE_RECORD = 'PROMO_SCHEME_DUPLICATE_RECORD',
  /** A referenced master (company, branch, item, unit, …) does not exist or is inactive. */
  REFERENCE_NOT_FOUND = 'PROMO_SCHEME_REFERENCE_NOT_FOUND',
}
