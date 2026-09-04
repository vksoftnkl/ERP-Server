// Allowed-value validation for accounts.acc_group_master lives here in the app
// layer. The equivalent DB CHECK constraints (chk_acc_group_type,
// chk_acc_group_nature, chk_acc_ledger_profile) were dropped in migration
// 20260623100000_remove_acc_group_check_constraints_to_app_layer.
export enum AccGroupMasterType {
  BALANCE_SHEET = 'BALANCESHEET',
  PROFIT_AND_LOSS = 'PROFITANDLOSS',
}

export enum AccGroupMasterNature {
  ASSETS = 'Assets',
  LIABILITIES = 'Liabilities',
  INCOME = 'Income',
  EXPENSES = 'Expenses',
}

export enum AccLedgerProfile {
  GENERAL = 'General',
  TAX = 'Tax',
  BANK = 'Bank',
  PARTY = 'Party',
  SALES_PURCHASE = 'SalesPurchase',
  CASH = 'Cash',
}
