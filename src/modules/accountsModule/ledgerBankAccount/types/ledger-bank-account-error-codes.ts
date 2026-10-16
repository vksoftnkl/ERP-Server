/**
 * Notes 119 / 127 §5 — every refusal the Ledger Bank Account routes raise.
 * The Qt client words its box by `errors[].code` alone, so each string is an
 * API contract: rename one and the box loses its wording.
 */
export const LedgerBankErrorCode = {
  /** The lbaId names no live ledger bank account (404). */
  NOT_FOUND: 'LEDGER_BANK_NOT_FOUND',
  /** A required text field (holder, bank name, account no.) is blank once trimmed. */
  FIELD_EMPTY: 'LEDGER_BANK_FIELD_EMPTY',
  /** The ledger already has a live bank account with this account number (409). */
  DUPLICATE_ACCOUNT_NO: 'LEDGER_BANK_DUPLICATE_ACCOUNT_NO',
  /** The save names a ledger or company the database has no row for (foreign key). */
  INVALID_REFERENCE: 'LEDGER_BANK_INVALID_REFERENCE',
  /** lbaLedgerId names no live account ledger. */
  LEDGER_NOT_FOUND: 'LEDGER_BANK_LEDGER_NOT_FOUND',
  /** lbaCompanyId names no live company. */
  COMPANY_NOT_FOUND: 'LEDGER_BANK_COMPANY_NOT_FOUND',
  /** lbaCompanyId differs from the company the ledger belongs to. */
  COMPANY_MISMATCH: 'LEDGER_BANK_COMPANY_MISMATCH',
} as const;

export type LedgerBankErrorCode = (typeof LedgerBankErrorCode)[keyof typeof LedgerBankErrorCode];
