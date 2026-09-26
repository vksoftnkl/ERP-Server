import {
  requireRoleLedgers,
  resolveRoleLedgers,
  roleLedgerKey,
  type ResolvedRoleLedger,
} from '../ledgerRole/ledger-map.helper';
import { ChequeLedgerRole } from './types/cheque-enum';

/**
 * The two ledgers this module posts to that are not a party, a bank the
 * operator picked, or the cheque's own tender ledger — found by ROLE, through
 * `accounts.acc_ledger_map`.
 *
 * Never by name (§10). "Bank Charges" is spelt six ways across six charts, a
 * company may have three of them, and a report that sums a ledger by name
 * answers a different question the day somebody renames it.
 *
 * ── WHY THE ROLES ARE RESOLVED LATE, AND CONDITIONALLY ───────────────────
 * §4.4 step 2 asks for `BANK_CHARGES` only when `bankCharge > 0` and
 * `BOUNCE_CHARGES_RECOVERED` only when `partyCharge > 0`, and that is not an
 * optimisation. A shop that never charges its customers for a bounce has no
 * reason to have configured `BOUNCE_CHARGES_RECOVERED`, and refusing to record
 * their bounce because of it would be the module inventing a requirement. A
 * shop that DOES charge gets the refusal — by role name, before anything is
 * written (§7: "no BOUNCE_CHARGES_RECOVERED mapping → refused by role name,
 * nothing written").
 *
 * Cheques In Hand is deliberately not a role here. It comes from the cheque's
 * OWN tender row — see `resolveChequesInHand` in cheques.guards, which has the
 * argument.
 */

type LedgerMapClient = Parameters<typeof resolveRoleLedgers>[0];

export type ChequeRoleLedgers = Map<string, ResolvedRoleLedger>;

/**
 * Resolve the roles a posting needs, and REFUSE if any is unmapped.
 *
 * `where: 'cheque'` names the caller in the message, so an operator reads
 * "cheque: nothing maps BOUNCE_CHARGES_RECOVERED to a ledger" rather than a
 * constraint name — and the field it lands on is the box they typed the charge
 * into, not a role code they have never seen.
 */
export function requireChequeRoleLedgers(
  client: LedgerMapClient,
  roles: readonly ChequeLedgerRole[],
  scope: { companyId: string; branchId: string | null },
): Promise<ChequeRoleLedgers> {
  return requireRoleLedgers(
    client,
    [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })),
    {
      companyId: scope.companyId,
      branchId: scope.branchId,
      where: 'cheque',
      message: 'Posting ledgers are not configured',
    },
  );
}

/** Look one role's answer out of the map `requireChequeRoleLedgers` returned. */
export function ledgerForRole(
  resolved: ReadonlyMap<string, ResolvedRoleLedger | null>,
  role: ChequeLedgerRole,
): ResolvedRoleLedger | null {
  return resolved.get(roleLedgerKey({ role })) ?? null;
}

/**
 * The API field an unmapped role is reported against — the box the operator is
 * looking at, never the role code.
 */
function roleFieldName(role: ChequeLedgerRole): string {
  switch (role) {
    case ChequeLedgerRole.BANK_CHARGES:
      return 'bankCharge';
    case ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED:
      return 'partyCharge';
    default:
      return 'apdId';
  }
}

export type { ResolvedRoleLedger };
