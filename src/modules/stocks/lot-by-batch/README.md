# lot-by-batch — `GET /api/v1/stock/lots/by-batch` (textile plan D5)

The sale bill's batch scan, read-only. `companyId`, `branchId`, `batchNo`
(+ `includeEmpty`, default false).

* Matches the company's lots whose `slt_key_batch` equals `upper(btrim(batchNo))`
  — the label folded as the lot key folds it — on `ix_slt_key_batch`
  (migration `20261023150000`). `ix_slt_batch_no` is on the batch as typed and
  cannot serve a folded match.
* Per lot: `lotId`, `itemId`, `itemCode`, `itemName`, `baseUomId` (the base
  unit's `item_unit_conversion` id) and `baseUnitName`, `batchNo` as stored,
  `mrp`, `salePrice`, `status`, and the **SALEABLE** stock at the branch:
  `onHandQty` and `godowns[]` (`godownId`, `godownName`, `onHandQty`,
  `availableQty`). A deleted item's lots are left out.
* Addendum 2 E3.1: the batch's `sizeId` / `sizeName`, `colourId` / `colourName` and
  `model` from `stock.stock_batch_detail` (null when it has none) — see `../batch-detail`.
* A lot with no saleable stock at the branch is left out unless
  `includeEmpty=true`; a re-lot's old lot (D7) leaves the list that way.
* No lot: 404 `STOCK_BATCH_NOT_FOUND`, "No stock with batch CBE26-00001".
* One row: the client fills the line from it (item, base unit, MRP, rate = the
  lot's selling price, `sbiBatchNo`, `sbiLotId`). Several: the client picks.

Not cached. No menu right of its own: like the other sale lookups, the login is
enough.
