/**
 * Notes 119 / 127 §5 — every refusal of the State master (/states) carries one
 * of these as `errors[].code`; the client words its box by the code alone. One
 * meaning per code: a site with a new meaning gets a new member, never an old one.
 */
export enum StateErrorCode {
  /** stmName was blank. */
  NAME_REQUIRED = 'STATE_NAME_REQUIRED',
  /** Another live state already has this name (checked first, or the unique index refused it). */
  NAME_EXISTS = 'STATE_NAME_EXISTS',
  /** No live state with this stmId. */
  NOT_FOUND = 'STATE_NOT_FOUND',
  /** The fixed "States" parent account group the state's group is created under is missing. */
  PARENT_GROUP_NOT_FOUND = 'STATE_PARENT_GROUP_NOT_FOUND',
  /** A delete of a state that live cities still point at. */
  HAS_CITIES = 'STATE_HAS_CITIES',
}
