import { Prisma } from '@prisma/client';
import {
  resolveRoleLedger,
  type ResolvedRoleLedger,
} from '../ledgerRole/ledger-map.helper';
import { OpeningLedgerRole } from './types/opening-balance-enum';

/**
 * The two system ledgers this module needs, found by ROLE.
 *
 * Neither can be found by name (§12): 'Difference in Opening Balances' is
 * spelt differently in every chart, and a company may well not have a ledger
 * called that at all. Both are resolved through accounts.acc_ledger_map, which
 * is exactly how the sale bill finds ROUND_OFF — one mechanism, already built,
 * already validated by accounts.fn_check_role_ledger.
 *
 * Seeded by migration 20260915090000; the per-company acc_ledger_map rows are
 * configuration, not migration, so an unmapped role is an ordinary state and
 * the callers here treat it as one rather than as an error.
 */

type LedgerMapClient = Parameters<typeof resolveRoleLedger>[0];

/**
 * The plug ledger (§7.1). Null when the company has not mapped the role —
 * the trial balance then reports `differenceLedgerId: null` and the screen
 * cannot offer the plug, which is the honest answer rather than a guess.
 */
export function resolveOpeningDifferenceLedger(
  client: LedgerMapClient,
  companyId: string,
  branchId: string | null,
): Promise<ResolvedRoleLedger | null> {
  return resolveRoleLedger(
    client,
    { role: OpeningLedgerRole.OPENING_DIFFERENCE, field: 'differenceLedgerId' },
    { companyId, branchId, where: 'opening_balance' },
  );
}

/**
 * Where the previous year's P&L result lands on carry-forward (DECISION 2,
 * Tally model). Null when unmapped; carry-forward refuses only when there is
 * actually a non-zero result to place — a company whose P&L nets to zero needs
 * no mapping and should not be blocked by one.
 */
export function resolveRetainedEarningsLedger(
  client: LedgerMapClient,
  companyId: string,
  branchId: string | null,
): Promise<ResolvedRoleLedger | null> {
  return resolveRoleLedger(
    client,
    { role: OpeningLedgerRole.RETAINED_EARNINGS, field: 'retainedEarningsLedgerId' },
    { companyId, branchId, where: 'opening_balance_carry_forward' },
  );
}

export type { ResolvedRoleLedger };
export type OpeningLedgerMapClient = LedgerMapClient;
export type { Prisma };
