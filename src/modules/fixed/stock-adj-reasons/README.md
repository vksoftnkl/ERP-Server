# Stock Adjustment Reasons

Read-only lookup API for **stock adjustment reasons** — the fixed catalogue of reasons a
physical-stock adjustment can be recorded against (e.g. `DAMAGE`, `EXPIRY`), each carrying a
reason kind, a default resolution and whether it affects accounts.

- **Base route:** `stock-adj-reasons` (API-versioned via `API_VERSION` — [`@Version(API_VERSION)`](stock-adj-reasons.controller.ts))
- **Swagger tag:** `Stock Adj Reasons`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `stock_adj_reasons` (`fixed` schema) — PK `sarId` (uuidv7), unique `sarCode`
- **Caching:** responses cached with `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [stock-adj-reasons.module.ts](stock-adj-reasons.module.ts) | Module wiring — registers the controller and service |
| [stock-adj-reasons.controller.ts](stock-adj-reasons.controller.ts) | HTTP route + Swagger docs |
| [stock-adj-reasons.service.ts](stock-adj-reasons.service.ts) | Query building, Prisma read, payload mapping |
| [dto/get-stock-adj-reasons-query.dto.ts](dto/get-stock-adj-reasons-query.dto.ts) | Query-string filters for `GET /get` |
| [dto/stock-adj-reasons-response.dto.ts](dto/stock-adj-reasons-response.dto.ts) | Swagger success / error / payload models |
| [types/stock-adj-reasons-api.types.ts](types/stock-adj-reasons-api.types.ts) | Payload / meta / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Fetch one reason by `sarId`, or list reasons filtered by `sarCode` / `sarReasonKind`. Defaults to active, non-deleted rows. |

This module is **read-only** — it exposes no create, update, or delete routes.

## Query semantics

All filters come from the query string ([GetStockAdjReasonsQueryDto](dto/get-stock-adj-reasons-query.dto.ts)):

- **`sarId`** — validated UUID; when supplied, an empty result throws `NotFoundException`
  (`Stock adjustment reason not found for sarId ...`). Other filters return an empty list instead.
- **`sarCode`** and **`sarReasonKind`** — trimmed strings (max 30 chars), matched
  **case-insensitively** (`mode: 'insensitive'`).
- **`activeOnly`** — boolean, defaults to `true`; restricts to `sarIsActive = true`.
- **`includeDeleted`** — boolean, defaults to `false`; excludes `sarIsDeleted = true` rows unless enabled.
- Results are ordered by `sarCode` then `sarId` (both ascending).
- The response `meta` echoes the applied filters plus a `count` of returned rows, and the success
  `message` is singular when `sarId` was supplied, plural otherwise.

## Payload fields

Each row is mapped by `toPayload` ([service](stock-adj-reasons.service.ts)) to:
`sarId`, `sarCode`, `sarName`, `sarReasonKind`, `sarDefaultResolution`, `sarAffectsAccounts`,
`sarIsActive`, `sarIsDeleted`, `sarCreatedOn`/`sarModifiedOn` (ISO strings; modified may be `null`),
and `sarCreatedBy`/`sarModifiedBy` (nullable). `sarReasonKind` and `sarDefaultResolution` are stored
as free-text `VarChar(30)` values, not app enums.

## Cross-module relation

The `StockAdjReason` model is referenced by `PhysicalStockDetail`
(`physicalStockDetails PhysicalStockDetail[]`, relation `PhysicalStockDetailReason`) — physical-stock
adjustment lines point at a reason. The service itself is **not exported**, so this module is
consumed over HTTP rather than composed into other services.
