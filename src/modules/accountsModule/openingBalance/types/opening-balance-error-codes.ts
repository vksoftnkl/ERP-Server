/**
 * Notes 119 / 127 §5 — every refusal the Opening Balance routes raise (the
 * opening set, the bill-wise breakup and carry-forward). The Qt client words
 * its box by `errors[].code` alone, so each string is an API contract: rename
 * one and the box loses its wording.
 */
export const OpeningBalanceErrorCode = {
  // ─── The accounting year ───────────────────────────────────────────────────
  /** accYear / fromAccYear / toAccYear is not YYYY-YYYY with the second half one greater. */
  ACC_YEAR_INVALID: 'OPENING_ACC_YEAR_INVALID',
  /** The fiscal year's fy_status is not OPEN (closed / locked by the accountant). */
  YEAR_NOT_OPEN: 'OPENING_YEAR_NOT_OPEN',
  /** The fiscal year's fy_lock_date has passed. */
  YEAR_LOCKED: 'OPENING_YEAR_LOCKED',

  // ─── The opening set (/opening-balance) ────────────────────────────────────
  /** The opId names no live opening in that year (404). */
  NOT_FOUND: 'OPENING_NOT_FOUND',
  /** Deleting an opening that still has opening bills — delete the bills first. */
  HAS_BILLS: 'OPENING_HAS_BILLS',
  /** A row's ledger does not exist or belongs to another company. */
  LEDGER_NOT_VISIBLE: 'OPENING_LEDGER_NOT_VISIBLE',
  /** The same ledger appears twice in one set — one opening per ledger per year. */
  DUPLICATE_LEDGER: 'OPENING_DUPLICATE_LEDGER',
  /** A negative opening amount — send a positive amount and the side in opDrCr. */
  NEGATIVE_AMOUNT: 'OPENING_NEGATIVE_AMOUNT',
  /** The ledger's group has no nature — classify the group first. */
  GROUP_NO_NATURE: 'OPENING_GROUP_NO_NATURE',
  /** An Income / Expenses ledger — only Assets and Liabilities carry an opening. */
  NOT_BALANCE_SHEET: 'OPENING_NOT_BALANCE_SHEET',
  /** Stock-in-Hand keyed here under PERPETUAL cogs — its opening comes from Opening Stock. */
  STOCK_LEDGER: 'OPENING_STOCK_LEDGER',
  /** A bill-by-bill party with no bills yet typed as a figure — open it in the breakup panel. */
  BILL_WISE_NEEDS_BILLS: 'OPENING_BILL_WISE_NEEDS_BILLS',
  /** A bill-by-bill party's figure differs from its bills' total — change the bills instead. */
  BILL_WISE_TOTAL_MISMATCH: 'OPENING_BILL_WISE_TOTAL_MISMATCH',
  /** The save's branch no longer exists (foreign key). */
  BRANCH_NOT_FOUND: 'OPENING_BRANCH_NOT_FOUND',
  /** The save's company no longer exists (foreign key). */
  COMPANY_NOT_FOUND: 'OPENING_COMPANY_NOT_FOUND',
  /** The row's ledger was deleted while the save ran (foreign key). */
  LEDGER_GONE: 'OPENING_LEDGER_GONE',

  // ─── The bill-wise breakup (/opening-balance/bills) ────────────────────────
  /** The partyId is not a ledger this company may open (404). */
  PARTY_NOT_FOUND: 'OPENING_PARTY_NOT_FOUND',
  /** The party is not a bill-by-bill ledger — open it with a figure instead. */
  NOT_BILL_WISE: 'OPENING_NOT_BILL_WISE',
  /** The opId sent is not this party's opening for that year and branch. */
  OPENING_MISMATCH: 'OPENING_OPENING_MISMATCH',
  /** A bill row with a blank reference (original invoice number). */
  BILL_REF_REQUIRED: 'OPENING_BILL_REF_REQUIRED',
  /** The same bill reference twice in one breakup. */
  BILL_REF_REPEATED: 'OPENING_BILL_REF_REPEATED',
  /** The reference is already a stored opening bill of this party for this year. */
  BILL_REF_EXISTS: 'OPENING_BILL_REF_EXISTS',
  /** A bill amount of zero or less — put the side in ablDrCr. */
  BILL_AMOUNT_NOT_POSITIVE: 'OPENING_BILL_AMOUNT_NOT_POSITIVE',
  /** A bill's due date is before its bill date. */
  BILL_DUE_BEFORE_DATE: 'OPENING_BILL_DUE_BEFORE_DATE',
  /** The ablId sent is not an opening bill of this party for this year. */
  BILL_NOT_FOUND: 'OPENING_BILL_NOT_FOUND',
  /** A bill with an amount settled against it had its amount / side / reference / date changed. */
  BILL_SETTLED_EDIT: 'OPENING_BILL_SETTLED_EDIT',
  /** A replace left out a bill with an amount settled against it. */
  BILL_SETTLED_REMOVE: 'OPENING_BILL_SETTLED_REMOVE',

  // ─── Carry-forward ─────────────────────────────────────────────────────────
  /** toAccYear is not the year right after fromAccYear — one year at a time. */
  CARRY_NOT_NEXT_YEAR: 'OPENING_CARRY_NOT_NEXT_YEAR',
  /** A non-zero P&L result to carry but no ledger mapped to RETAINED_EARNINGS. */
  RETAINED_EARNINGS_UNMAPPED: 'OPENING_RETAINED_EARNINGS_UNMAPPED',
} as const;

export type OpeningBalanceErrorCode =
  (typeof OpeningBalanceErrorCode)[keyof typeof OpeningBalanceErrorCode];
