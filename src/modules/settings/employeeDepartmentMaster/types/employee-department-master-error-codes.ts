/**
 * Notes 119 / 127 §5 — every Employee Department Master refusal carries one of
 * these in `errors[].code`; the client words its box by the code alone. A code
 * keeps its meaning forever: a new refusal gets a new member.
 */
export enum EmployeeDepartmentMasterErrorCode {
  /** No live employee department with that id — get, update, delete. */
  NOT_FOUND = 'DEPARTMENT_NOT_FOUND',
  /** Delete refused: active employees are still in the department. */
  IN_USE = 'DEPARTMENT_IN_USE',
  /** edptName is blank. */
  NAME_REQUIRED = 'DEPARTMENT_NAME_REQUIRED',
  /** Another department already has this name. */
  NAME_DUPLICATE = 'DEPARTMENT_NAME_DUPLICATE',
  /** Another department already has this code. */
  CODE_DUPLICATE = 'DEPARTMENT_CODE_DUPLICATE',
  /** The database refused the save on a unique index the checks above did not cover. */
  DUPLICATE = 'DEPARTMENT_DUPLICATE',
}
