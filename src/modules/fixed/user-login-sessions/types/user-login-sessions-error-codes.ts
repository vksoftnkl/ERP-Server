/**
 * Notes 119 / 127 §5 — every User Login Sessions refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum UserLoginSessionsErrorCode {
  /** The user login sessions grid is not configured in grid details. */
  GRID_NOT_CONFIGURED = 'LOGIN_SESSION_GRID_NOT_CONFIGURED',
  /** No live login session with that id — get, update, delete. */
  NOT_FOUND = 'LOGIN_SESSION_NOT_FOUND',
  /** The database refused the save on a unique index: the session exists already. */
  DUPLICATE = 'LOGIN_SESSION_DUPLICATE',
}
