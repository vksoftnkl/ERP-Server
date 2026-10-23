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
}
