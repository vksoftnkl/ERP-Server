/**
 * Notes 119 / 127 §5 — every refusal of the City master (/cities) carries one
 * of these as `errors[].code`; the client words its box by the code alone. One
 * meaning per code: a site with a new meaning gets a new member, never an old one.
 */
export enum CityErrorCode {
  /** ctmName was blank. */
  NAME_REQUIRED = 'CITY_NAME_REQUIRED',
  /** Another live city of the same state already has this name (checked first, or the unique index refused it). */
  NAME_EXISTS = 'CITY_NAME_EXISTS',
  /** No live city with this ctmId. */
  NOT_FOUND = 'CITY_NOT_FOUND',
  /** ctmStateId names no live state. */
  STATE_NOT_FOUND = 'CITY_STATE_NOT_FOUND',
  /** The parent account group the city's group is created under is missing. */
  PARENT_GROUP_NOT_FOUND = 'CITY_PARENT_GROUP_NOT_FOUND',
  /** A delete of a city that live areas still point at. */
  HAS_AREAS = 'CITY_HAS_AREAS',
}
