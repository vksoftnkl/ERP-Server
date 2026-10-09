// usr_type, shown as "User Role" (notes 96). A label only: what a user may open is user_menus,
// what they may approve at a till is till_approval_authority. No DB constraint, enum-only.
export enum UserType {
  SUPER_ADMIN = 'SUPER ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  USER = 'USER',
  CASHIER = 'CASHIER',
  VIEWER = 'VIEWER',
  SYSTEM = 'SYSTEM',
}
