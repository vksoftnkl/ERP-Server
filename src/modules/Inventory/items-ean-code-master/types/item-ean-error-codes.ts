/**
 * Notes 119 / 127 §5 — every refusal of the item EAN code master carries one
 * of these as `errors[].code`; the client words its message box by the code
 * alone. Never reuse a code for a different meaning.
 */
export enum ItemEanErrorCode {
  /** No item EAN code (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_EAN_NOT_FOUND',
  /** A delete was sent with no body and no ean_id. */
  ID_REQUIRED = 'ITEM_EAN_ID_REQUIRED',
  /** ean_code is missing or blank. */
  CODE_REQUIRED = 'ITEM_EAN_CODE_REQUIRED',
  /** Another live row already has this ean_code. */
  CODE_TAKEN = 'ITEM_EAN_CODE_TAKEN',
  /** ean_unit_id (or another id on the row) names a row that does not exist. */
  UNKNOWN_REFERENCE = 'ITEM_EAN_UNKNOWN_REFERENCE',
  /** Delete refused: the EAN row is already deleted (DELETE no longer toggles, notes 137 D1). */
  ALREADY_DELETED = 'ITEM_EAN_ALREADY_DELETED',
  /** ean_item_id names no live item: the item is missing or deleted. */
  ITEM_NOT_LIVE = 'ITEM_EAN_ITEM_NOT_LIVE',
  /** ean_unit_id is not one of the item's own live unit conversion rows. */
  UNIT_NOT_OF_ITEM = 'ITEM_EAN_UNIT_NOT_OF_ITEM',
}
