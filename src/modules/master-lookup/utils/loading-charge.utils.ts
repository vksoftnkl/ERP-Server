import { Prisma } from '@prisma/client';
import { LoadingSlabRow } from '../types/master-lookup-internal.types';

/**
 * Weight the `auto` slab match runs against.
 *
 * The lookup takes no weight of its own: it is always the item's per-unit UOM
 * weight (item_unit_conversion.iuc_uom_weight) on the conversion the selected
 * rate hangs off, since item_master carries no weight column. Line quantity
 * plays no part — the slab charge is flat per slab, so scaling the match weight
 * by qty would only push a line into a heavier slab, not multiply the charge.
 *
 * Returns null when there is nothing to match on — a conversion row without a
 * UOM weight cannot be slab-matched, which the caller turns into a 400 rather
 * than silently charging nothing.
 *
 * The value stays a Prisma.Decimal so a 3-decimal UOM weight reaches the
 * numeric comparison in the query without a binary-float tail.
 */
export function resolveLoadingWeight(uomWeight: Prisma.Decimal | number): Prisma.Decimal | null {
  const weight = new Prisma.Decimal(uomWeight);
  return weight.gt(0) ? weight : null;
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
