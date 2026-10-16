/**
 * Notes 119 / 127 §5 — every refusal of the loyalty module carries one of these
 * as `errors[].code`; the client words its box by the code alone. One meaning
 * per code: a site with a new meaning gets a new member, never an old one.
 *
 * Covers the Promotion Loyalty Points scheme master (/promotion-loyalty-points)
 * and the Loyalty Status member actions (members/). The ledger's own refusals
 * (redeem cap and the like) are SALES_* codes in sales/posting and stay there.
 */
export enum LoyaltyErrorCode {
  // ─── field shape (the service's own checks, before the invariants) ─────────
  /** A required field (code, name, date, a grid row's scope id, …) was missing or blank. */
  FIELD_REQUIRED = 'LOYALTY_FIELD_REQUIRED',
  /** An id field was not a valid uuid. */
  INVALID_UUID = 'LOYALTY_INVALID_UUID',
  /** A number was not a number, or below the least value the field takes. */
  NUMBER_BELOW_MINIMUM = 'LOYALTY_NUMBER_BELOW_MINIMUM',
  /** A number was above the most the field takes. */
  NUMBER_ABOVE_MAXIMUM = 'LOYALTY_NUMBER_ABOVE_MAXIMUM',
  /** A field that takes a whole number got a fraction. */
  NOT_WHOLE_NUMBER = 'LOYALTY_NOT_WHOLE_NUMBER',
  /** A date field was not a YYYY-MM-DD date. */
  INVALID_DATE = 'LOYALTY_INVALID_DATE',
  /** A time field was not HH:mm or HH:mm:ss. */
  INVALID_TIME = 'LOYALTY_INVALID_TIME',
  /** lsc_approved_on was not a valid date-time. */
  INVALID_DATETIME = 'LOYALTY_INVALID_DATETIME',

  // ─── scheme rules (the CHECK constraints, mirrored in loyalty-scheme-invariants.ts) ──
  /** A vocabulary field (type, status, scope, kind, …) held a value outside its list. */
  VALUE_NOT_ALLOWED = 'LOYALTY_VALUE_NOT_ALLOWED',
  /** An amount, points or limit field was below 0. */
  NEGATIVE_VALUE = 'LOYALTY_NEGATIVE_VALUE',
  /** A factor, quantity or "each" field was 0 or less where it must be above 0. */
  NOT_ABOVE_ZERO = 'LOYALTY_NOT_ABOVE_ZERO',
  /** A bounded field (priority, decimals, activation days, redeem %) was outside its range. */
  OUT_OF_RANGE = 'LOYALTY_OUT_OF_RANGE',
  /** lsc_code held a character other than letters, digits, underscore and hyphen. */
  CODE_SHAPE = 'LOYALTY_CODE_SHAPE',
  /** lsc_expiry_basis is EARN_DATE but lsc_points_valid_days is 0. */
  EXPIRY_DAYS_REQUIRED = 'LOYALTY_EXPIRY_DAYS_REQUIRED',
  /** An end date (lsc_end_date, lsg_valid_upto) falls before its start date. */
  END_BEFORE_START = 'LOYALTY_END_BEFORE_START',
  /** Only one of lsc_valid_from_time / lsc_valid_to_time was sent. */
  TIME_PAIR_INCOMPLETE = 'LOYALTY_TIME_PAIR_INCOMPLETE',
  /** lsc_valid_weekdays was not a comma list of MON…SUN. */
  WEEKDAYS_INVALID = 'LOYALTY_WEEKDAYS_INVALID',
  /** Point redemption is on but lsc_redeem_value_per_point is not above 0. */
  REDEEM_RATE_REQUIRED = 'LOYALTY_REDEEM_RATE_REQUIRED',
  /** lsc_status is APPROVED with no lsc_approved_by. */
  SCHEME_APPROVER_REQUIRED = 'LOYALTY_SCHEME_APPROVER_REQUIRED',
  /** A grid row's serial number (lsb/lsp/lsi/lss/lsg_slno) was not a whole number above 0. */
  SLNO_INVALID = 'LOYALTY_SLNO_INVALID',
  /** An exclude item row carried points or a factor other than 1. */
  EXCLUDE_ROW_EARNS = 'LOYALTY_EXCLUDE_ROW_EARNS',
  /** A slab's lss_upto was not above its lss_exceeds. */
  SLAB_BAND_INVALID = 'LOYALTY_SLAB_BAND_INVALID',

  // ─── lookups and clashes ────────────────────────────────────────────────────
  /** The loyalty scheme (lsc_id) does not exist or was deleted. */
  SCHEME_NOT_FOUND = 'LOYALTY_SCHEME_NOT_FOUND',
  /** The customer asked about in an eligibility check does not exist or was deleted. */
  CUSTOMER_NOT_FOUND = 'LOYALTY_CUSTOMER_NOT_FOUND',
  /** A grid row id (lsb/lsp/lsi/lss/lsg_id) is not a live row of this scheme. */
  SCHEME_ROW_NOT_FOUND = 'LOYALTY_SCHEME_ROW_NOT_FOUND',
  /** Another live scheme of the company already uses this lsc_code. */
  SCHEME_CODE_EXISTS = 'LOYALTY_SCHEME_CODE_EXISTS',
  /** Another approved, active priority-1 scheme already covers this company / branch / type. */
  PRIMARY_SCHEME_EXISTS = 'LOYALTY_PRIMARY_SCHEME_EXISTS',
  /** Two rows of one grid in the same request name the same scope. */
  DUPLICATE_ROW_SCOPE = 'LOYALTY_DUPLICATE_ROW_SCOPE',
  /** The database refused the write as a duplicate (a unique index). */
  DUPLICATE_RECORD = 'LOYALTY_DUPLICATE_RECORD',
  /** A referenced master (company, branch, item, unit, …) does not exist or is inactive. */
  REFERENCE_NOT_FOUND = 'LOYALTY_REFERENCE_NOT_FOUND',
  /** A table CHECK refused a row the rules above did not catch first. */
  CHECK_REJECTED = 'LOYALTY_CHECK_REJECTED',

  // ─── Loyalty Status member actions (members/) ─────────────────────────────
  /** No live loyalty member with this id in the company. */
  MEMBER_NOT_FOUND = 'LOYALTY_MEMBER_NOT_FOUND',
  /** The member was merged into another wallet, so its status cannot change. */
  MEMBER_MERGED = 'LOYALTY_MEMBER_MERGED',
  /** The member already has the requested status. */
  MEMBER_NO_CHANGE = 'LOYALTY_MEMBER_NO_CHANGE',
  /** Closing a wallet that still holds points, without force. */
  MEMBER_HAS_BALANCE = 'LOYALTY_MEMBER_HAS_BALANCE',
  /** A status other than ACTIVE was asked for without a reason. */
  MEMBER_REASON_REQUIRED = 'LOYALTY_MEMBER_REASON_REQUIRED',
  /** A forced close (points written off) came without approvedBy. */
  MEMBER_APPROVER_REQUIRED = 'LOYALTY_MEMBER_APPROVER_REQUIRED',
  /** No fiscal year of the company holds the date of the action. */
  MEMBER_YEAR_UNKNOWN = 'LOYALTY_MEMBER_YEAR_UNKNOWN',
  /** The branch is not the company's, or the company has no branch at all. */
  MEMBER_BRANCH_NOT_IN_COMPANY = 'LOYALTY_MEMBER_BRANCH_NOT_IN_COMPANY',
  /** Adjust points was sent 0 (or a non-finite number) points. */
  MEMBER_POINTS_ZERO = 'LOYALTY_MEMBER_POINTS_ZERO',
}
