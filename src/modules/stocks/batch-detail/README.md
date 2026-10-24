# batch-detail — a batch's size, colour and model (textile addendum 2 E2/E3)

`stock.stock_batch_detail` (`sbd_`), keyed by **(company, batch no)**: an auto batch
number is unique in the company by construction (plan D1), a Re-lot keeps it, and a
draft has it before any lot exists. Nothing is added to `stock_lot`,
`stock_voucher_item` or `sale_bill_item`. `sbd_id` is uuid v5 over
`company|BATCH` (`batchDetailId`), so two installs write one row.

## Written by the inward save (`batch-detail.helper.ts`)

`StockVoucherService.save` (opening stock, rule `autoBatchNo`) takes `sizeId`,
`colourId` and `model` on each line — declared on `SaveOpeningStockVoucherItemDto` as
well as the shared transfer line (notes 149 #1) — and calls `syncBatchDetails` in its
own transaction, after the lines are written:

* A line with an **auto batch** gets its row written or revived. An auto batch is one
  numbered by this save, or one this document was given on an earlier save: a re-save
  that hands the server's number back, with or without line ids, is not a typed batch
  (notes 149 #2). A key left out is none, so omitting `sizeId` on a re-save clears it.
* Size, colour or model on a **typed** batch (or no batch) is refused: 422
  `STOCK_BATCH_DETAIL_NEEDS_AUTO_BATCH`.
* A size or colour that is not live in the company or shared is refused: 422
  `STOCK_BATCH_SIZE_NOT_FOUND` / `STOCK_BATCH_COLOUR_NOT_FOUND`. Inactive rows pass.
* A removed line, or a line now carrying a typed batch, has its row soft-deleted.
  Deleting (`softDelete`) or cancelling (`cancel`) the draft soft-deletes all of its
  rows (notes 149 #3); a POSTED cancel keeps them, since the lot exists.
* An unchanged row is not rewritten.

The opening `/get` returns `sizeId`, `sizeName`, `colourId`, `colourName` and `model`
per line, joined by line id **and** batch and reading retired rows too — so a
cancelled draft still shows what was keyed, while a line whose batch was typed over
shows nothing.

## Routes (`/api/v1/stock/batch-detail`)

| Route | What |
|---|---|
| `GET models?companyId&itemId[&q]` | E3.2. Distinct models of the item, most recently used first, at most 20. `q` matches anywhere, ignoring case. |
| `POST update` | E2. Puts right a **posted** batch: `companyId`, `batchNo`, and optional `sizeId` / `colourId` / `model` (left out = kept, null = cleared). A `reason` is required. It writes an `audit.audit_log` row (screen "Batch Detail") with the before and after. A draft's batch is refused with 409 `STOCK_BATCH_DETAIL_ON_DRAFT`: change the draft. An unknown batch is 404 `STOCK_BATCH_DETAIL_NOT_FOUND`. |

## Read elsewhere (by company + item + folded batch)

* `GET /stock/lots/by-batch` (E3.1): `sizeId` / `sizeName`, `colourId` / `colourName`,
  `model`.
* `GET /stock/physical/count-sheet` (notes 150 #9): the same five per holding, by
  company + item + folded batch.
* `/bills/get` (E3.3): `sbiSizeName`, `sbiColourName`, `sbiModel` (not `sbiSize`, the
  typed dimension). DC `/get`: `sdi*`. Sale return: `sri*`. DC return: `sdri*`.
* Bill print, `sales.bill.items` (E3.4): `size_name`, `colour_name`, `model`.

The item is matched as well as the batch, so a typed batch that equals another item's
auto number shows nothing.
