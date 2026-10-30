/**
 * Notes 119 / 127 §5 — every refusal of the item tax history master carries one
 * of these as `errors[].code`; the client words its message box by the code
 * alone. Never reuse a code for a different meaning.
 */
export enum ItemTaxHistoryErrorCode {
  /** No item tax history row has the ith_id given. */
  NOT_FOUND = 'ITEM_TAX_HISTORY_NOT_FOUND',
  /** ith_effective_from / ith_effective_to is not a valid date. */
  DATE_INVALID = 'ITEM_TAX_HISTORY_DATE_INVALID',
  /** ith_effective_to falls before ith_effective_from. */
  DATE_RANGE_INVALID = 'ITEM_TAX_HISTORY_DATE_RANGE_INVALID',
  /** The database refused a duplicate tax history row. */
  DUPLICATE = 'ITEM_TAX_HISTORY_DUPLICATE',
  /** ith_item_id or ith_tax_id names an item or tax rate that does not exist. */
  REFERENCE_NOT_FOUND = 'ITEM_TAX_HISTORY_REFERENCE_NOT_FOUND',
  /** Delete refused: related records still reference the row. */
  IN_USE = 'ITEM_TAX_HISTORY_IN_USE',
}
