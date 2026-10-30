import type { PrismaClient } from '@prisma/client';

/**
 * Notes 115 — the e2e suites run on the live company and branch
 * (helpers/payment-e2e COMPANY / BRANCH), so a business day they open is the
 * one the real counters join, and its till_event rows are those sessions'
 * audit journal too. A teardown therefore deletes events only by what it can
 * prove is its own — its sessions' ids and its devices' ids (every day-level
 * event the server writes carries the caller's device) — and NEVER by
 * `tev_day_id`.
 *
 * This drops the day itself, called once the suite's own events and sessions
 * are gone, and only while nothing else stands on it: no session (a real
 * counter that joined the day keeps it) and no event (someone else's day-level
 * fact). Pass a day the suite opened; one it found already open is never
 * passed in.
 */
export async function dropTestDay(
  prisma: PrismaClient,
  dayId: string | null | undefined,
): Promise<void> {
  if (!dayId) {
    return;
  }
  await prisma.$executeRaw`
    DELETE FROM accounts.till_business_day d
     WHERE d.tbd_id = ${dayId}::uuid
       AND NOT EXISTS (SELECT 1 FROM accounts.till_session s WHERE s.tss_day_id = d.tbd_id)
       AND NOT EXISTS (SELECT 1 FROM accounts.till_event e WHERE e.tev_day_id = d.tbd_id)`;
}
