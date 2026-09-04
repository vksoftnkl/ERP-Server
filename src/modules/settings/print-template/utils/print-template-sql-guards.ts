import { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import { PTD_SQL_MAX_LENGTH, PTD_SQL_MIN_LENGTH } from '../print-template.constants';

/**
 * The eleven stored-SQL guards of §4, ported from the CHECK constraints to
 * TypeScript so a template author is refused when they SAVE rather than by a
 * constraint name when the database rejects the row.
 *
 * ── THESE ARE AN AUTHORING LINT, NOT A SECURITY BOUNDARY ──────────────────
 * The boundary is three runtime facts, and none of them live here: parameters
 * BOUND over the extended protocol (which makes a second statement
 * structurally impossible rather than merely filtered), the query run in a READ
 * ONLY transaction, and a role with no write privilege. Neither a CHECK nor
 * this file can parse SQL, and neither ever will.
 *
 * What this file buys is the error message. The constraint names are accurate
 * and unreadable — ck_ptd_sql_no_quoted_param fires on a case its own comment
 * calls a false positive — so every guard below returns a sentence that says
 * what to change.
 *
 * The database still has the final word: it recomputes ptd_sql_norm itself and
 * re-runs every one of these. This is the friendlier copy, not a replacement.
 */

/**
 * ptd_sql_norm, exactly as the GENERATED ALWAYS expression computes it.
 *
 * Order is load-bearing and matches the migration comment: comments are
 * stripped BEFORE literals, because a stray quote inside a comment would
 * otherwise mispair the literal scanner. The reverse case — a '--' inside a
 * literal — mangles the residue, which can only FAIL a good query, never pass
 * a bad one. Failing closed is the right direction.
 *
 * The PostgreSQL flags map onto JavaScript as:
 *   '/\*.*?\*​/'  'g'   — not newline-sensitive, so '.' spans newlines → [\s\S]
 *   '--.*$'      'gn'  — newline-sensitive, '$' at each line end   → m
 */
export function normalizeDatasetSql(sql: string | null | undefined): string {
  return (sql ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // 1. /* block */
    .replace(/--.*$/gm, ' ') // 2. -- to end of line
    .replace(/'(?:[^']|'')*'/g, ' @lit ') // 3. 'literal', '' escape included
    .replace(/"[^"]*"/g, ' @id ') // 4. "quoted identifier"
    .replace(/::/g, ' ') // 5. casts flattened
    .toLowerCase();
}

/** regexp_count(subject, pattern) — Postgres 15+, and there is no JS built-in. */
function countMatches(subject: string, pattern: RegExp): number {
  return subject.match(pattern)?.length ?? 0;
}

/**
 * Every SQL guard, in the order the constraints are declared, collected rather
 * than short-circuited so one bad query is answered with all of its problems.
 *
 * `field` names the DTO key, not the column, because that is what the caller
 * sent — the same convention the rest of the module's errors use.
 */
export function collectDatasetSqlErrors(
  sql: string,
  requiresCompany: boolean,
  field: string,
): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  const norm = normalizeDatasetSql(sql);
  const push = (message: string): void => {
    errors.push({ field, message });
  };

  // ck_ptd_sql_size — checked first: everything below reads better against a
  // query that is at least plausibly a query.
  if (sql.length < PTD_SQL_MIN_LENGTH || sql.length > PTD_SQL_MAX_LENGTH) {
    push(
      `${field} must be between ${PTD_SQL_MIN_LENGTH} and ${PTD_SQL_MAX_LENGTH} characters ` +
        `(this one is ${sql.length})`,
    );
    // A 3-character "sql" fails almost every guard below for no useful reason.
    return errors;
  }

  // ck_ptd_sql_no_dollar_quote. Checked against the RAW text: dollar quoting
  // defeats the literal scanner outright, so by the time it reaches the norm
  // the damage is already done.
  if (/\$[A-Za-z_0-9]*\$/.test(sql)) {
    push(
      'Dollar quoting ($$ … $$) is not allowed — it hides text from the normaliser that every ' +
        "other check reads. Use ordinary '…' literals.",
    );
  }

  // ck_ptd_sql_normalised. Nothing may survive the normaliser: a quote left in
  // the residue means the scanner mispaired something, so refuse rather than
  // guess what the query means.
  if (norm.includes("'") || norm.includes('"')) {
    push(
      "An unpaired quote survived normalisation. Check that every '…' literal is closed and " +
        "that a literal apostrophe is doubled ('it''s'), and that every \"identifier\" is closed.",
    );
  }

  // ck_ptd_sql_no_residual_comment
  if (/\/\*|\*\//.test(norm)) {
    push(
      'An unterminated or nested block comment was left behind. PostgreSQL allows /* nested */ ' +
        'comments, which this stripper deliberately does not — remove them.',
    );
  }

  // ck_ptd_sql_single_statement. Literals are already tokens by now, so a
  // semicolon inside a string cannot reach this. One trailing ';' is allowed.
  if (/;/.test(norm.replace(/\s*;\s*$/, ''))) {
    push('Only one statement is allowed. A single trailing ";" is fine, anything after it is not.');
  }

  // ck_ptd_sql_read_only_start. A leading '(' allows (SELECT …) UNION (SELECT …).
  if (!/^\(*\s*(select|with)\b/.test(norm.trim())) {
    push('A dataset query must start with SELECT or WITH.');
  }

  // ck_ptd_sql_no_write. With one-statement and SELECT-only already enforced,
  // the only remaining way to write is a data-modifying CTE. The list is short
  // on purpose: a long blacklist is a false-positive machine, and every false
  // refusal teaches somebody to work around the guard.
  const write = norm.match(/\b(insert|update|delete|merge|truncate|copy|grant|revoke)\b/);
  if (write) {
    push(
      `A dataset query may not write. Found "${write[1]}" — a data-modifying CTE is still a ` +
        'write. If the word is part of a column name such as last_updated_on, it is safe and ' +
        'this guard did not fire on it.',
    );
  }

  // ck_ptd_sql_no_escape. A blacklist, and blacklists lose; this exists to make
  // the common mistake loud. The read-only role is what makes it not matter.
  const escape = norm.match(
    /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink|dblink_exec|pg_sleep|pg_terminate_backend|pg_cancel_backend|set_config|current_setting|pg_authid|pg_shadow)\b/,
  );
  if (escape) {
    push(
      `"${escape[1]}" reaches outside the query — the filesystem, the network or the catalog — ` +
        'and is not allowed in a dataset query.',
    );
  }

  // ck_ptd_sql_param_shape. Parameters are :name and nothing else.
  // Known false positive, accepted upstream and repeated here: an array slice
  // arr[2:5]. Say so, rather than leaving the author to work it out.
  if (/:(?![a-z_])/.test(norm)) {
    push(
      'A ":" that is not a parameter. Parameters are :name — lower case, starting with a letter ' +
        'or underscore. Note that an array slice such as arr[2:5] trips this too; rewrite it ' +
        'with a function.',
    );
  }

  // ck_ptd_sql_no_quoted_param — THE 3.0 BUG, named. Its stored SQL contained
  // ':iacc_year' WITH the quotes inside the SQL, because parameters were a
  // string replace rather than a binding.
  //
  // Counting rather than pattern-matching is what makes it exact: any :name
  // present in the raw text but ABSENT from the norm was inside a literal. The
  // constraint's own comment records the false positive this shares — a :name
  // inside a '--' comment counts the same way — and asks the service layer for
  // a better message than the constraint name gives. This is that message.
  if (countMatches(sql.replace(/::/g, ' '), /:[A-Za-z_]/g) !== countMatches(norm, /:[A-Za-z_]/g)) {
    push(
      'A parameter is written inside a string literal or a comment. Parameters are BOUND, not ' +
        "pasted: write  x = :company_id , never  x = ':company_id' . (A :name mentioned in a " +
        '"--" comment reads the same way to this check — move it out of the comment.)',
    );
  }

  // ck_ptd_sql_company_scoped — THE CHECK 3.0 MOST NEEDED AND NOBODY WROTE. In
  // a chain, a query that is not company-scoped shows one company another
  // company's numbers.
  if (requiresCompany && !/:company_id\b/.test(norm)) {
    push(
      'The query must be company-scoped: bind :company_id somewhere in it. Set ' +
        'ptdRequiresCompany to false only for genuinely global data, such as a state-code list. ' +
        '(If it IS scoped, check for a "--" inside a string literal — that mangles the residue ' +
        'this check reads.)',
    );
  }

  return errors;
}
