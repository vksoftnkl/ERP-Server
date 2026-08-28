/**
 * `:name` → `$n`, over the extended protocol.
 *
 * ── THIS IS THE BOUNDARY, NOT THE LINT ─────────────────────────────────────
 *
 * §4 is emphatic that the eleven `ck_ptd_sql_*` guards are an authoring lint:
 * "The boundary is three runtime facts, and none of them live here: parameters
 * BOUND over the extended protocol (which makes a second statement structurally
 * impossible rather than merely filtered), the query run in a READ ONLY
 * transaction, and a role with no write privilege."
 *
 * This file is the first of those three. It never interpolates a value into
 * SQL — not a quoted one, not an escaped one, not a uuid it has checked the
 * shape of. It rewrites the parameter SYNTAX and hands the values to node-pg
 * separately, so what reaches PostgreSQL is one parse of one statement with a
 * value list beside it. A value cannot become syntax, which is a stronger
 * statement than any amount of filtering can make.
 *
 * That is also why it re-does work the guards already did. The guards run when
 * an author SAVES; this runs when a counter PRINTS, against a row that may have
 * been written by an older build, restored from a backup, or edited in the
 * database by hand. It assumes nothing about what has already been checked.
 *
 * ── THE 3.0 BUG THIS ENDS ──────────────────────────────────────────────────
 *
 * 3.0's stored SQL contained `':iacc_year'` — the parameter WITH quotes, inside
 * the query — because parameters were a string replace. Everything downstream
 * of a string replace is a matter of how carefully the replacing was done. Here
 * a `:name` inside a literal is not a parameter at all: the scanner is inside a
 * string when it meets it, so it is left exactly as written and the query says
 * what it says.
 */

export interface BoundQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
  /** Parameter names actually bound, in `$1..$n` order. */
  readonly bound: readonly string[];
}

export class DatasetBindError extends Error {
  constructor(
    message: string,
    readonly unknownParams: readonly string[] = [],
  ) {
    super(message);
    this.name = 'DatasetBindError';
  }
}

/**
 * Every `:name` in the query that is really a parameter, in order of first
 * appearance.
 *
 * A hand-written scanner rather than a regular expression, because the three
 * things that must NOT yield a parameter are all context, and context is what a
 * regular expression does not have:
 *
 *   'text with :name'      a literal — including the '' escape inside one
 *   "col :name"            a quoted identifier
 *   -- :name  /* :name *​/  a comment, either kind
 *   value::type            a cast, which is two colons and not a parameter
 *
 * `arr[2:5]`, an array slice, is the one construct that reads like a parameter
 * and is not. It is left alone here (nothing follows the colon that could be a
 * name) and refused by the save-time guard, which is the right place to explain
 * it — see ck_ptd_sql_param_shape.
 */
export function scanParams(sql: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    // '…' literal. Two consecutive quotes inside are one escaped quote, and
    // the loop below stays inside the literal for them.
    if (char === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'") {
          if (sql[index + 1] === "'") {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    // "…" quoted identifier, with the same "" escape.
    if (char === '"') {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === '"') {
          if (sql[index + 1] === '"') {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    // -- to end of line.
    if (char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') index += 1;
      continue;
    }

    // /* … */. PostgreSQL nests these; the save guard refuses nesting, and
    // this scanner tracks depth anyway so that a nested comment cannot end
    // early and expose its tail to parameter scanning.
    if (char === '/' && next === '*') {
      let depth = 1;
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql[index] === '/' && sql[index + 1] === '*') {
          depth += 1;
          index += 2;
          continue;
        }
        if (sql[index] === '*' && sql[index + 1] === '/') {
          depth -= 1;
          index += 2;
          continue;
        }
        index += 1;
      }
      continue;
    }

    // A cast, not a parameter.
    if (char === ':' && next === ':') {
      index += 2;
      continue;
    }

    if (char === ':' && next !== undefined && /[a-zA-Z_]/.test(next)) {
      let end = index + 1;
      while (end < sql.length && /[a-zA-Z0-9_]/.test(sql[end])) end += 1;
      const name = sql.slice(index + 1, end);
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
      index = end;
      continue;
    }

    index += 1;
  }

  return names;
}

/**
 * Rewrite the query's parameters as `$n` and collect their values.
 *
 * `values` is the ONLY source of a value. A name the query uses and this map
 * does not hold is refused rather than bound to null: a report whose
 * `:from_date` silently became NULL returns no rows, and "the report is empty"
 * is the hardest possible bug to trace back to a spelling mistake in a
 * parameter name.
 */
export function bindDatasetSql(sql: string, values: Readonly<Record<string, unknown>>): BoundQuery {
  const names = scanParams(sql);
  const unknown = names.filter((name) => !Object.prototype.hasOwnProperty.call(values, name));

  if (unknown.length > 0) {
    throw new DatasetBindError(
      `The query binds ${unknown.map((name) => `:${name}`).join(', ')}, which nothing supplies. ` +
        `Bindable here: ${Object.keys(values)
          .sort()
          .map((name) => `:${name}`)
          .join(', ')}. ` +
        'Context parameters are a closed set; anything else must be declared as an operator ' +
        'prompt on the revision (ptvParams).',
      unknown,
    );
  }

  const ordinal = new Map<string, number>();
  names.forEach((name, position) => ordinal.set(name, position + 1));

  // A second pass with the same scanner, so the rewrite and the scan cannot
  // disagree about what a parameter is. Rebuilt rather than regex-replaced:
  // replacing `:doc_id` textually would also hit `:doc_id` inside a literal,
  // which is exactly the class of bug this module exists to end.
  let out = '';
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "'" || char === '"') {
      const quote = char;
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === quote) {
          if (sql[end + 1] === quote) {
            end += 2;
            continue;
          }
          end += 1;
          break;
        }
        end += 1;
      }
      out += sql.slice(index, end);
      index = end;
      continue;
    }

    if (char === '-' && next === '-') {
      let end = index;
      while (end < sql.length && sql[end] !== '\n') end += 1;
      out += sql.slice(index, end);
      index = end;
      continue;
    }

    if (char === '/' && next === '*') {
      let depth = 1;
      let end = index + 2;
      while (end < sql.length && depth > 0) {
        if (sql[end] === '/' && sql[end + 1] === '*') {
          depth += 1;
          end += 2;
          continue;
        }
        if (sql[end] === '*' && sql[end + 1] === '/') {
          depth -= 1;
          end += 2;
          continue;
        }
        end += 1;
      }
      out += sql.slice(index, end);
      index = end;
      continue;
    }

    if (char === ':' && next === ':') {
      out += '::';
      index += 2;
      continue;
    }

    if (char === ':' && next !== undefined && /[a-zA-Z_]/.test(next)) {
      let end = index + 1;
      while (end < sql.length && /[a-zA-Z0-9_]/.test(sql[end])) end += 1;
      const name = sql.slice(index + 1, end);
      out += `$${ordinal.get(name)}`;
      index = end;
      continue;
    }

    out += char;
    index += 1;
  }

  return {
    sql: out,
    params: names.map((name) => values[name]),
    bound: names,
  };
}

/**
 * Cap the result IN SQL rather than by slicing what came back.
 *
 * The point of ptd_row_limit is to stop PostgreSQL materialising a million
 * rows, not to hide them after it has. The wrapper takes the next ordinal, so
 * the limit is a bound parameter too.
 *
 * One row is read for a MASTER dataset — it is "the header context, one row
 * read" — and asking for two would only make the truncation flag lie.
 */
export function withRowLimit(bound: BoundQuery, limit: number): BoundQuery {
  const ordinal = bound.params.length + 1;
  return {
    // Named `ptd_rows` so a PostgreSQL error message about the subquery points
    // at something the reader can find in this file.
    sql: `SELECT * FROM (${bound.sql}) AS ptd_rows LIMIT $${ordinal}`,
    params: [...bound.params, limit],
    bound: bound.bound,
  };
}
