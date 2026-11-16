import { Prisma } from '@prisma/client';

/**
 * Small text formatters the delivery and godown-position print providers share
 * (delivery tracking P5). The engine's `fmt` pads to a fixed number of decimals;
 * these prints want quantities and kilograms WITHOUT trailing zeros ("80",
 * "9.999", "12.5"), so the provider hands the design ready text beside the number.
 */

type Num = Prisma.Decimal | string | number | null | undefined;

/** A Decimal from anything numeric; null / blank / junk → 0. */
export function decOf(value: Num): Prisma.Decimal {
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);
  try {
    return new Prisma.Decimal(value as Prisma.Decimal.Value);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/** Indian digit grouping of a whole-number string: 12,34,567. */
function groupIndian(whole: string): string {
  if (whole.length <= 3) return whole;
  const last = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last}`;
}

/**
 * A quantity or weight as print text: at most `dp` decimals, trailing zeros
 * dropped, Indian grouping, a minus kept. 1117.000 → "1,117"; 9.999 → "9.999";
 * 12.50 → "12.5"; 0 → "0".
 */
export function qtyText(value: Num, dp = 3): string {
  const d = decOf(value).toDecimalPlaces(dp, Prisma.Decimal.ROUND_HALF_UP);
  if (d.isZero()) return '0';
  const negative = d.isNegative();
  const [whole, frac = ''] = d.abs().toFixed(dp).split('.');
  const trimmed = frac.replace(/0+$/, '');
  return `${negative ? '-' : ''}${groupIndian(whole)}${trimmed ? `.${trimmed}` : ''}`;
}

/** A number for the engine (null stays null). */
export function numOf(value: Num): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(decOf(value).toString());
  return Number.isFinite(n) ? n : null;
}

/** dd/MM/yyyy from 'YYYY-MM-DD' (or a Date's UTC calendar day); '' when empty. */
export function dmyText(value: string | Date | null | undefined): string {
  if (!value) return '';
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * An instant as IST 12-hour text: dd/MM/yyyy hh:mm AM. IST is fixed (+05:30, no
 * daylight saving), so the offset is added rather than read from the process or
 * the database session — the same answer as `AT TIME ZONE 'Asia/Kolkata'`.
 */
export function istText(at: Date | string | null | undefined): string {
  if (!at) return '';
  const when = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(when.getTime())) return '';
  const ist = new Date(when.getTime() + 330 * 60_000);
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const hh = ist.getUTCHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const mi = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${ist.getUTCFullYear()} ${String(h12).padStart(2, '0')}:${mi} ${hh < 12 ? 'AM' : 'PM'}`;
}

/** "n thing(s)" with the plural only when n ≠ 1. */
export function countText(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A comma list of uuids from a prompt ("a,b, c"), de-duplicated, order kept; junk refused. */
export function uuidList(raw: unknown, what: string, max = 1000): string[] {
  const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(',') : '';
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const id = part.trim().toLowerCase();
    if (!id) continue;
    if (!UUID.test(id)) {
      throw new Error(`${what}: '${part.trim()}' is not an id. Send the ids comma separated.`);
    }
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  if (out.length > max) {
    throw new Error(`${what}: ${out.length} ids sent; at most ${max} print at once.`);
  }
  return out;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One promise per key while it runs (and a few seconds after): the datasets of
 * one render resolve AT ONCE (the dataset runner's Promise.all), and a head, a
 * lines and a still-to-come dataset must read the same moment rather than run
 * the same reads three times.
 */
export class RenderMemo<T> {
  private readonly runs = new Map<string, Promise<T>>();

  constructor(private readonly keepMs = 5_000) {}

  get(key: string, work: () => Promise<T>): Promise<T> {
    const running = this.runs.get(key);
    if (running) return running;
    const started = work();
    this.runs.set(key, started);
    const forget = () => {
      const timer = setTimeout(() => {
        if (this.runs.get(key) === started) this.runs.delete(key);
      }, this.keepMs);
      timer.unref?.();
    };
    started.then(forget, () => this.runs.delete(key));
    return started;
  }
}
