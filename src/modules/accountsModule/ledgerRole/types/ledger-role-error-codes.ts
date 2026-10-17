/**
 * Notes 119 / 127 §5 — every refusal the posting-role helpers raise
 * (ledger-role.helper.ts: is this ledger fit for that role; ledger-map.helper.ts:
 * which ledger answers that role). The Qt client words its box by
 * `errors[].code` alone, so each string is an API contract: rename one and the
 * box loses its wording.
 */
export const LedgerRoleErrorCode = {
  /** A role name accounts.acc_ledger_role has no row for (404) — a caller bug, not operator input. */
  UNKNOWN_ROLE: 'LEDGER_ROLE_UNKNOWN_ROLE',
  /** The ledger id paired with a role names no ledger. */
  LEDGER_NOT_FOUND: 'LEDGER_ROLE_LEDGER_NOT_FOUND',
  /** The role wants a ledger of another led_ledger_type (e.g. INCOME, CASH, BANK). */
  WRONG_LEDGER_TYPE: 'LEDGER_ROLE_WRONG_LEDGER_TYPE',
  /** The role wants a ledger with another GST duty head (CGST / SGST / IGST / CESS …). */
  WRONG_DUTY_HEAD: 'LEDGER_ROLE_WRONG_DUTY_HEAD',
  /** The role wants a ledger under a group of another nature (Income, Expense, Asset …). */
  WRONG_GROUP_NATURE: 'LEDGER_ROLE_WRONG_GROUP_NATURE',
  /** A shared (company-less) mapping names a company's own ledger — it must be a global one. */
  LEDGER_NOT_GLOBAL: 'LEDGER_ROLE_LEDGER_NOT_GLOBAL',
  /**
   * Nothing (neither the tax rate nor accounts.acc_ledger_map) maps a role to a
   * ledger. Only when the caller names no code of its own for this case.
   */
  NOT_MAPPED: 'LEDGER_ROLE_NOT_MAPPED',
} as const;

export type LedgerRoleErrorCode = (typeof LedgerRoleErrorCode)[keyof typeof LedgerRoleErrorCode];
