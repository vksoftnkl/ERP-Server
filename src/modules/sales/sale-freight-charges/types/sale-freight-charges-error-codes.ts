/**
 * Notes 119 / 127 §5 — every refusal of the Sale Freight Charges master
 * (/sale-freight-charges) carries one of these as `errors[].code`; the client
 * words its box by the code alone. One meaning per code: a site with a new
 * meaning gets a new member, never an old one.
 */
export enum SaleFreightChargeErrorCode {
  /** No live freight charge row with this frId. */
  NOT_FOUND = 'FREIGHT_NOT_FOUND',
  /** The unique index refused the row: the same km range already exists. */
  RANGE_EXISTS = 'FREIGHT_RANGE_EXISTS',
  /** A foreign key refused the write: the company or branch it names is gone. */
  REFERENCE_NOT_FOUND = 'FREIGHT_REFERENCE_NOT_FOUND',
}
