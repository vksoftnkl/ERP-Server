/**
 * Notes 119 / 127 §5 — every Employee Designation Master refusal carries one of
 * these in `errors[].code`; the client words its box by the code alone. A code
 * keeps its meaning forever: a new refusal gets a new member.
 */
export enum EmployeeDesignationMasterErrorCode {
  /** No live employee designation with that id — get, update, delete. */
  NOT_FOUND = 'DESIGNATION_NOT_FOUND',
  /** Delete refused: active employees still hold the designation. */
  IN_USE = 'DESIGNATION_IN_USE',
  /** edName is blank. */
  NAME_REQUIRED = 'DESIGNATION_NAME_REQUIRED',
  /** Another designation already has this name. */
  NAME_DUPLICATE = 'DESIGNATION_NAME_DUPLICATE',
  /** Another designation already has this code. */
  CODE_DUPLICATE = 'DESIGNATION_CODE_DUPLICATE',
  /** The database refused the save on a unique index the checks above did not cover. */
  DUPLICATE = 'DESIGNATION_DUPLICATE',
}
