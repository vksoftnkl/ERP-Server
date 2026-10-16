// usr_type, shown as "User Role" (notes 96). A label only: what a user may open is user_menus,
// what they may approve at a till is till_approval_authority. No DB constraint, enum-only.
// Notes 125: the role names follow the till approval levels (TILL_APPROVER_ROLES) in the
// space spelling — STORE MANAGER ↔ STORE_MANAGER — so a 285 grant can start at the user's role;
// MANAGER was renamed STORE MANAGER (migration 20261016110000). SUPER ADMIN is VK Softwares'
// own account, never a client's: only a SUPER ADMIN gives it or touches a user holding it.
export enum UserType {
  SUPER_ADMIN = 'SUPER ADMIN',
  ADMIN = 'ADMIN',
  HO_FINANCE = 'HO FINANCE',
  AREA_MANAGER = 'AREA MANAGER',
  STORE_MANAGER = 'STORE MANAGER',
  CASH_OFFICE = 'CASH OFFICE',
  SUPERVISOR = 'SUPERVISOR',
  USER = 'USER',
  CASHIER = 'CASHIER',
  VIEWER = 'VIEWER',
  SYSTEM = 'SYSTEM',
}

/**
 * Notes 119 / 127 §5 — every User Administration refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum UserAdminErrorCode {
  /** Notes 125 §3 (403): only a SUPER ADMIN gives, changes, deactivates, deletes or resets one. */
  ROLE_RESERVED = 'USER_ROLE_RESERVED',
  /** No live user with that id — get, update, delete. */
  NOT_FOUND = 'USER_NOT_FOUND',
  /** Creating a user without usrPassword. */
  PASSWORD_REQUIRED = 'USER_PASSWORD_REQUIRED',
  /** menus[] names a menu id that does not exist or is inactive. */
  MENU_INVALID = 'USER_MENU_INVALID',
  /** usrLoginName is another user's already (400 from the check, 409 from the unique index). */
  LOGIN_NAME_TAKEN = 'USER_LOGIN_NAME_TAKEN',
  /** usrEmployeeId names no live employee. */
  EMPLOYEE_NOT_FOUND = 'USER_EMPLOYEE_NOT_FOUND',
  /** usrEmployeeId is an employee of another company than the user's. */
  EMPLOYEE_OTHER_COMPANY = 'USER_EMPLOYEE_OTHER_COMPANY',
  /** usrEmployeeId is not active (a new link, or a user made active again). */
  EMPLOYEE_INACTIVE = 'USER_EMPLOYEE_INACTIVE',
  /** usrEmployeeId is already linked to another active user. */
  EMPLOYEE_LINKED = 'USER_EMPLOYEE_LINKED',
}
