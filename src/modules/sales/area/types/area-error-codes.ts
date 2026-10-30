/**
 * Notes 119 / 127 §5 — every refusal of the Area master (/areas) carries one of
 * these as `errors[].code`; the client words its box by the code alone. One
 * meaning per code: a site with a new meaning gets a new member, never an old one.
 */
export enum AreaErrorCode {
  /** armName was blank. */
  NAME_REQUIRED = 'AREA_NAME_REQUIRED',
  /** Another live area of the same city already has this name (checked first, or the unique index refused it). */
  NAME_EXISTS = 'AREA_NAME_EXISTS',
  /** No live area with this armId. */
  NOT_FOUND = 'AREA_NOT_FOUND',
  /** armCityId names no live city. */
  CITY_NOT_FOUND = 'AREA_CITY_NOT_FOUND',
  /** The parent account group the area's group is created under is missing. */
  PARENT_GROUP_NOT_FOUND = 'AREA_PARENT_GROUP_NOT_FOUND',
  /** A delete of an area that live customers still point at. */
  HAS_CUSTOMERS = 'AREA_HAS_CUSTOMERS',
}
