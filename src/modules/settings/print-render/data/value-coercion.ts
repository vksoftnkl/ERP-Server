import { QueryResult, QueryResultRow } from 'pg';
import { toScalarText } from './scalar-text';

/**
 * Driver values → values an expression can do arithmetic on.
 *
 * node-pg hands back `numeric` as a STRING, because a JavaScript number cannot
 * hold every value a `numeric(15,2)` can. That is the right default for a
 * driver and the wrong one for a report: `{{ row.qty * row.rate }}` on two
 * strings is `NaN`, and `{{ row.amount|fmt('#,##0.00') }}` on a string is
 * whatever the formatter makes of it. Every invoice in the system would be
 * subtly wrong in a way that only shows up in the total.
 *
 * ── WHY THE TYPE OID AND NOT A LOOK-AT-THE-VALUE GUESS ─────────────────────
 *
 * A stored query has no declared field types — print_template_dataset carries
 * the SQL and nothing about its columns, deliberately, so that editing a query
 * cannot leave a stale field list behind. So the types come from the RESULT,
 * where PostgreSQL has already stated them exactly.
 *
 * Sniffing the value instead would be a bug generator with a long fuse: bill
 * number '0012345' is a string that parses as a number, and printing it as
 * 12345 loses the leading zeros on a legal document. A GSTIN, an HSN code, a
 * phone number and a pin code are all "numeric-looking text" whose leading
 * zeros or length matter. The OID knows the difference; a regular expression
 * never can.
 */

// PostgreSQL type OIDs. From pg_type; stable across versions by definition.
const OID = {
  BOOL: 16,
  INT8: 20,
  INT2: 21,
  INT4: 23,
  FLOAT4: 700,
  FLOAT8: 701,
  NUMERIC: 1700,
  JSON: 114,
  JSONB: 3802,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  DATE: 1082,
} as const;

const NUMERIC_OIDS = new Set<number>([OID.INT2, OID.INT4, OID.FLOAT4, OID.FLOAT8, OID.NUMERIC]);

const PASSTHROUGH_OIDS = new Set<number>([OID.JSON, OID.JSONB, OID.BOOL, OID.DATE]);

/**
 * A `bigint` that does not fit in a JavaScript number keeps its string form.
 *
 * `sb_bill_slno` is a BIGINT. Real ones are small and want to be numbers so
 * `{{ invoice.bill_slno }}` compares and formats; a value past 2^53 would lose
 * its last digits silently, and a document number that prints one digit wrong
 * is worse than one that prints as text.
 */
function coerceBigInt(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const text = toScalarText(value);
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : text;
}

function coerceByOid(value: unknown, oid: number): unknown {
  if (value === null || value === undefined) return null;

  if (NUMERIC_OIDS.has(oid)) {
    const parsed = typeof value === 'number' ? value : Number(value);
    // NaN would print as 'NaN' across the whole column. Null prints blank,
    // which reads as "this cell has no value" — which is what happened.
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (oid === OID.INT8) return coerceBigInt(value);

  // `timestamptz` IS an instant, and its round trip through UTC is correct.
  // ISO text is what the format transforms take.
  if (oid === OID.TIMESTAMP || oid === OID.TIMESTAMPTZ) {
    return value instanceof Date ? value.toISOString() : toScalarText(value);
  }

  // `date` already arrives as the text PostgreSQL wrote — see PgService's
  // DATE_AS_TEXT. A calendar date names no instant, so there is nothing for a
  // timezone to do to it.
  if (PASSTHROUGH_OIDS.has(oid)) return value;

  if (typeof value === 'bigint') return coerceBigInt(value);
  if (Array.isArray(value) || (typeof value === 'object' && value instanceof Date)) {
    return value instanceof Date ? value.toISOString() : value;
  }

  return typeof value === 'object' ? value : toScalarText(value);
}

/** One result set, coerced column by column using the types it declared. */
export function coerceResultRows<T extends QueryResultRow>(
  result: QueryResult<T>,
): Record<string, unknown>[] {
  const fields = result.fields.map((field) => ({ name: field.name, oid: field.dataTypeID }));

  return result.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      // A duplicated output column name — `SELECT a.id, b.id` — leaves only the
      // last one reachable, which is node-pg's own behaviour for the row object
      // and not something this can repair. It is named in the render warnings.
      out[field.name] = coerceByOid((row as Record<string, unknown>)[field.name], field.oid);
    }
    return out;
  });
}

/** Output column names that appear more than once, for a render warning. */
export function duplicateColumns<T extends QueryResultRow>(result: QueryResult<T>): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const field of result.fields) {
    if (seen.has(field.name)) duplicated.add(field.name);
    seen.add(field.name);
  }
  return [...duplicated];
}

/**
 * The same coercion for values a PROVIDER produced.
 *
 * Providers read through Prisma, which hands back `Decimal` for numeric and
 * `Date` for timestamps — different representations of the same two problems.
 */
export function coerceProviderValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return coerceBigInt(value);

  // Prisma's Decimal, duck-typed rather than imported: importing it here would
  // tie this file to the client's runtime for one method call.
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  ) {
    const parsed = (value as { toNumber(): number }).toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return value;
}

/** Every value of one provider row, coerced. */
export function coerceProviderRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = coerceProviderValue(value);
  }
  return out;
}
