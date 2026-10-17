export const dropDownDeviceTypes = {
  Desktop: 'Desktop',
  Mobile: 'Mobile',
  Tablet: 'Tablet',
  All: 'All',
};

/**
 * Notes 119 / 127 §5 — every Dropdown Details refusal (configure and run)
 * carries one of these in `errors[].code`; the client words its box by the code
 * alone. A code keeps its meaning forever: a new refusal gets a new member.
 */
export enum DropdownDetailErrorCode {
  /** dropdown_id names no configured dropdown. */
  NOT_FOUND = 'DROPDOWN_NOT_FOUND',
  /** dropdown_columns_id names no dropdown column. */
  COLUMN_NOT_FOUND = 'DROPDOWN_COLUMN_NOT_FOUND',
  /** dropdown_id is not a positive whole number. */
  ID_INVALID = 'DROPDOWN_ID_INVALID',
  /** dropdown_columns_id is not a valid UUID. */
  COLUMN_ID_INVALID = 'DROPDOWN_COLUMN_ID_INVALID',
  /** A column's dropdown_columns_name is blank. */
  COLUMN_NAME_REQUIRED = 'DROPDOWN_COLUMN_NAME_REQUIRED',
  /** A column's dropdown_columns_data_type is blank. */
  COLUMN_DATA_TYPE_REQUIRED = 'DROPDOWN_COLUMN_DATA_TYPE_REQUIRED',
  /** Run: the dropdown has no SQL configured. */
  SQL_MISSING = 'DROPDOWN_SQL_MISSING',
  /** Run: the stored SQL fails the read-only validation (not a single SELECT, forbidden token …). */
  SQL_INVALID = 'DROPDOWN_SQL_INVALID',
  /** Run: the stored SQL ran and Postgres refused it. */
  SQL_FAILED = 'DROPDOWN_SQL_FAILED',
  /** Run: dropdown_param is not valid JSON. */
  PARAM_NOT_JSON = 'DROPDOWN_PARAM_NOT_JSON',
  /** Run: dropdown_param parsed, but not to an object. */
  PARAM_NOT_OBJECT = 'DROPDOWN_PARAM_NOT_OBJECT',
  /** Run: a dropdown_param key is not a plain identifier. */
  PARAM_NAME_INVALID = 'DROPDOWN_PARAM_NAME_INVALID',
  /** Run: a dropdown_param value is an object or array (only string, number, boolean, null bind). */
  PARAM_VALUE_UNSUPPORTED = 'DROPDOWN_PARAM_VALUE_UNSUPPORTED',
  /** Run: a dropdown_param number is NaN or Infinity. */
  PARAM_VALUE_NOT_FINITE = 'DROPDOWN_PARAM_VALUE_NOT_FINITE',
}
