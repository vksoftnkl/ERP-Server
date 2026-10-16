/**
 * Notes 119 / 127 §5 — every refusal of the Sale Loading Charges master
 * (/sale-loading-charges) carries one of these as `errors[].code`; the client
 * words its box by the code alone. One meaning per code: a site with a new
 * meaning gets a new member, never an old one.
 */
export enum SaleLoadingChargeErrorCode {
  /** No live loading charge slab with this ilcId. */
  NOT_FOUND = 'LOADING_NOT_FOUND',
  /** The unique index refused the row: the same weight range already exists. */
  RANGE_EXISTS = 'LOADING_RANGE_EXISTS',
  /** The weight range overlaps an existing slab of the company/branch (excl_ilc_slab_overlap). */
  RANGE_OVERLAPS = 'LOADING_RANGE_OVERLAPS',
  /** A foreign key refused the write: the company or branch it names is gone. */
  REFERENCE_NOT_FOUND = 'LOADING_REFERENCE_NOT_FOUND',
}
