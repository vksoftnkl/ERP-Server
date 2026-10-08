# Loose search — "chillipowder" finds CHILLI POWDER (2026-10-02)

The report: searching anywhere in the application for `chillipowder` found nothing, though the
item is `CHILLI POWDER`. The user wants whatever is typed to find the thing, across the whole
application, with the server doing the work.

## Why it failed

Every search compared the typed text with the stored text as-is, case-insensitively:
`value ILIKE '%chillipowder%'`. One space in the stored name — or a hyphen, a dot, `200 g` vs
`200g` — and nothing matches. Word order mattered too (`powder chilli` found nothing).

Where the comparisons live (server):

| Path | What it serves | Rows compared with |
|---|---|---|
| `ConfiguredGridSqlService.buildSearchSql` | **every configured grid** (`/configured-grid-sql/run` — all master lists, bill/order/quotation/receipt lists) and **every configured dropdown** (`/dropdown-details/run` — all lazy pickers) in BOTH clients | `grid_kv.value ILIKE '%<typed>%'` over the searchable columns |
| 8 hand-written `$queryRaw` searches | stock adjustment item picker, price-bulk grid, voucher ledger lookup, ledger statement, temp credit, stock voucher ref, batch / serial stock | `col ILIKE '%<typed>%'` |
| ~100 Prisma `contains … mode: 'insensitive'` | the per-module `GET /<master>/get?search=` list routes | Prisma compiles them to `ILIKE '%<typed>%'` |
| Client-side filters | React selects loaded up front (`dynamic-modal-form`, `searchable-select`, `searchable-multi-select`); Qt `NexGridProxy` | lower-case `includes` (React); Qt already strips ` ^*.-/+` |

## The rule

One normalisation, applied to BOTH sides of every comparison, inside the database:

```sql
fixed.fn_search_norm(txt) = regexp_replace(lower(txt), '[[:space:][:punct:]]+', '', 'g')
```

lower-case, every run of white space and punctuation removed. Letters of any script survive.
The typed text is split on spaces and **every piece must be found** in at least one searched
column (AND over pieces, OR over columns), so:

| typed | finds |
|---|---|
| `chillipowder`, `Chilli Powder`, `powder chilli`, `chilli-powder.` | CHILLI POWDER |
| `smsauce00012`, `sm-sauce 00012` | …Chilli Sauce 200 g SM-SAUCE-00012 |
| `200g` | …200 g… |
| `chilli sauce` | only rows carrying both words (in any column) |
| ` - / ` (punctuation only) | treated as no search |

The piece is normalised by the SQL function too (`LIKE '%' || fixed.fn_search_norm($n) || '%'`),
never in TypeScript, so the two sides cannot drift (glibc's `[[:punct:]]` and JS `\p{P}` differ
on some combining marks). Because `%`, `_` and `\` are punctuation, a normalised term needs no
LIKE escaping.

## Done (this change)

Server (`~/Dev/erp/ERP server`):

- `prisma/migrations/20261002130000_search_norm_function` — `fixed.fn_search_norm(text)`,
  IMMUTABLE / PARALLEL SAFE (index-able later). **Applied to dev.** Reaches live through the
  normal `prisma migrate deploy` in deploy.sh; plain SQL, no extension, no data.
- `src/common/search/loose-search.ts` (+ spec, 12 cases) — `splitSearchTokens`,
  `looseSearchPredicateSql` (positional `$n` form for the pg pool), `looseSearchSql`
  (`Prisma.sql` form for `$queryRaw`; refuses a column expression that is not an identifier
  chain, so no user input can be spliced).
- `ConfiguredGridSqlService.buildSearchSql` — one `EXISTS … key = ANY($cols::text[]) AND
  fn_search_norm(value) LIKE …` per piece, ANDed. Spec updated (+3 cases). This alone covers
  every master list and picker in Qt and React.
- The 8 `$queryRaw` searches above now use `looseSearchSql(...)`.
- `test/loose-search-http.e2e-spec.ts` — through the real HTTP stack: dropdown 42 ITEMS and grid
  "MAIN LIST - ITEMS" find a two-word item typed squashed, reversed and with punctuation; a word
  the name lacks excludes it. Read-only, self-selecting (any live `Word Word` item).
- Unit: configured-grid-sql 2 suites + search + stocks/vouchers/reports/temp-credit — 514 passed;
  `tsc` clean.

React client (`~/Dev/erp/ERP client`, dev):

- `lib/search-text.ts` (+ vitest, 5 cases) — the same rule for selects that filter in the browser;
  used by `dynamic-modal-form.tsx`, `searchable-select.tsx`, `searchable-multi-select.tsx`. `tsc` clean.

Qt: no change needed — `NexGridProxy::stripSpecialChars` already removes spaces and `^*.-/+`
before a case-insensitive match, and its server-fed lists get the rule from the server.

## Not done — the remaining paths

| # | Path | Why it matters | How |
|---|---|---|---|
| R1 | ~100 Prisma `contains`/`insensitive` list routes (`GET /<master>/get?search=`) | Prisma cannot call a SQL function in `where`. Most React masters moved to configured grids ("Configuration by name"), and Qt uses grids only, so these are mostly the older routes — but anything still calling them searches strictly. | Shared helper `looseSearchIds(prisma, { table, idColumn, columns, search, extraWhere })` → `$queryRaw` for the ids, then the module's `findMany({ where: { id: { in } } })` keeps its shape. Convert the routes a client actually sends `search` to first (grep the two clients for the route + `search`); leave the rest. |
| R2 | Typos — `chily powder`, `chilli poder` | Normalisation does not fix a missing or wrong letter. | `CREATE EXTENSION IF NOT EXISTS pg_trgm` (trusted; works as the DB owner on live) in a migration; when the strict pass returns 0 rows and the term has ≥ 4 characters, re-run with `word_similarity(fn_search_norm(term), fn_search_norm(value)) >= 0.5`, ordered by similarity. Two queries only on a miss; ranking changes on that fallback only. Decide the threshold with real names. |
| R3 | Speed on big tables | `fn_search_norm(col) LIKE '%x%'` cannot use a b-tree, same as the ILIKE it replaces (so no regression — 10k items answer in ~40 ms). | If an item or ledger list ever drags: `CREATE INDEX … USING gin (fixed.fn_search_norm(item_name_en) gin_trgm_ops)` (needs R2's extension); the function is IMMUTABLE for exactly this. |
| R4 | Ranking | Rows are returned in the grid's own order; a name that STARTS with the typed text does not float up (Qt's local StartsWith mode does that). | Optional `ORDER BY (fn_search_norm(name) LIKE 'term%') DESC` ahead of the configured sort, grids only. |
| R5 | Qt local filters beyond `NexGridProxy` | Any Qt completer / combo that filters with plain `Qt::MatchContains` keeps the strict rule. | Grep for `MatchContains` / `setFilterFixedString` and route them through `stripSpecialChars`. |

## Behaviour changes to know

- A search made only of spaces and punctuation now returns everything (it used to return rows
  containing that punctuation).
- Numbers are matched without their punctuation: `12.5` finds `12.50` and `125`.
- Every typed word is required. Before, `chilli powder` was one phrase and `powder chilli` found
  nothing; now both find CHILLI POWDER, and `chilli sauce` no longer finds a plain chilli powder.
