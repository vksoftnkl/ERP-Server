// Allowed-value validation for accounts.acc_ship_addrs lives in the app layer.
// The equivalent DB CHECK constraint (acc_ship_addrs_addr_type_chk) cannot be
// expressed in the Prisma schema, so the allowed shipping-address types are
// enforced here (and via @IsEnum in the save DTO) instead of in the database.
// See migration 20260624130000_restructure_acc_ship_addrs_and_move_checks_to_app_layer.
export enum SaaAddrType {
  SHIP_TO = 'SHIP_TO',
  BILL_TO = 'BILL_TO',
  BOTH = 'BOTH',
}
