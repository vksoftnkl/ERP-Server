/**
 * Notes 119 / 127 §5 — every Employee Master refusal (and its staff advance
 * ledger's) carries one of these in `errors[].code`; the client words its box
 * by the code alone. A code keeps its meaning forever: a new refusal gets a new
 * member. LEDGER_HAS_BALANCE keeps its older EMP_ spelling — the client already
 * branches on it.
 */
export enum EmployeeMasterErrorCode {
  /** No live employee with that id — get, update, delete. */
  NOT_FOUND = 'EMPLOYEE_NOT_FOUND',
  /** empCompanyId names no active company. */
  COMPANY_NOT_FOUND = 'EMPLOYEE_COMPANY_NOT_FOUND',
  /** empDesignationId names no active employee designation. */
  DESIGNATION_NOT_FOUND = 'EMPLOYEE_DESIGNATION_NOT_FOUND',
  /** empDepartmentId names no active employee department. */
  DEPARTMENT_NOT_FOUND = 'EMPLOYEE_DEPARTMENT_NOT_FOUND',
  /** empName is blank. */
  NAME_REQUIRED = 'EMPLOYEE_NAME_REQUIRED',
  /** empSalaryType is blank. */
  SALARY_TYPE_REQUIRED = 'EMPLOYEE_SALARY_TYPE_REQUIRED',
  /** empPhoto is not a valid base64 string. */
  PHOTO_INVALID = 'EMPLOYEE_PHOTO_INVALID',
  /** The database refused the save on a unique index (e.g. a duplicate employee code). */
  DUPLICATE = 'EMPLOYEE_DUPLICATE',
  /** The database refused the save on a foreign key: a referenced row does not exist. */
  RELATION_NOT_FOUND = 'EMPLOYEE_RELATION_NOT_FOUND',
  /** Delete refused: the employee's staff advance ledger still holds a balance (409). */
  LEDGER_HAS_BALANCE = 'EMP_LEDGER_HAS_BALANCE',
  /** empLoanLedgerId is already the staff advance ledger of another employee. */
  LEDGER_TAKEN = 'EMPLOYEE_LEDGER_TAKEN',
  /** The staff advance ledger name the employee would get already exists. */
  LEDGER_NAME_DUPLICATE = 'EMPLOYEE_LEDGER_NAME_DUPLICATE',
  /** empLoanLedgerId names no active ledger. */
  LEDGER_NOT_FOUND = 'EMPLOYEE_LEDGER_NOT_FOUND',
  /** empLoanLedgerId is not under the staff advance group (or a sub-group of it). */
  LEDGER_WRONG_GROUP = 'EMPLOYEE_LEDGER_WRONG_GROUP',
  /** empLoanLedgerId belongs to another company. */
  LEDGER_OTHER_COMPANY = 'EMPLOYEE_LEDGER_OTHER_COMPANY',
  /** The shared staff advance account group is missing (it is seeded with the chart of accounts). */
  LEDGER_GROUP_MISSING = 'EMPLOYEE_LEDGER_GROUP_MISSING',
}
