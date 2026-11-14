# Item Ledger — `stock/reports/item-ledger`

Every movement of ONE item at ONE branch in posting order, with a running
balance from a true opening (menu 301, Reports › Stock Reports › Item Ledger).
Read-only: no table, column, function or trigger. Plan:
`Prathap/report/plan-item-ledger-2026-11-11.md` (answers Q1–Q3 at its end);
DB step: migration `20261111130000_item_ledger_report` (menus 300 / 301,
grants, the 9 `ITEM_LEDGER_*` wording rows, print purpose `ITEM_LEDGER`,
covering index `stock.ix_sml_item_ledger`).

## Routes — all `GET /api/v1/stock/reports/item-ledger…`, `{ success, message, data }`

| Route | Query | Serves |
| --- | --- | --- |
| `/options` | companyId, branchId, itemId | item facts (group, brand, HSN, GST %, tracked as, units, reorder level), the branch's godowns, the item's lots here, the report types it has here, last count date, FY of today, print / export rights |
| `/` | scope + `order` (asc / desc), `page` (≥ 1), `limit` (1–5,000, default 1,000) | head, opening, closing, totals, tiles, tie, periodTie, one page of rows, byType, stockNow |
| `/days` | scope | one row per day with rows, opening → closing chain, totals, periodTie |
| `/months` | scope **without `from`** | every month of the financial year of `to`, up to `to` (the last one `partial`), yearToDate |
| `/export` | scope + `order` | head, printedAs, opening, closing, totals and ALL rows (≤ 20,000, else 422 `ITEM_LEDGER_TOO_MANY_ROWS`) |

Scope = `companyId`, `branchId`, `itemId`, `from`, `to` (YYYY-MM-DD) +
optional `godownId`, `bucket` (SALEABLE default · DAMAGED · QUARANTINE ·
EXPIRED · SAMPLE · ALL), `lotId`, `unitId` (an `iuc_id`; default the base
unit), `valueAt` (WITHOUT_TAX default · WITH_TAX), `types` (comma list of
report types), `showReversed` (default true).

Every route checks VIEW on 301 first (403 `ITEM_LEDGER_RIGHT_VIEW`), then
refuses `RANGE_REVERSED`, `BRANCH_NOT_IN_COMPANY`, `ITEM_NOT_FOUND`,
`GODOWN_NOT_IN_BRANCH`, `LOT_NOT_OF_ITEM`, `UNIT_NOT_OF_ITEM` (all 422, with
the `ITEM_LEDGER_` prefix), and `/months` `NO_FISCAL_YEAR` (after the scope
checks). A malformed key is the house pipe's 400 `VALIDATION_*`. Ids are
lower-cased by the DTOs, so an upper-case uuid is the same id. No HTTP cache.

## The rules (where they live)

- **Opening** (D12) = Σ every ledger row of the holding before `from`, all
  years — `openingSql`, an index-only range scan on `ix_sml_item_ledger`.
- **Scope vs row filters** (D16): godown / bucket / lot define the holding
  (opening, balance, closing follow); `types` / `showReversed` only set
  `shown` — balances never move, the totals are "of the rows shown".
- **One display row** = document × type × godown × lot × bucket × reversal
  (`grp`). A sale bill is one row per lot (D5).
- **Reversals** stay in their type's column with a minus (D13). An original
  whose pair was reversed is `CANCELLED` or `AMENDED` (a later non-draft
  shadow of the same bill exists, D14) and carries `reversal`; the reversal
  row is `REVERSAL`, carries `reverses`, and sorts right after its original.
  `showReversed=false` hides only the pairs whose quantity AND value net to 0.
- **Internal moves** (D15): both legs of a godown transfer / bucket move in
  scope = ONE row, `kind` INTERNAL, `movedQty`, no received / issued. With one
  godown / bucket chosen the leg in scope is a real IN / OUT row.
- **Branch outward** is an issue here, with the transit state; branch inward
  is a receipt "← from-branch".
- **REVALUED** (D17): `stock_cost_revaluation` rows, value only, only at All
  godowns with Bucket = All / Saleable; otherwise they are out of the opening
  AND the period, and `head.revaluationsLeftOut` counts every one dated up to
  `to`.
- **Party**: a sale bill to the walk-in (`sales.default_customer_id`,
  resolved for company + branch) or to no customer is "Counter (cash)" unless
  the cashier typed another name (D6); purchases show the supplier and the
  supplier's invoice no.
- **The rows point to a stock voucher, not the bill**: `sml_src_doc_id` is a
  `svh_id`; the bill is `svh_link_src_*` (the page enrichment joins through
  it). `sml_src_refno` already carries the bill no.
- **Tie** (D25): only when `to` ≥ today (IST) — closing + in-scope rows dated
  after `to` against Σ `stock_balance.sbl_on_hand_qty` in scope. Since P2-IL
  also the value: `tie.stockNowValue` / `tie.valueEqual` (null when an in-scope
  row is dated after `to`); `tie.equal` stays the quantity.
- **Closing value = the stock engine's rule** (P2-IL, Stock Summary Q3,
  2026-11-14): `closing.value` / `closing.rate` = the holding in scope valued
  at the branch pool's rate (`reports/common/stock-valuation.sql.ts`, the
  Stock Summary's own helper), as `stock_balance` stores it. New keys:
  `closing.ledgerValue` (the rows' own sum — the running balance's last
  figure, the old `closing.value`) and `closing.costAdj` (= value −
  ledgerValue: re-averaging across buckets, a negative lot at its last cost
  rate, revaluations outside the scope). The opening, the running balance, the
  Day-wise / Month-wise chains and `yearToDate` stay the ledger's sums. Print
  head: + `closing_ledger_value`, `cost_adj`.
- **periodTie**: opening + received − issued = closing (`qtyEqual`) and the
  same for value (`valueEqual`), decided on the exact base numbers before the
  Qty-in unit and the 3 / 2 dp rounding, so a unit of 12 cannot show a false
  "≠". Both null when a row filter hides any row (`rowsShown` < `rows`).

`item-ledger.sql.ts` exports `ledgerScopeWhere`, `reportTypeCase` and
`openingSql` for the Stock Summary; `item-ledger.rules.ts` holds the same type
table in TypeScript (`reportTypeOf`), and the specs hold the two together.

Every response is ONE read-only REPEATABLE READ transaction with
`plan_cache_mode = force_custom_plan` and `jit = off` (JIT compiled the chain
for ~330 ms of a ~30 ms query on the dev box).

## Printing

Purpose `ITEM_LEDGER` (REPORT / ITEM_LEDGER). Providers
(`settings/print-render/data/providers/item-ledger.providers.ts`) call this
module's `export` in-process, through the same DTO. Prompts: `item_id`,
`from_date`, `to_date` (required), `branch_id` (blank = the session's),
`godown_id`, `bucket`, `lot_id`, `types`, `unit_id`, `value_at`,
`show_reversed`, `order`. The A4 landscape design is
`docs/print-templates/item-ledger-a4/` (not assigned yet: Printing
Assignments, menu 248).

- `reports.item_ledger.head` (one): `title`, `company_name`, `branch_name`,
  `item_code`, `item_name`, `item_label`, `printed_as`, `from_date`, `to_date`,
  `from_text`, `to_text`, `period_text`, `godown_name`, `bucket`, `batch_no`,
  `unit_name`, `value_at_text`, `opening_text`, `opening_qty`,
  `opening_value`, `opening_rate`, `opening_lots`, `received_qty`,
  `issued_qty`, `value_in`, `value_out`, `rows`, `rows_shown`, `docs`,
  `reversed_pairs`, `rows_note`, `closing_text`, `closing_qty`,
  `closing_value`, `closing_rate`, `closing_ledger_value`, `cost_adj`,
  `printed_at`, `printed_by`. The A4 design prints `cost_adj` as its own
  summary line (opening + in − out + cost adj. = closing value).
- `reports.item_ledger.rows` (many): `sl_no`, `seq`, `date_text`, `time`,
  `type_label`, `state`, `state_chip`, `greyed`, `doc_no`, `party_detail`,
  `godown`, `batch_no`, `received_qty`, `issued_qty`, `moved_text`,
  `balance_qty`, `cost_rate`, `cost_value`, `doc_rate`, `user`.
