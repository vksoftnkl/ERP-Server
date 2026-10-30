/**
 * Notes 119 / 127 §5 — every UI Table Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum UiTableMasterErrorCode {
  /** No live UI table with that id. */
  NOT_FOUND = 'UI_TABLE_NOT_FOUND',
  /** No live UI table column with that id. */
  COLUMN_NOT_FOUND = 'UI_TABLE_COLUMN_NOT_FOUND',
  /** uiTblName is blank. */
  NAME_REQUIRED = 'UI_TABLE_NAME_REQUIRED',
  /** Another live UI table already has this name (the check or the unique index). */
  NAME_DUPLICATE = 'UI_TABLE_NAME_DUPLICATE',
  /** A column's uiTblClmName is blank. */
  COLUMN_NAME_REQUIRED = 'UI_TABLE_COLUMN_NAME_REQUIRED',
  /** A table or column id is not a whole number. */
  ID_INVALID = 'UI_TABLE_ID_INVALID',
  /**
   * The save would leave two live columns of one table on the same
   * uiTblClmNo — a create without replaceColumns APPENDS (notes 137 E).
   */
  COLUMN_NO_DUPLICATE = 'UI_TABLE_COLUMN_NO_DUPLICATE',
}
