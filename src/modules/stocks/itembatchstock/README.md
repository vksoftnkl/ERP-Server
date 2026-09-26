# Item Batch Stock

Read-only query API for **batch-wise item stock** — the per-batch closing/free/reserved/available
quantities, valuation, and expiry dates that a single item carries across an account year, company,
branch, and godown scope.

- **Base route:** `item-batch-stock` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Item Batch Stock`
- **Auth:** Bearer `access-token` (required)
- **Response cache:** `@CacheTTL(60)` (60 s)
- **Primary table:** `item_batch_stock` (`inventory` schema) — PK `ibsId`
- **Joined table:** `item_batch_master` — PK `btmId`, FK `ibsBatchId → btmId` (included as `batch`)
- **Also read:** `item_price_master` — PK `ipmId`, for unit-factor conversion (not written)

## Files

| File | Purpose |
| --- | --- |
| [itemBatchStockModule.ts](itemBatchStockModule.ts) | Module wiring — controller, service, and the exception filter as a provider (service is **not** exported) |
| [itemBatchStockController.ts](itemBatchStockController.ts) | HTTP route + Swagger docs; applies the module exception filter and a 60 s cache TTL |
| [itemBatchStockService.ts](itemBatchStockService.ts) | Query logic, batch-master join, unit-factor conversion, payload mapping |
| [itemBatchStockExceptionFilter.ts](itemBatchStockExceptionFilter.ts) | Maps HTTP/validation/domain errors to the module's `{ success, message, errors }` shape |
| [dto/get-item-batch-stock-query.dto.ts](dto/get-item-batch-stock-query.dto.ts) | Query-string DTO with trimming/boolean coercion transforms |
| [dto/item-batch-stock-response.dto.ts](dto/item-batch-stock-response.dto.ts) | Swagger success/error response models |
| [types/item-batch-stock-api.types.ts](types/item-batch-stock-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch batch stock rows for an exact acc-year / company / branch / godown / item / unit scope. |

This module exposes **only reads** — there is no create, update, or delete route, so no audit
logging or soft-delete flow lives here (the `ibsIsActive` / `ibsIsDeleted` columns are used purely
as query filters).

## Query semantics

The `/get` query (`GetItemBatchStockQueryDto`) has six **required** scope fields and five optional
filters:

- **Required:** `ibs_acc_year` (≤ 9 chars), `ibs_company_id`, `ibs_branch_id`, `ibs_godown_id`,
  `ibs_item_id`, `ibs_unit_id` (all UUIDs). String fields are trimmed before validation.
- **Optional:** `ibs_batch_id` (UUID), `ibs_stock_bucket` (≤ 20 chars — omit to return all buckets),
  `ibs_is_active` (defaults to `true`), `ibs_is_deleted` (defaults to `false`), and `search`.
- Boolean flags accept `1/true/yes/on` and `0/false/no/off` (case-insensitive) in addition to real
  booleans.
- Results are ordered by `ibsStockBucket`, then `ibsExpiryDate`, then `ibsBatchNo`, then `ibsBatchId`
  (all ascending) — i.e. bucket first, nearest expiry first (FEFO-friendly).

### Search

When `search` is present it runs a case-insensitive `contains` across the stock row's `ibsBatchNo`
and `ibsSerialNo`, and the joined batch master's `btmBatchNo`, `btmMfgBatchNo`, and `btmBarcode`.

## Unit-factor conversion (book quantities)

Every stock quantity is stored in the item's **base unit**; the response also reports it in the
caller's requested **display unit**:

- `getItemPriceUnitFactors` loads non-deleted `item_price_master` rows for the item where either
  `ipmId` **or** `ipmUnitId` equals `ibs_unit_id`, mapping each unit id → `ipmUnitFactor`.
- The stock query is then widened to **all** unit ids discovered in that map (plus the requested
  unit), so alternate-unit rows for the same item are returned too (`ibsUnitId in (...)`).
- Per row, the unit factor is chosen by the row's own `ibsUnitId`, falling back to the requested
  `ibs_unit_id`.
- `book_*` fields = base qty ÷ unit factor (a `0` or negative factor yields `0`); `book_*_base_qty`
  fields echo the raw base-unit qty. This applies to closing, free, reserved, and available
  quantities.

## Batch / expiry handling

The payload prefers the stock row's own snapshot and falls back to the joined batch master:

- `ibs_batch_no` ← `ibsBatchNo` ?? `batch.btmBatchNo`
- `ibs_mfg_date` ← `ibsMfgDate` ?? `batch.btmMfgDate`; `ibs_expiry_date` ← `ibsExpiryDate` ?? `batch.btmExpiryDate`
- `ibs_mfg_batch_no`, `ibs_batch_date`, and `ibs_barcode` come from the batch master only.
- Dates are serialized to ISO strings (or `null`); `ibs_row_version` is a `BigInt` serialized as a
  string.

## Not-found & error behavior

- If the scope query matches **no rows**, the service throws `404` with message
  *"Item batch stock not found"* and a `scope` field detail echoing every scope value.
- If no matching `item_price_master` exists for the item/unit (empty factor map, or a row whose unit
  has no factor), it throws `404` *"Item price master not found"*.
- `ItemBatchStockExceptionFilter` normalizes all responses to `{ success: false, message, errors }`:
  it passes through already-shaped module errors, remaps Nest `400` validation payloads (inferring the
  offending `ibs_*` / `search` field name from the message), forwards other `HttpException`s, and
  returns a generic `500 Internal server error` for anything else.
