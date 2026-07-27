import { ItemPriceMaster } from '@prisma/client';
import { toNumber } from '../../../common/utils/module-service.utils';
import { PriceRowWithUnit, UnitCycleRow } from '../types/master-lookup-internal.types';

/**
 * Collapses the price rows to one per unit. A row without a branch prices the
 * unit for every branch, so it stands in only where the requested branch has
 * no rate of its own — a branch-specific row always beats the branch-less one.
 * Rows arrive ordered (slno, then ipm_id), so the fallback pick is stable.
 */
export function preferBranchPriceRows(
  priceRows: PriceRowWithUnit[],
  branchId?: string,
): PriceRowWithUnit[] {
  if (!branchId) return priceRows;
  const byUnit = new Map<string, PriceRowWithUnit>();
  for (const row of priceRows) {
    const current = byUnit.get(row.ipmUcUnitId);
    if (!current || (current.ipmBranchId !== branchId && row.ipmBranchId === branchId)) {
      byUnit.set(row.ipmUcUnitId, row);
    }
  }
  return [...byUnit.values()];
}

/**
 * Unit-rate selection (legacy WHERE clause). An explicit unit wins. Otherwise
 * the unit-slno rule applies: a retail item takes the row with the highest
 * slno (largest pack), a non-retail item takes the base row — the lowest slno.
 * The legacy cursor hard-coded slno 0 for the base unit, but item_unit_conversion
 * numbers an item's units from 1, so matching on 0 found nothing. Returns null
 * only when the item has no price rows at all.
 */
export function selectUnitRate(
  priceRows: PriceRowWithUnit[],
  isRetailItem: boolean,
  unitId?: string,
): PriceRowWithUnit | null {
  if (priceRows.length === 0) return null;
  if (unitId) {
    // Callers pass a unit_id, which the row now holds only via its conversion;
    // an iuc_id still matches so an internal caller can pass either.
    return (
      priceRows.find(
        (row) => row.itemUnitConversion.iucUnitId === unitId || row.ipmUcUnitId === unitId,
      ) ?? null
    );
  }
  // The unit slno the legacy rule keys off lives on the conversion row now.
  return priceRows.reduce((best, row) => {
    const slno = row.itemUnitConversion.iucUnitSlno;
    const bestSlno = best.itemUnitConversion.iucUnitSlno;
    return isRetailItem ? (slno > bestSlno ? row : best) : slno < bestSlno ? row : best;
  }, priceRows[0]);
}

/**
 * Steps one place along an item's unit-conversion list and returns the unit id
 * landed on. `rows` must already be in the cycle order the caller wants; the
 * step wraps around, so the last row's successor is the first one.
 *
 * The requested unit is matched on either identifier, the same way
 * `selectUnitRate` does: entry screens hold a unit_id, internal callers may
 * hold the conversion PK (iuc_id).
 *
 * Two degenerate cases keep the refresh a no-op instead of an error, so an
 * entry screen never breaks on a cycle:
 *  - no conversion rows at all → the requested unit stands.
 *  - the requested unit is not in the list (stale selection) → the first row.
 */
export function nextUnitIdInCycle(rows: UnitCycleRow[], requestedUnitId: string): string {
  if (rows.length === 0) return requestedUnitId;
  const index = rows.findIndex(
    (row) => row.iucUnitId === requestedUnitId || row.iucId === requestedUnitId,
  );
  if (index === -1) return rows[0].iucUnitId;
  return rows[(index + 1) % rows.length].iucUnitId;
}

/** Legacy price-level CASE (1–7 → a/b/c/d/max/min/cost). */
export function priceForLevel(rate: ItemPriceMaster, priceLevel: number): number {
  switch (priceLevel) {
    case 2:
      return toNumber(rate.ipmSalesPriceB);
    case 3:
      return toNumber(rate.ipmSalesPriceC);
    case 4:
      return toNumber(rate.ipmSalesPriceD);
    case 5:
      return toNumber(rate.ipmMaxPrice);
    case 6:
      return toNumber(rate.ipmMinPrice);
    case 7:
      return toNumber(rate.ipmCostPrice);
    case 1:
    default:
      return toNumber(rate.ipmSalesPriceA);
  }
}
