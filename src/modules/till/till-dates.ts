import { Prisma } from '@prisma/client';
import { throwTill } from './till-errors';
import { TillErrorCode } from './types/till-enum';

type SqlClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * The business date NOW, as 'YYYY-MM-DD' (§5.3): the calendar date less the
 * cut-off, so a sale at 00:40 with a 04:00 cut-off belongs to yesterday.
 *
 * Worked out in the DATABASE, in its session time zone (Asia/Kolkata on every
 * box — memory db-session-timezone-ist), and returned as text: a DATE pushed
 * through a JS Date and bound back as timestamptz lands 5h30 early.
 */
export async function businessDateNow(client: SqlClient, cutoff: string): Promise<string> {
  const [row] = await client.$queryRaw<{ d: string }[]>`
    SELECT to_char(now() - ${`${cutoff}:00`}::interval, 'YYYY-MM-DD') AS d`;
  return row.d;
}

/** The business date a given moment belongs to (an offline bill's own time). */
export async function businessDateAt(client: SqlClient, at: Date, cutoff: string): Promise<string> {
  const [row] = await client.$queryRaw<{ d: string }[]>`
    SELECT to_char(${at}::timestamptz - ${`${cutoff}:00`}::interval, 'YYYY-MM-DD') AS d`;
  return row.d;
}

/** The April–March financial year a date falls in — what ck_tbd_year / ck_tss_year assert. */
export function accYearOf(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  const start = month < 4 ? year - 1 : year;
  return `${start}-${start + 1}`;
}

/** A DATE column read back through Prisma ('YYYY-MM-DD', no zone shift: it is a UTC midnight). */
export function isoDateOf(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → the Date Prisma wants for a @db.Date field. */
export function dateParam(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** 'C01-261007-02' — counter, business date, nth session of the day (§8 S1). */
export function sessionNumber(counterCode: string, isoDate: string, daySeq: number): string {
  const [y, m, d] = isoDate.split('-');
  return `${counterCode.toUpperCase()}-${y.slice(2)}${m}${d}-${String(daySeq).padStart(2, '0')}`;
}

/**
 * A till table with no partition for the year fails every insert with a raw
 * "no partition of relation … found for row". Say which year and what to run.
 */
export async function assertTillPartitions(
  client: SqlClient,
  accYear: string,
  field: string,
): Promise<void> {
  const suffix = accYear.replace('-', '_');
  const [row] = await client.$queryRaw<{ present: number }[]>`
    SELECT count(*)::int AS present
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'accounts'
       AND c.relname IN (${`till_business_day_${suffix}`}, ${`till_session_${suffix}`},
                         ${`acc_voucher_header_${suffix}`})`;
  if ((row?.present ?? 0) < 3) {
    throwTill(
      TillErrorCode.YEAR_NOT_SET_UP,
      `${accYear} has no till / voucher partitions. Run SELECT public.ensure_acc_year_partitions('${accYear}'); and try again.`,
      field,
    );
  }
}
