/**
 * Notes 119 / 127 §5 — every refusal of the item price master (and its bucket
 * re-derivation) carries one of these as `errors[].code`; the client words its
 * message box by the code alone. Never reuse a code for a different meaning.
 */
export enum ItemPriceErrorCode {
  /** No item price row (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_PRICE_NOT_FOUND',
  /** Delete/restore called with neither a body nor an ipm_id query value. */
  ID_REQUIRED = 'ITEM_PRICE_ID_REQUIRED',
  /** ipm_profit_type is missing or blank. */
  PROFIT_TYPE_REQUIRED = 'ITEM_PRICE_PROFIT_TYPE_REQUIRED',
  /** ipm_uc_unit_id names no live unit conversion of this item. */
  UNIT_NOT_FOUND = 'ITEM_PRICE_UNIT_NOT_FOUND',
  /** A date field is not a valid date. */
  DATE_INVALID = 'ITEM_PRICE_DATE_INVALID',
  /** The unit already has a price at this company, branch and MRP. */
  DUPLICATE = 'ITEM_PRICE_DUPLICATE',
  /** A selling price is above the row's own MRP (ck_ipm_not_above_mrp). */
  ABOVE_MRP = 'ITEM_PRICE_ABOVE_MRP',
  /** The row's MRP bucket differs from its MRP (ck_ipm_bucket_mrp_is_max). */
  MRP_BUCKET_MISMATCH = 'ITEM_PRICE_MRP_BUCKET_MISMATCH',
  /** The row's MRP bucket is zero or negative (ck_ipm_bucket_mrp). */
  MRP_BUCKET_NOT_POSITIVE = 'ITEM_PRICE_MRP_BUCKET_NOT_POSITIVE',
  /** The row's sale-price bucket is zero or negative (ck_ipm_bucket_sp). */
  SP_BUCKET_NOT_POSITIVE = 'ITEM_PRICE_SP_BUCKET_NOT_POSITIVE',
  /** The price ends before it starts (ck_ipm_dates). */
  DATES_REVERSED = 'ITEM_PRICE_DATES_REVERSED',
  /** A price, charge or points figure is negative (chk_ipm_nonnegative). */
  NEGATIVE_FIGURE = 'ITEM_PRICE_NEGATIVE_FIGURE',
  /** The company, branch, item, unit or godown named does not exist (foreign key on save). */
  REFERENCE_NOT_FOUND = 'ITEM_PRICE_REFERENCE_NOT_FOUND',
  /** Delete refused: other records still use the price row. */
  IN_USE = 'ITEM_PRICE_IN_USE',
  /** A tracking change would merge two of the item's price rows into one bucket. */
  BUCKET_COLLISION = 'ITEM_PRICE_BUCKET_COLLISION',
  /** A tracking change would put a price under an MRP it sells above. */
  REBUCKET_ABOVE_MRP = 'ITEM_PRICE_REBUCKET_ABOVE_MRP',
  /** Delete refused: the price row is already deleted (DELETE no longer toggles, notes 137 D1). */
  ALREADY_DELETED = 'ITEM_PRICE_ALREADY_DELETED',
  /** ipm_item_id names no live item: the item is missing or deleted. */
  ITEM_NOT_LIVE = 'ITEM_PRICE_ITEM_NOT_LIVE',
  /** ipm_company_id is not the company the item belongs to (notes 137 C4). */
  OTHER_COMPANY = 'ITEM_PRICE_OTHER_COMPANY',
  /** ipm_branch_id names no branch, or a branch of another company than the row's / the item's. */
  BRANCH_OTHER_COMPANY = 'ITEM_PRICE_BRANCH_OTHER_COMPANY',
  /** ipm_godown_id names no godown, or a godown outside the row's branch / company. */
  GODOWN_OUT_OF_SCOPE = 'ITEM_PRICE_GODOWN_OUT_OF_SCOPE',
  /**
   * An update by ipm_id whose new MRP (an MRP bucket) or default-level price (a
   * sale-price bucket) would move the row onto other stock (notes 140 D).
   */
  BUCKET_CHANGED = 'ITEM_PRICE_BUCKET_CHANGED',
}
