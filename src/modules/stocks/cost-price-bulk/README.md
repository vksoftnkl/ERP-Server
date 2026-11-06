# CostPriceBulkModule — Cost Price – Bulk Change, menu 298

Plan: `Shared/Prathap/schema/stock/plan-cost-price-bulk-change-2026-11-05.md` (§0 decisions,
§1 writer change, §3 API), mockup `bulk_cost_change_mockup.png` beside it. DB phase:
migration `20261105120000_cost_price_bulk_change` (menu 298 VIEW / EDIT, `ck_ipcl_source` +
`BULK_COST_CHANGE`, ui_table 67, the `COST_BULK_*` wording rows). Ports 3.0 menu 176.

**What it is for.** A wholesale shop has no time to key the whole purchase bill. It types the
new cost; each unit's selling prices follow that unit's own rule (`ipm_profit_type`: By % /
By Rs / By User). **The client computes the rule** (and the round-up, and the child units
following their parent); the server checks and writes what it is sent. Price wins: the
w/o-tax figures and markups are recomputed from each price against the new cost.

Three routes, none cached (live prices, per user rights and per company):

| Route | Right (menu 298) | What it is |
|---|---|---|
| `GET /api/v1/stock/cost-bulk` | VIEW | the grid + `leftOut[]`; `itemId` = the blank-row add (422 with the reason when it may not load) |
| `POST /api/v1/stock/cost-bulk/validate` | EDIT | every refusal and warning, nothing written, no lock |
| `POST /api/v1/stock/cost-bulk` | EDIT | the save: lock, re-check, write in place, log + audit, one transaction |

## Who is on the grid ("Plain stock")

An item is loaded when it is active, its **effective track preset** (its own
`item_track_preset_id`, else its group's `itg_track_preset_id`) is NULL or tracks none of
batch / MRP / sale price / serial, and the old batch tick `item_is_batch_based` is off. One row
per **active** unit (`iuc_is_active`, not deleted) with a **headline** price row
(`ipm_key_mrp = -1 AND ipm_key_sp = -1`) **in force today at this branch**: not deleted,
`effective_from ≤ CURRENT_DATE ≤ effective_to`, this company or shared, this branch or all
branches — the branch row before the chain row (`priceScope` BRANCH / CHAIN). Item scope is
menu 30's: `item_company_id` this company or NULL, `item_branch_id` this branch or NULL.

`leftOut` (page 1 only, at most 1,000; `leftOutTotal` and `leftOutCounts` count all) names, for
the same filters, each item that is not Plain stock once (`NOT_PLAIN_STOCK` — the preset —
or `OLD_BATCH_TICK`) and each active unit of an eligible item with no price row
(`NO_PRICE_ROW`). `INACTIVE` appears only in one-item mode (a list never reads inactive
items). The rule filter (`profitType`) is not applied to it: a left-out unit has no rule.

`leftOutReasonOf` (rules, TS) and `LEFT_OUT_REASON_SQL` (gateway) are the same rule — change
both together.

**Child units.** `parentUomId` = the previous active unit by `iuc_unit_slno`;
`unitsPerParent` = parent `iuc_to_base_factor` ÷ this one's — the keyed `iuc_unit_factor`
when the two agree within a RELATIVE 1e-4 of it (to-base factors are stored to 6 dp, so
0.083333 ÷ 0.000744 = 112.0067 for a keyed 112), else the ratio with `factorsAgree: false`. Child cost = parent new cost ÷ `unitsPerParent`
(client). Paging is by rows, so a parent may sit on an earlier page: the client loads every
page before it follows children.

**Shared rows.** A row with `ipm_company_id` NULL is shared by every company. It is shown
(it is what is in force; `companyShared: true`) but never rewritten in place — see "What a save
writes".

**Price levels.** `levels[].active` is `fixed.price_levels.price_lvl_is_active` (not
deleted) for 1–4 — the house list the item card, menu 30 and quick rate use, NOT
`inventory.item_price_levels.ipl_status`. The screen shows only active levels; the checks
judge only active levels.

**Scheduled.** `scheduledFrom` = the first day after today on which a LATER row takes over at
this branch for this company: any headline row visible here (branch or chain, company or
shared) that starts after today and is, on its first day, the row that answers (branch before
chain, company before shared).

## The save, per row (`planRow`, pure)

1. **The row itself** — any of these and nothing else is judged:
   not there / deleted / not a headline / its item or unit gone / another company's or
   branch's → `COST_BULK_ROW_NOT_CURRENT`; item inactive → `COST_BULK_INACTIVE`; not Plain
   stock → `COST_BULK_NOT_PLAIN_STOCK`; no longer the row in force today here (ended, or a
   branch row now overrides the chain row) → `COST_BULK_ROW_NOT_CURRENT`; `rowToken`
   differs → `COST_BULK_ROW_CHANGED`.
2. **Unchanged** — cost, MRP, Min, rule and the four prices all as stored: no checks, no
   write, no log, no audit (`written: false`, counted in `unchanged`).
3. **All-branches row** from a user type that is not HQ (`isHqUserType`, menu 30's list)
   → `COST_BULK_CHAIN_NEEDS_HQ`.
4. **Per ACTIVE level in use** (price > 0; an inactive level keeps its price and is not
   judged): above the MRP — the row's new `mrp` when sent; MRP 0 =
   none — `COST_BULK_ABOVE_MRP`; below the Min (new when sent) `COST_BULK_BELOW_MIN`; both
   refusals. Below the new cost: `inventory.below_cost_price` (AppSettingValueService, menu
   30's `resolveBelowCostPolicy`) — `restrict` refuses, `warning` warns, `allow` says nothing
   — `COST_BULK_BELOW_COST`.
5. **By User** (the rule after the save) whose cost changed while every active level keeps
   its stored price → warning `COST_BULK_BY_USER_PRICES_KEPT`.
6. **A markup the column cannot hold** — `ipm_price_*_markup_perc` is numeric(9,3), at most
   999,999.999 %, and all four levels are written — `COST_BULK_COST_TOO_LOW` (a mistyped
   tiny cost: 0.02 against 250). A price, cost or MRP past numeric(18,6) still reaches the
   database; `CostPriceBulkExceptionFilter` answers its 22003 as 422 `VALUE_TOO_LARGE`
   (or `COST_BULK_COST_TOO_LOW` when the detail names the markup column).

Notes are the NexWarningStrip shape (sales HANDOVER §1.5): `code, level (REFUSE | WARN),
message, field (rows.<index>.…), line (the row's lineNo), ipmId, overridable`. A warning is
ticked by `overrides[] {code, line?}` — no `line` = every line with that code (what
`NexWarningStrip::overrides()` sends). Ticking needs only menu 298 EDIT (decided 2026-11-05:
no separate Override right), so `rights.override` = `rights.edit`. A refusal is never
tickable. The save answers **422** while any refusal or un-ticked warning remains: `errors[]`
lists them (house shape, worded), `refusals[]` / `warnings[]` carry the notes for the strip.

At most **1,000 rows** per call (`COST_BULK_TOO_MANY_ROWS`, checked before anything is
read): the client saves in parts, each its own transaction. One `ipmId` once
(`VALIDATION_ARRAY_UNIQUE`), one `lineNo` once (same code).

## What a save writes

Only `inventory.item_price_master`, only today's rows, **in place**, through
`PriceMasterWriter.rewritePriceRows` (one UPDATE for the part): `ipm_cost_price`,
`ipm_cost_wot` (= cost ÷ (1 + tax %)), `ipm_max_price`, `ipm_min_price`, `ipm_profit_type`,
`ipm_sales_price_a…d`, `ipm_price_*_wot`, `ipm_price_*_markup_perc` ((price − cost) ÷ cost ×
100; a level priced 0 stores 0 / 0 / 0), `ipm_updated_on / _by`. Never round-off, the period,
the bucket, discount, cess, charges or loyalty; never a stock table, never `item_qty_price`
(the toast names items with slabs: `hasQtySlabs`); never a new dated row (a later scheduled
row is left alone: `scheduledFrom`). Tax is as of the database's today (`item_tax_history`,
else the item default — `resolveItemTaxRates`).

**A company-shared row** (`ipm_company_id` NULL) is never updated: that would move the price
for every company. The save inserts THIS company's own row instead
(`PriceMasterWriter.insertCompanyPriceRows`, as menu 30's S3 inserts one): the shared row's
branch scope, item, unit, bucket, godown, sl no, round-off, discount, cess, charges, loyalty,
remarks and active flag, with this company and the new figures; its period is the shared row's,
clipped to the day after the company's last closed row of the same key and scope and to the day
before its next scheduled one (so `ex_ipm_overlap` never meets a row). The shared row is left as
it is. Logged as CREATE, audited as an insert; the saved row reads back with the new `ipmId`,
`sourceIpmId` = the shared row's, `companyCopy: true`. The request's `rowToken` still guards
the shared row; after the copy the shared row is no longer current here
(`COST_BULK_ROW_NOT_CURRENT`). The all-branches HQ rule applies when the copy is branch-NULL.

In the same transaction: one **Price Change Log** row per written row (the writer:
`ipcl_source` `BULK_COST_CHANGE`, `ipcl_menu_id` 298, one change set per save, the ticked
warnings as `ipcl_reason`) and one **audit** row (`update`, table "item price master", screen
"Item Price Master" (26) as menu 30, `entityId` = the item, notes "Cost Price – Bulk Change
(menu 298), this branch | all branches — cost a → b" + the ticked warnings).

## The concurrency token

`rowToken` = `md5((to_jsonb(row) - IGNORED_COLUMNS.IPM)::text)` — the row's business columns,
without exactly what the Price Change Log ignores (`ipm_created_*`, `ipm_updated_*`,
`ipm_sync_date`, the generated `ipm_key_*`). Any change to a price, the cost, the MRP, the
period or the deleted flag changes it; a sync stamp (the cloud sync sets and clears
`ipm_sync_date`) or a no-op save does not. `ipm_updated_on` alone could not be the token: it
is NULL on a row never updated. `updatedOn` is still sent, for display only (IST text with
its offset).

Rows are locked `FOR UPDATE` in `ipm_id` order before they are read, so two saves over the
same rows queue rather than deadlock.

## Errors

| Code | When | Status |
|---|---|---|
| `COST_BULK_RIGHT_VIEW` / `_RIGHT_EDIT` | no VIEW (GET) / EDIT (validate, save) on menu 298 | 403 |
| `LOOKUP_ITEM_NOT_FOUND` | one-item mode, no such live item here | 404 |
| `COST_BULK_INACTIVE`, `_NOT_PLAIN_STOCK`, `_NO_PRICE_ROW` | one-item mode (with `reasonCode`, `trackedAs`) | 422 |
| `COST_BULK_TOO_MANY_ROWS` | > 1,000 rows | 422 |
| `COST_BULK_COST_TOO_LOW` | a recomputed markup over 999,999.999 % (validate and save) | 422 |
| `VALUE_TOO_LARGE` | a figure past its numeric column (22003 backstop; no wording row yet) | 422 |
| row notes (above) | save with a refusal or an un-ticked warning | 422 |
| `VALIDATION_*` | the house pipe (`forbidNonWhitelisted`: send only the keys above) | 400 |
| constraint SQLSTATEs | `SellingPriceBulkExceptionFilter` (same table, same words) | 409 / 422 |

## Reused, not copied

`PriceMasterWriter` + `PriceChangeLogService` (writes and the log), `AuditLogService`,
`assertMenuRight`, `isHqUserType` / `HQ_USER_TYPES`, `resolveBelowCostPolicy` +
`AppSettingValueService`, `resolveItemTaxRates`, `IGNORED_COLUMNS`, `numericOverflowOf`, and
`SellingPriceBulkExceptionFilter` (extended by `CostPriceBulkExceptionFilter`).

## Open

- React's item card still sends "By User" on every save, which resets the unit's rule (plan
  §1 known gap; the React port's job).
- No live user without HQ holds menu 298 on the dev box, so `COST_BULK_CHAIN_NEEDS_HQ` is
  proven by the unit spec only.
