import { Prisma } from '@prisma/client';
import { LoadingSlabRow } from '../types/master-lookup-internal.types';

/**
 * Weight the `auto` slab match runs against.
 *
 * An explicitly supplied weight wins, even when it is 0 — the caller weighed
 * the line and 0 is an answer. Only an absent one is derived, from the item's
 * own per-unit UOM weight (item_unit_conversion.iuc_uom_weight) times the
 * quantity; item_master carries no weight column of its own.
 *
 * Returns null when nothing is derivable — an item whose conversion row has no
 * UOM weight cannot be slab-matched, which the caller turns into a 400 rather
 * than silently charging nothing.
 *
 * The arithmetic stays on Prisma.Decimal so a 3-decimal UOM weight times a
 * fractional qty does not pick up a binary-float tail before it reaches the
 * numeric comparison in the query.
 */
export function resolveLoadingWeight(
  weight: number | undefined,
  qty: number,
  uomWeight: Prisma.Decimal | number,
): Prisma.Decimal | null {
  if (weight !== undefined) {
    return new Prisma.Decimal(weight);
  }
  const derived = new Prisma.Decimal(uomWeight).mul(qty);
  return derived.gt(0) ? derived : null;
}

/**
 * Picks the slab that applies out of the rows the query already narrowed to
 * this tenant and weight.
 *
 * Both scope columns are nullable in `sale_loading_charges`, so up to four
 * scopes can match one weight at once. They rank by how specifically they name
 * the caller — company before branch, since company is the tenant boundary and
 * branch only narrows within it:
 *
 *   company + branch (3) > company, any branch (2) > branch only (1) > global (0)
 *
 * Rows arrive ordered by PK, so two slabs of equal specificity resolve to the
 * older one — deterministic, but arbitrary. Overlapping slabs within one scope
 * are a data error the exclusion constraint on the master is what really
 * prevents; this tie-break only keeps the response stable until then.
 */
export function selectLoadingSlab<T extends LoadingSlabRow>(
  slabs: T[],
  companyId: string,
  branchId: string,
): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const slab of slabs) {
    const score = (slab.ilcCompId === companyId ? 2 : 0) + (slab.ilcBranchId === branchId ? 1 : 0);
    if (score > bestScore) {
      best = slab;
      bestScore = score;
    }
  }
  return best;
}
