/**
 * Notes 119 / 127 §5 — every Bank List refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps
 * its meaning forever: a new refusal gets a new member.
 */
export enum BankListErrorCode {
  /** The bank list grid (bank_list_grid) is not configured in grid details. */
  GRID_NOT_CONFIGURED = 'BANK_LIST_GRID_NOT_CONFIGURED',
  /** No live bank with that id — get, update, delete. */
  NOT_FOUND = 'BANK_LIST_NOT_FOUND',
  /** Delete refused: ledger bank accounts still name the bank. */
  IN_USE = 'BANK_LIST_IN_USE',
  /** bnkName is blank. */
  NAME_REQUIRED = 'BANK_LIST_NAME_REQUIRED',
  /** Another bank already has this name (the check or the unique index). */
  NAME_DUPLICATE = 'BANK_LIST_NAME_DUPLICATE',
}
