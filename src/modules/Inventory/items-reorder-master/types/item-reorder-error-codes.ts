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
  /** The item already has a reorder row for this unit and godown. */
  DUPLICATE = 'ITEM_REORDER_DUPLICATE',
  /** The item or unit named does not exist (foreign key on save). */
  REFERENCE_NOT_FOUND = 'ITEM_REORDER_REFERENCE_NOT_FOUND',
}
