# Price Level Master

Read-only lookup API for **price levels** — the named pricing tiers (e.g. `Retail` / `RTL`)
that item-pricing and rate modules reference when resolving a rate. This module only exposes
a read endpoint over the `fixed.price_levels` table; it does not create, update, or delete rows.

- **Base route:** `price-level-masters` (API-versioned via `API_VERSION`, applied per-route with `@Version`)
- **Swagger tag:** `Price Level Master`
- **Auth:** Bearer `access-token` (required)
- **Caching:** controller-level `@CacheTTL(1)`
- **Primary table:** `price_levels` (`fixed` schema) — PK `priceLvlId`

## Files

| File | Purpose |
| --- | --- |
| [price-level-master.module.ts](price-level-master.module.ts) | Module wiring — registers the controller and service (no exports) |
| [price-level-master.controller.ts](price-level-master.controller.ts) | HTTP route + Swagger docs |
| [price-level-master.service.ts](price-level-master.service.ts) | Query building, filtering, and payload mapping over Prisma |
| [dto/get-price-level-master-query.dto.ts](dto/get-price-level-master-query.dto.ts) | Query-string filters for `GET /get` |
| [dto/price-level-master-response.dto.ts](dto/price-level-master-response.dto.ts) | Swagger success / error / payload response models |
| [types/price-level-master-api.types.ts](types/price-level-master-api.types.ts) | Payload, meta, and response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch one price level by `priceLvlId`, or list all matching price levels. Defaults to active, non-deleted rows. |

### Query parameters

All parameters are optional query-string fields ([GetPriceLevelMasterQueryDto](dto/get-price-level-master-query.dto.ts)):

- **`priceLvlId`** — integer (minimum `1`). When supplied, restricts the result to that id; when omitted, all matching rows are returned.
- **`activeOnly`** — boolean, **defaults to `true`**. When true, filters `priceLvlIsActive = true`.
- **`includeDeleted`** — boolean, **defaults to `false`**. When false, filters `priceLvlIsDeleted = false`; set true to also return soft-deleted rows.

### Query behavior

- Results are ordered by `priceLvlName` ascending, then `priceLvlId` ascending.
- **404 only in single-fetch mode:** when `priceLvlId` is supplied and no row matches, the service throws `NotFoundException`. A list query with no matches returns an empty array (not an error).
- Every response carries a `meta` object echoing the resolved filters and result `count`: `{ priceLvlId?, activeOnly, includeDeleted, count }`.
- The success `message` reflects the mode — singular (`Price level fetched successfully`) when `priceLvlId` is set, plural otherwise.

### Response payload

Each item ([PriceLevelMasterPayload](types/price-level-master-api.types.ts)) exposes `priceLvlId`, `priceLvlName`, `priceLvlShort` (nullable), the `priceLvlIsActive` / `priceLvlIsAdmin` / `priceLvlIsDeleted` flags, and the audit columns `priceLvlSyncDate`, `priceLvlCreatedOn` / `priceLvlCreatedBy`, `priceLvlModifiedOn` / `priceLvlModifiedBy`. Date columns are serialized to ISO strings (`priceLvlSyncDate` is `null` when unset).
