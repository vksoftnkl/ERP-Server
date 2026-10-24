/**
 * An instant as a person reads it on the shop's clock — `DD-MM-YYYY hh:mm AM`
 * in Asia/Kolkata. Notes 121 §1: AM/PM wherever a person reads a time, as the
 * grids' `HH12:MI AM`; 12:05 AM just after midnight, 12:05 PM just after noon.
 *
 * The same text till-print's `timeText` produces for a slip, here for every
 * server message that names a time (notes 150, minor 2). The SQL spelling for
 * `to_char` on a timestamptz is beside it: the DB session runs in
 * Asia/Kolkata, so `to_char` already renders the shop's clock.
 */
export const IST_CLOCK_SQL_FORMAT = 'DD-MM-YYYY HH12:MI AM';

export function istClockText(instant: Date | string | number): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return String(instant);
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  const hour = Number(p('hour')) % 24;
  const h12 = String(hour % 12 || 12).padStart(2, '0');
  return `${p('day')}-${p('month')}-${p('year')} ${h12}:${p('minute')} ${hour < 12 ? 'AM' : 'PM'}`;
}
