/**
 * Notes 119 / 127 §5 — every State Code Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum StateCodeMasterErrorCode {
  /** The state code master grid is not configured in grid details. */
  GRID_NOT_CONFIGURED = 'STATE_CODE_GRID_NOT_CONFIGURED',
  /** No live state with that code — get, update, delete. */
  NOT_FOUND = 'STATE_CODE_NOT_FOUND',
  /** stateCode is missing or not exactly 2 characters. */
  CODE_INVALID = 'STATE_CODE_CODE_INVALID',
  /** stateName is blank. */
  NAME_REQUIRED = 'STATE_CODE_NAME_REQUIRED',
  /** Another live state already has this name. */
  NAME_DUPLICATE = 'STATE_CODE_NAME_DUPLICATE',
  /** The database refused the save on a unique index: the state code exists already. */
  DUPLICATE = 'STATE_CODE_DUPLICATE',
}
