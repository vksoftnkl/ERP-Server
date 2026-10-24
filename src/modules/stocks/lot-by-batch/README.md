# lot-by-batch — `GET /api/v1/stock/lots/by-batch` (textile plan D5)

The sale bill's batch scan, read-only — and the count screen's (notes 150 #10) and the
adjustment screen's (notes 151 #10).
`companyId`, `branchId`, `batchNo` (+ `includeEmpty`, default false; `bucket`,
default `SALEABLE`, any one bucket or `ALL`; `godownId`, optional).

* Matches the company's lots whose `slt_key_batch` equals `upper(btrim(batchNo))`
  — the label folded as the lot key folds it — on `ix_slt_key_batch`
  (migration `20261023150000`). `ix_slt_batch_no` is on the batch as typed and
  cannot serve a folded match.
* Per lot: `lotId`, `itemId`, `itemCode`, `itemName`, `baseUomId` (the base
  unit's `item_unit_conversion` id) and `baseUnitName`, `batchNo` as stored,
  `mrp`, `salePrice`, `status`, and the stock at the branch **in the bucket asked
  for** (SALEABLE unless `bucket` says otherwise; `ALL` counts every bucket):
  `onHandQty` and `godowns[]` (`godownId`, `godownName`, `bucket`, `onHandQty`,
  `availableQty`, `avgCostRate`), narrowed to one godown by `godownId`. A deleted item's lots
  are left out.
* Notes 151 #10 — the cost, so an adjustment line can be filled from a scan:
  `godowns[].avgCostRate` is the holding's `sbl_avg_cost_rate` (what an outward
  line relieves, what a re-lot carries); the lot row's `avgCostRate` is the
  holdings' value ÷ quantity over the godowns listed, else the lot's own
  `slt_cost_rate`.
* Addendum 2 E3.1: the batch's `sizeId` / `sizeName`, `colourId` / `colourName` and
  `model` from `stock.stock_batch_detail` (null when it has none) — see `../batch-detail`.
* A lot with no stock (in the bucket asked for) at the branch is left out unless
  `includeEmpty=true`; a re-lot's old lot (D7) leaves the list that way. The count
  screen scans with `bucket=ALL&includeEmpty=true` to resolve a QUARANTINE or
  DAMAGED holding.
* No lot: 404 `STOCK_BATCH_NOT_FOUND`, "No stock with batch CBE26-00001".
* One row: the client fills the line from it (item, base unit, MRP, rate = the
  lot's selling price, `sbiBatchNo`, `sbiLotId`). Several: the client picks.

Not cached. No menu right of its own: like the other sale lookups, the login is
enough.
