# OpeningStockVoucherModule — `/api/v1/stock/opening`

**There is no opening-stock table.** An opening stock is a `stock.stock_voucher`
row with `svh_voucher_type = 'OPENING'` and its `stock.stock_voucher_item` lines.
Eleven document types differ in three columns and share forty, so they share one
table — and everything downstream of the document (the lot, the ledger row, the
balance, the moving average) is written by `stock.fn_svh_post()` and by triggers.

This module writes **two tables and calls one function.**

The legacy `stock.opening_stock_header` / `_detail` pair was dropped in migration
`20260907070000`, along with the physical-stock trio. Nothing here imports from
it: that module posted nothing to stock, by its own design, which is the opposite
of what this one does.

## Routes

| Route | What it is |
|---|---|
| `POST /stock/opening` | save a draft — create when `header.svhId` is absent, update when present. Update is a **full replace of the lines**. |
| `GET /stock/opening` | `svhId` present loads one document; absent lists them |
| `GET /stock/opening/validate` | the preflight — every line, `problem` null on the clean ones |
| `POST /stock/opening/post` | the whole engine, one statement |
| `POST /stock/opening/cancel` | cancels a **DRAFT or a POSTED** opening, never a delete. A posted one is reversed; a draft moves the header alone. `reason` required on both. |
| `POST /stock/opening/import` | replace an existing DRAFT's lines from a CSV. Never posts, never creates. |
| `GET /stock/opening/reconcile` | what the branch started with, what it holds now, the difference |
| `GET /stock/opening/item-lookup` | the item picker — one round trip fills a line: unit, base unit, factor, tax, tracking signature. **No cost.** |

Every response is `{ success, message, data }`. No `@CacheTTL` anywhere — these
are live balances, and a cached preflight is worse than none.

## The number comes from the accounts voucher-type master

`svh_refno` is drawn from `accounts.acc_voucher_seq` under
`accounts.acc_voucher_types` row 1 — code `OPENING`, "Opening Stock": prefix
`OPN`, no suffix, width 4, yearly reset — so the first opening of a year
prints as `OPN0001`. The counter is branch-wide (`MAIN`), not per
device, because `ux_svh_refno` is unique per (company, branch, acc_year) with no
device in it. `svh_slno` keeps its own per-device serial; the two numbers are
allowed to differ. `OPENING_VCHR_TYPE_ID` in the controller is what pins the row.

A client that sends `refno` still has it honoured verbatim and consumes no
accounts number.

## The type is pinned by the route

`OPENING_RULES` in the controller supplies the voucher type. A payload carrying
`voucherType: 'TRANSFER_OUT'` is refused with a 400, not silently honoured — a
transfer posted through this route would leave its `stock_transit` row uncreated
and the receiving branch waiting for a document that never arrives.

## Picking an item — `GET /stock/opening/item-lookup`

19q Q6. Runs once per item picked on the line grid (menu 44), with the
**document's** `companyId`, `branchId` and date (`onDate`), the `itemId`, and
optionally a `uomId` (an `iuc_id`; omit it for the item's default unit). One
round trip returns what a line cannot be built without:

* **`uomId` and `baseUomId`, both `iuc_id`s.** The sales lookup the screen used
  to call returns no base unit at all, and `svi_base_uom_id` is `NOT NULL` and
  not resolved on save. Guessing it from the selling unit is right only for
  single-unit items. `toBaseFactor` comes with them.
* **`trackSignature`** — which of batch / MRP / sale price / expiry / serial /
  supplier the line must carry, resolved by the same `effectivePolicyLateral`
  fragment the preflight and the post use, **as at `onDate`**. A back-dated
  opening is keyed under the policy in force then, which is why the date is
  required rather than defaulted. `'N'` when nothing matches: track nothing.
* **`taxPerc`, `cessPerc`, `cessUnit`.** Cess travels with the tax because the
  screen derives cost-without-tax, and a per-unit cess is not a percentage.
* **`mrp` and `salePrice`** — lot *identity*, not a price list: a seed for a
  signature carrying M or S, most specific price scope first, then the dearest
  live bucket. The line's real bucket is the MRP that gets typed. They read
  `stock.stock_mrp_price` through `StockMrpPriceGateway` and are **0 on every
  database where that table is not deployed** (all of them today) — the picker
  itself keeps working, because a LEFT JOIN to a missing relation is an error,
  not an empty row.
* **`alreadyOpened`** — a warning while the operator is still typing, not a
  refusal. The engine's rule is per holding, finer than this can see; the
  preflight is the real check.

**It returns no cost, deliberately.** The engine resolves `rateSource` only
when a line arrives at cost 0. A picker that seeds the cost cell hands the
engine a non-zero rate, the rate-source CASE never runs, and the line is valued
at a figure read when the item was picked rather than when it posted — under
`AVG_COST` the average moves with every line of the same document. The cost
cell stays empty unless a human types one.

**The item is scoped to the document's company and branch.** Company is a
strict match: an item with no company is a row nobody owns, not a shared one
(that is what a null means for `stock_track_policy`, and inventing the same
rule for items would let five orphan rows open in every company). Branch is
nullable-means-shared: 10,010 of 10,041 live items carry no branch and belong to
the whole company, so the lookup returns this branch's own items plus the
company-wide ones and never another branch's. Without this a barcode scanned
through `/master-lookups/item-by-barcode`, which takes no company at all,
filled a line from another company's item (seen on 192.168.0.106, 2026-09-08).

**Empty is a 404 that names the cause**, because "no such item" would mislead
for almost every item on a real master (on 192.168.0.106, 46 of 10,041 live
items have any conversion row): no such item, an item with no company, another
company's item, another branch's item, a service item, no unit conversion at
all, a `uomId` that is not one of the item's, no default unit when none was
sent, or a keyed unit whose base unit has no conversion row.

## What the screen must not do

* **Sum its own grid, and send the totals.** `lineCount`, `totalQty`,
  `totalValue` and `totalValueWot` are taken from the payload and written
  verbatim — the server counts no lines and sums nothing. All four are optional
  (`NOT NULL DEFAULT 0`); omitting one on a create takes the column default and
  omitting it on an update leaves the stored value alone. Note that where the
  engine DDL is installed, `fn_svh_recompute` still re-derives all four **at
  post**, so a posted document carries the engine's figures.
* **Never send a lot id.** `lotId` is NULL while DRAFT and filled by the post.
  That is not missing data — it is the tick that says the line reached the
  ledger.
* **`uomId` is an `iuc_id`, not a `unit_id`.** `inventory.item_unit_conversion`,
  never `item_unit_master`. So is `baseUomId`.
* **Send the conversion, and the base quantities with it.** `baseUomId`,
  `toBaseFactor` and `baseQty` are **required**, and `freeBaseQty` optional; all
  four are written straight through. The save path no longer opens
  `item_unit_conversion` at all, so nothing multiplies `qty × factor` and nothing
  resolves the base unit for you. `svi_value` is `GENERATED` from `baseQty +
  freeBaseQty`, so these are the numbers the document is valued on — a wrong
  factor now multiplies the opening quantity of the whole branch, and only the
  screen can prevent it. What went with the lookup is the cross-check that the
  unit belonged to the item: the foreign keys still refuse an `iuc_id` that does
  not exist, but one belonging to a *different* item is now the client's to get
  right.
* **Default the rate source to `MANUAL`.** On a go-live day `stock_item_cost` is
  empty, so `AVG_COST` and `LAST_PURCHASE` have nothing to read. The preflight
  reports it, but the honest default is manual entry.

## The payload is the full writable surface

The save DTO exposes **every** column of `stock_voucher` / `stock_voucher_item`
that an application is allowed to write — including the ones an opening does not
use. That is deliberate: the DTO is shared by all eleven document types, so the
type-specific fields are **gated by `StockVoucherTypeRules`** rather than being
absent, and a document that sends one it may not use gets a 422 naming the field
instead of silently writing a column that changes what the ledger records.

For an OPENING the gated refusals are:

| Field | Refused because |
|---|---|
| `toBranchId` | only a transfer leaves the branch |
| `freezeStock` / `freezeFrom` / `freezeTo` | only a physical count freezes stock |
| `bookQty` / `countedQty` | `svi_diff_qty` is GENERATED from the pair and is what POSTS — on a document that counted nothing it would post a variance nobody entered |
| `lotId` | `fn_slt_resolve` owns lot identity; a client-chosen lot would let two documents open the same holding under two lots |
| `lrNo` / `vehicleNo` / `expectedOn` | `stock_transit` columns, written only by the transfer service. They used to be accepted here and **silently discarded** — a 201 with the value gone |
| `fromGodownId` | an opening is INWARD: it states what was already on the shelf, so there is no godown it came from. Only `toGodownId` is meaningful, and it is required |
| `reasonId` (header **and** line) | a reason belongs to an ADJUSTMENT — the fix path when an opening turns out to be wrong — not to the opening itself. Nothing *decided* an opening; it is the starting figure |
| `supplierId` / `partyRef` **on the header** | an opening is the starting figure, not a receipt from anybody — there is no counterparty to name. The **line** keeps its own `supplierId`, which is part of the lot identity |
| `linkSrcModule` / `linkSrcDocType` / `linkSrcDocId` / `linkSrcAccYear` | nothing *causes* an opening — it is where the ledger starts, so there is no source document to point at. `ck_svh_link` is all-or-nothing and is satisfied by all four staying NULL |
| `syncDate` (header **and** line) | set by the device, and this route is not the offline path |

**The save DTO is STANDALONE**, not an extension of the shared eleven-type
classes — see the header comment in `save-opening-stock-voucher.dto.ts`. So
every row above is refused by `forbidNonWhitelisted` alone, as a 400 saying
*"property X should not exist"*, with no `@IsEmpty` anywhere.
`assertPayloadRules` still answers 422 for them on the routes that do use the
shared DTOs.

Standalone buys two things extending never could, because a subclass can only
ADD — `@IsOptional()` on a base property whitelists `undefined` for every
validator on it, so a `@RequiredUuid()` added downstream never fires:

| Now a 400 naming the field | Was |
|---|---|
| `header.toGodownId` missing | 422 from `assertPayloadRules` |
| `lines[].uomId` missing | 422 from `assertPayloadRules` |
| a negative `qty` / `freeQty` / `baseQty` / `weightQty` / `costRate` | 422 (`ck_svi_qty_sign`) |

**Two rules stay in the service on purpose**, because neither is a property of
one field: a line needs `qty` **or** `freeQty` (a free-goods line legitimately
has `qty` 0), and `costRate` is required only when `rateSource` derives nothing,
which depends on the header.

The cost of standalone is **drift**: a column added to the shared header no
longer reaches this route on its own. Add it here too.

**What is deliberately NOT refused**, however tempting a lean payload looks:
`batchNo` / `mfgDate` / `expiryDate` / `mrp` / `salePrice` / `serialNo` /
`supplierId` are what `fn_slt_resolve` builds `stock_lot` from at post time, so
an opening without them could not bring in a batch- or serial-tracked item at
all; `splitNo` is what makes one line drawn from three batches three rows;
`slno` / `refno` let a tablet that numbered and *printed* a document offline send
that number back; and without `docDatetime` a week of synced offline documents
all land at the same instant.

What is left is **21 header fields and 26 line fields**:

| | Required | Optional |
|---|---|---|
| header | `accYear` `companyId` `branchId` `deviceId` `docDate` `toGodownId` | `svhId` `tenantId` `sessionId` `slno` `refno` `usrRefno` `docDatetime` `lineCount` `totalQty` `totalValue` `totalValueWot` `rateSource` `remarks` `userId` `voucherType` |
| line | `lineNo` `itemId` `uomId` `baseUomId` `toBaseFactor` `baseQty` `godownId` | `splitNo` `bucket` `barcode` `batchNo` `mfgDate` `expiryDate` `mrp` `salePrice` `serialNo` `supplierId` `qty` `freeQty` `freeBaseQty` `weightQty` `costRate` `costRateWot` `landedRate` `taxPerc` `remarks` |

The ones easy to overlook: `docDatetime` (a device syncing a week of offline
documents must say when each was *keyed*, or they all land at the same instant),
`slno` / `refno` (a tablet that numbered and *printed* offline sends that number
back), and on the line `weightQty` and `landedRate`.

`weightQty` is carried, never derived. A 10kg bag that actually weighs 9.7kg
opens at what the scale said, and no conversion factor knows that.

Any **line** `reasonId` cited is checked against `stock.stock_reason_master` — it must be
visible to the company (its own rows and the shared ones merge), active, and
permitted for this voucher type by `srm_allowed_txn_types`. That is not cosmetic:
`fn_svh_txn_map` reads the reason to decide what the ledger records.

## Cancel takes a draft as well as a posted opening

One route, two amounts of work, decided by the status and nothing else:

* **DRAFT** — no `stock_ledger` row was ever written, so there is nothing to
  reverse. The header moves to CANCELLED and the answer says
  `rowsReversed: 0`. This path cannot fail on stock.
* **POSTED** — reversal rows, and see below for how that can legitimately fail.

An already-CANCELLED opening is refused with **409** and the date it was
cancelled on.

Cancelling a draft is **not** the same act as deleting one, which is why both
exist. A soft-deleted draft leaves the list as though it had never been raised;
a cancelled draft stays on the list, numbered, with the reason on its trail.
That is the whole reason `reason` is required even on a draft, where there is no
ledger row to explain — for an opening abandoned because the count was wrong or
the branch was wrong, the sentence is the point.

## Cancelling a posted opening can legitimately fail

Cancelling an opening after stock has been sold from it drives the holding
negative, and `fn_sml_apply` refuses that under `stp_allow_negative = 'BLOCK'`.
That surfaces as **409 naming the item**. It is correct behaviour, not a bug to
retry around: the fix is an ADJUSTMENT with a reason.

A POSTED voucher is **cancelled, never deleted**. `svh_is_deleted` is not read
by the cancellation's ledger scan, so soft-deleting a posted document would hide
it from every list while its ledger rows went on affecting stock for ever. This
screen exposes no delete route at all, so on this screen cancel is the only way
to take a draft out of play too.

## Importing from a file

`POST /stock/opening/import` takes a multipart CSV as the `file` part, plus
`svhId`, `accYear`, `companyId` and `branchId` as form fields. It replaces the
lines of a DRAFT that already exists — the header is the operator's decision and
a spreadsheet does not get to make it — and it **never posts**.

Required columns: `item_code`, `unit_name`, `qty`, `cost_rate`. Optional:
`line_no`, `split_no`, `godown`, `bucket`, `batch_no`, `mfg_date`,
`expiry_date`, `mrp`, `sale_price`, `serial_no`, `supplier`, `free_qty`,
`cost_rate_wot`, `tax_perc`, `remarks`. Headers are matched case-insensitively
and by alias (`code`, `uom`, `quantity`, `rate` all work).

Three rules make it safe to trust:

* **Ambiguity is refused, never guessed.** Two items sharing a code, or two
  conversions sharing a unit name on one item, refuse that row and name the
  candidates. "Pick the first" is how an import silently opens the wrong
  holding.
* **Every bad row is reported at once.** An operator fixing a 400-line file one
  error per upload stops trusting the importer before they finish.
* **It goes through `save()`, not around it.** Resolution turns codes into ids
  and stops; every §4.2 rule is then applied by the ordinary save path. A second
  write path would be an importer that can create lines the screen cannot.

The response carries the reloaded document plus the §6 preflight, so a file that
resolved cleanly but produced lines the engine will refuse says so immediately.

## Not built here

* **The Qt grid definition.** `fixed.menu_master` 44 (Opening Stock) already
  exists in `prisma/seed/Menu_Master.sql`. `fixed.ui_tables` 5 ("opening stock")
  also exists — but its 45 seeded columns describe the **retired** screen: ten
  hidden `osl_*` id columns from the dropped `opening_stock_detail`, and twelve
  price-level columns (`Price A/B/C/D`, MRP, MSP, markup, round off) that the
  `svi_` line deliberately does not have. Pointing the new screen at table 5
  would bind a grid to fields this API never returns. A new column set has to be
  agreed with whoever owns the Qt client, because a column also needs a client
  meaning there before it renders — a seeded row on its own renders nowhere and
  saves NULL.
* **Sale prices on the line.** `svi_*` deliberately has no price levels — prices
  live in `inventory.item_price_master` and `stock.stock_mrp_price`. If go-live
  is to capture them, that is a second call to the pricing endpoints.
