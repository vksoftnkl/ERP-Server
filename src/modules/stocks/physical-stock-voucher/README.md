# PhysicalStockVoucherModule — `/api/v1/stock/physical`

**There is no physical-stock table.** A count is a `stock.stock_voucher` row with
`svh_voucher_type = 'PHYSICAL'` and its `stock.stock_voucher_item` lines — the
same two tables an opening writes. So this is the **third controller over
`StockVoucherService`**, not a third copy of save/post/cancel.

The legacy `inventory.physical_stock_header` / `_detail` / `_batch_detail` trio
was dropped by `20260509061137_remove_four_tables`. Nothing here imports from the
`nest g resource` output written against them: its DTO knows nothing about
`svi_counted_qty` and its service knows nothing about the engine.

## Routes

| Route | What it is |
|---|---|
| `GET /stock/physical/count-sheet` | **generate** the sheet from `stock_balance` — a read, not a document |
| `POST /stock/physical` | save a draft. Update is a **full replace of the lines**. |
| `GET /stock/physical` | `svhId` present loads one count; absent lists them |
| `GET /stock/physical/validate` | the preflight — every line, `problem` null on the clean ones |
| `POST /stock/physical/post` | the whole engine, one statement |
| `POST /stock/physical/cancel` | reversal rows, never a delete. `reason` required. |
| `GET /stock/physical/variance` | the count as the **ledger** recorded it |

Every response is `{ success, message, data }`. **No `@CacheTTL` anywhere** — and
here it matters more than on any other screen: a cached count sheet is a book
figure from before the last sale.

## Four things that make a count not an opening

1. **It cannot start from nothing.** The sheet is *generated* from
   `stock_balance`, at that table's own grain: one line per **godown × lot ×
   bucket**, not per item. Two batches of MILK are two lines to count, because
   they are two holdings. An item with **no balance row is not on the sheet and
   must not be added to it** — no book quantity means no variance to have.
   Finding it on the shelf is an `ADJUSTMENT`, which is a screen that does not
   exist yet.
2. **Only the difference posts.** `svi_qty`, `svi_base_qty` and `svi_cost_rate`
   stay **0 for the whole document**. The operator types one number per line,
   `svi_counted_qty`; `svi_diff_qty` is `GENERATED ALWAYS` as counted − book, and
   *that* is what reaches the ledger.
3. **A line that agrees writes nothing — and the document still closes POSTED.**
   Three lines counted, two ledger rows, zero traces of the third. `rowsPosted:
   0` is a success, and the message says so rather than reading like a failure.
4. **It moves stock both ways at once**, and the two directions get their rate
   from two different places (see below).

## What the client sends, and what the server reads

The line DTO is **narrower** than the shared one. Eighteen properties are absent
and refused with a 400 (`forbidNonWhitelisted`), because every one of them is a
property of the holding the line already names by `lotId`:

> `qty` `freeQty` `weightQty` `costRate` `costRateWot` `landedRate` `taxPerc`
> `uomId` `baseUomId` `barcode` `batchNo` `mfgDate` `expiryDate` `mrp`
> `salePrice` `serialNo` `supplierId` `bookQty`

What is left is `lineNo`, `itemId`, `godownId`, `bucket`, **`lotId`** and
**`countedQty`**. The server reads the rest from `stock_balance` / `stock_lot` at
save time, in one query.

- **`svi_book_qty` is read, never taken.** It is an ordinary writable numeric
  column, so nothing in the database stops a client sending its own — and a book
  figure the client chose turns a variance into a wish. It is also a **snapshot**:
  never refreshed at post, never recomputed on load, because it is what lets a
  variance be defended a year later.
- **`svi_lot_id` is written at save**, uniquely among the eleven types. The lot is
  *where the book figure came from*; `fn_svh_post` uses it as given and never
  calls `fn_slt_resolve` for these lines. A `lotId` with no live balance row in
  this godown is a **422 saying "regenerate the count sheet"** — which is exactly
  what happens when someone sells the last of a lot mid-count.
- **A count is taken in the base unit**, factor 1, because the book figure it is
  measured against is held in the base unit.
- **Absent `countedQty` is refused**, naming the line. Absent is not "0 found",
  it is *not counted yet*, and posting an uncounted line as a total shortage is
  the single most expensive mistake this screen can make. Send `0` to record that
  nothing was found.

## Cost: two directions, two rules

| Direction | Where the rate comes from |
|---|---|
| overage (`diff > 0`) | `svh_rate_source` in `fn_svh_post` |
| shortage (`diff < 0`) | left at 0 **on purpose** — `fn_sml_cost_default` stamps it from the item's valuation policy |

A shortage is valued at what the stock cost us, by policy, **never by the
counter**. `svh_rate_source` therefore defaults to **`AVG_COST`** (applied at the
write, so the stored document says out loud what it was valued at). `MANUAL` —
the right default for an *opening* — makes the engine refuse an overage line:
there is nothing behind "the storekeeper types it" on a count sheet, and guessing
zero would drag the item's moving average toward zero for every future sale.

**The average must not move.** A shortage is relieved at the average and an
overage added at it. A count finds a *quantity* error, not a price error;
correcting a price is something this engine cannot express at all — there is no
REVALUE.

## The freeze (§11)

*A count that does not freeze the stock it is counting is counting a moving
target.* `freezeStock` requires both `freezeFrom` and `freezeTo` — the API answers
422 before `ck_svh_freeze` fires — and the window is **wall clock, not document
date**: `tr_sml_freeze_guard` compares it to `now()`, because a back-dated entry
still changes today's shelf. Send instants with an offset.

The guard refuses movements touching **the counted godown only**; other godowns
keep trading, and posting or cancelling the sheet lifts it without waiting for
`freezeTo`. Default the window on the screen —
`now()` to `now() + 3h` — rather than making the operator type it.

**A refused movement surfaces in *other* modules** (sales, transfers), not this
one. Their exception filters need the SQLSTATE the guard raises with; until it is
confirmed against the deployed function, a blocked sale during a count is an
unexplained 500. That is [open item 2](#open-items).

## Header totals mean the net variance

After the 2026-09-04 `fn_svh_recompute` fix, `totalQty` / `totalValue` on a
POSTED count are the **net variance read off the ledger** — qty +1, value 86.00
for the captured run — not the sum of anything on the screen. A DRAFT count
truthfully totals 0. Label the field **Net variance**, or do not show it: a column
headed "Total" reading 1 under three lines totalling 236 counted units is worse
than no column.

### Fifteen header fields the count does not have

The header DTO is **standalone** — it does not extend `SaveStockVoucherHeaderDto`
— so these are not in the payload, not in the `/api/docs` schema, and refused
with a **400 naming the field** by `forbidNonWhitelisted` alone.

That is why it is standalone. class-validator *merges* a base class's metadata
into a subclass, so a subclass can only ever **add**: while this class extended
the shared header, each of the fifteen needed an explicit `@IsEmpty` to be
refused at all, and every one still rendered in the schema and the example body
regardless — `@ApiHideProperty` is a no-op at runtime (it feeds the CLI plugin,
which this project does not enable) and cannot suppress an inherited property.
A subclass cannot **tighten** either, which is why `toGodownId` — the counted
godown, which a count cannot be saved without — was a 422 from
`assertPayloadRules` and is now simply required, a 400 naming the field. The
cost is drift: a column added to the shared header no longer reaches this route
on its own.

| Refused | Why |
| --- | --- |
| `lineCount` `totalQty` `totalValue` `totalValueWot` | The header carries the **net variance**, read off the ledger by `fn_svh_recompute` at post. A client total is a number that would be silently replaced |
| `lrNo` `vehicleNo` `expectedOn` | `stock_transit` columns (`stt_lr_no`, `stt_vehicle_no`, `stt_expected_on`), written only by the transfer service after `fn_svh_post_transfer`. A count despatches nothing, so there is no transit row to write them to |
| `fromGodownId` | A count is **one godown against its own book figure**, and that godown is `toGodownId` (required here). The service reads the counted godown as `toGodownId ?? fromGodownId`, so a payload sending both and disagreeing was a count of one godown filed against another |
| `toBranchId` | Only a transfer leaves the branch. Was a 422 from `assertPayloadRules` (`allowsToBranch: false`) |
| `supplierId` `partyRef` | A count receives from nobody. `svi_supplier_id` on a counted line is read from the holding, never from the header |
| `linkSrcModule` `linkSrcDocType` `linkSrcDocId` `linkSrcAccYear` | Nothing outside the count causes it — it is what the shelf said. `ck_svh_link` is all-or-nothing and is satisfied by all four being NULL |

Before this, the totals and the lorry were accepted and **silently discarded**
(a 200 with the value gone), the counterparty fields were stored on a document
they do not describe, and `toBranchId` / the link columns were 422s reported
after the whole payload had been walked.

What a count *does* keep, and what no other type has: `freezeStock` /
`freezeFrom` / `freezeTo`.

`lotId` is filled from the moment of save here, so the screen **cannot** use it as
the "reached the ledger" tick. Use `diffQty <> 0` plus `status = 'POSTED'`, or
`GET …/variance`.

## Re-counting beats cancelling

A holding may be **counted any number of times**, each posting its own variance
from the then-current book figure, and the ledger keeps them all. The opening's
"one opening per holding per year" guard is switched off for a count by
`allowsRepeatHolding`.

Cancelling *un-corrects a correction*: the book figure goes back to being the one
the shelf disagreed with. It can also legitimately fail with 409 — cancel an
overage after the found stock has been sold and the reversal drives the holding
negative, which `fn_sml_apply` refuses under `BLOCK`. Put "a second count is
usually what you want" in the confirm dialog.

## Not built here

- **The engine.** `fn_svh_post`, `fn_svh_cancel`, `fn_svh_txn_map`,
  `fn_sml_apply`, `fn_sbl_rebuild` and `tr_sml_freeze_guard` come from
  `schema/stock/` and are **not** in this repo.
  `20260907090000_add_stock_engine_tables` created the tables; the posting
  machinery remains the DB owner's to supply. `test/physical-stock.e2e-spec.ts`
  detects this and skips rather than failing red for an environmental reason —
  `STOCK_ENGINE_REQUIRED=1` turns the skip into a failure once it is deployed.
- **`menu_master` and the grid rows** for the count screen. The screen cannot
  open without them.

## Open items

1. **Which godown column does `fn_svh_post` read for a PHYSICAL?**
   `PHYSICAL_RULES` assumes `svh_to_godown_id`, and the service enforces that
   every line's `svi_godown_id` equals it — so whichever side the function reads,
   the two agree. Confirm before the DTO is frozen.
2. **The freeze guard's SQLSTATE and message**, for other modules' filters.
3. **Which §0.1 build is deployed** — it decides whether the header shows totals
   at all. The e2e prints what it found.
4. **`ADJUSTMENT` is the missing neighbour**: stock found for an item with no
   balance row cannot be a count line, and there is no adjustment screen yet.
5. **Re-generating a sheet in place.** A re-save replaces the lines wholesale and
   silently refreshes `svi_book_qty` — right for a sheet being filled in, worth a
   confirmation on one being re-counted after a partial post.
6. **Revaluation remains a gap.** Say so before someone tries to fix a costing
   error by counting.
