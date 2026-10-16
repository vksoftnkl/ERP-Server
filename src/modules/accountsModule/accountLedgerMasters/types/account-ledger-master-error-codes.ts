/**
 * Notes 119 / 127 §5 — every refusal Account Ledger Master raises (its bank
 * account rows included) carries one of these as `errors[].code`; the Qt client
 * words its box by the code alone, so each string is an API contract: rename one
 * and the box loses its wording.
 */
export enum AccountLedgerErrorCode {
  /** No live (not deleted) account ledger has the id given (404). */
  NOT_FOUND = 'LEDGER_NOT_FOUND',
  /** The name is already taken by a ledger this company sees (its own or a shared one) (409). */
  NAME_TAKEN = 'LEDGER_NAME_TAKEN',
  /** Delete refused: the ledger belongs to a customer / supplier / other master — delete it there. */
  OWNED_BY_MASTER = 'LEDGER_OWNED_BY_MASTER',
  /** The account group named is not a live account group. */
  GROUP_NOT_FOUND = 'LEDGER_GROUP_NOT_FOUND',
  /** The bank-account read was sent with neither lbaId nor ledId. */
  ID_REQUIRED = 'LEDGER_ID_REQUIRED',
  /** No live bank account row has the lbaId given (on this ledger, when saving its rows). */
  BANK_ACCOUNT_NOT_FOUND = 'LEDGER_BANK_ACCOUNT_NOT_FOUND',
  /** The ledger already has a live bank account with this account number (409). */
  BANK_ACCOUNT_DUPLICATE = 'LEDGER_BANK_ACCOUNT_DUPLICATE',
  /** More than one of the ledger's bank account rows is marked as the default. */
  BANK_ACCOUNT_DEFAULTS = 'LEDGER_BANK_ACCOUNT_DEFAULTS',
}
