import { Prisma } from '@prisma/client';
import { BillDrCr, OpeningDrCr } from './types/opening-balance-enum';

/**
 * The arithmetic every part of this module shares, in one place because it is
 * the arithmetic that is easy to get wrong.
 *
 * The rule the whole module rests on: **an amount is always positive and the
 * side lives in a flag**. `ck_op_amount` and `ck_abl_amount` both refuse a
 * negative, so a signed figure is only ever an intermediate — it is produced
 * to add balances together and split again before anything is stored.
 *
 * Money is Prisma.Decimal end to end rather than number. `0.1 + 0.2` is the
 * reason: a trial balance decides whether a company's books are accepted, and
 * it must not hinge on binary floating point. Conversion to number happens
 * once, at the response boundary.
 */

/** ux_op_scope COALESCEs a NULL branch to this. Company level, as an id. */
export const ALL_BRANCHES_SENTINEL = '00000000-0000-0000-0000-000000000000';

/** ck_op_acc_year / ck_abl_acc_year: 'YYYY-YYYY', second half = first + 1. */
export const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export const ZERO = new Prisma.Decimal(0);

export function isValidAccYear(accYear: string): boolean {
  if (!ACC_YEAR_PATTERN.test(accYear)) {
    return false;
  }
  return Number(accYear.slice(5, 9)) === Number(accYear.slice(0, 4)) + 1;
}

/** '2025-2026' -> '2026-2027'. The caller has already validated the shape. */
export function nextAccYear(accYear: string): string {
  const start = Number(accYear.slice(0, 4)) + 1;
  return `${start}-${start + 1}`;
}

/** '2026-2027' -> '2025-2026'. */
export function previousAccYear(accYear: string): string {
  const start = Number(accYear.slice(0, 4)) - 1;
  return `${start}-${start + 1}`;
}

/** Ordering key for "every year after this one" — the years are comparable as strings. */
export function isAccYearAfter(candidate: string, reference: string): boolean {
  return Number(candidate.slice(0, 4)) > Number(reference.slice(0, 4));
}

// ─── Sign, and the split back out of it ──────────────────────────────────────

/** Debit positive. The convention for both spellings of the flag. */
export function signedOpening(
  amount: Prisma.Decimal | string | number,
  drCr: string,
): Prisma.Decimal {
  const value = new Prisma.Decimal(amount);
  return drCr === OpeningDrCr.DEBIT ? value : value.negated();
}

/** Same, for acc_bill_balance's two-character flag. */
export function signedBill(
  amount: Prisma.Decimal | string | number,
  drCr: string,
): Prisma.Decimal {
  const value = new Prisma.Decimal(amount);
  return drCr === BillDrCr.DEBIT ? value : value.negated();
}

/**
 * The step §5.2 warns gets written wrong: a signed balance back into the
 * positive amount and the side the database will accept.
 *
 * Zero is 'D' by convention, not by meaning — a zero has no side. Callers that
 * care about zero drop the row instead of storing it (§5.1 rule 4).
 */
export function splitSigned(signed: Prisma.Decimal): {
  amount: Prisma.Decimal;
  drCr: OpeningDrCr;
} {
  return {
    amount: signed.abs(),
    drCr: signed.isNegative() ? OpeningDrCr.CREDIT : OpeningDrCr.DEBIT,
  };
}

/** The same split, in acc_bill_balance's spelling. */
export function splitSignedBill(signed: Prisma.Decimal): {
  amount: Prisma.Decimal;
  drCr: BillDrCr;
} {
  return {
    amount: signed.abs(),
    drCr: signed.isNegative() ? BillDrCr.CREDIT : BillDrCr.DEBIT,
  };
}

/**
 * Money as the database stores it. Every amount is rounded to 2dp before a
 * comparison or a write, so a figure that differs only below the stored
 * precision does not read as a difference.
 */
export function money(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
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

/** A date column as the API spells it: 'YYYY-MM-DD', never a timestamp. */
export function toDateString(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * A date-only column, parsed the way Postgres `date` means it: midnight UTC,
 * with no timezone shift. `new Date('2026-01-12')` already does this; going
 * through the local timezone does not, and lands on the 11th west of UTC.
 */
export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** A bill nothing has been settled against is free to change (§5.5 rule 3). */
export function isBillFrozen(bill: {
  ablAllocAmount: Prisma.Decimal;
  ablDiscAmount: Prisma.Decimal;
  ablWriteoffAmount: Prisma.Decimal;
}): boolean {
  return bill.ablAllocAmount.plus(bill.ablDiscAmount).plus(bill.ablWriteoffAmount).greaterThan(0);
}

export function settledTotal(bill: {
  ablAllocAmount: Prisma.Decimal;
  ablDiscAmount: Prisma.Decimal;
  ablWriteoffAmount: Prisma.Decimal;
}): Prisma.Decimal {
  return bill.ablAllocAmount.plus(bill.ablDiscAmount).plus(bill.ablWriteoffAmount);
}
