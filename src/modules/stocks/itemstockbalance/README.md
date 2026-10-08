# Item Stock Balance

Read-only API for **item stock balances** — the current on-hand quantities (opening / in / out /
closing, free, reserved, transit, available) per accounting-year scope of item, unit, godown and
stock bucket, plus per-batch stock lookups. All quantities are additionally converted to a display
"book" quantity using item price-master unit factors.

- **Base route:** `item-stock-balance` (each route is API-versioned via `API_VERSION`)
- **Swagger tag:** `Item Stock Balance`
- **Auth:** Bearer `access-token` (declared via `@ApiBearerAuth`)
- **Caching:** controller-level `@CacheTTL(60)` (60s)
- **Primary table:** `item_stock_balance` (`inventory` schema) — PK `isbId`, unique scope
  `uq_isb_balance_scope` = accYear + companyId + branchId + godownId + itemId + unitId + stockBucket
- **Batch table:** `item_batch_stock` (`inventory` schema) — PK `ibsId`, joined to `ItemBatchMaster` (`batch`)
- **Also read (never written):** `item_master`, `unit`, `godown_location`, `item_price_master`

## Files

| File | Purpose |
| --- | --- |
| [itemStockBalanceModule.ts](itemStockBalanceModule.ts) | Module wiring — registers controller, service, and exception filter (service is **not** exported) |
| [itemStockBalanceController.ts](itemStockBalanceController.ts) | HTTP routes + Swagger docs (all `GET`, read-only) |
| [itemstockBalanceService.ts](itemstockBalanceService.ts) | Query logic, unit-factor resolution, payload mapping, not-found errors |
| [itemStockBalanceExceptionFilter.ts](itemStockBalanceExceptionFilter.ts) | Maps `HttpException`s to the module's `{ success, message, errors }` shape (infers `isb_*` field names) |
| [dto/get-item-stock-balance-query.dto.ts](dto/get-item-stock-balance-query.dto.ts) | Query DTO for `GET /get` (`isb_*` params) |
| [dto/get-bulk-item-stock-list-query.dto.ts](dto/get-bulk-item-stock-list-query.dto.ts) | Query DTO for `GET /bulk-list` (item-master filters, `stock_type`, `limit`) |
| [dto/get-item-batch-stock-options-query.dto.ts](dto/get-item-batch-stock-options-query.dto.ts) | Query DTO for `GET /batch-options` (`ibs_*` params, `search`, `limit`) |
| [dto/item-stock-balance-response.dto.ts](dto/item-stock-balance-response.dto.ts) | Swagger response/error models |
| [types/item-stock-balance-api.types.ts](types/item-stock-balance-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch stock balances for an exact scope (acc year, company, branch, godown, item) across the query unit and its related price-master units; optional `isb_stock_bucket`. |
| `GET` | `/bulk-list` | List stock balances for an acc year / company / branch with optional item-master, godown, stock-bucket and `stock_type` filters; enriched with item, unit, godown and price data. |
| `GET` | `/batch-options` | Search per-batch stock (active, non-deleted) for an exact scope; optional `ibs_stock_bucket` and `search`. |

This module is **strictly read-only** — there are no create, update or delete routes, no
transactions, and no audit logging. It never writes to any table.

## How balances are queried & computed

**Unit factors.** Before returning quantities, `getByScope` and `getBatchOptionsByScope` call
`getItemPriceUnitFactors(itemId, unitId)`, which reads `item_price_master` rows for the item
(`ipmIsDeleted = false`, matching `ipmId = unitId` **or** `ipmUnitId = unitId`) and builds a
`unitId → ipmUnitFactor` map. Every returned row gets a `book_qty = closingQty / unitFactor`
(when the factor > 0, else 0) alongside `book_base_qty = closingQty` (the raw base-unit closing
quantity). Decimal columns are coerced to numbers, with non-finite values falling back to `0`.

**`GET /get` (`getByScope`).** Queries `item_stock_balance` on the exact scope with
`isbUnitId IN {queryUnit ∪ price-master units}`, plus the optional `isb_stock_bucket`, ordered by
`isbStockBucket, isbId`. Throws `404 Item stock balance not found` when no rows match, and
`404 Item price master not found` when no price-master unit factors exist for the item/unit. Each
row is mapped to the full `ItemStockBalancePayload` (all `isb_*` quantity, valuation, "wot"
valuation, and audit fields).

**`GET /bulk-list` (`getBulkList`).** Runs in steps:
1. If any item-master filter is supplied (`item_group_id` / `item_brand_id` / `item_section_id` /
   `item_category_id`), it first resolves matching non-deleted `item_master` ids; **no matches →
   returns `[]`** (so the row `limit` never hides items that pass the filter).
2. Queries `item_stock_balance` by acc year / company / branch, with optional `isb_godown_id`,
   `isb_stock_bucket`, resolved item ids, and a `stock_type` filter — `ZERO` → `isbClosingQty = 0`,
   `NEGATIVE` → `isbClosingQty < 0`, `ALL` (or omitted) → no quantity filter. Ordered by item then
   unit, capped at `limit` (default `500`, hard cap `2000`). Empty result → `[]`.
3. Fetches related `item_master`, `unit`, `godown_location` and `item_price_master` rows in
   parallel. Price is matched by `item:unit:godown` first, then falls back to `item:unit` (any
   godown); `isb_to_base_factor` is `ipmToBaseFactor || ipmUnitFactor || 1`. Balances whose item is
   missing/deleted are dropped. Returns the flattened `BulkItemStockPayload` (names, book/free
   quantities, avg rates, MRP, cost).

**`GET /batch-options` (`getBatchOptionsByScope`).** Queries `item_batch_stock` on the exact scope
with `ibsIsActive = true` and `ibsIsDeleted = false`, including the related `ItemBatchMaster`
(`batch`). `search` (trimmed) does a case-insensitive `contains` across `ibsBatchNo`, `ibsSerialNo`
and the batch master's `btmBatchNo` / `btmMfgBatchNo` / `btmBarcode`. Ordered by batch no then
batch id, capped by `limit` (default `50`, hard cap `100`). Batch/mfg/expiry fields fall back from
the stock row to the batch master; each row maps to `ItemBatchStockOptionPayload`.

The service also exposes `getPriceMasterByItemAndUnit(itemId, unitId)`, which returns full
`ItemPricePayload[]` rows (reusing the `items-price-master` module's contract) and throws
`404 Item price master not found` when none exist; it is a helper and is not wired to a route.

## Validation

Query DTOs use `class-validator` / `class-transformer`. Values are trimmed via `@Transform`;
empty/blank optionals normalize to `undefined`.

- `GET /get` — required: `isb_acc_year` (string, max 9), `isb_company_id`, `isb_branch_id`,
  `isb_godown_id`, `isb_item_id`, `isb_unit_id` (all UUIDs); optional: `isb_stock_bucket`
  (string, max 20).
- `GET /bulk-list` — required: `isb_acc_year`, `isb_company_id`, `isb_branch_id`; optional UUIDs:
  `isb_godown_id`, `item_group_id`, `item_brand_id`, `item_section_id`, `item_category_id`;
  optional `stock_type` (`ALL` | `NEGATIVE` | `ZERO`), `isb_stock_bucket` (max 20), `limit`.
- `GET /batch-options` — required: `ibs_acc_year` (max 9), `ibs_company_id`, `ibs_branch_id`,
  `ibs_godown_id`, `ibs_item_id`, `ibs_unit_id` (all UUIDs); optional: `ibs_stock_bucket` (max 20),
  `search` (max 100), `limit` (max 3).

## Error handling

`ItemStockBalanceExceptionFilter` (`@Catch()` all) normalizes responses:

- Responses already in the module's `{ success: false, message, errors }` shape pass through
  unchanged (e.g. the service's 404s).
- `400` validation errors from the global `ValidationPipe` are reshaped into
  `{ field, message }[]`, inferring `field` from the message via a regex over the `isb_*` names
  (falling back to `request`).
- Other `HttpException`s become `{ success: false, message, errors: [] }`; any non-HTTP error
  becomes `500 Internal server error`.
