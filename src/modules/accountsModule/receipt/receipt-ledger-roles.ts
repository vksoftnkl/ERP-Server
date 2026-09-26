import {
  requireRoleLedgers,
  resolveRoleLedgers,
  roleLedgerKey,
  type ResolvedRoleLedger,
} from '../ledgerRole/ledger-map.helper';
import { ReceiptLedgerRole } from './types/receipt-enum';

/**
 * Every ledger this module posts to that is not a party, a tender or a ledger
 * the operator picked by hand — found by ROLE, through
 * `accounts.acc_ledger_map`.
 *
 * Never by name (§12). "Bank Charges" is spelt six ways across six charts, a
 * company may have three of them, and a report that sums a ledger by name
 * answers a different question the day somebody renames it. The role is stable;
 * the ledger behind it is configuration.
 *
 * `av_role` on the leg is the other half of the same idea: the map says where a
 * role posts TODAY, the leg records which role it was posted under, so the
 * answer survives a remap.
 */

type LedgerMapClient = Parameters<typeof resolveRoleLedgers>[0];

export type ReceiptRoleLedgers = Map<string, ResolvedRoleLedger>;

/**
 * Resolve the roles a posting needs, and REFUSE if any of them is unmapped.
 *
 * The throwing form is right here and not on the draft path: an unmapped role
 * means the receipt cannot be posted at all, and discovering that at post time
 * — after the operator has counted the cash — is the whole failure this
 * prevents. `/receipts/create` uses `describeRoleLedgers` instead, so a draft
 * can be saved and the gap reported.
 *
 * `where` names the caller in the message, so an operator reads "receipt: nothing
 * maps TDS_RECEIVABLE to a ledger" rather than a constraint name.
 */
export function requireReceiptRoleLedgers(
  client: LedgerMapClient,
  roles: readonly string[],
  scope: { companyId: string; branchId: string | null },
): Promise<ReceiptRoleLedgers> {
  return requireRoleLedgers(
    client,
    [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })),
    {
      companyId: scope.companyId,
      branchId: scope.branchId,
      where: 'receipt',
      message: 'Posting ledgers are not configured',
    },
  );
}

/**
 * The same lookup, but a gap is an answer rather than an error — what the draft
 * path and the open-items screen use, so they can show what WOULD happen
 * without refusing to work.
 */
export function describeReceiptRoleLedgers(
  client: LedgerMapClient,
  roles: readonly string[],
  scope: { companyId: string; branchId: string | null },
): Promise<Map<string, ResolvedRoleLedger | null>> {
  return resolveRoleLedgers(
    client,
    [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })),
    { companyId: scope.companyId, branchId: scope.branchId, where: 'receipt' },
  );
}

/** Look one role's answer out of the map `requireReceiptRoleLedgers` returned. */
export function ledgerForRole(
  resolved: ReadonlyMap<string, ResolvedRoleLedger | null>,
  role: string,
): ResolvedRoleLedger | null {
  return resolved.get(roleLedgerKey({ role })) ?? null;
}

/**
 * The API field an unmapped role is reported against. `otherLines` for a line
 * the operator keyed; the named field for the ones the SERVER adds on its own,
 * because an operator who never typed a discount cannot be told to fix
 * `otherLines.4`.
 */
function roleFieldName(role: string): string {
  switch (role as ReceiptLedgerRole) {
    case ReceiptLedgerRole.DISCOUNT_ALLOWED:
      return 'allocations.discount';
    case ReceiptLedgerRole.WRITE_OFF:
      return 'allocations.writeoff';
    case ReceiptLedgerRole.ROUND_OFF:
      return 'allocations.roundoff';
    case ReceiptLedgerRole.BANK_CHARGES:
      return 'tenders.tdMdrAmt';
    case ReceiptLedgerRole.SURCHARGE_RECOVERED:
      return 'tenders.tdSurchargeAmt';
    default:
      return 'otherLines';
  }
}

export type { ResolvedRoleLedger };
