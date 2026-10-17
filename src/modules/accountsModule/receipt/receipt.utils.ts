import { Prisma } from '@prisma/client';

/**
 * The arithmetic the whole module shares, in one place because it is the
 * arithmetic that is easy to get wrong.
 *
 * Money is `Prisma.Decimal` end to end, never `number`. `0.1 + 0.2` is the
 * reason: §5.2 step 4 refuses a receipt whose identity is out by ONE PAISA, and
 * a rule that strict cannot be evaluated in binary floating point. Conversion
 * to `number` happens once, at the response boundary — `toAmount`.
 */

export const ZERO = new Prisma.Decimal(0);

/** ck_abl_acc_year / ck_avh_acc_year: 'YYYY-YYYY', second half = first + 1. */
export const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export function isValidAccYear(accYear: string): boolean {
  if (!ACC_YEAR_PATTERN.test(accYear)) {
    return false;
  }
  return Number(accYear.slice(5, 9)) === Number(accYear.slice(0, 4)) + 1;
}

/** Money as the database stores it: 2dp, so a sub-paisa difference is not one. */
export function money(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

export function sum(values: Iterable<Prisma.Decimal>): Prisma.Decimal {
  let total = ZERO;
  for (const value of values) {
    total = total.plus(value);
  }
  return total.toDecimalPlaces(2);
}

/** The response boundary — the one place Decimal becomes number. */
export function toAmount(value: Prisma.Decimal | string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return new Prisma.Decimal(value).toDecimalPlaces(2).toNumber();
}

export function toNullableAmount(
  value: Prisma.Decimal | string | number | null | undefined,
): number | null {
  return value === null || value === undefined ? null : toAmount(value);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * A `date` column parsed the way Postgres means it: midnight UTC, no timezone
 * shift. `new Date('2026-09-20')` already does this; going through the local
 * timezone does not, and lands on the 19th west of UTC — which for a post-dated
 * cheque is the difference between settling today and settling tomorrow.
 */
export function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** A date column as the API spells it: 'YYYY-MM-DD', never a timestamp. */
export function toDateString(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Today at midnight UTC — the reference a post-dated row is measured against. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function startOfDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}

/**
 * How overdue a bill is on a given day. A bill with no due date is never
 * overdue — it has no date to be late against, and guessing one from the doc
 * date plus credit days would invent an ageing the accountant did not set.
 */
export function daysOverdue(dueDate: Date | null, onDate: Date): number {
  if (!dueDate) {
    return 0;
  }
  return Math.max(0, daysBetween(dueDate, onDate));
}

// ─── Pro-rata ────────────────────────────────────────────────────────────────

/**
 * Split `total` across `weights` so the parts sum to EXACTLY `total`.
 *
 * Largest-remainder, not round-and-hope: three bills sharing 100.00 by thirds
 * are 33.33 / 33.33 / 33.34, and the paisa goes to the largest remainder rather
 * than being lost. §5.2 step 4 compares to the paisa, so "sums exactly" is not
 * a nicety here — a naive split fails the identity it is feeding.
 *
 * A zero total, or weights that sum to zero, returns all zeros: there is
 * nothing to spread and nowhere to spread it.
 */
export function distributeProRata(
  total: Prisma.Decimal,
  weights: readonly Prisma.Decimal[],
): Prisma.Decimal[] {
  const target = money(total);
  const weightTotal = sum(weights);
  if (weights.length === 0 || target.isZero() || weightTotal.isZero()) {
    return weights.map(() => ZERO);
  }

  const shares = weights.map((weight) =>
    target.times(weight).dividedBy(weightTotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN),
  );

  // What rounding down left on the table, handed out one paisa at a time to the
  // largest remainders — the parts that were cut hardest, in weight order so
  // the same inputs always produce the same split.
  const paisa = new Prisma.Decimal('0.01');
  let remainder = target.minus(sum(shares));
  const order = weights
    .map((weight, index) => ({
      index,
      remainder: target.times(weight).dividedBy(weightTotal).minus(shares[index]),
      weight,
    }))
    .sort(
      (left, right) =>
        right.remainder.comparedTo(left.remainder) ||
        right.weight.comparedTo(left.weight) ||
        left.index - right.index,
    );

  for (const entry of order) {
    if (remainder.lessThanOrEqualTo(0)) {
      break;
    }
    shares[entry.index] = shares[entry.index].plus(paisa);
    remainder = remainder.minus(paisa);
  }

  return shares;
}

// ─── Reading what the database types as text ─────────────────────────────────

/**
 * `avh_voucher_status`, `av_dr_cr` and friends are VARCHAR + CHECK, not PG
 * enums, so Prisma hands them back as plain strings. Comparing one of those
 * against a TypeScript enum member is a comparison the compiler cannot check —
 * and a typo in it fails silently, which for a status gate means a POSTED
 * receipt posting twice.
 *
 * These two do the narrowing in ONE place, so every comparison downstream is
 * between two members of the same enum and a typo is a compile error.
 */
export function asEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value !== null && value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** DR becomes CR and CR becomes DR — what a reversal leg does. */
export function flipSide<T extends string>(value: string, dr: T, cr: T): T {
  return value === dr ? cr : dr;
}

// ─── Text ────────────────────────────────────────────────────────────────────

export function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Column widths, so an over-long value is cut here and not reported as a 22001. */
export function truncate(value: string | null, maxLength: number): string | null {
  if (value === null) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
