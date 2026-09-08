# SellingPriceBulkModule — Change Selling Price (bulk), menu 30

Plan: `plan/plan-nestjs-change-selling-price.md`. Screen accelerator `CTRL+G`
(`prisma/seed/Menu_Master.sql:130`).

Three routes:

| Route | What it is |
|---|---|
| `GET /api/v1/stock/price-bulk` | the grid — Q25, paged, four optional filters |
| `GET /api/v1/stock/price-buckets/:itemId` | F12's bucket picker — Q24 |
| `POST /api/v1/stock/price-bulk` | the save — Q26 → S1–S3 → Q27 → the headline fan-out |

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

## What is not deployed here

`stock.stock_mrp_price` ships out of band from the `schema/stock/` share, like
`stock.stock_voucher`, and is **not on this database** — no model, no migration,
no reference to `smp_` or `fn_smp_effective` anywhere in the repo (verified
2026-09-07). Its column list is unverified too, so no Prisma model has been
written from the plan alone.

Every statement that needs it lives in `StockMrpPriceGateway` and answers **503**
with the sentence that says so. One file changes when the share lands: fill in
Q23–Q27 and S1–S3 from `16q` as `$queryRaw` **verbatim**, and flip `isDeployed`.

**A save of headline rows only works today**, end to end, because it never
touches the gateway. That is the §6 fan-out, and it is most of what the legacy
form got wrong.

## Where the rules live

| Rule | Enforced in |
|---|---|
| shape, types, level 1–4, scope membership | the DTOs, as 400 |
| `scope: 'CHAIN'` from a non-HQ caller | `assertScopeAllowed`, as **403** — never a silent downgrade |
| which row the edit targets | `resolveTargetScope` (pure) |
| above MRP / below min | Q26, as 422 with the row list, before any write |
| below cost | `inventory.below_cost_price` via `AppSettingValueService.resolveEffective` |
| bucket vs headline | `isHeadlineRow` — has this row a dimension? |
| everything else | the database, translated by `SellingPriceBulkExceptionFilter` |

## Five traps worth reading before editing

**1. A raise from inside a function is `P2010`.** Same trap as the voucher
filter: the real SQLSTATE is in `error.meta.code`, the text in
`error.meta.message`, and a filter switching on `error.code` answers one useless
500 to every distinct failure. `23P01 exclusion_violation` was added to the
*shared* `STOCK_ENGINE_SQLSTATE_STATUS` rather than locally — the transfer
screens will meet its cousin.

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

1. The `stock_mrp_price` column list — partitioned? levels as columns or rows?
   what is the scope discriminator called?
2. All branches over a BRANCH-sourced row. Implemented as the plan recommends
   (update the override, do not promote); the other reading is destructive to
   every other branch.
3. **Which `usr_type` values are HQ.** `HQ_USER_TYPES` in
   `types/selling-price-bulk.types.ts` is a placeholder, deny-by-default, and the
   only place the answer is written down.
4. Confirm `block` / `ask` were shorthand for `restrict` / `warning`.
5. Cess items — disable the four-number panel, or warn. Today the row carries
   `hasCess` and the screen decides.
6. Q23 is referenced by the screen plan and used by none of the three endpoints.
