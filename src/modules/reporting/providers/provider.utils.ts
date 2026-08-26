import { Prisma } from '@prisma/client';

/**
 * Shared coercions for providers.
 *
 * Every provider hands the layout engine display-ready scalars, never driver
 * types. The reason is narrow and important: Prisma returns `Decimal` objects
 * and `Date` objects, and both survive a jexl expression as opaque values that
 * stringify to something no invoice should show. Normalising at the provider
 * boundary means a template author never has to know what a Decimal is.
 *
 * Decimals become NUMBERS, not strings. A report footing has to add them up.
 * The precision cost is acceptable because every stored value is at most
 * numeric(18,4) and IEEE754 carries ~15 significant digits — but that is also
 * why aggregates in the layout engine round at each step rather than at the end.
 */

export const toNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const numeric = Number(value.toString());
  return Number.isFinite(numeric) ? numeric : 0;
};

/** Nullable variant, for a figure whose absence is meaningful (e.g. MRP). */
export const toNullableNumber = (
  value: Prisma.Decimal | number | string | null | undefined,
): number | null => (value === null || value === undefined ? null : toNumber(value));

/** ISO date-only string, the form every date transform accepts. */
export const toDateOnly = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export const toIsoDateTime = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const toText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  // A Prisma Decimal coerces exactly through Number(); any other object yields
  // NaN and becomes empty rather than '[object Object]' on an invoice.
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '';
};

/** BigInt columns (bill serial numbers) are not JSON-safe and not printable. */
export const toBigIntText = (value: bigint | null | undefined): string =>
  value === null || value === undefined ? '' : value.toString();

/** Join the non-blank parts of a multi-line address into one line. */
export const joinAddress = (...parts: Array<string | null | undefined>): string =>
  parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');

/** Round to 2 decimals the way money is rounded everywhere else in the app. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const round3 = (value: number): number => Math.round((value + Number.EPSILON) * 1000) / 1000;
