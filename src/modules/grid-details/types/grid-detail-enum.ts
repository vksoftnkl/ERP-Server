export enum gridDeviceTypeEnum {
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  WEB = 'web',
}

/**
 * Notes 119 / 127 §5 — every Grid Details (configure) refusal carries one of
 * these in `errors[].code`; the client words its box by the code alone. Running
 * a grid answers the configured-grid-sql runner's own GRID_RUN_* codes. A code
 * keeps its meaning forever: a new refusal gets a new member.
 */
export enum GridDetailErrorCode {
  /** grid_id names no live configured grid. */
  NOT_FOUND = 'GRID_NOT_FOUND',
  /** grid_column_id names no live grid column. */
  COLUMN_NOT_FOUND = 'GRID_COLUMN_NOT_FOUND',
  /** grid_id is not a whole number. */
  ID_INVALID = 'GRID_ID_INVALID',
  /** grid_column_id is not a valid UUID. */
  COLUMN_ID_INVALID = 'GRID_COLUMN_ID_INVALID',
  /** A column's grid_column_name is blank. */
  COLUMN_NAME_REQUIRED = 'GRID_COLUMN_NAME_REQUIRED',
  /** grid_sql is not a SELECT with a top-level FROM table. */
  SQL_NO_FROM_TABLE = 'GRID_SQL_NO_FROM_TABLE',
  /** grid_sql fails the read-only validation (not a single SELECT, forbidden token …). */
  SQL_INVALID = 'GRID_SQL_INVALID',
}
