/**
 * Notes 119 / 127 §5 — every refusal of the item section master carries one of
 * these as `errors[].code`; the client words its message box by the code alone.
 * Never reuse a code for a different meaning.
 */
export enum ItemSectionErrorCode {
  /** No item section (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_SECTION_NOT_FOUND',
  /** sec_parent_id names the section itself. */
  SELF_PARENT = 'ITEM_SECTION_SELF_PARENT',
  /** sec_parent_id names no live item section. */
  PARENT_NOT_FOUND = 'ITEM_SECTION_PARENT_NOT_FOUND',
  /** sec_parent_id sits below the section in the tree — the move would make a loop. */
  PARENT_IN_SUBTREE = 'ITEM_SECTION_PARENT_IN_SUBTREE',
  /** Delete refused: live sub-sections still sit under the section. */
  HAS_CHILDREN = 'ITEM_SECTION_HAS_CHILDREN',
  /** Delete refused: live items still use the section. */
  IN_USE = 'ITEM_SECTION_IN_USE',
  /** Delete refused: the section is already deleted. */
  ALREADY_DELETED = 'ITEM_SECTION_ALREADY_DELETED',
  /** Restore refused: the section is not deleted. */
  NOT_DELETED = 'ITEM_SECTION_NOT_DELETED',
  /** Restore refused: the section's parent is deleted. */
  PARENT_DELETED = 'ITEM_SECTION_PARENT_DELETED',
  /** sec_photo is empty, not valid base64, or holds no image data. */
  PHOTO_INVALID = 'ITEM_SECTION_PHOTO_INVALID',
  /** Another item section already has this name. */
  NAME_TAKEN = 'ITEM_SECTION_NAME_TAKEN',
}
