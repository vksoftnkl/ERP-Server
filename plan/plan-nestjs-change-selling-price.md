# NestJS — Change Selling Price (Bulk), menu 30

Target repo: `/home/vk/Dev/erp/ERP server` (NestJS + Prisma, PostgreSQL 18).
Screen plan: `change_selling_price_bulk.md` · layout `change_selling_ui_mockup.png`.
Schema it is written against: `schema/stock/16_stock.sql` §20 (`stock_mrp_price`,
`fn_smp_effective`) and `16q` Q23–Q27 + the S1–S3 save statements.
Siblings: `plan-nestjs-opening-stock.md`, `plan-nestjs-physical-stock.md`.

## Context

**This is the easy one, and that is the point.** It writes one table, fires no
trigger, moves no stock, and has no document lifecycle — no draft, no post, no
cancel, no reversal. Phase 1 of `PRICING_AND_FORMS_PLAN.md` picked it first for
exactly that reason: it is the smallest screen that exercises the whole
`schema/stock` deployment path end to end, and if the price screen cannot read a
`stock` table through Prisma, neither can the five voucher screens behind it.

What it is *not* easy about is **which row an edit lands on**. One item at one
unit can be priced four ways at once — a chain row, a branch override, a bucket
row, a headline row — and the screen's job is to be honest about which one the
user is looking at (`Src`) and which one Save will touch (the scope switch).
Every real defect in the legacy 3.0 form of this name was in that resolution, not
in the arithmetic.

**Scope of this plan (decided):** three endpoints, one new Prisma model, one
reused service. No new pricing logic in TypeScript — `fn_smp_effective` resolves
prices, Q26 validates, S1–S3 write, and this module is the transaction boundary
and the error translator around them.

---

## 0. Blockers to settle first

### 0.1 `stock.stock_mrp_price` is not in this repo, in any form

Verified 2026-09-07: no Prisma model, no migration, no reference anywhere in
`src/` or `prisma/` to `stock_mrp_price`, `smp_`, `fn_smp_effective`, or Q23–Q27.
The `stock` schema is deployed out of band from the `schema/stock/` share — the
same arrangement `plan-nestjs-opening-stock.md` §0.1 and
`plan-nestjs-physical-stock.md` §0.1 describe, and nothing in
`prisma/migrations/` creates any of it.

Two consequences, and the second is the one that bites:

1. **§1 adds the model and no migration.** Same rule as every other `stock` table
   here.
2. **This plan cannot restate Q23–Q27 or S1–S3.** They are in `16q`, which is not
   in the repo. Every §3–§5 statement below names what each query must *return*
   and what the API does with it; the SQL goes in as `$queryRaw` **verbatim from
   `16q`**, unedited, with parameters bound. If a query has to be reshaped to fit
   an endpoint, the endpoint is wrong — the reason the screen reads prices only
   through `fn_smp_effective` is that a second implementation of the resolution
   rule is a second answer to "what does this item cost", and the two will
   disagree within a month.

Until the share is deployed to 192.168.0.106 nothing here can be smoke-tested.
The screen plan says everything referenced is verified as of 2026-09-04 — verified
on a throwaway cluster, which is not the same as deployed.

### 0.2 The column list is unknown to this repo — confirm before the DTO freezes

Everything below assumes `stock_mrp_price` carries, per bucket: an id, company /
branch, item, uom, the two identity dimensions (MRP and sale price), the four
price levels, min price, round-off, an effective-from/to pair, and a scope
discriminator. That is inferred from the screen plan's own vocabulary
(`smp_id`, `smp_round_off`, `ck_smp_identity`, `ck_smp_not_above_mrp`,
`ck_smp_prices_nonneg`, `ex_smp_overlap`, `price_source`, `price_scope`) and from
`item_price_master`'s shape. **It is not verified.** Three specific questions in
§13; do not write `stockMrpPrice.prisma` from this plan alone, write it from
`16_stock.sql` §20 with this plan as the checklist.

One inference worth stating because the whole grid depends on it: the four price
levels in `inventory.item_price_master` are **columns, not rows** —
`ipm_sales_price_a…d`, `ipm_price_a_wot…d_wot`, `ipm_price_a_markup_perc…d`, with
`inventory.item_price_levels` (`ipl_name` / `ipl_uname`) supplying only the level
*names*. If `stock_mrp_price` levels the same way, the DTO is four fixed groups; if
it levels by row, it is an array and the grid's twelve editable cells become a
join. **Confirm.**

### 0.3 `inventory.below_cost_price` already exists — and its values are not the
ones in the screen plan

It is an app setting, seeded by
`prisma/migrations/20260812161533_seed_app_setting_def_catalog`:

```
('inventory.below_cost_price', 'INVENTORY', 'Pricing', 'TEXT', 'warning',
 '["restrict","warning","allow"]'::jsonb, … 'COMPANY',
 'Price below cost', 'What happens when a price is entered below its cost:
  block it, ask, or allow it silently.', 40, false, 'SYSTEM')
```

**The values are `restrict` | `warning` | `allow`, not `block` | `ask` | `allow`.**
The screen plan's three behaviours are right; its three tokens are not. Map:

| Setting value | API behaviour |
|---|---|
| `restrict` | abort with the below-cost rows in the error list |
| `warning` | return them once with `needsConfirm`; the client re-posts with `confirmed: true` |
| `allow` | proceed silently, and still report them in the response |

Read it through **`AppSettingValueService.resolveEffective({companyId, branchId,
deviceId, userId})`**, which calls `public.fn_app_settings_effective` — precedence
GLOBAL < COMPANY < BRANCH < DEVICE < USER. Never query `app_setting_value`
directly and never re-merge the precedence in TypeScript; the service's own
comment says why, and a pricing screen that disagrees with the settings screen
about what is allowed is worse than one that has no rule at all.

The default is `warning`, so **the confirm round-trip is the common path, not the
exception.** Build it first, not last.

### 0.4 Masters and client rows

| Thing | State |
|---|---|
| `menu_master` 30 "Change Selling", `CTRL+G` | **exists**, `prisma/seed/Menu_Master.sql:130` |
| `menu_master` 31 "Change Selling (Purchase)" | exists — that is form 6, out of scope |
| `inventory.item_price_master` + its module | **exists and is used** — §6 |
| `inventory.item_tax_master`, `item_tax_history` | exist — §4.3 |
| `inventory.item_price_levels` | exists — level names for the four columns |
| `stock.stock_track_policy` + module | exists — decides which buckets exist at all |
| `ui_table_master` / grid rows for this screen | **do not exist** — same gap the opening and count screens hit |

---

## 1. Prisma — one model, no migration

New file `prisma/stocks/stockMrpPrice.prisma`, model `StockMrpPrice`, table
`stock.stock_mrp_price`, `@@schema("stock")`. House style as in
`prisma/stocks/stockVoucher.prisma`: camelCase fields with `@map`, `@db.Uuid` /
`@db.Decimal(18,6)` / `@db.VarChar(n)`, `@default(dbgenerated("uuidv7()"))`, no
Prisma enums over `varchar + CHECK` columns.

Then, as always:

```bash
node scripts/build-prisma-schema.js && npx prisma generate
```

`prisma/schema.prisma` is generated — never edit it.

Four things to get right, each of which is a defect if missed:

1. **Is it partitioned?** The voucher tables are `PARTITIONED BY LIST (acc_year)`
   and therefore carry composite primary keys. A price row has no accounting
   year, so it almost certainly is not — but check §20 before writing `@@id`,
   because getting this wrong makes every `findUnique` in the module wrong.
2. **`ex_smp_overlap` is an EXCLUDE constraint over a date range.** Prisma cannot
   express it and, worse, `migrate dev` would try to regenerate what it *can* see
   and fail on the existing name. Declare no indexes and no constraints on this
   model at all — the same rule the voucher models already follow, and for the
   same reason. Note the error it raises is `23P01 exclusion_violation`, which is
   **not** in the shared stock SQLSTATE map today (§9).
3. **Effective-from / effective-to are live columns and dormant features.** They
   exist, the exclusion constraint uses them, and this screen writes "now" rows
   only (§12). Map them; never let a v1 payload set them.
4. **No relation fields to Prisma-owned masters.** `item_master`,
   `item_unit_conversion`, `godown_locations` are read by raw joins inside
   Q23–Q27, not by Prisma relations. A relation here makes a `stock` model depend
   on models this module must not write.

`fn_smp_effective` is a function, not a table: it needs no model, and every call
to it is raw.

---

## 2. Module shape

```
src/modules/stocks/selling-price-bulk/
  selling-price-bulk.module.ts
  selling-price-bulk.controller.ts
  selling-price-bulk.service.ts
  selling-price-bulk-exception.filter.ts
  types/selling-price-bulk.types.ts
  dto/list-selling-price-query.dto.ts        <- §3
  dto/price-buckets-query.dto.ts             <- §4
  dto/save-selling-price-bulk.dto.ts         <- §5
  dto/selling-price-bulk-response.dto.ts
```

Under `stocks/` because it writes a `stock` table, not under `Inventory/` — even
though half its fan-out lands in `inventory.item_price_master`. The table it owns
decides where it lives.

House shape, as every module here: `@ApiTags` + `@ApiBearerAuth('access-token')` +
`@UseFilters(SellingPriceBulkExceptionFilter)` on the class, `@Version(API_VERSION)`
on every method, envelope `{ success, message, data }`. Routes resolve as
`/api/v1/stock/price-bulk…`.

**No `@CacheTTL`, anywhere in this module.** `item-price-details` caches for 60s
and is right to; this screen reads live stock alongside live prices and then
writes them back. A 60-second-old bucket list is a save aimed at a row that has
moved.

Dependencies: `PrismaService`, `AuditLogService`, `RequestContextService`,
`AppSettingValueService` (§0.3), `ItemsPriceMasterService` (§6).

---

## 3. `GET /api/v1/stock/price-bulk` — the grid

**Q25**, verbatim. One row per (item × uom × live bucket) that has stock, plus the
headline row for items with none.

Query params, all optional except scope: `companyId`, `branchId`, `itemGroupId`,
`itemBrandId`, `itemSectionId`, `supplierId`, `limit`, `offset`. The four filters
map to `item_master.item_group_id` / `item_brand_id` / `item_section_id` /
`item_supplier_id`, all of which exist and are indexed on group.

**Page it.** A group filter over a 40,000-row item master with four buckets each
is not a grid, it is a denial of service against the Qt table. Default 200, max
1000 — the same numbers the opening plan's reports use. F8's bulk-load filter
dialog exists precisely so the operator narrows before loading.

The response row is the grid's contract, and carries more than the mockup's
columns because the client needs the arithmetic inputs:

```
lineNo · itemId · itemCode · itemName · uomId · unitName
stockQty                       -- for the Stock column, and for §5.4's no-stock list
mrp · salePrice                -- the two identity dimensions
priceSource · priceScope       -- BUCKET|MASTER, BRANCH|CHAIN  -> the Src chip
bucketId                       -- NULL when priceSource = MASTER
costRate · minPrice · roundOff
taxPerc · inclTax              -- §4.3
levels: [{ level, markupPerc, priceWot, price, marginPerc }] x4
```

`Src` renders from the two columns, not from a computed string — the API sends
`priceSource` and `priceScope`, the client draws `BUCKET·BR` / `BUCKET·CH` /
`MASTER`. Sending a pre-rendered chip means the save cannot reason about it.

---

## 4. `GET /api/v1/stock/price-buckets/:itemId` — the F12 picker

**Q24**, verbatim: every live bucket of one item, both dimensions grouped.

Params: `itemId` in the path, `companyId` / `branchId` in the query. Returns the
same row shape as §3 minus the filters, so the client can drop a picked bucket
straight into the grid row.

**Picking a bucket resets that row's delta baseline** (screen plan, Delta
baseline). That is a client rule, but the API must make it possible: every row
this endpoint returns carries its own loaded values, complete, so the client never
has to merge a picked bucket into a row it loaded from §3 and guess which numbers
are now "before".

### 4.1 What a bucket is

A bucket is a live (MRP, sale price) pair for an item — the same two dimensions
`stock_track_policy` decides whether to track. The picker groups by both, which is
why an item with two MRPs and one sale price shows two buckets, not three.

### 4.2 Items with no buckets

An item whose policy tracks neither MRP nor sale price has **no bucket and cannot
have one**: `ck_smp_identity` refuses a (NULL, NULL) row on purpose. §3 returns it
as `priceSource = MASTER` with both dimensions blank, F12 returns an empty list,
and its edits route to the headline (§6). Say this in the endpoint description or
the first field question is "why is F12 empty".

### 4.3 Tax, and the date nobody thought about

The four-number recompute needs a tax percentage:
`item_master.item_default_tax_id` → `item_tax_master.tax_gst_rate_total`, with
`item_master.item_incl_tax` saying whether the item's prices are quoted
tax-inclusive.

But **`inventory.item_tax_history` exists** and is date-effective
(`ith_effective_from` / `ith_effective_to`). So "tax % comes from the item's tax
master at load" is under-specified: at load, as of *when*? For a screen that
writes "now" rows, as of today — but say so, resolve it server-side in Q25, and
send `taxPerc` down. A client that reads the tax master itself will use the
current row on a screen that, once §12's dormant columns wake up, may be writing a
future one.

Cess is out of scope for the recompute (`tax_cess_perc` / `tax_cess_unit` are not
a percentage of price in the unit case). If an item has cess, the four numbers are
approximate and the screen should not pretend otherwise — flag it in the row.

---

## 5. `POST /api/v1/stock/price-bulk` — the save

**One POST, one `prisma.$transaction`.** Q26 → S1–S3 → Q27, and the headline
fan-out (§6) inside the same transaction.

### 5.1 Payload

```ts
{
  companyId, branchId,
  scope: 'BRANCH' | 'CHAIN',        // the header radio — §5.5
  confirmed?: boolean,              // the below-cost round trip — §5.3
  rows: [{
    itemId, uomId,
    bucketId?,                      // absent = create (S3) or headline (§6)
    mrp?, salePrice?,               // the identity dimensions, echoed back
    levels: [{ level, price, priceWot?, markupPerc? }],
    minPrice?, roundOff?
  }],
  userId?
}
```

Only **changed** rows are sent. The client knows which are dirty; the API must not
have to diff four hundred rows to find twelve.

`price` is authoritative among the four numbers. The client sends what it
computed, the API stores it, and `smp_round_off` is applied at the price-with-tax
step — but **the server recomputes `priceWot` and `markupPerc` from `price` and
the tax it resolved in §4.3 rather than trusting them.** Four numbers that must
agree, arriving from a client, are four numbers that can arrive disagreeing; the
one the user typed is the one they meant, and the other three are derivations.
Which one they typed is not knowable server-side, so the rule is: `price` wins,
always, and the client is responsible for having put the user's intent there.

### 5.2 Step 1 — Q26, the validation

Q26 over the changed rows returns a `problem` verdict per row. Three families:

| Verdict | Action |
|---|---|
| above MRP | abort, always — `ck_smp_not_above_mrp` would abort anyway |
| below min | abort, always — min is data, not a CHECK, so this is the *only* enforcement |
| below cost | consult `inventory.below_cost_price` — §0.3 |

Abort = **422** with the row list, before any write. The `below min` line matters:
there is no constraint behind it. If Q26 is skipped or its verdict ignored, a
below-minimum price saves cleanly and nothing ever notices.

### 5.3 The below-cost round trip

On `warning` (the default), the first POST returns **200 with
`needsConfirm: true`** and the offending rows — not an error, because nothing is
wrong yet; the user is being asked. The client shows them and re-posts the
identical payload with `confirmed: true`.

Three rules that keep this from becoming a hole:

- `confirmed: true` **suppresses only below-cost**. Above-MRP and below-min still
  abort. A single confirm flag that waves through every verdict is how the
  amber rule quietly disables the red ones.
- Re-run Q26 on the confirmed post. The first POST's verdicts are stale by
  definition — cost moves when a purchase posts — and the confirm is the user
  agreeing to the price, not to a particular cost figure.
- Record it. The audit row for a confirmed below-cost save says so, with the
  rows; `AuditLogService.logEntityChange` inside the transaction, as every module
  here does it.

### 5.4 Steps 2–4 — write, report, commit

Per changed row: **S1** (find at the target scope, `FOR UPDATE`) → **S2** update
if found, **S3** insert if not. Collect the touched `smp_id`s. Then **Q27** over
those ids for the "priced, nothing on hand" list. Then commit.

```ts
{ saved: 12, masterRowsSaved: 2, noStock: [...], needsConfirm: false }
```

The toast is a stated requirement and it is worth honouring in the API's own
`message`:

> “12 buckets saved · 2 have no stock on hand — the price applies when stock
> arrives.”

**Never a plain "Saved" when `noStock` is non-empty** — legacy fault #2. The
response makes that easy to get right and the client hard to get wrong.

The DB is still the last line, inside the same transaction:
`ck_smp_not_above_mrp`, `ck_smp_prices_nonneg`, `ex_smp_overlap`. A save the
screen failed to validate aborts whole. That is the design, not a fallback — §9
maps the SQLSTATEs so it aborts with a sentence rather than a 500.

### 5.5 The scope switch — rule 4 in `16q` is the law

The header radio (`This branch ▸ / All branches`) decides what S1 looks for, and
therefore whether S2 updates or S3 inserts. It is **not** a filter on what is
displayed.

| Switch | Row's `priceScope` | S1 finds | Result |
|---|---|---|---|
| This branch | BRANCH | this branch's row | S2 updates it |
| This branch | CHAIN | nothing | **S3 creates a branch override**; the chain row is untouched and other branches keep it |
| All branches | CHAIN | the chain row | S2 updates it — every branch without an override moves at once |
| All branches | BRANCH | *see §13* | — |

Two hard rules:

- **All branches is an HQ action.** A branch user's switch is fixed to *This
  branch* — and fixed **server-side**, not only in the UI. `RequestContextService`
  exposes `getUserType()` (the JWT's `user_type`; `usr_type` defaults to
  `'USER'`), and there is **no roles guard in this repo** — `src/common/guards`
  does not exist. So the check is an explicit one in the service: a non-HQ caller
  sending `scope: 'CHAIN'` gets **403**, never a silently downgraded save. Which
  `usrType` values count as HQ is §13.
- **Changing scope with unsaved edits prompts**, because it changes what Save
  means. Client-side, but the API should make a scope change cheap to recover
  from: §3 is a plain reload.

---

## 6. The headline fan-out — and the service that already exists

Rows with **neither dimension** (`priceSource = MASTER`, MRP and sale price both
blank) cannot become buckets — `ck_smp_identity` — so their edits are headline
edits and land in `inventory.item_price_master`.

**Do not write that table from this module.** `ItemsPriceMasterService` exists
(`src/modules/Inventory/items-price-master/`, 587 lines) and its `save()` is
already overloaded to accept a transaction client:

```ts
async save(dto: SaveItemPriceDto[], tx?: Prisma.TransactionClient): Promise<ItemPricePayload[]>
```

with the comment *"When supplied, the batch runs inside the caller's transaction
instead of opening its own"* — written for `ItemsMasterService.saveComposite`, and
exactly what this needs. Import `ItemsPriceMasterModule`, call `save(rows, tx)`
inside the §5 transaction, and the whole save — buckets and headlines — commits or
rolls back together. `masterRowsSaved` in the response is that call's length.

The fan-out rule is one line of TypeScript: **has this row a dimension?** MRP or
sale price present → smp; neither → headline. It is not a user-facing choice and
must never become one.

Note the level mapping is not identity: `item_price_master` levels as columns
(`ipm_sales_price_a…d`, `ipm_price_a_wot…d_wot`, `ipm_price_a_markup_perc…d`) plus
`ipm_min_price`, `ipm_round_off`, `ipm_cost_price`. Write the mapping once, in one
private method, with the four levels named by `item_price_levels` rather than by
literal A/B/C/D anywhere the user can see them.

---

## 7. What the API does not do

The four-number recompute (`markup % ⇄ price-wot ⇄ price ⇄ margin %`) is **client
arithmetic** and stays there: markup on the tax-inclusive pair, margin on the
tax-exclusive pair, live, with no recalculate button and the delta chip as the
preview. The API sends `taxPerc`, `costRate`, `roundOff` and the loaded values, and
receives `price`.

Resist the request to add a `POST /price-bulk/preview`. It would be a network
round trip per keystroke, and it would put the same formula in two places — which
is the one thing §0.1 is trying to avoid about `fn_smp_effective`.

What the API *does* own, and the client must not duplicate: which row an edit
targets (§5.5), whether a below-cost price is allowed (§0.3), and what the price
resolves to for everyone else (`fn_smp_effective`).

---

## 8. Qt client notes — carried from the screen plan, unchanged

These are house rules the server does not enforce but the plan is not complete
without:

- **Edits come from the delegate's `cellEdited`, never the table's
  `itemChanged`** — the grid-delegate pattern already used on the sales and
  charges grids. The recompute runs in the delegate commit path, writes sibling
  cells with signals blocked at the *model* level, and marks the row dirty once.
- **Connect only user-intent signals** (`activated`, `editingFinished`).
  Programmatic loads must not fire recompute. If a `QSignalBlocker` seems
  necessary, the wiring is wrong.
- Row model keeps: loaded values (the delta baseline), `bucketId`, `priceScope`,
  tax %, cost, and per-level dirty flags.
- Keyboard: `F5` load · `F7` clear grid · `F8` bulk-load filter dialog · `F12`
  bucket list for the current row · `Ctrl+D` remove row · `Ctrl+Enter` save.
  Menu 30's own accelerator is `CTRL+G` (`Menu_Master.sql:130`).

---

## 9. Errors

Per-module exception filter, as every module here has. Reuse the shape of
`stock-voucher-exception.filter.ts` — including **the trap**: a RAISE from inside a
function reaches Prisma as `PrismaClientKnownRequestError` with code **`P2010`**,
the real SQLSTATE in `error.meta.code` and the text in `error.meta.message`. A
filter that switches on `error.code` answers every distinct failure with one
useless message.

| SQLSTATE | Raised for | HTTP |
|---|---|---|
| `23514` check_violation | `ck_smp_not_above_mrp`, `ck_smp_prices_nonneg`, `ck_smp_identity` | **422** |
| **`23P01` exclusion_violation** | `ex_smp_overlap` — two rows for one bucket at one scope over one period | **409** |
| `23505` unique_violation | whatever uniqueness §20 carries besides the exclusion | **409** |
| `23503` foreign_key_violation | bad item / uom / bucket | **422** |
| `P0002` no_data_found | bucket vanished between load and save | **404** |
| below-min / above-MRP from Q26 | ours, pre-write | **422** with the row list |
| `scope: 'CHAIN'` from a non-HQ user | ours | **403** |

`23P01` is **not in the shared stock map today** (`STOCK_ENGINE_SQLSTATE_STATUS`
in `stock-voucher/types/stock-voucher.types.ts` has seven entries and this is not
one of them). Add it there rather than locally — the transfer screens will meet it
too — and give it a message that says which bucket and which period, because
"conflicting key value violates exclusion constraint" tells a shopkeeper nothing.

---

## 10. Wiring

- `SellingPriceBulkModule` imports `AuditLogModule`, `AppSettingsModule` (for
  `AppSettingValueService`) and `ItemsPriceMasterModule` (for the §6 fan-out).
  Check the latter two **export** their services before assuming it; add the
  export if not, in the same commit.
- Add to `src/app.module.ts` imports, near the other `stocks/` modules
  (~line 200).
- `@ApiTags('Change Selling Price')`; verify at
  `https://192.168.0.106:3011/api/docs`.
- Not a configured grid — no grid id exists for this screen, so it does **not**
  go through `ConfiguredGridSqlService`, unlike `ItemsPriceMasterService.listPrices`.
- `numeric` comes back as Prisma `Decimal` — return JS numbers. Dates as ISO
  `yyyy-MM-dd`; `NexJson::date` on the Qt side reads the first ten characters.

---

## 11. Tests

Unit (`selling-price-bulk.service.spec.ts`, mirroring the existing specs):

- the fan-out rule: a row with an MRP goes to smp; a row with neither dimension
  goes to `ItemsPriceMasterService.save`, **with the transaction client**; assert
  the mock received `tx`.
- scope resolution, one case per row of §5.5's table, asserting S2-vs-S3 by which
  statement was issued — this is the module's actual logic and the legacy form's
  actual bug.
- `scope: 'CHAIN'` from a non-HQ `userType` → 403, no write attempted.
- below-cost: `restrict` → 422; `warning` → 200 + `needsConfirm`, then the
  confirmed re-post writes; `allow` → writes and still reports.
- `confirmed: true` does **not** suppress an above-MRP or below-min verdict.
- Q26 is re-run on the confirmed post (assert two calls).
- `priceWot` / `markupPerc` are recomputed server-side: send deliberately
  inconsistent values and assert what was stored.
- the SQLSTATE map, driven off `meta.code`, one case per row of §9 —
  including `23P01`.
- `noStock` non-empty → the message is not "Saved".

Integration, once §0.1 is deployed — the four resolutions that make this screen
worth building:

1. a CHAIN-sourced row saved at *This branch* creates a branch override and
   leaves the chain row byte-identical; a second branch still reads the chain
   price through `fn_smp_effective`.
2. the same row saved at *All branches* moves every branch without an override,
   and moves none that has one.
3. two saves racing on the same bucket at the same scope: one commits, one gets
   `23P01` → 409.
4. a price saved for a bucket with no stock appears in `noStock`, and
   `fn_smp_effective` returns it the moment stock arrives.

---

## 12. Out of scope for v1, deliberately

- **Effective-date scheduling UI.** The columns are live and the exclusion
  constraint uses them; this screen writes "now" rows only. Map the columns
  (§1.3), reject them in the DTO, and leave the feature dormant.
- **Editing MRP, or creating buckets for items with no policy.**
  `stock_track_policy` decides which buckets exist; this screen prices them.
- **The purchase screen's price write** — menu 31, "Change Selling (Purchase)",
  the same S1–S3 statements, arriving with form 6. Which is the argument for
  putting S1–S3 behind one service method in this module now, so form 6 imports
  it rather than copying it. Name it `applyBucketPrice(tx, row, scope)` and keep
  it free of anything screen-shaped.

---

## 13. Open items to close with the DB owner / client

1. **The `stock_mrp_price` column list** (§0.2) — and specifically: is it
   partitioned; do the four price levels live in columns or rows; what exactly is
   the scope discriminator called and what are its values (the screen plan says
   `price_scope` returns BRANCH / CHAIN from Q25, but a returned column and a
   stored column need not be the same thing).
2. **All branches + a BRANCH-sourced row** (§5.5, row 4). Undefined by the screen
   plan. The two candidate readings — "update this branch's row" and "promote it
   to a chain row" — are very different, and the second is destructive to the
   other branches' effective prices. Recommend: update the branch row, i.e. the
   switch does nothing on a row that already has an override, and the Src chip is
   how the user sees why.
3. **Which `usrType` values are HQ** (§5.5). `usr_type` defaults to `'USER'` and
   the repo has no role guard, so this needs an explicit list — or, better, an
   app setting in the same catalog as `below_cost_price`, resolved the same way.
4. **`inventory.below_cost_price`'s tokens** (§0.3) — confirm the screen plan's
   `block`/`ask` were shorthand for the seeded `restrict`/`warning` and that no
   fourth behaviour is intended. If the plan meant a genuinely different
   vocabulary, the catalog row needs a migration, not a translation table.
5. **Cess items** (§4.3). Whether the four-number panel should be disabled, or
   shown with a warning, for an item whose tax carries a per-unit cess.
6. **Q23** is referenced by the screen plan's header (Q23–Q27) but used by none of
   the three endpoints. Confirm it is not needed — or find out which of §3/§4 was
   meant to use it before the SQL is wired in verbatim.
