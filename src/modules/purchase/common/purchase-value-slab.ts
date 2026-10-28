import { Prisma } from '@prisma/client';
import { D, type Tx } from './purchase-doc.helpers';

/**
 * ENT-09 / P15 — value-based GST slab (GST 2.0, 22-Sep-2025: apparel ≤ ₹2,500 per piece 5 %, above 18 %).
 * A rate row may carry tax_value_threshold + tax_above_tax_id (migration
 * 20261028190200_tax_rate_value_slab, share purchase/sql): a line whose taxable value PER PIECE after
 * discount (addendum 2 R25) is above the threshold takes the "above" rate instead. Until the columns
 * exist nothing changes. Pure decision in valuePerPiece / pickSlab (spec); applyValueSlabs is the hook.
 */
export interface SlabLine { rate: number; discPct?: number; discPerQty?: number; schPct?: number; schPerQty?: number }

/** Taxable value of one base unit (piece) after the line's discounts. */
export function valuePerPiece(l: SlabLine, toBaseFactor: Prisma.Decimal.Value): Prisma.Decimal {
  const f = D(toBaseFactor);
  const perUnit = D(l.rate).times(D(1).minus(D(l.discPct ?? 0).div(100))).minus(D(l.discPerQty ?? 0))
    .times(D(1).minus(D(l.schPct ?? 0).div(100))).minus(D(l.schPerQty ?? 0));
  return f.isZero() ? perUnit : perUnit.div(f);
}

/** The tax id to use: the "above" rate when the value per piece is ABOVE the threshold (≤ keeps the base rate). */
export function pickSlab(baseTaxId: string, perPiece: Prisma.Decimal, threshold: Prisma.Decimal.Value | null, aboveTaxId: string | null): string {
  if (threshold == null || !aboveTaxId) return baseTaxId;
  return perPiece.greaterThan(D(threshold)) ? aboveTaxId : baseTaxId;
}

let columnsReady: boolean | null = null;

/** Rewrites each line's taxId by its slab (lines whose tax row carries a threshold). */
export async function applyValueSlabs(
  tx: Tx,
  lines: (SlabLine & { uomId: string; taxId?: string })[],
  factorOf: (uomId: string) => Prisma.Decimal.Value | undefined,
) {
  if (columnsReady === null) {
    const [c] = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = 'inventory' AND table_name = 'tax_rate_master' AND column_name IN ('tax_value_threshold', 'tax_above_tax_id')`;
    columnsReady = Number(c?.n ?? 0) === 2;
  }
  if (!columnsReady) return;
  const ids = [...new Set(lines.map((l) => l.taxId).filter((t): t is string => !!t))];
  if (!ids.length) return;
  const slabs = await tx.$queryRawUnsafe<{ tax_id: string; tax_value_threshold: Prisma.Decimal | null; tax_above_tax_id: string | null }[]>(
    `SELECT tax_id, tax_value_threshold, tax_above_tax_id FROM inventory.tax_rate_master
      WHERE tax_id = ANY($1::uuid[]) AND tax_value_threshold IS NOT NULL AND tax_above_tax_id IS NOT NULL`, ids);
  if (!slabs.length) return;
  const by = new Map(slabs.map((s) => [s.tax_id, s]));
  for (const l of lines) {
    const s = l.taxId ? by.get(l.taxId) : undefined;
    if (!s) continue;
    l.taxId = pickSlab(l.taxId!, valuePerPiece(l, factorOf(l.uomId) ?? 1), s.tax_value_threshold, s.tax_above_tax_id);
  }
}
