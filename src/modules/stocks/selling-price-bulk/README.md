# SellingPriceBulkModule — Change Selling Price (bulk), menu 30

Plans: `plan/plan-nestjs-change-selling-price.md`, retargeted by
`plan/plan-nestjs-one-price-table.md` §5. Screen accelerator `CTRL+G`
(`prisma/seed/Menu_Master.sql:130`).

**One price table.** Every row this screen reads or writes is an
`inventory.item_price_master` row: a bucket row ("this item at MRP 40 sells
for…", `ipm_bucket_mrp` / `ipm_bucket_sp` set) or the headline (both NULL).
`stock.stock_mrp_price` was never created. All statements live in
`PriceBucketGateway` (`price-bucket.gateway.ts`).

The routes:

| Route | What it is |
|---|---|
| `GET /api/v1/stock/price-bulk` | the grid — since P1 (2026-11-23) the price LINES of a page of ITEMS, as on the item card (below); Edit on menu 30 |
| `GET /api/v1/stock/price-buckets/:itemId` | F12's bucket picker — Q24: the price rows this branch sees, plus the stock buckets with no row of their own, priced as the grid prices them (notes 74); Edit on menu 30 |
| `POST /api/v1/stock/price-bulk` | the save — cost → Q26 (+ every branch for CHAIN lines) → S1–S3 → Q27, one transaction |
| `POST /api/v1/stock/price-bulk/back-to-all-branches` | P1 — a store's own line (and its scheduled rows) removed; Edit + Delete on menu 30 |
| `GET /api/v1/stock/price-schedule`, `POST …/price-schedule/cancel` | notes 140 B — scheduled prices |

Menu 244 (Qty-wise Prices) still reads the OLD grid through `SellingPriceBulkService.listPrices`
(one row per unit × bucket with stock): only the route moved to `listPriceLines`.

Plan of the P1 rework: `Shared/Prathap/inventory/plan-change-selling-price-rework-p1-2026-11-23.md`
(+ the user's answers at its end); keys handed to the Qt side:
`Shared/Prathap/inventory/csp-rework-p1-keys-2026-11-23.md`.

## The thing this screen is actually about

Not arithmetic. **Which row an edit lands on.** One item at one unit can be
priced four ways at once — a chain row, a branch override, a bucket row, a
headline row — and every real defect in the legacy 3.0 form of this name was in
that resolution.

So the API sends `priceSource` and `priceScope` as two columns and never a
pre-rendered `Src` chip (the save has to reason about both), and the whole of
§5.5 is one pure function, `resolveTargetScope`, with a test per row of its
table:

| Header radio | Row's scope | S1 finds | Result |
|---|---|---|---|
| This branch | BRANCH | this branch's row | S2 updates it |
| This branch | CHAIN | **nothing** | S3 creates a branch override; the chain row is untouched |
| All branches | CHAIN | the chain row | S2 updates it — every branch without an override moves |
| All branches | BRANCH | this branch's row | S2 updates the override; it is **not** promoted (§13.2) |

Row 2 is the one that matters and the mechanism is the point: S1 searches *at
the target scope*, so a BRANCH search cannot find the chain row and the write
falls through to S3. The chain row is never read for update, so it cannot be
edited by accident.

## Buckets, and how a row finds its price

A bucket is the (MRP, sale price) pair of stock on hand, **blanked by the
item's stock track policy** — the rule lot identity uses (`bucketKeyFor` /
`bucketKeySql` beside `lotIdentityKeyColumns`). An item that tracks neither
has one bucket, (NULL, NULL): its headline. The grid is one row per item × unit
× live bucket at the branch (plus the headline for an item with no stock), and
each row's price is what the resolver answers — `resolveEffectivePrice` in
`Inventory/items-price-master/price-resolver.ts`, mirrored in SQL by
`effectivePriceLateral`: the exact bucket row before the headline, a branch
row before the chain row, company before shared.

The save blanks each row's MRP / sale price by the policy again (an untracked
item's MRP 45 is its headline), costs it from `stock.stock_item_cost`, and
writes by key at the target scope. There is **no fan-out**: a headline edit is
S1–S3 at key (-1, -1). A new bucket row (S3) copies godown, cess, discount,
loading, freight, loyalty and the unit remark from the headline, or a
bucket-priced line would lose its cess at the till. `masterRowsSaved` is
always 0 and goes after one release.

**Audit.** One audit row per price row written, under the table's own "Item
Price Master" screen — an update with the row before and after, an insert with
the row after — so a price's history reads the same whichever screen changed
it. The notes name menu 30, the scope, and any confirmed below-cost verdicts
(notes 71 B1: a single summary row logged as an `update` with no original
record made every valid save a 400).

## Where the rules live

| Rule | Enforced in |
|---|---|
| shape, types, level 1–4, scope membership | the DTOs, as 400 |
| `scope: 'CHAIN'` (body or `rows[].scope`) from a non-HQ caller | `assertScopeAllowed` / `assertRowScopesAllowed`, as **403** — never a silent downgrade |
| another branch than the login's own | `assertBranchAllowed`, as **403** (head office excepted) |
| which row the edit targets | `resolveTargetScope` (pure) |
| above MRP / below min | Q26, as 422 with the row list, before any write |
| below cost — the higher of line cost and stock cost; CHAIN rows at every branch | `inventory.below_cost_price` via `AppSettingValueService.resolveEffective` |
| bucket vs headline | `bucketKeyFor` over the item's policy — never the client's say-so |
| one row per bucket per scope | the save (422, both lines named), then `ex_ipm_overlap` (409) |
| the unit is the item's | the save, as 422 |
| everything else | the database, translated by `SellingPriceBulkExceptionFilter` |

### The row's cost (notes 147 B; P1 A1 / A3 option C, 2026-11-23)

A price line has TWO costs, and P1 keeps them apart:

- the **line cost** — `ipm_cost_price` / `ipm_cost_wot`, the line's own (the last purchase cost,
  as the item card shows it);
- the **stock cost** — what was paid here: this MRP's landing cost (its lots), else the branch
  average, × the unit factor (`stock-cost.reader.ts`, `StockCostReader`). Null when there is none.
  The SQL reads it WITHOUT GST (`stockCostWot`; a purchase lot is costed on the ITC figure);
  `stockCost` is ALWAYS `stockCostWithGst` = stockCostWot × (1 + the item's GST %), the line
  cost's own footing (decision 12; user "Go" 2026-11-27).

What a save STORES in `ipm_cost_price`:

| Row sends | menu 30 / Ctrl+R (`saveBulk`, `keepLineCost`) | purchase price update, menu 244 |
|---|---|---|
| `costPrice` | that cost, `ipm_cost_wot = costPrice ÷ (1 + tax %)` | the same (244: `keepCost` may keep the stored pair) |
| no `costPrice` | the line's own cost, kept (its key's line in force at the branch); a key with no line yet → the stock-first cost | the stock-first cost, as before (P2 changes purchases) |

What a save JUDGES below cost against (A3 option C, every writer of the shared save): the
**higher** of the line cost (what the line will store) and the stock cost — `judgeCost` on the
candidate. A BELOW_COST problem carries `cost` (the judged one), `lineCost`, `stockCost` and, when
BOTH are above 0, `rule` LINE_COST or STOCK_COST naming the higher (the wording variants
`rule=LINE_COST` / `rule=STOCK_COST`); with one cost known there is no rule and the old words
stand. `params` = level (short name), price, cost, lineCost, stockCost (2 dp), unit, mrp, item, n.
`inventory.below_cost_price` (restrict / warning / allow) decides what happens, as before.

**A purchase's own rows (user 2026-11-27: "every purchase and its stock is a single line
maintenance").** The post's price step, and the bill's own keys saved from menu 30's purchase
view (`fromPurchase`, a row that sends a cost and whose key the bill bought at a cost), are judged
on the cost they send ALONE (`ownCostOnly`): no stock cost beside it and no other branch (C6).

**Every branch (C6, O10).** A row written at CHAIN scope is also judged at every OTHER active
branch of the company that reads it: saleable stock on hand for the key (MRP line: that MRP;
headline: the item), no live own line for the unit and key on the day, a stock cost. A branch is
named only where ITS stock cost is above the line cost and the price is under it (a price under
the line cost is the same everywhere and was reported once): verdict BELOW_COST, `rule`
BRANCHES, `branchId` / `branchName`, one problem per active level priced above 0.

**The markup (decision 20).** A sent `levels[].markupPerc` is stored as sent when it reproduces
the price — cost × (1 + % ÷ 100), rounded to the R.Off step, within 0.005 (the item card's
typed-figure rule); otherwise it is recomputed. The price still wins.

Each `rows[]` entry in the response carries `costRate` / `costWot` / `costBasis` — the OLD grid
rule (stock first), kept for the old screen.

### Per-line scope (P1 §4.6)

`rows[].scope` (CHAIN / BRANCH) is each line's own; the body's `scope` is only the default
(default BRANCH). `resolveTargetScope(row.scope ?? dto.scope ?? 'BRANCH', row.priceScope, branchId)`
is unchanged. Checks, in order, before anything is read: Edit on menu 30; `branchId` is the
login's own branch (device branch, else `usr_branch_id`) unless head office
(`STOCK_PRICE_BRANCH_HQ_ONLY`, also on both GETs and Back); CHAIN (body or row) is head office
only (`STOCK_PRICE_CHAIN_HQ_ONLY`, field `rows.<n>.scope`). `rows[].isNew` (+ Line): an MRP item
needs an MRP above 0 (`STOCK_PRICE_BUCKET_MRP_ZERO`), and a key already lined at the target scope
is `STOCK_PRICE_LINE_EXISTS` (params unit, mrp, branch, n; `existingIpmId`).

### Back to all branches (P1 §4.9, Q1, Q5)

`POST /stock/price-bulk/back-to-all-branches {companyId, branchId, ipmId}`: the branch's own line
of `ipmId`'s key in force today and its later scheduled own rows are soft-deleted through
`PriceMasterWriter.softDeletePriceRow` (logged DELETE, reason "Back to all branches"; one audit
`cancel` row each), in one transaction. A stale id (the card rewrote the line) finds the live line
by its key. Edit AND Delete on menu 30 (`STOCK_PRICE_RIGHT_DELETE`); a store user for his own
branch only. Refused: an All branches line or another branch's (`STOCK_PRICE_BACK_NOT_OWN`);
nothing left to price the unit there — no All branches line of the key and no headline
(`STOCK_PRICE_BACK_NOTHING_LEFT`, params item / unit / branch). Answers `removed`, `removedIds`,
`nowPricedBy {lineKind, branchId, ipmId, prices[4]}`.

### The grid's lines (P1 §4.1)

`GET /stock/price-bulk` pages by ITEM (`limit` / `offset` count items, `meta.lines` the lines).
Per live unit: the HEADLINE always (bucketId null when unpriced), every MRP / "sold at" line in
force at the branch (keys the item's policy tracks), and NO_PRICE for stock whose key has no line
of its own (priced by the headline; a plain item's headline with stock and no line is NO_PRICE
too). `unpricedOnly` keeps items with a NO_PRICE line. New keys per line: `lineKind`,
`lineCost(Wot)`, `stockCost(Wot)`, `stockCostBasis`, `otherBranchesStockCost` (CHAIN lines: the
other branches reading it, lowest – highest), `profitType`, `companyId/Name`, `branchId/Name`,
`unitFactor`, `unitSlNo`, `isDefaultUnit`, `levels[].storedMarkupPerc`, and the item row's facts.

### The save in two halves (Qty-wise Prices plan 2026-11-05 §4.6)

`saveBulk` is rights + scope + via + policy around one transaction of `prepareBulk(tx, dto)`
(start day, tax, costs, candidates, the unit / one-row-per-bucket refusals, Q26 — writes nothing;
above MRP / below min thrown, below cost thrown under `restrict`, else handed back) → the confirm
verdict → `writeBulkInTx(tx, prepared, { confirmed, via, policy })` (S1 → S2/S3, Q27, audit, the
answer). Qty-wise Prices (menu 244) runs the same two inside its own transaction with its slab
checks between them; menu 30 and Quick Rate answer exactly as before.

A row may also carry `profitType` (the unit's Rule, stored in `ipm_profit_type`) and `maxPrice`
(a typed MRP, stored in `ipm_max_price` on a HEADLINE row only). Menu 30 sends them since P1
(`maxPrice` on a plain item's headline only).

## Five traps worth reading before editing

**1. A raw-query failure is `P2010`.** Same trap as the voucher
filter: the real SQLSTATE is in `error.meta.code`, the text in
`error.meta.message`, and a filter switching on `error.code` answers one useless
500 to every distinct failure. `23P01 exclusion_violation` was added to the
*shared* `STOCK_ENGINE_SQLSTATE_STATUS` rather than locally — the transfer
screens will meet its cousin. `ex_ipm_overlap` is what raises it here.

**2. The setting's tokens are `restrict` / `warning` / `allow`.** The screen plan
says `block` / `ask` / `allow`; those are not in the catalog and never were. The
seeded default is `warning`, so **the confirm round trip is the common path**.
`confirmed: true` suppresses below-cost *only* — a flag that waved through every
verdict is how the amber rule quietly disables the red ones — and Q26 is re-run
on the confirmed post, because cost moves when a purchase posts.

**3. `price` wins, always.** The four-number panel is client arithmetic (§7) and
stays there. The server recomputes `priceWot` and `markupPerc` from `price` and
discards what arrived in them: four numbers that must agree, arriving over a
network, can arrive disagreeing. Which one the user typed is not knowable
server-side, so the client is responsible for having put their intent in `price`.

**4. `uomId` is an `iuc_id`.** `inventory.item_unit_conversion.iuc_id`, not
`item_unit_master.unit_id` — the same convention as the voucher lines, and it
maps straight onto `ipm_uc_unit_id`. The foreign key catches a `unit_id`, but
only after forty rows have been typed.

**5. No `@CacheTTL`, anywhere.** `item-price-details` caches for 60s and is right
to; this screen reads live stock alongside live prices and writes them back, so a
60-second-old bucket list is a save aimed at a row that has moved. It is also not
a configured grid — no grid id exists for this screen.

## Open items (plan §13)

1. ~~The `stock_mrp_price` column list~~ — closed: the table is
   `inventory.item_price_master` (plan-nestjs-one-price-table.md).
2. All branches over a BRANCH-sourced row. Implemented as the plan recommends
   (update the override, do not promote); the other reading is destructive to
   every other branch.
3. **Which `usr_type` values are HQ.** `HQ_USER_TYPES` in
   `types/selling-price-bulk.types.ts` is a placeholder, deny-by-default, and the
   only place the answer is written down.
4. Confirm `block` / `ask` were shorthand for `restrict` / `warning`.
5. Cess items — disable the four-number panel, or warn. Today the row carries
   `hasCess` and the screen decides.
6. ~~Q23~~ — closed: it is `/master-lookups/item-price` (plan §3), not a route
   of this module.
