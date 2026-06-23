// Mirrors the CHECK constraints on accounts.account_groups:
//   chk_acc_group_type   -> acc_group_type IN ('BALANCESHEET', 'PROFITANDLOSS')
//   chk_acc_group_nature -> acc_group_nature IN ('Assets', 'Liabilities', 'Income', 'Expenses')
export enum AccountGroupType {
  BALANCE_SHEET = 'BALANCESHEET',
  PROFIT_AND_LOSS = 'PROFITANDLOSS',
}

export enum AccountGroupNature {
  ASSETS = 'Assets',
  LIABILITIES = 'Liabilities',
  INCOME = 'Income',
  EXPENSES = 'Expenses',
}
