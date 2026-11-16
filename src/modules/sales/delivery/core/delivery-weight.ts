import { Prisma } from '@prisma/client';

/**
 * Delivery note weights (round 2, S1): ONE rule for `unitKg` and `weightKg`.
 *
 * `raw` is BillLineFacts.unitKg, i.e. lineUnitKgSql(): the bill line's own
 * weight per unit (sbi_weight_qty / sbi_bill_qty) when it carries one, else the
 * unit's iuc_uom_weight, else 0. It is rounded half-up to 3 places ONCE, here,
 * and every note weight (a line's weightKg, the stored sdni_weight_kg, the
 * totals, the vehicle load) is qty × that rounded figure, rounded to 3 places.
 * So weightKg = qty × unitKg exactly, and the client can recompute a line's kg
 * as the user types its qty.
 */
const Z = new Prisma.Decimal(0);

/** kg of ONE package of the line's own unit, 3 dp (half-up). */
export function unitKgOf(raw: Prisma.Decimal | null | undefined): Prisma.Decimal {
  return (raw ?? Z).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

/** A note line's kg: qty × unitKgOf(raw), 3 dp (half-up). */
export function lineWeightKg(
  qty: Prisma.Decimal,
  raw: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  return qty.times(unitKgOf(raw)).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

/** `unitKg` as the API answers it: always 3 places ("20.000", "0.000"). */
export function unitKgText(raw: Prisma.Decimal | null | undefined): string {
  return unitKgOf(raw).toFixed(3);
}
