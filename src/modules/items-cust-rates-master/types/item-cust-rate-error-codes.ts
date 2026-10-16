/**
 * Notes 119 / 127 §5 — every refusal of the item customer rate master
 * (/item-cust-rates) carries one of these as `errors[].code`; the client words
 * its box by the code alone. Never reuse a code for a different meaning.
 */
export enum ItemCustRateErrorCode {
  /** No live item customer rate has the id given — 404. */
  NOT_FOUND = 'ITEM_CUST_RATE_NOT_FOUND',
  /** csr_valid_to is before csr_valid_from. */
  VALID_TO_BEFORE_FROM = 'ITEM_CUST_RATE_VALID_TO_BEFORE_FROM',
  /** A date field is not a valid date (the house ValidationPipe's code). */
  DATE_INVALID = 'VALIDATION_IS_DATE',
  /** The same item customer rate already exists (unique violation on save) — 409. */
  DUPLICATE = 'ITEM_CUST_RATE_DUPLICATE',
  /** The customer, unit rate or branch the row names does not exist (foreign key). */
  REFERENCE_INVALID = 'ITEM_CUST_RATE_REFERENCE_INVALID',
}
