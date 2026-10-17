/**
 * Notes 119 / 127 §5 — every refusal of the item unit conversion master carries
 * one of these as `errors[].code`; the client words its message box by the code
 * alone. Never reuse a code for a different meaning.
 */
export enum ItemUnitConversionErrorCode {
  /** No unit conversion row (live, where the route needs one) has the id given. */
  NOT_FOUND = 'UNIT_CONV_NOT_FOUND',
  /** Delete/restore called with neither a body nor an iuc_id query value. */
  ID_REQUIRED = 'UNIT_CONV_ID_REQUIRED',
  /** iuc_to_base_factor is zero or negative. */
  FACTOR_NOT_POSITIVE = 'UNIT_CONV_FACTOR_NOT_POSITIVE',
  /** iuc_unit_factor is zero or negative. */
  UNIT_FACTOR_NOT_POSITIVE = 'UNIT_CONV_UNIT_FACTOR_NOT_POSITIVE',
  /** A chain row has no iuc_unit_factor and none can be derived from its neighbours. */
  UNIT_FACTOR_MISSING = 'UNIT_CONV_UNIT_FACTOR_MISSING',
  /** iuc_uom_weight is negative. */
  WEIGHT_NEGATIVE = 'UNIT_CONV_WEIGHT_NEGATIVE',
  /** The base-unit row's iuc_unit_id is not the selected base unit. */
  BASE_ROW_UNIT_MISMATCH = 'UNIT_CONV_BASE_ROW_UNIT_MISMATCH',
  /** The base-unit row's iuc_to_base_factor is not 1. */
  BASE_ROW_FACTOR_NOT_ONE = 'UNIT_CONV_BASE_ROW_FACTOR_NOT_ONE',
  /** A date field is not a valid date. */
  DATE_INVALID = 'UNIT_CONV_DATE_INVALID',
  /** The item already has this unit, or a second default / base unit row. */
  DUPLICATE = 'UNIT_CONV_DUPLICATE',
  /** The item, unit or base unit named does not exist (foreign key on save). */
  REFERENCE_NOT_FOUND = 'UNIT_CONV_REFERENCE_NOT_FOUND',
  /** Delete refused: other records (prices, stock, documents) still use the row. */
  IN_USE = 'UNIT_CONV_IN_USE',
}
