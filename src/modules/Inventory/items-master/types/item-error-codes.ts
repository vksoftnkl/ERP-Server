/**
 * Notes 119 / 127 §5 — every refusal of the item master (including the
 * composite save, delete and restore) carries one of these as `errors[].code`;
 * the client words its message box by the code alone. Never reuse a code for a
 * different meaning. No code here may start with another Inventory module's
 * prefix (ITEM_GROUP_, ITEM_PRICE_, ITEM_EAN_ …) — a missing group is
 * ITEM_UNKNOWN_GROUP, not ITEM_GROUP_NOT_FOUND.
 */
export enum ItemErrorCode {
  /** No item (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_NOT_FOUND',
  /** item_name_en is missing or blank. */
  NAME_REQUIRED = 'ITEM_NAME_REQUIRED',
  /** Another live item already has this item_name_en. */
  NAME_TAKEN = 'ITEM_NAME_TAKEN',
  /** item_photo is not valid base64. */
  PHOTO_INVALID = 'ITEM_PHOTO_INVALID',
  /** item_branch_id is set but item_company_id is not — a branch item must name the branch's company. */
  BRANCH_NEEDS_COMPANY = 'ITEM_BRANCH_NEEDS_COMPANY',
  /** item_branch_id names no branch. */
  UNKNOWN_BRANCH = 'ITEM_UNKNOWN_BRANCH',
  /** item_branch_id names a branch of another company than item_company_id. */
  BRANCH_OTHER_COMPANY = 'ITEM_BRANCH_OTHER_COMPANY',
  /** item_group_id names no item group (foreign key refused the write). */
  UNKNOWN_GROUP = 'ITEM_UNKNOWN_GROUP',
  /** item_default_tax_id names no tax rate in tax_rate_master. */
  UNKNOWN_TAX_RATE = 'ITEM_UNKNOWN_TAX_RATE',
  /** item_base_unit_id names no unit. */
  UNKNOWN_UNIT = 'ITEM_UNKNOWN_UNIT',
  /** item_category_id names no item category. */
  UNKNOWN_CATEGORY = 'ITEM_UNKNOWN_CATEGORY',
  /** item_company_id names no company. */
  UNKNOWN_COMPANY = 'ITEM_UNKNOWN_COMPANY',
  /** item_track_preset_id names no stock track preset. */
  UNKNOWN_TRACK_PRESET = 'ITEM_UNKNOWN_TRACK_PRESET',
  /** Some other id on the item names a row that does not exist (an unmapped foreign key). */
  UNKNOWN_REFERENCE = 'ITEM_UNKNOWN_REFERENCE',
  /** A price, EAN or reorder row names a unit the item has no unit-conversion row for. */
  UNIT_NOT_CONVERTED = 'ITEM_UNIT_NOT_CONVERTED',
  /** Two child rows of one composite save share a natural key (same unit, same EAN, same scope …). */
  DUPLICATE_CHILD_ROWS = 'ITEM_DUPLICATE_CHILD_ROWS',
  /** Delete refused: the item is already deleted. */
  ALREADY_DELETED = 'ITEM_ALREADY_DELETED',
  /** Restore refused: the item is not deleted. */
  NOT_DELETED = 'ITEM_NOT_DELETED',
  /** Delete refused: stock of the item is still on hand or in transit. */
  IN_USE = 'ITEM_IN_USE',
  /** Delete/restore refused: someone else deleted or restored the item between the read and the write. */
  CHANGED_CONCURRENTLY = 'ITEM_CHANGED_CONCURRENTLY',
  /** Restore refused: another live item has taken this item's name since it was deleted. */
  RESTORE_NAME_TAKEN = 'ITEM_RESTORE_NAME_TAKEN',
  /** Restore refused: one of the item's EAN codes now belongs to another live item. */
  RESTORE_EAN_TAKEN = 'ITEM_RESTORE_EAN_TAKEN',
  /** Restore refused: some other row of the item now clashes with a live row elsewhere. */
  RESTORE_CLASH = 'ITEM_RESTORE_CLASH',
}
