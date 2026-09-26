/**
 * The shape `StatutoryService.limit()` returns, and the vocabulary it reads.
 *
 * Nothing in this codebase may hard-code a rupee figure, a percentage, a day
 * count or an hour count that comes from an Act. Every one of them is a row in
 * `public.statutory_limits`, and every read of that table carries a DATE — a
 * bill dated before a threshold changed must still resolve the threshold that
 * was in force when it was raised.
 */

/** `public.statutory_limits.stl_value_type` */
export type StatutoryValueType = 'AMOUNT' | 'PERCENT' | 'DAYS' | 'HOURS' | 'KM' | 'BOOL' | 'TEXT';

/** `stl_enforce` — what a guard does when the figure is exceeded. */
export type StatutoryEnforce = 'WARN' | 'REFUSE' | 'INFO';

/**
 * `stl_applies_to`: 'ALL', a supply direction, a B2B/B2C split, or a
 * two-character state code. A specific value outranks 'ALL' in the resolver.
 */
export type StatutoryAppliesTo =
  | 'ALL'
  | 'INTRA_STATE'
  | 'INTER_STATE'
  | 'B2B'
  | 'B2C'
  // A two-character state code, which cannot be enumerated here. `string & {}`
  // rather than a bare `string`: it admits any code while KEEPING the literals
  // above visible to autocomplete, where a plain union with `string` would
  // collapse to `string` and offer nothing.
  | (string & {});

/** `companys.comp_aato_class` — the turnover ladder, one class per company. */
export type AatoClass = 'LE_1_5CR' | 'LE_5CR' | 'LE_10CR' | 'GT_10CR';

/**
 * One resolved statutory figure.
 *
 * `isCompanyOverride` is surfaced deliberately: the client shows it so an
 * operator can see a figure is this company's own and not the statute's
 * default. plan-backend-sales.md §2 rule 9 requires every statutory refusal to
 * carry `{code, value, effectiveFrom, isCompanyOverride}`.
 */
export interface StatutoryLimit {
  id: string;
  code: string;
  section: string | null;
  label: string;
  valueType: StatutoryValueType;
  /** Populated for every type except TEXT, which uses `valueText`. */
  value: number | null;
  valueText: string | null;
  enforce: StatutoryEnforce;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceRef: string | null;
  isCompanyOverride: boolean;
}

/** The codes the shipped pack defines. Not exhaustive — a company may add rows. */
export const STATUTORY_CODES = {
  CASH_TXN_LIMIT_269ST: 'CASH_TXN_LIMIT_269ST',
  PAN_REQUIRED_CASH_SALE: 'PAN_REQUIRED_CASH_SALE',
  TCS_206C1H_THRESHOLD: 'TCS_206C1H_THRESHOLD',
  TCS_206C1H_RATE: 'TCS_206C1H_RATE',
  EWAY_VALUE_LIMIT: 'EWAY_VALUE_LIMIT',
  EWAY_VALIDITY_KM_PER_DAY: 'EWAY_VALIDITY_KM_PER_DAY',
  EWAY_ODC_KM_PER_DAY: 'EWAY_ODC_KM_PER_DAY',
  EWAY_CANCEL_HOURS: 'EWAY_CANCEL_HOURS',
  EINV_CANCEL_HOURS: 'EINV_CANCEL_HOURS',
  EINV_AATO_THRESHOLD: 'EINV_AATO_THRESHOLD',
  EINV_REPORT_DAYS: 'EINV_REPORT_DAYS',
  HSN_DIGITS: 'HSN_DIGITS',
  CREDIT_NOTE_CUTOFF: 'CREDIT_NOTE_CUTOFF',
  DC_RETURN_WINDOW_DAYS: 'DC_RETURN_WINDOW_DAYS',
} as const;

export type StatutoryCode = (typeof STATUTORY_CODES)[keyof typeof STATUTORY_CODES];

/** Which cancellation window is being tested — they are different statutes. */
export type CancelWindowKind = 'IRN' | 'EWAYBILL';

/** The error detail shape the sales exception filter renders. */
export interface SalesStatutoryErrorDetail {
  field: string;
  message: string;
  code?: string;
  value?: number | string | null;
  effectiveFrom?: string;
  isCompanyOverride?: boolean;
}

export interface SalesStatutoryErrorResponse {
  statusCode: number;
  message: string;
  errors: SalesStatutoryErrorDetail[];
}
