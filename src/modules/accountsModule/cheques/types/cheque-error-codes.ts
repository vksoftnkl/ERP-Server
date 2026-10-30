/**
 * Notes 124 — the codes only Received Cheques (51) raises. A refusal the
 * Voucher Register's `VCH` set or the receipt / payment `ACC` set already
 * names reuses that code instead.
 *
 * `code` is what the Qt client words the box by, and the user's wording rows
 * in prisma/seed/Error_Messages.json are keyed on it, so every string below is
 * an API contract: rename one and the box loses its wording.
 */
export const CHQ = {
  /** The allocations do not add up to the cheque, or no longer fit the bills. */
  ALLOCATION_WRONG: 'CHQ_ALLOCATION_WRONG',
  /** A bounce without a reason. */
  REASON_REQUIRED: 'CHQ_REASON_REQUIRED',
  /** The cheque names no bank ledger. */
  BANK_MISSING: 'CHQ_BANK_MISSING',
  /** Deposit of a cheque that has bounced once: re-present it instead. */
  BOUNCED_ONCE: 'CHQ_BOUNCED_ONCE',
  /** Dated more than three months back. */
  STALE: 'CHQ_STALE',
  /** Dated more than a year ahead. */
  DATE_TOO_FAR: 'CHQ_DATE_TOO_FAR',
  /** Before the earliest date the action allows. */
  DATE_TOO_EARLY: 'CHQ_DATE_TOO_EARLY',
  /** In the future. */
  DATE_FUTURE: 'CHQ_DATE_FUTURE',
  /** A deposit into a ledger that is not a BANK ledger. */
  BANK_WRONG: 'CHQ_BANK_WRONG',
  /** The same action was already recorded. */
  ALREADY_DONE: 'CHQ_ALREADY_DONE',
} as const;

export type ChqErrorCode = (typeof CHQ)[keyof typeof CHQ];
