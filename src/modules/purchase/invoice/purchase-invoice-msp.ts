import { Prisma } from '@prisma/client';

/**
 * Purchase entry P9: the MSP (minimum selling price) of a bill line.
 *
 *  - SHOWN (/validate `minPrice`): what the operator typed, else the item's current minimum on the price row
 *    Post would write (branch, unit, MRP bucket), else null.
 *  - SAVED (`pii_min_price`): only what the operator typed (user 2026-11-02). A typed 0 is kept as 0 ("no MSP":
 *    Post clears the item's minimum). A line without `minPrice` saves NULL, so a draft never carries the item's
 *    MSP of the day it was saved into a later Post. The screen re-sends a draft's stored value on re-save.
 *  - POSTED: a non-null `pii_min_price` rides with Sell A–D into item_price_master (applyPurchasePrices, MSP
 *    first); NULL leaves the item's minimum alone, and the prices are still checked against it.
 */
const r2 = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** The MSP the line saves: the typed value (2 places), else null. */
export function savedMinPrice(typed: number | null | undefined): Prisma.Decimal | null {
  return typed === null || typed === undefined ? null : r2(typed);
}

/** The MSP the line shows: typed, else the item's current minimum here, else null. */
export function shownMinPrice(typed: number | null | undefined, current: Prisma.Decimal | null | undefined): Prisma.Decimal | null {
  return savedMinPrice(typed) ?? current ?? null;
}
