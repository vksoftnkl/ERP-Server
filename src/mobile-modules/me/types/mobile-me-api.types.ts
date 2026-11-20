/** The five rights the phone acts on, per menu, read as the desktop guards read them (user_menus). */
export interface MobileMenuRights {
  view: boolean;
  create: boolean;
  post: boolean;
  cancel: boolean;
  print: boolean;
}

/** GET /mobile/me */
export interface MobileMe {
  userId: string;
  loginName: string;
  /** user_master.usr_employee_id when it names a live employee; the receipts' collector. */
  employeeId: string | null;
  employeeName: string | null;
  /** By menu id as text: '11' Sales Order, '12' Sales Bill, '99' Receipt. */
  rights: Record<string, MobileMenuRights>;
}
