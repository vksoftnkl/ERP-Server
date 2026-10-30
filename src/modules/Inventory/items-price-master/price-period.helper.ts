import { Prisma } from '@prisma/client';

/**
 * Notes 140 — WHICH OF AN ITEM'S PRICE ROWS ARE ITS PRICES TODAY.
 *
 * Change Selling Price can schedule a price ("rate from tomorrow"): the row in
 * force on that day ends the day before it, and a new row runs from it. One
 * key (company, branch, unit, bucket) may therefore hold several live rows —
 * history (ended before today), today's, and scheduled ones (starting after
 * today) — kept apart by `ex_ipm_overlap`. Billing picks by the document's
 * date (`resolveEffectivePrice`); a reader that wants "the price" without a
 * date means today's, and must say so, or it may land on yesterday's or
 * tomorrow's row.
 *
 * TODAY is the database's CURRENT_DATE, the clock every price statement
 * compares the effective dates with — never the server's, which disagrees
 * for five and a half hours a day when it runs on UTC.
 */

/** The database's today, `YYYY-MM-DD`. */
export async function databaseToday(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<string> {
  const [row] = await client.$queryRaw<Array<{ today: string }>>`
    SELECT CURRENT_DATE::text AS today
  `;
  return row.today;
}

/** A `YYYY-MM-DD` as Prisma reads and writes a `@db.Date`: UTC midnight. */
export function toDateColumn(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** The rows in force on `day` (`YYYY-MM-DD`). */
export function priceRowsInForce(day: string): Prisma.ItemPriceMasterWhereInput {
  const date = toDateColumn(day);
  return { ipmEffectiveFrom: { lte: date }, ipmEffectiveTo: { gte: date } };
}

/** The rows that start after `day` (`YYYY-MM-DD`): scheduled, not yet on the shelf. */
export function priceRowsScheduledAfter(day: string): Prisma.ItemPriceMasterWhereInput {
  return { ipmEffectiveFrom: { gt: toDateColumn(day) } };
}
