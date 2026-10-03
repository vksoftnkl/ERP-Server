# SellingPriceBulkModule — Change Selling Price (bulk), menu 30

Plans: `plan/plan-nestjs-change-selling-price.md`, retargeted by
`plan/plan-nestjs-one-price-table.md` §5. Screen accelerator `CTRL+G`
(`prisma/seed/Menu_Master.sql:130`).

**One price table.** Every row this screen reads or writes is an
`inventory.item_price_master` row: a bucket row ("this item at MRP 40 sells
for…", `ipm_bucket_mrp` / `ipm_bucket_sp` set) or the headline (both NULL).
`stock.stock_mrp_price` was never created. All statements live in
`PriceBucketGateway` (`price-bucket.gateway.ts`).

Three routes:

| Route | What it is |
|---|---|
| `GET /api/v1/stock/price-bulk` | the grid — Q25, paged, four optional filters |
| `GET /api/v1/stock/price-buckets/:itemId` | F12's bucket picker — Q24: the price rows this branch sees, plus the stock buckets with no row of their own, priced as the grid prices them (notes 74) |
| `POST /api/v1/stock/price-bulk` | the save — cost → Q26 → S1–S3 → Q27, one transaction |

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
| `scope: 'CHAIN'` from a non-HQ caller | `assertScopeAllowed`, as **403** — never a silent downgrade |
| which row the edit targets | `resolveTargetScope` (pure) |
| above MRP / below min | Q26, as 422 with the row list, before any write |
| below cost | `inventory.below_cost_price` via `AppSettingValueService.resolveEffective` |
| bucket vs headline | `bucketKeyFor` over the item's policy — never the client's say-so |
| one row per bucket per scope | the save (422, both lines named), then `ex_ipm_overlap` (409) |
| the unit is the item's | the save, as 422 |
| everything else | the database, translated by `SellingPriceBulkExceptionFilter` |

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
