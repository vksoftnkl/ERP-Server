/**
 * Notes 119 / 127 §5 — every refusal of the item category master carries one of
 * these as `errors[].code`; the client words its message box by the code alone.
 * Never reuse a code for a different meaning.
 */
export enum ItemCategoryErrorCode {
  /** No item category (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_CATEGORY_NOT_FOUND',
  /** category_parent_id names the category itself. */
  SELF_PARENT = 'ITEM_CATEGORY_SELF_PARENT',
  /** category_parent_id names no live item category. */
  PARENT_NOT_FOUND = 'ITEM_CATEGORY_PARENT_NOT_FOUND',
  /** category_parent_id sits below the category in the tree — the move would make a loop. */
  PARENT_IN_SUBTREE = 'ITEM_CATEGORY_PARENT_IN_SUBTREE',
  /** Delete refused: live sub-categories still sit under the category. */
  HAS_CHILDREN = 'ITEM_CATEGORY_HAS_CHILDREN',
  /** Delete refused: live items still use the category. */
  IN_USE = 'ITEM_CATEGORY_IN_USE',
  /** Delete refused: the category is already deleted. */
  ALREADY_DELETED = 'ITEM_CATEGORY_ALREADY_DELETED',
  /** Restore refused: the category is not deleted. */
  NOT_DELETED = 'ITEM_CATEGORY_NOT_DELETED',
  /** Restore refused: the category's parent is deleted. */
  PARENT_DELETED = 'ITEM_CATEGORY_PARENT_DELETED',
  /** category_photo is empty or not valid base64. */
  PHOTO_INVALID = 'ITEM_CATEGORY_PHOTO_INVALID',
  /** Another live item category already has this name, ignoring case. */
  NAME_TAKEN = 'ITEM_CATEGORY_NAME_TAKEN',
}
