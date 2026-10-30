import type { ModuleErrorDetail } from '../../utils/module-shared.utils';

/**
 * Every refusal GET /configured-grid-sql/run raises (notes 119): the client
 * words its box by `errors[0].code` alone.
 */
export enum GridRunErrorCode {
  /** grid_param is not valid JSON. */
  PARAM_NOT_JSON = 'GRID_RUN_PARAM_NOT_JSON',
  /** grid_param parsed, but to an array / scalar / null instead of an object. */
  PARAM_NOT_OBJECT = 'GRID_RUN_PARAM_NOT_OBJECT',
  /** A grid_param key is not a plain identifier ([a-z_][a-z0-9_]*). */
  PARAM_NAME_INVALID = 'GRID_RUN_PARAM_NAME_INVALID',
  /** A grid_param value is an object or array (only string, number, boolean, null bind). */
  PARAM_VALUE_UNSUPPORTED = 'GRID_RUN_PARAM_VALUE_UNSUPPORTED',
  /** A grid_param number is NaN or Infinity. */
  PARAM_VALUE_NOT_FINITE = 'GRID_RUN_PARAM_VALUE_NOT_FINITE',
  /** The grid SQL failed because a p_* token got no value — the request left a grid_param key out. */
  PARAM_MISSING = 'GRID_RUN_PARAM_MISSING',
  /** grid_id names no configured grid. */
  GRID_NOT_FOUND = 'GRID_RUN_GRID_NOT_FOUND',
  /** The grid exists but has no SQL configured. */
  SQL_MISSING = 'GRID_RUN_SQL_MISSING',
  /** The grid's stored SQL fails the read-only validation (not a single SELECT, forbidden token …). */
  SQL_INVALID = 'GRID_RUN_SQL_INVALID',
  /** The grid's stored SQL ran and Postgres refused it (undefined column/table, bad cast …). */
  SQL_FAILED = 'GRID_RUN_SQL_FAILED',
}

export interface GridRunErrorDetail extends ModuleErrorDetail {
  code: GridRunErrorCode;
}
