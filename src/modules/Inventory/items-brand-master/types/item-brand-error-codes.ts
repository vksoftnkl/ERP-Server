/**
 * Notes 119 / 127 §5 — every refusal of the item brand master carries one of
 * these as `errors[].code`; the client words its message box by the code alone.
 * Never reuse a code for a different meaning.
 */
export enum ItemBrandErrorCode {
  /** No item brand (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_BRAND_NOT_FOUND',
  /** brand_parent_id names the brand itself. */
  SELF_PARENT = 'ITEM_BRAND_SELF_PARENT',
  /** brand_parent_id names no live item brand. */
  PARENT_NOT_FOUND = 'ITEM_BRAND_PARENT_NOT_FOUND',
  /** brand_parent_id sits below the brand in the tree — the move would make a loop. */
  PARENT_IN_SUBTREE = 'ITEM_BRAND_PARENT_IN_SUBTREE',
  /** Delete refused: live sub-brands still sit under the brand. */
  HAS_CHILDREN = 'ITEM_BRAND_HAS_CHILDREN',
  /** Delete refused: live items still use the brand. */
  IN_USE = 'ITEM_BRAND_IN_USE',
  /** Delete refused: the brand is already deleted. */
  ALREADY_DELETED = 'ITEM_BRAND_ALREADY_DELETED',
  /** Restore refused: the brand is not deleted. */
  NOT_DELETED = 'ITEM_BRAND_NOT_DELETED',
  /** Restore refused: the brand's parent is deleted. */
  PARENT_DELETED = 'ITEM_BRAND_PARENT_DELETED',
  /** brand_photo is empty or not valid base64. */
  PHOTO_INVALID = 'ITEM_BRAND_PHOTO_INVALID',
  /** Another item brand already has this name. */
  NAME_TAKEN = 'ITEM_BRAND_NAME_TAKEN',
}
