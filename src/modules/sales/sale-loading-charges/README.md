# Sale Loading Charges

CRUD API for **sale loading charges** — a sales master that stores weight-slab load/unload rates
(`from`/`to` weight, load charge, unload charge), company/branch agnostic. Split out of the former
`freight-charges` module; distance-based freight rates now live in the separate
[sale-freight-charges](../sale-freight-charges/README.md) module.

- **Base route:** `sale-loading-charges` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Sale Loading Charges`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_loading_charges` (`sales` schema) — PK `ilcId`

## Files

| File | Purpose |
| --- | --- |
| [sale-loading-charges.module.ts](sale-loading-charges.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service, and exception filter |
| [sale-loading-charges.controller.ts](sale-loading-charges.controller.ts) | HTTP routes + Swagger docs |
| [sale-loading-charges.service.ts](sale-loading-charges.service.ts) | Business logic, persistence, audit logging |
| [sale-loading-charges-exception.filter.ts](sale-loading-charges-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `ilc*` field names) |
| [dto/save-sale-loading-charges.dto.ts](dto/save-sale-loading-charges.dto.ts) | Single create/update payload |
| [dto/sale-loading-charges-response.dto.ts](dto/sale-loading-charges-response.dto.ts) | Swagger response models |
| [types/sale-loading-charges-api.types.ts](types/sale-loading-charges-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a sale-loading-charge row (by presence of `ilcId`). |
| `GET` | `/get` | Fetch one sale-loading-charge row by `ilcId` query param. |
| `DELETE` | `/delete` | Soft-delete a sale-loading-charge row by `ilcId` query param. |

- `GET /get` and `DELETE /delete` take `ilcId` as a query param validated by `ParseUUIDPipe({ version: '7' })`.
- Responses use the shared envelope `{ success, message, data }`
  ([SaleLoadingChargeSuccessResponse](types/sale-loading-charges-api.types.ts)).

## Create / update semantics

- **Omit `ilcId` → create; include `ilcId` → update** the existing row. The controller inspects
  `dto.ilcId`: with it, the request routes through `save`/`updateSaleLoadingCharge` and returns
  `200 OK`; without it, `createSaleLoadingCharge` runs and returns `201 Created`.
- **Create** seeds every numeric field, defaulting `ilcFromWeight`, `ilcToWeight`, `ilcLoadChrg`,
  and `ilcUnloadChrg` to `0` when omitted. Active state is derived from the payload:
  `ilcIsActive === false` stores the row as inactive **and** deleted (`ilcIsDeleted = true`).
- **Update** is a partial patch — only fields actually present in the body are applied
  (`applyPresentFields` over the optional-field list `ilcFromWeight`, `ilcToWeight`, `ilcLoadChrg`,
  `ilcUnloadChrg`, `ilcIsActive`). Missing fields are left untouched.
- The acting user is resolved from `ilcCreatedBy` / `ilcModifiedBy` in the body, falling back to
  `RequestContextService.getUserId()` and then `DEFAULT_ACTOR`.
- Both create and update run inside a `$transaction` and map any Prisma unique-constraint
  violation to a `409` **"Sale loading charge already exists"** / "Duplicate sale loading charge
  range is not allowed" error on `ilcFromWeight` (`throwOnUniqueConstraintError`).

## Business rules

- **Soft delete only** — rows are never hard-deleted. `DELETE /delete` flags
  `ilcIsDeleted = true` / `ilcIsActive = false` and stamps `ilcModifiedOn` / `ilcModifiedBy`, via a
  guarded `updateMany` inside a transaction; a missing or already-deleted row raises a `404`
  "Sale loading charge not found" (`throwSalesNotFound`).
- **Reads exclude deleted rows** — `getById` and the delete/update lookups filter on
  `ilcIsDeleted: false`.
- **Decimal fields are normalized** in responses: `ilcFromWeight`, `ilcToWeight`, `ilcLoadChrg`,
  and `ilcUnloadChrg` are converted to numbers (`toNumber`), returning `null` for absent/zero
  values.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`) with `screenType: 'master'`, an `ILC-{ilcFromWeight}-{ilcToWeight}` display name, and
  the original vs. modified records.
