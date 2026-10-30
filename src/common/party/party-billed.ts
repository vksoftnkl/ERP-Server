import { Prisma } from '@prisma/client';

/**
 * Party master rules D3, Q9 = B (plan §3.6) — "last billed" is worked out from the
 * bills each time it is read, never stored: the latest bill date and the number of
 * POSTED, live sale bills of the customer, over every company, branch and year.
 * A cancelled or voided bill is CANCELLED, so it drops out; an amend cancels the old
 * bill and posts a new one, so it counts once. Served by ix_sb_cust_posted.
 *
 * cus_billed_date / cus_billed_count / sup_billed_date stay in the table for one
 * release (P2 drops them); nothing writes them any more.
 */
export interface LastBilled {
  /** sb_bill_date (a DATE, read back as UTC midnight), or null with no posted bill. */
  date: Date | null;
  count: number;
}

type BilledClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

export async function lastBilledOf(client: BilledClient, cusId: string): Promise<LastBilled> {
  const rows = await client.$queryRaw<{ d: Date | null; n: number }[]>`
    SELECT max(sb_bill_date) AS d, count(*)::int AS n
      FROM sales.sale_bill
     WHERE sb_cust_id = ${cusId}::uuid
       AND sb_status = 'POSTED'
       AND sb_is_deleted = false`;
  const row = rows[0];
  return { date: row?.d ?? null, count: Number(row?.n ?? 0) };
}
