# Item Price Details

Read-only lookup API that assembles a single **item price detail** view within Inventory —
one item joined with its per-unit price rows and its default tax record — fetched by item id
or by barcode.

- **Base route:** `item-price-details` (API-versioned — every route carries `@Version(API_VERSION)`)
- **Swagger tag:** `Item Price Details`
- **Auth:** Bearer `access-token` (required)
- **Response caching:** `@CacheTTL(60)` (60 seconds)
- **Primary tables (all read-only):**
  - `item_master` — PK `item_id`
  - `item_price_master` — PK `ipm_id`, FK `ipm_item_id → item_id`
  - `item_tax_master` — PK `tax_id`, joined via `item_default_tax_id`

## Files

| File | Purpose |
| --- | --- |
| [item-price-details.module.ts](item-price-details.module.ts) | Module wiring — registers controller, service, and exception filter (service is **not** exported) |
| [item-price-details.controller.ts](item-price-details.controller.ts) | HTTP routes + Swagger docs |
| [item-price-details.service.ts](item-price-details.service.ts) | Fetch + aggregation logic and payload mapping |
| [item-price-detail-exception.filter.ts](item-price-detail-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches the `item_id` field name) |
| [dto/get-item-price-detail-query.dto.ts](dto/get-item-price-detail-query.dto.ts) | Query DTOs for the `item_id` and `barcode` lookups |
| [dto/item-price-detail-response.dto.ts](dto/item-price-detail-response.dto.ts) | Swagger response models |
| [types/item-price-detail-api.types.ts](types/item-price-detail-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch the item price detail view for one item by `item_id` (UUID). |
| `GET` | `/get-by-barcode` | Fetch the item price detail view for the item whose `item_default_barcode` matches `barcode`. |

Both routes validate their query params explicitly via `validateDto` (query DTOs in
[dto/get-item-price-detail-query.dto.ts](dto/get-item-price-detail-query.dto.ts)) and return
the same envelope: `{ success: true, message: 'Item price details fetched successfully', data }`.

## Query rules

- `GET /get` requires `item_id`, validated as a UUID (`@IsUUID('all')`).
- `GET /get-by-barcode` requires a non-empty string `barcode` (`@IsString`, `@IsNotEmpty`).

## Aggregation semantics

The response `data` is a single object with three parts
([`ItemPriceDetailPayload`](types/item-price-detail-api.types.ts)):

- `item` — the matched `item_master` row.
- `item_prices` — the item's active price rows from `item_price_master`
  (`ipm_item_id = item_id`, `ipm_is_deleted = false`), ordered by `ipm_unit_slno` then `ipm_id`.
- `item_tax` — the item's default tax row from `item_tax_master` (looked up by
  `item_default_tax_id`, `tax_is_deleted = false`), or `null` when the item has no default tax.

Behavior details, all grounded in [the service](item-price-details.service.ts):

- **Active rows only** — every lookup filters on the relevant `*_is_deleted = false` flag.
- **Barcode lookup delegates to id lookup** — `getByBarcode` first resolves the active item by
  `item_default_barcode`, then calls `getByItemId(itemId)`, so both endpoints share the same
  aggregation path.
- **Prices and tax are fetched concurrently** (`Promise.all`); the tax query is skipped entirely
  (resolves to `null`) when `item_default_tax_id` is unset.
- **Not found** — a missing/deleted item raises an Inventory "not found" error keyed on the
  `item_id` field (or `barcode` for the barcode route) via `throwInventoryNotFound`.
- **Decimal fields** are coerced to numbers (`toNumber`) and date fields serialized to ISO
  strings in the payload mapping; `item_photo` is base64-encoded.

This module performs **reads only** — there are no create, update, upsert, delete, or
soft-delete endpoints, and no audit logging.

## Reuse from other modules

This module composes, but does not export, work from sibling Inventory masters. Its response
payloads, DTOs, and types are reused from:

- `items-master` — `ItemPayload` / `ItemPayloadDto`
- `items-price-master` — `ItemPricePayload` / `ItemPricePayloadDto`
- `items-tax-master` — `ItemTaxPayload` / `ItemTaxPayloadDto`
