import {
  requireRoleLedgers,
  resolveRoleLedgers,
  roleLedgerKey,
  type ResolvedRoleLedger,
} from '../ledgerRole/ledger-map.helper';
import { PaymentLedgerRole } from './types/payment-enum';

/**
 * Every ledger this module posts to that is not a party, a tender or a ledger
 * the operator picked by hand — found by ROLE, through `acc_ledger_map`, never
 * by name (§12). `receipt-ledger-roles.ts`, with the payment's names.
 */

type LedgerMapClient = Parameters<typeof resolveRoleLedgers>[0];

export type PaymentRoleLedgers = Map<string, ResolvedRoleLedger>;

/** Resolve the roles a posting needs, and REFUSE if any of them is unmapped. */
export function requirePaymentRoleLedgers(
  client: LedgerMapClient,
  roles: readonly string[],
  scope: { companyId: string; branchId: string | null },
): Promise<PaymentRoleLedgers> {
  return requireRoleLedgers(
    client,
    [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })),
    {
      companyId: scope.companyId,
      branchId: scope.branchId,
      where: 'payment',
      message: 'Posting ledgers are not configured',
    },
  );
}

/** The same lookup, but a gap is an answer — what the draft path uses. */
export function describePaymentRoleLedgers(
  client: LedgerMapClient,
  roles: readonly string[],
  scope: { companyId: string; branchId: string | null },
): Promise<Map<string, ResolvedRoleLedger | null>> {
  return resolveRoleLedgers(
    client,
    [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })),
    { companyId: scope.companyId, branchId: scope.branchId, where: 'payment' },
  );
}

export function ledgerForRole(
  resolved: ReadonlyMap<string, ResolvedRoleLedger | null>,
  role: string,
): ResolvedRoleLedger | null {
  return resolved.get(roleLedgerKey({ role })) ?? null;
}

function roleFieldName(role: string): string {
  switch (role as PaymentLedgerRole) {
    case PaymentLedgerRole.DISCOUNT_RECEIVED:
      return 'allocations.discount';
    case PaymentLedgerRole.BALANCES_WRITTEN_BACK:
      return 'allocations.writeoff';
    case PaymentLedgerRole.ROUND_OFF:
      return 'allocations.roundoff';
    case PaymentLedgerRole.BANK_CHARGES:
      return 'tenders.tdMdrAmt';
    case PaymentLedgerRole.TDS_PAYABLE:
      return 'avhPartyId';
    default:
      return 'otherLines';
  }
}

export type { ResolvedRoleLedger };
