# item-price-log — the price change log (notes 144)

Every change to `inventory.item_price_master` (IPM) and `inventory.item_qty_price`
(IQP) is one row of `inventory.item_price_change_log` (migration
`20261023120000_item_price_change_log_notes_144`): who, when, where from, the
source screen, where the price applies, and the row before and after.
`audit.audit_log` keeps getting its rows as before.

## Writing — `PriceMasterWriter`

The **only** code that writes either price table. Each method snapshots the row
(`to_jsonb`), runs its one statement, snapshots it again, and calls
`PriceChangeLogService.record()` in the same transaction.

| Source (`ipcl_source`, menu) | Caller | Writer methods |
|---|---|---|
| `ITEM_CARD` (29) | `ItemsPriceMasterService` (item card, `/item-prices`) | `createPrice`, `updatePrice` (update / soft delete / restore) |
| `BUCKET_REKEY` (29) | `PriceBucketService.rekeyItem` | `rekeyPrice` → action `REKEY` |
| `CHANGE_SELLING_PRICE` (30) | `SellingPriceBulkService` | `updateBucketPrice`, `insertBucketPrice`, `closePriceRowBefore`, `insertSplitPrice`, `softDeletePriceRow`, `extendPriceRowTo` (moved from `PriceBucketGateway`, SQL unchanged) |
| `QTY_PRICE` (244) | `ItemsQtyPriceMasterService` | `createQtyPrice`, `updateQtyPrice`, `setQtyPriceDeleted` (delete / restore) |

`price-master-writer.guard.spec.ts` (plan §2.5) fails the build on a Prisma write,
a nested relation write or raw SQL against either table anywhere else.

## Recording — `PriceChangeLogService.record()`

- **Action** is read off before / after: no row before = `CREATE`, the deleted flag
  set = `DELETE` (kept as `before` only, `ck_ipcl_shape`), cleared = `RESTORE`,
  else `UPDATE`. `REKEY` is stated by the re-key.
- **No-op check:** the stamps (`*_created_*`, `ipm_updated_*` / `iqp_modified_*`,
  `*_sync_date`) and the generated `ipm_key_*` are ignored. A save that changed
  nothing else writes no log row.
- **One change set per transaction:** every row a save logs shares
  `ipcl_change_set_id`.
- **Who** is the token's user and device and the request IP, never the body. The
  app is `DESKTOP` (device Desktop / PC), `WEB` (Web), `API` (no registered device,
  or Mobile), or `SYSTEM` (no user).
- Item code / name, unit, branch, godown and party names are copied at the time
  of the change.

## Reading — `/item-price-log/*` (menu 290)

All routes need `um_can_view` on menu **290 Price Change Log** (Reports, beside
Audit Logs), else 403 `IPCL_RIGHT_VIEW`. They are not cached.

| Route | What |
|---|---|
| `GET list` | `companyId`, `fromDate`, `toDate` (IST days, ≤ 366 apart) + optional `branchId`, `priceTable` (IPM / IQP / BOTH), `itemId`, `userId`, `deviceId`, `field` (a column, e.g. `ipm_sales_price_b`: only changes that touched it), `source`, `action`, `search`, `page`, `limit` (≤ 500). Newest first. |
| `GET get` | `ipclId` → the row, `before` / `after`, and `fields[]` (column, label, before, after). |
| `GET days` | The `list` filters, per day: changes, price rows, slabs, items, users, saves. |
| `GET item-history` | `itemId` + optional `companyId`, `branchId`, `priceTable`, `limit` (≤ 1000). |
| `GET gaps` | Plan §2.6, the gap count: price rows touched since the log's first row whose latest log row is missing (`NOT_LOGGED`) or does not match the row (`DIFFERS`). 0 is healthy. |

Every row (list, item-history, get) carries `fields[]` (notes 145): each changed
column with its label and its value before → after — a level's price first, then
its w/o-tax and markup companions; a row's own id is never a field, and a soft
delete reads Deleted false → true. Rows logged before notes 145 are put in the same
order when read.

A company's report includes its shared (no-company) prices, and a branch's the
all-branches ones. Each row carries `changePct` for the headline figure (price A,
or the slab price) and `changedLabels` (`price-field-labels.ts`, notes 144 §6).

## Decisions taken here (the plan file was not on the server box)

- Menu **290** under Reports for the report's right (notes 144: "a normal menu right").
- `gaps` is a fifth read route, so the gap count can be checked on a live database.
- `ipcl_app` mapping above. Mobile reads as `API` (the table's CHECK has no MOBILE).
