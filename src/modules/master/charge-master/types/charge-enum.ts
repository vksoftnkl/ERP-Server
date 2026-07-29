// Allowed-value validation for the enum-style charge columns, shared by the
// charge master and the per-document charge lines: every cd_* value on
// sale_charge_detail is a SNAPSHOT of the matching chg_* one on charge_master,
// so there is one set of members, defined here once.
//
// Where the database stands on each set:
//   - sale_charge_detail still CHECKs them — ck_cd_doc_type / ck_cd_type /
//     ck_cd_method / ck_cd_apply_on / ck_cd_cost_alloc (migration
//     20260728140000_sale_charge_detail_check_constraints). These enums mirror
//     those constraints member for member; keep the two in step.
//   - charge_master does not — the ck_chg_* constraints were dropped in
//     20260724130000_drop_charge_master_check_constraints, so for the chg_*
//     columns these enums are the only definition of what is allowed.
// Both column families are plain varchar in Postgres; nothing here is a native
// PG enum type, and the columns are deliberately left that way.

// Which module's document a charge line hangs off (cd_doc_id is polymorphic, so
// this discriminator is the only thing naming the parent's table).
export enum ChargeDocType {
  PURCHASE = 'PURCHASE',
  SALES = 'SALES',
  GRN = 'GRN',
  QUOTATION = 'QUOTATION',
  INVOICE = 'INVOICE',
}

// The well-known charges a module can carry. NONE is the escape hatch for a
// charge that is not one of the recognised roles.
export enum ChargeRole {
  FREIGHT = 'FREIGHT',
  LOADING = 'LOADING',
  UNLOADING = 'UNLOADING',
  CASH_DISC = 'CASH_DISC',
  OTHERS = 'OTHERS',
  NONE = 'NONE',
}

// How the charge amount is computed. FIXED is a lump sum, PERCENT a share of the
// basis, and the rest are per-unit rates (quantity, net quantity, or weight).
export enum ChargeMethod {
  FIXED = 'FIXED',
  QTY = 'QTY',
  NET_QTY = 'NET_QTY',
  KG = 'KG',
  QTL = 'QTL',
  TON = 'TON',
  PERCENT = 'PERCENT',
}

// The sign of the charge: added to the document total, or deducted from it.
export enum ChargeType {
  ADD = 'ADD',
  DEDUCT = 'DEDUCT',
}

// Distribution basis for a FIXED lump sum — how it is spread across the lines.
export enum ChargeApplyOn {
  FLAT = 'FLAT',
  QTY = 'QTY',
  VALUE = 'VALUE',
  WEIGHT = 'WEIGHT',
}

// How a landing-cost charge is allocated to the items it loads (purchase only).
export enum ChargeCostAlloc {
  VALUE = 'VALUE',
  QTY = 'QTY',
  WEIGHT = 'WEIGHT',
}
