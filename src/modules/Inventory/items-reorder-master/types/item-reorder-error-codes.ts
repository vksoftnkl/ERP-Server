/**
 * Notes 119 / 127 §5 — every refusal of the item reorder master carries one of
 * these as `errors[].code`; the client words its message box by the code alone.
 * Never reuse a code for a different meaning.
 */
export enum ItemReorderErrorCode {
  /** No reorder row (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_REORDER_NOT_FOUND',
  /** Delete/restore called with neither a body nor an ir_id value. */
  ID_REQUIRED = 'ITEM_REORDER_ID_REQUIRED',
  /** ir_max_level is below ir_min_level. */
  LEVEL_RANGE_INVALID = 'ITEM_REORDER_LEVEL_RANGE_INVALID',
  /** The item already has a reorder row for this branch, unit and godown. */
  DUPLICATE = 'ITEM_REORDER_DUPLICATE',
  /** The item or unit named does not exist (foreign key on save). */
  REFERENCE_NOT_FOUND = 'ITEM_REORDER_REFERENCE_NOT_FOUND',
  /** Delete refused: the reorder row is already deleted (DELETE no longer toggles, notes 137 D1). */
  ALREADY_DELETED = 'ITEM_REORDER_ALREADY_DELETED',
  /** ir_item_id names no live item: the item is missing or deleted. */
  ITEM_NOT_LIVE = 'ITEM_REORDER_ITEM_NOT_LIVE',
  /** ir_unit_id is not one of the item's own live unit conversion rows. */
  UNIT_NOT_OF_ITEM = 'ITEM_REORDER_UNIT_NOT_OF_ITEM',
  /** ir_branch_id names no live branch (the column has no foreign key, notes 137 B9). */
  UNKNOWN_BRANCH = 'ITEM_REORDER_UNKNOWN_BRANCH',
  /** ir_godown_id names no live godown, or a godown of another branch than ir_branch_id. */
  GODOWN_OUT_OF_SCOPE = 'ITEM_REORDER_GODOWN_OUT_OF_SCOPE',
}
