# Stock Summary — `stock/reports/summary`

Item-wise opening · inward · outward · closing with value, for ONE branch and a
period (menu 302, Reports › Stock Reports › Stock Summary). Read-only: no
table, column, function or trigger. Plan:
`Prathap/report/plan-stock-summary-2026-11-13.md` (answers Q1–Q4 at its end);
DB step: migration `20261115100000_stock_summary_report` (menu 302, grants,
the 12 `STOCK_SUMMARY_*` wording rows, print purpose `STOCK_SUMMARY`,
ui_tables 78 / 79). Real JSON keys: `Prathap/report/stock-summary-keys-2026-11-14.md`.

## Routes — all `GET /api/v1/stock/reports/summary…`, `{ success, message, data }`

| Route | Query | Serves | SQL |
| --- | --- | --- | --- |
| `/options` | companyId, branchId | company, branch, its live godowns, buckets, today (IST), FY, defaults (1st of the month → today …), print / export rights | yes |
| `/` (Show) | scope + view | computes the Item-wise **run**, keeps it, answers page 1: head (runId, asOf, expiresAt, todayOnly …), tiles, totals, totalsShown (the view's, as /rows), tie, transitOut, rows, page, view | yes |
| `/rows` | runId (+ companyId) + view | another page / sort / filter / Find of a run (Item-wise or Branch-wise rows) + totalsShown | **no** |
| `/item` | scope + itemId (+ runId) | item facts, Lots & godowns, Movement (the Item Ledger's By voucher type) | yes |
| `/groups` | runId, groupBy, hideZero, onlyNegative, show | Group summary by GROUP / BRAND / SECTION / CATEGORY | **no** |
| `/godowns` | runId + view | one qty column per godown + value; rows carry `otherCompany`, `defaultUnitId` (as Item-wise, for Enter) | **no** |
| `/branches` | scope **without godownId** + view | opens a Branch-wise run: one column per branch + in transit + chain; rows carry `otherCompany`, `defaultUnitId` | yes |
| `/export` | runId, tab (ITEMS / GROUPS / GODOWNS / BRANCHES) + view | every row of the tab, no paging, + printedAs | **no** |

"No SQL" = nothing but the rights row (`user_menus`), proved in
`stock-summary.service.spec.ts` (the Prisma mock sees only `rights`).

Scope = `companyId` (any company, Q2 — no check of the user against it, as
the Item Ledger), `branchId`, `from`, `to` (YYYY-MM-DD) + optional `godownId`,
`groupId`, `brandId` (each with its whole subtree, walked by parent id),
`bucket` (SALEABLE default · DAMAGED · QUARANTINE · EXPIRED · SAMPLE · ALL),
`valueAt` (WITHOUT_TAX default · WITH_TAX), `qtyIn` (BASE default · DEFAULT
= each item's `iuc_is_default_unit`), `noSaleDays` (1–3,650, default 60).
View = `sort` (name · code · group · brand · opening · inward · outward ·
closing · reserved · available · inTransit · rate · value · lastSale), `dir`,
`page`, `limit` (1–5,000, default 500), `hideZero` (default true),
`onlyNegative`, `show` (ALL · NEGATIVE · NON_SALEABLE · IN_TRANSIT · RESERVED ·
NO_SALE · NOT_TIED), `find` (≤ 60: code, name, barcode, SKU), `groupBy` +
`groupKey` (the Group summary drill; `NONE` = its "(No …)" line; on `/export`
with tab GROUPS `groupBy` is the "Summarise by").

Every route checks VIEW on 302 first (403 `STOCK_SUMMARY_RIGHT_VIEW`;
`/export` also EXPORT → `_RIGHT_EXPORT`; print PRINT → `_RIGHT_PRINT`), then
refuses `RANGE_REVERSED`, `BRANCH_NOT_IN_COMPANY`, `GODOWN_NOT_IN_BRANCH`,
`GROUP_NOT_FOUND`, `BRAND_NOT_FOUND`, and on `/item` `ITEM_NOT_FOUND` (all 422,
`STOCK_SUMMARY_` prefix). A deleted branch / godown (`br_is_deleted` /
`gdl_is_deleted`) is refused as not in the company / branch, as a deleted
group / brand is (review N7). Show / `/branches` past 50,000 items → 422
`TOO_MANY_ITEMS`; `/export` past 20,000 rows → 422 `TOO_MANY_ROWS`. A run that
is gone → 410 `STOCK_SUMMARY_RUN_EXPIRED` (the screen re-runs Show once,
silently). A malformed key is the house pipe's 400 `VALIDATION_*`
(`godownId` on `/branches` = `VALIDATION_WHITELIST`). No HTTP cache.

## The rules (where they live)

- **Value = the stock engine's rule** (D18), `reports/common/stock-valuation.sql.ts`
  (`poolValuationCtes`): qty × the branch POOL's rate — one pool per (branch,
  item) for a plain item (WAVG), per (branch, item, lot) for a tracked one
  (LOT_ACTUAL); rate = ROUND(pool value incl. revaluations ÷ pool qty, 6) while
  qty > 0, else the latest LIVE row's cost rate (0 when every holding is 0).
  Opening value at `from − 1`, closing value at `to`. At today it equals
  `stock_balance` holding for holding (Coimbatore 2026-11-14: 982 / 982,
  189,027.20 all buckets, 178,101.41 Saleable). The Item Ledger's closing value
  uses the same helper (P2-IL).
- **Inward / outward value** = the ledger rows' cost values; **costAdj** =
  value − (openingValue + inwardValue − outwardValue), exact: re-averaging
  across buckets / godowns, revaluations, a negative pool at its last rate.
- **Inward / outward by type, not sign** (D9): a reversal keeps its natural
  direction with a minus. **Internal moves** (D10): both legs of a godown
  transfer / bucket move IN SCOPE are one internal pair and net — the Item
  Ledger's own rule (`mv`), so the Movement pane and the row agree on
  quantities; with one godown / bucket chosen, the leg in scope is a real
  inward / outward.
- **One pass** (`passSql`): the holdings before `from` (index-only skip scan on
  `ix_sml_item_ledger`), the period rows, every godown and bucket (the pool
  needs them; the scope is the `ins` flag), both valuations; answered in three
  parts (H / O / C) merged in TypeScript (`mergePass`).
- **Today-only** (D17, `to` ≥ today IST): reserved, available, in transit (to
  this branch, `stock_transit` IN_TRANSIT / PARTIAL), the EXPIRY chip and the
  tie. Otherwise null / absent.
- **Which items are rows** (D26 + "List the item", user 2026-11-14): every item
  with a ledger row at the branch up to `to` (in the group / brand filter), AND,
  when `to` ≥ today, every item with goods on the road TO this branch in scope
  (company, bucket, godown via `stt_to_godown_id`, group, brand) even with no
  ledger row here. Such a row has opening / inward / outward / closing / value
  0, its `inTransit` set, reserved / available from `stock_balance` (else 0),
  no NO SALE / NEVER SOLD chip (closing is 0, D28) and ties (0 = 0). It is in
  `tiles.inTransitIn` and in `show=IN_TRANSIT`; Hide zero keeps it. A past
  `to` adds none (in transit is today-only there). The sender's side and
  Branch-wise are unchanged (D21).
- **Tie** (D19): per item, closing + the in-scope rows dated after `to` =
  Σ `sbl_on_hand_qty` in scope; the value = Σ stored value when no such row.
- **Goods in transit** (D21): `transitOut` (sent from this branch, not received)
  from `stock_transit` today, replayed from the ledger for a past `to`
  (`transitReplaySql`: sent − received − settled short by the CLOSED step).
  Never `stt_short_qty <> 0` (a recalled row carries one).
- **Chips**: NEGATIVE; EXPIRY {date, days, tone RED ≤ 3 / AMBER} (the nearest
  saleable lot with stock within `item_intimate_before_days` > 0); NO_SALE
  {days} / NEVER_SOLD (closing > 0); OTHER_COMPANY; NOT_TIED.
- **Non-saleable** (tile, `nonSaleableValue`): the godown scope's stock in a
  bucket other than Saleable that the bucket scope leaves out (none at ALL).
  A row is non-saleable (the tile's count and the NON_SALEABLE filter alike)
  when such a holding has a quantity or a value — also stock at cost 0
  (review N6). Under `show=NON_SALEABLE` Hide zero keeps such a row even when
  it is zero in the bucket scope (stock only in Damaged …), as it keeps a row
  in transit: the click always lists what the tile counts (user 2026-11-14).
  Under every other `show` Hide zero is unchanged.

## The run store (D20)

`StockSummaryRunStore`: process memory (Redis is optional here, and a run is
one Show's cursor, not a cache). 15 min idle (each read renews), 4 runs per
user, 40 runs / 100,000 rows in all (LRU); a run answers only its own user
(and company, when named). A restart loses every run (410 → Show again).
**One API process today** (`ecosystem.config.js`: one fork). If the API is ever
clustered, runs need sticky routing or a shared store.

## Printing

Purpose `STOCK_SUMMARY` (REPORT / STOCK_SUMMARY). Providers
(`settings/print-render/data/providers/stock-summary.providers.ts`) read the
screen's run by `run_id` (no second computation), else build ONE run from the
prompts, shared by the head and rows of the render: the build's promise is kept
per (user, prompts) for a minute BEFORE it settles, so the two datasets the
print engine resolves at once share one computation and one slot of the 4-run
cap; a refused build is not kept (review S1). VIEW + PRINT on 302.
Prompts: `run_id`, `from_date`, `to_date`, `branch_id` (blank = the
session's), `godown_id`, `group_id`, `brand_id`, `bucket`, `value_at`,
`qty_in`, `no_sale_days`, `hide_zero`, `only_negative`, `show`, `find`,
`sort`, `dir`, `group_by` + `group_key` (the Group summary drill, as on
`/rows`; with `run_id` alone the view prompts still apply, and printedAs names
the drill). Company = the render's docId when it is a uuid (the screen's
Company dropdown), else the session's. A4 landscape design:
`docs/print-templates/stock-summary-a4/` (not assigned yet: menu 248).

- `reports.stock_summary.head` (one): `title`, `company_name`, `branch_name`,
  `printed_as`, `period_text`, `as_of_text`, `bucket`, `value_at_text`,
  `qty_in_text`, `items_text`, `closing_value`, `opening_value`,
  `inward_value`, `outward_value`, `cost_adj`, `transit_out_text`, `tie_text`,
  `printed_at`, `printed_by`.
- `reports.stock_summary.rows` (many): `sl_no`, `code`, `name`, `group`,
  `unit`, `opening`, `inward`, `outward`, `closing`, `today_only`, `reserved`,
  `available`, `in_transit`, `rate`, `value`, `last_sale`, `chips_text`,
  `negative`.

## Measured (Coimbatore, 9,591 ledger rows, 982 holdings, 48 items, 2026-11-14)

Show 01/11 → today p95 121 ms (the pass ~80 ms in psql); a whole-year Show
110 ms; a past To 88 ms; `/rows`, `/groups`, `/godowns`, `/export` 2–5 ms;
`/item` 41–69 ms; `/branches` today 15 ms, past (company replay) 52 ms. Every
valuation CTE is MATERIALIZED: inlined, the planner nested-looped the fallback
probe per joined row (over 60 s).
