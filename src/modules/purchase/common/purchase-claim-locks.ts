import { Prisma } from '@prisma/client';

/**
 * The per-claim advisory locks of a claim settlement (one settlement at a time per claim):
 *  - a return claim row  (pur_return_item.pri_id)         -> (hashtext(RETURN_CLAIM_LOCK),   hashtext(priId))
 *  - a shortage claim    (pur_shortage_close.psc_id)      -> (hashtext(SHORTAGE_CLAIM_LOCK), hashtext(pscId))
 * settleIn / settleClaimIn / the undo paths take them one at a time. A multi-row settle
 * (/purchase/supplier-dues/settle) takes ALL of its rows' locks first, in claimLockOrder(),
 * so two settles that list the same claims in opposite orders queue instead of deadlocking.
 * The per-row lock inside settleIn / settleClaimIn is then a re-entry (xact advisory locks
 * stack within one transaction) and waits for nothing.
 */
export const RETURN_CLAIM_LOCK = 'purchase_claim';
export const SHORTAGE_CLAIM_LOCK = 'purchase_shortage_claim';

export interface ClaimLockKey {
  ns: typeof RETURN_CLAIM_LOCK | typeof SHORTAGE_CLAIM_LOCK;
  id: string;
}

/** A settle row's claim: shortageCloseId when set, else returnItemId (as the settle dispatch does). */
export function claimLockKeyOf(row: { returnItemId?: string | null; shortageCloseId?: string | null }): ClaimLockKey | null {
  if (row.shortageCloseId) return { ns: SHORTAGE_CLAIM_LOCK, id: row.shortageCloseId };
  if (row.returnItemId) return { ns: RETURN_CLAIM_LOCK, id: row.returnItemId };
  return null;
}

/** The canonical lock order: distinct keys sorted by (namespace, id), lower-cased id (uuid text). */
export function claimLockOrder(rows: readonly { returnItemId?: string | null; shortageCloseId?: string | null }[]): ClaimLockKey[] {
  const seen = new Map<string, ClaimLockKey>();
  for (const r of rows) {
    const k = claimLockKeyOf(r);
    if (!k) continue;
    const key = { ns: k.ns, id: k.id.toLowerCase() };
    seen.set(`${key.ns}|${key.id}`, key);
  }
  return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, k]) => k);
}

/** Take the given claim locks, one statement each, in the order given (pass claimLockOrder()). */
export async function lockClaims(tx: Prisma.TransactionClient, keys: readonly ClaimLockKey[]): Promise<void> {
  for (const k of keys) {
    await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext(${k.ns}), hashtext(${k.id})))::int AS locked`;
  }
}
