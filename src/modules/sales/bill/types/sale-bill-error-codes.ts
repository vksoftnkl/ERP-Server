/**
 * The sale-bill refusals that have no SALES_ERROR_CODES member (notes 119):
 * the client words its box by `errors[0].code` alone. A refusal whose meaning
 * a shared sales code already names (SALES_NOT_FOUND, SALES_LINE_NOT_FOUND,
 * SALES_CUSTOMER_REQUIRED …) answers with that one instead.
 */
export enum SaleBillErrorCode {
  /** A date field on the bill is not a valid ISO date. */
  DATE_INVALID = 'SALE_BILL_DATE_INVALID',
  /** A guarded header/line value (sbDocType, sbBillType, sbiFreeType …) is not one of the allowed values. */
  VALUE_NOT_ALLOWED = 'SALE_BILL_VALUE_NOT_ALLOWED',
  /** A line with sbiSplitNo other than 1 names no batch (sbiBatchNo). */
  BATCH_REQUIRED_FOR_SPLIT = 'SALE_BILL_BATCH_REQUIRED_FOR_SPLIT',
  /** The customer the bill (or the party lookup) names does not exist. */
  CUSTOMER_NOT_FOUND = 'SALE_BILL_CUSTOMER_NOT_FOUND',
  /** sbPosStcd names no GST state code (fixed.state_codes). */
  POS_STATE_NOT_FOUND = 'SALE_BILL_POS_STATE_NOT_FOUND',
  /** An adjustment names a credit that is not an open CR balance of this customer. */
  ADJUSTMENT_CREDIT_NOT_FOUND = 'SALE_BILL_ADJUSTMENT_CREDIT_NOT_FOUND',
  /** An adjustment sets off more than the credit still has pending. */
  ADJUSTMENT_OVER_PENDING = 'SALE_BILL_ADJUSTMENT_OVER_PENDING',
  /** An adjustment's amount is zero or negative. */
  ADJUSTMENT_AMOUNT_NOT_POSITIVE = 'SALE_BILL_ADJUSTMENT_AMOUNT_NOT_POSITIVE',
  /** One credit is named twice with two different accounting years. */
  ADJUSTMENT_YEAR_CONFLICT = 'SALE_BILL_ADJUSTMENT_YEAR_CONFLICT',
  /** The credit belongs to a different party than the bill's. */
  ADJUSTMENT_CREDIT_OTHER_PARTY = 'SALE_BILL_ADJUSTMENT_CREDIT_OTHER_PARTY',
  /** The balance named is a DR (the party owes it), not a credit. */
  ADJUSTMENT_NOT_A_CREDIT = 'SALE_BILL_ADJUSTMENT_NOT_A_CREDIT',
  /** The credit's bill type is not one a sale bill may adjust (only order advances and credit notes). */
  ADJUSTMENT_TYPE_NOT_ALLOWED = 'SALE_BILL_ADJUSTMENT_TYPE_NOT_ALLOWED',
  /** The advance / credit-note adjustments do not add up to sbAdvanceAmt / sbNoteAdjAmt. */
  ADJUSTMENT_TOTAL_MISMATCH = 'SALE_BILL_ADJUSTMENT_TOTAL_MISMATCH',
  /** A bill with this id already exists (unique violation on save). */
  DUPLICATE = 'SALE_BILL_DUPLICATE',
  /** Posting a bill that has no bill number (sbBillSlno / sbBillRefno) assigned. */
  NUMBER_MISSING = 'SALE_BILL_NUMBER_MISSING',
  /** Posting a bill whose voucher was already posted and cancelled in accounts. */
  CANCELLED_IN_ACCOUNTS = 'SALE_BILL_CANCELLED_IN_ACCOUNTS',
  /** Deleting a bill that has a discount or write-off settled against it in accounts. */
  SETTLED_IN_ACCOUNTS = 'SALE_BILL_SETTLED_IN_ACCOUNTS',
  /** Changing a bill's amount to below what is already settled against it. */
  AMOUNT_BELOW_SETTLED = 'SALE_BILL_AMOUNT_BELOW_SETTLED',
}
