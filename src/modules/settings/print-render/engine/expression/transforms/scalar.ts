/**
 * Scalar-to-string coercion for the expression layer.
 *
 * jexl hands transforms values typed `any`/`unknown`, and rendering them is the
 * whole job. A bare `String(value)` on an object would print '[object Object]'
 * on the face of an invoice, and the @typescript-eslint/no-base-to-string rule
 * rightly flags it — so every display conversion in the transforms and the
 * evaluator routes through here instead.
 *
 * A Prisma Decimal coerces exactly through Number() (via valueOf); any other
 * object yields NaN and becomes empty, which is the safe failure for a report.
 */
export const scalarToString = (value: unknown): string => {
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
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '';
};
