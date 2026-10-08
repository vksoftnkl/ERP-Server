import { Prisma } from '@prisma/client';

/**
 * Loose search — "chillipowder", "chilli powder" and "POWDER chilli" all find
 * CHILLI POWDER.
 *
 * Both sides of every comparison go through `fixed.fn_search_norm` (migration
 * 20261002130000): lower-case, every run of white space and punctuation
 * removed. The typed text is split on white space here and each piece has to be
 * found in at least one of the searched columns (AND over pieces, OR over
 * columns). A piece is normalised INSIDE the query by the same SQL function, not
 * here, so the term and the stored value can never be normalised differently.
 *
 * Two builders share the rule:
 *   - `ConfiguredGridSqlService.buildSearchSql` (positional `$n` params for the
 *     pg pool) — every configured grid and dropdown.
 *   - `looseSearchSql` below (`Prisma.sql` fragment) — the hand-written
 *     `$queryRaw` searches.
 */
export const SEARCH_NORM_SQL_FUNCTION = 'fixed.fn_search_norm';

/** The most pieces one search is split into; the rest of a very long term is ignored. */
export const MAX_SEARCH_TOKENS = 8;

/**
 * The TypeScript twin of fixed.fn_search_norm, for deciding what is worth
 * sending (a piece that is only punctuation matches everything, so it is
 * dropped) and for de-duplicating pieces. The SQL side does the matching.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  return (text ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/**
 * The typed text as the distinct pieces a search has to find, in typing order.
 * Pieces are the raw white-space-separated words (the query normalises them);
 * a word that normalises to nothing, or repeats an earlier one, is dropped.
 */
export function splitSearchTokens(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const word of (text ?? '').trim().split(/\s+/)) {
    const key = normalizeSearchText(word);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    tokens.push(word);
    if (tokens.length === MAX_SEARCH_TOKENS) {
      break;
    }
  }
  return tokens;
}

/** `fixed.fn_search_norm(<expr>) LIKE '%' || fixed.fn_search_norm($n::text) || '%'` for a positional param. */
export function looseSearchPredicateSql(columnExpr: string, paramPlaceholder: string): string {
  return (
    `${SEARCH_NORM_SQL_FUNCTION}(${columnExpr}) LIKE ` +
    `'%' || ${SEARCH_NORM_SQL_FUNCTION}(${paramPlaceholder}::text) || '%'`
  );
}

// A column expression is a dotted identifier chain written in code
// (`itm.item_name_en`); anything else is refused so the raw splice below can
// never carry user input.
const COLUMN_EXPR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

/**
 * A `Prisma.sql` predicate for a hand-written `$queryRaw`: TRUE when there is
 * nothing to search for, else one `(col1 LIKE … OR col2 LIKE …)` group per
 * piece of the typed text, ANDed. Drop it in where `col ILIKE ${pattern}` was:
 *
 *     AND ${looseSearchSql(['itm.item_name_en', 'itm.item_code'], query.search)}
 *
 * `columnExprs` are code literals (dotted identifiers); a value that is not one
 * throws, so a caller cannot splice user input through here.
 */
export function looseSearchSql(
  columnExprs: readonly string[],
  search: string | null | undefined,
): Prisma.Sql {
  for (const expr of columnExprs) {
    if (!COLUMN_EXPR_PATTERN.test(expr)) {
      throw new Error(`looseSearchSql: "${expr}" is not a column identifier`);
    }
  }
  const tokens = splitSearchTokens(search);
  if (tokens.length === 0 || columnExprs.length === 0) {
    return Prisma.sql`TRUE`;
  }
  const groups = tokens.map((token) => {
    const perColumn = columnExprs.map(
      (expr) =>
        Prisma.sql`${Prisma.raw(`${SEARCH_NORM_SQL_FUNCTION}(${expr})`)} LIKE '%' || ${Prisma.raw(
          SEARCH_NORM_SQL_FUNCTION,
        )}(${token}::text) || '%'`,
    );
    return Prisma.sql`(${Prisma.join(perColumn, ' OR ')})`;
  });
  return Prisma.sql`(${Prisma.join(groups, ' AND ')})`;
}
