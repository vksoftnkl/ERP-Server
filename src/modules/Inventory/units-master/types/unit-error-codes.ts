/**
 * Notes 119 / 127 §5 — every refusal of the units master carries one of these
 * as `errors[].code`; the client words its message box by the code alone.
 * Never reuse a code for a different meaning.
 */
export enum UnitErrorCode {
  /** No unit (live, where the route needs one) has the id given. */
  NOT_FOUND = 'UNIT_NOT_FOUND',
  /** unit_base_unit_id names the unit itself. */
  SELF_BASE = 'UNIT_SELF_BASE',
  /** unit_conversion (base units per unit) is missing while unit_base_unit_id is set. Not UNIT_CONV_ (item unit conversions). */
  TO_BASE_REQUIRED = 'UNIT_TO_BASE_REQUIRED',
  /** unit_conversion is 0 or negative. */
  TO_BASE_NOT_POSITIVE = 'UNIT_TO_BASE_NOT_POSITIVE',
  /** Delete refused: pack units, item unit conversions, items or group / category defaults still use the unit. */
  IN_USE = 'UNIT_IN_USE',
  /** Delete refused: the unit is already deleted. */
  ALREADY_DELETED = 'UNIT_ALREADY_DELETED',
  /** Restore refused: the unit is not deleted. */
  NOT_DELETED = 'UNIT_NOT_DELETED',
  /** Restore refused: the unit's base unit is deleted. */
  BASE_DELETED = 'UNIT_BASE_DELETED',
  /** Another live unit already has this name, ignoring case. */
  NAME_TAKEN = 'UNIT_NAME_TAKEN',
  /** unit_code names no GST unit (item_gst_units). */
  CODE_NOT_FOUND = 'UNIT_CODE_NOT_FOUND',
  /** unit_base_unit_id names no live unit. */
  BASE_NOT_FOUND = 'UNIT_BASE_NOT_FOUND',
  /** unit_is_pack_unit is true but the unit has no unit_base_unit_id. */
  PACK_BASE_REQUIRED = 'UNIT_PACK_BASE_REQUIRED',
}
