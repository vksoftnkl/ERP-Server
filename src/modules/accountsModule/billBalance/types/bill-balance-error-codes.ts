/**
 * Notes 119 / 127 §5 — every refusal the bill-balance (party credit summary)
 * routes raise. The Qt client words its box by `errors[].code` alone, so each
 * string is an API contract: rename one and the box loses its wording.
 */
export const BillBalanceErrorCode = {
  /** The partyId names no live customer (unknown, soft-deleted, or another company's) — 404. */
  PARTY_NOT_FOUND: 'BILL_BALANCE_PARTY_NOT_FOUND',
} as const;

export type BillBalanceErrorCode = (typeof BillBalanceErrorCode)[keyof typeof BillBalanceErrorCode];
