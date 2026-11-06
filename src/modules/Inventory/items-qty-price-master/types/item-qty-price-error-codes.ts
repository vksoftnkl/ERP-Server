/**
 * Notes 119 / 127 §5 — every refusal of the item qty price (slab) master carries
 * one of these as `errors[].code`; the client words its message box by the code
 * alone. Never reuse a code for a different meaning.
 */
export enum ItemQtyPriceErrorCode {
  /** No qty price slab (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_QTY_PRICE_NOT_FOUND',
  /** Delete/restore called with neither a body nor an iqp_id value. */
  ID_REQUIRED = 'ITEM_QTY_PRICE_ID_REQUIRED',
  /** The save body is not an array of slabs. */
  PAYLOAD_NOT_ARRAY = 'ITEM_QTY_PRICE_PAYLOAD_NOT_ARRAY',
  /** Delete refused: the slab is already deleted. */
  ALREADY_DELETED = 'ITEM_QTY_PRICE_ALREADY_DELETED',
  /** Restore refused: the slab is not deleted. */
  NOT_DELETED = 'ITEM_QTY_PRICE_NOT_DELETED',
  /** iqp_effective_to is before iqp_effective_from. */
  DATE_RANGE_INVALID = 'ITEM_QTY_PRICE_DATE_RANGE_INVALID',
  /** iqp_to_qty is not above iqp_from_qty. */
  QTY_RANGE_INVALID = 'ITEM_QTY_PRICE_QTY_RANGE_INVALID',
  /** A date field is not a valid date. */
  DATE_INVALID = 'ITEM_QTY_PRICE_DATE_INVALID',
  /** The same slab already exists. */
  DUPLICATE = 'ITEM_QTY_PRICE_DUPLICATE',
  /** The item, unit, company, branch or party named does not exist (foreign key on save). */
  REFERENCE_NOT_FOUND = 'ITEM_QTY_PRICE_REFERENCE_NOT_FOUND',
  /** iqp_item_unit_id is not a live unit row (item_unit_conversion) of iqp_item_id. */
  UNIT_NOT_OF_ITEM = 'ITEM_QTY_PRICE_UNIT_NOT_OF_ITEM',
  /** The price mode's own figure is missing: P needs iqp_disc_pct, R iqp_flat_off, F iqp_price. */
  VALUE_REQUIRED = 'ITEM_QTY_PRICE_VALUE_REQUIRED',
  /** The slab's qty range overlaps a live slab of the same item, unit and scope on a shared date. */
  OVERLAP = 'ITEM_QTY_PRICE_OVERLAP',

  // ── Qty-wise Prices + card rate, one form (plan 2026-11-05 §4.5; wording rows
  //    catalogue 2026-11-06.1). The four RIGHT_* codes are built by
  //    assertMenuRight from the ITEM_QTY_PRICE prefix (menu 244).
  /** No VIEW on menu 244. */
  RIGHT_VIEW = 'ITEM_QTY_PRICE_RIGHT_VIEW',
  /** A new slab without CREATE on menu 244. */
  RIGHT_CREATE = 'ITEM_QTY_PRICE_RIGHT_CREATE',
  /** A saved slab changed without EDIT on menu 244. */
  RIGHT_EDIT = 'ITEM_QTY_PRICE_RIGHT_EDIT',
  /** A slab deleted / restored without DELETE on menu 244. */
  RIGHT_DELETE = 'ITEM_QTY_PRICE_RIGHT_DELETE',
  /** save-with-rates with no card row, no slab and no delete. */
  NOTHING_TO_SAVE = 'ITEM_QTY_PRICE_NOTHING_TO_SAVE',
  /** A slab (sent or named for delete) of another item than the form's. */
  ITEM_MISMATCH = 'ITEM_QTY_PRICE_ITEM_MISMATCH',
  /** A slab's price level is not blank / an active selling level 1–4 (C6, Q12). */
  LEVEL_NOT_SELLING = 'ITEM_QTY_PRICE_LEVEL_NOT_SELLING',
  /** A typed cost on an item that is not Plain stock. */
  COST_NOT_PLAIN_STOCK = 'ITEM_QTY_PRICE_COST_NOT_PLAIN_STOCK',
  /** A typed MRP on an item that is not Plain stock. */
  MRP_NOT_PLAIN_STOCK = 'ITEM_QTY_PRICE_MRP_NOT_PLAIN_STOCK',
  /** A card price or a slab price above the unit's MRP. */
  ABOVE_MRP = 'ITEM_QTY_PRICE_ABOVE_MRP',
  /** A slab price below the unit's minimum. */
  BELOW_MIN = 'ITEM_QTY_PRICE_BELOW_MIN',
  /** A slab that takes the price to zero or less. */
  ZERO_OR_LESS = 'ITEM_QTY_PRICE_ZERO_OR_LESS',
  /** A slab price below the unit's cost (inventory.below_cost_price decides). */
  BELOW_COST = 'ITEM_QTY_PRICE_BELOW_COST',
  /** A By User unit whose cost changed while its prices did not (confirmable). */
  BY_USER_PRICES_KEPT = 'ITEM_QTY_PRICE_BY_USER_PRICES_KEPT',
  /** A slab for all branches (branch blank) from a user type that is not HQ (Q9). */
  CHAIN_HQ_ONLY = 'ITEM_QTY_PRICE_CHAIN_HQ_ONLY',

  // ── review fixes 2026-11-06 (wording row catalogue 2026-11-06.2)
  /**
   * D16 — a user type that is not HQ created, changed, deleted or restored a
   * slab of another branch than its own (the session's logged-in branch), or
   * has no logged-in branch at all.
   */
  OTHER_BRANCH = 'ITEM_QTY_PRICE_OTHER_BRANCH',
}
