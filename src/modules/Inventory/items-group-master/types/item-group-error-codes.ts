/**
 * Notes 119 / 127 §5 — every refusal of the item group master carries one of
 * these as `errors[].code`; the client words its message box by the code alone.
 * Never reuse a code for a different meaning.
 */
export enum ItemGroupErrorCode {
  /** No item group (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_GROUP_NOT_FOUND',
  /** itg_parent_id names the group itself. */
  SELF_PARENT = 'ITEM_GROUP_SELF_PARENT',
  /** itg_parent_id names no live item group. */
  PARENT_NOT_FOUND = 'ITEM_GROUP_PARENT_NOT_FOUND',
  /** itg_parent_id sits below the group in the tree — the move would make a loop. */
  PARENT_IN_SUBTREE = 'ITEM_GROUP_PARENT_IN_SUBTREE',
  /** Delete refused: live sub-groups still sit under the group. */
  HAS_CHILDREN = 'ITEM_GROUP_HAS_CHILDREN',
  /** Delete refused: live items still use the group. */
  IN_USE = 'ITEM_GROUP_IN_USE',
  /** Delete refused: the group is already deleted. */
  ALREADY_DELETED = 'ITEM_GROUP_ALREADY_DELETED',
  /** Restore refused: the group is not deleted. */
  NOT_DELETED = 'ITEM_GROUP_NOT_DELETED',
  /** Restore refused: the group's parent is deleted. */
  PARENT_DELETED = 'ITEM_GROUP_PARENT_DELETED',
  /** itg_photo is empty or not valid base64. */
  PHOTO_INVALID = 'ITEM_GROUP_PHOTO_INVALID',
  /** Another live item group already has this name, ignoring case. */
  NAME_TAKEN = 'ITEM_GROUP_NAME_TAKEN',
  /** itg_track_preset_id names no live stock tracking preset. */
  TRACK_PRESET_NOT_FOUND = 'ITEM_GROUP_TRACK_PRESET_NOT_FOUND',
}
