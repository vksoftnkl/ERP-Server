// Allowed-value validation for accounts.acc_ledger_master GST party registration
// type and opening-balance Dr/Cr lives here in the app layer. The equivalent native
// Postgres enum types (accounts."LedGstPartyRegType", accounts."LedObType") were
// dropped in migration 20260623110000_move_acc_ledger_enums_to_app_layer.
export enum LedGstPartyRegType {
  REGULAR = 'REGULAR',
  COMPOSITION = 'COMPOSITION',
  UNREGISTERED = 'UNREGISTERED',
}

export enum LedObType {
  DR = 'DR',
  CR = 'CR',
}

// Allowed-value validation for the nested ledger bank account `lbaAccountType`.
// The acc_ledger_bank_accounts.lba_account_type column is a plain VarChar(20)
// (no native Postgres enum), so this is enforced in the app layer only.
export enum BankAccountType {
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
  CASH_CREDIT = 'CASH_CREDIT',
  OVERDRAFT = 'OVERDRAFT',
}
