/**
 * Notes 119 / 127 §5 — every refusal the Posting Ledgers (/ledger-map) routes
 * raise. The Qt client words its box by `errors[].code` alone, so each string
 * is an API contract: rename one and the box loses its wording.
 *
 * The ledger-fits-role check is ledger-role.helper's, so a ledger of the wrong
 * type / duty head / group nature (or an unknown ledger id) arrives with its
 * LEDGER_ROLE_* code (ledgerRole/types/ledger-role-error-codes.ts).
 */
export const LedgerMapErrorCode = {
  /** The role already has a live shared mapping — re-point that one instead (409). */
  ROLE_ALREADY_MAPPED: 'LEDGER_MAP_ROLE_ALREADY_MAPPED',
  /** The almId names no live acc_ledger_map row (404). */
  NOT_FOUND: 'LEDGER_MAP_NOT_FOUND',
  /** Unmapping a role a deployed document posts through (409). */
  ROLE_IN_USE: 'LEDGER_MAP_ROLE_IN_USE',
  /** The almId belongs to a different role than the one sent — a mapping never changes role. */
  ROLE_CHANGED: 'LEDGER_MAP_ROLE_CHANGED',
  /** The role is not in the posting-role catalogue (accounts.acc_ledger_role). */
  UNKNOWN_ROLE: 'LEDGER_MAP_UNKNOWN_ROLE',
  /** The ledger picked is deleted. */
  LEDGER_DELETED: 'LEDGER_MAP_LEDGER_DELETED',
  /** The ledger picked is inactive. */
  LEDGER_INACTIVE: 'LEDGER_MAP_LEDGER_INACTIVE',
  /** The mapping is scoped to a company, branch or supply nature — /ledger-map edits the shared one only. */
  SCOPED_MAPPING: 'LEDGER_MAP_SCOPED_MAPPING',
} as const;

export type LedgerMapErrorCode = (typeof LedgerMapErrorCode)[keyof typeof LedgerMapErrorCode];
