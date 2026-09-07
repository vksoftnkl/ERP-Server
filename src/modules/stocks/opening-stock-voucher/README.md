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
| `POST /stock/opening/cancel` | reversal rows, never a delete. `reason` required. |
| `DELETE /stock/opening` | soft delete, **DRAFT only** |
| `GET /stock/opening/pending-items` | items with no opening movement in this branch and year |
| `GET /stock/opening/reconcile` | what the branch started with, what it holds now, the difference |

Every response is `{ success, message, data }`. No `@CacheTTL` anywhere — these
are live balances, and a cached preflight is worse than none.

## The type is pinned by the route

`OPENING_RULES` in the controller supplies the voucher type. A payload carrying
`voucherType: 'TRANSFER_OUT'` is refused with a 400, not silently honoured — a
transfer posted through this route would leave its `stock_transit` row uncreated
and the receiving branch waiting for a document that never arrives.

## What the screen must not do

* **Never sum its own grid.** The four header totals are trigger-maintained and
  re-summed at post. Read them back; do not compute them.
* **Never send a lot id.** `lotId` is NULL while DRAFT and filled by the post.
  That is not missing data — it is the tick that says the line reached the
  ledger.
* **`uomId` is an `iuc_id`, not a `unit_id`.** `inventory.item_unit_conversion`,
  never `item_unit_master`. The conversion factor is read server-side from that
  row and a factor in the payload is ignored: a wrong one would multiply the
  opening quantity of the whole branch.
* **Default the rate source to `MANUAL`.** On a go-live day `stock_item_cost` is
  empty, so `AVG_COST` and `LAST_PURCHASE` have nothing to read. The preflight
  reports it, but the honest default is manual entry.

## Cancelling can legitimately fail

Cancelling an opening after stock has been sold from it drives the holding
negative, and `fn_sml_apply` refuses that under `stp_allow_negative = 'BLOCK'`.
That surfaces as **409 naming the item**. It is correct behaviour, not a bug to
retry around: the fix is an ADJUSTMENT with a reason.

A POSTED voucher is likewise **cancelled, never deleted**. `svh_is_deleted` is
not read by `fn_svh_cancel`'s ledger scan, so soft-deleting a posted document
would hide it from every list while its ledger rows went on affecting stock for
ever. `DELETE` on a POSTED document answers 409 and points at cancel.

## Not built here

* **Import from file** (§11 of `plan/plan-nestjs-opening-stock.md`). Deferred
  deliberately: a 400-line opening typed by hand is painful but correct, whereas
  a silent code-resolution mismatch in an importer is 400 wrong lines.
* **`menu_master` 44 and the `ui_table_master` grid rows** the Qt screen reads.
  Not this module's work, but the screen cannot open without them.
* **Sale prices on the line.** `svi_*` deliberately has no price levels — prices
  live in `inventory.item_price_master` and `stock.stock_mrp_price`. If go-live
  is to capture them, that is a second call to the pricing endpoints.
