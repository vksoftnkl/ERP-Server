# Sale Freight Charges

CRUD API for **sale freight charges** — a sales master that stores distance-slab freight rates
(`from`/`to` km, `from`/`to` weight), optionally scoped to a company/branch. Split out of the
former `freight-charges` module; loading/unloading charges now live in the separate
[sale-loading-charges](../sale-loading-charges/README.md) module.

- **Base route:** `sale-freight-charges` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Sale Freight Charges`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_freight_charges` (`sales` schema) — PK `frId`

## Files

| File | Purpose |
| --- | --- |
| [sale-freight-charges.module.ts](sale-freight-charges.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service, and exception filter |
| [sale-freight-charges.controller.ts](sale-freight-charges.controller.ts) | HTTP routes + Swagger docs |
| [sale-freight-charges.service.ts](sale-freight-charges.service.ts) | Business logic, persistence, audit logging |
| [sale-freight-charges-exception.filter.ts](sale-freight-charges-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `fr*` field names) |
| [dto/save-sale-freight-charges.dto.ts](dto/save-sale-freight-charges.dto.ts) | Single create/update payload |
| [dto/sale-freight-charges-response.dto.ts](dto/sale-freight-charges-response.dto.ts) | Swagger response models |
| [types/sale-freight-charges-api.types.ts](types/sale-freight-charges-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a sale-freight-charge row (by presence of `frId`). |
| `GET` | `/get` | Fetch one sale-freight-charge row by `frId` query param. |
| `DELETE` | `/delete` | Soft-delete a sale-freight-charge row by `frId` query param. |

- `GET /get` and `DELETE /delete` take `frId` as a query param validated by `ParseUUIDPipe({ version: '7' })`.
- Responses use the shared envelope `{ success, message, data }`
  ([SaleFreightChargeSuccessResponse](types/sale-freight-charges-api.types.ts)).

## Create / update semantics

- **Omit `frId` → create; include `frId` → update** the existing row. The controller inspects
  `dto.frId`: with it, the request routes through `save`/`updateSaleFreightCharge` and returns
  `200 OK`; without it, `createSaleFreightCharge` runs and returns `201 Created`.
- **Create** seeds every numeric field, defaulting `frFromKm`, `frToKm`, `frFreightChrg`,
  `frFromWeight`, and `frToWeight` to `0` when omitted, and `frCompanyId`/`frBranchId` to `null`.
  Active state is derived from the payload: `frIsActive === false` stores the row as inactive
  **and** deleted (`frIsDeleted = true`).
- **Update** is a partial patch — only fields actually present in the body are applied
  (`applyPresentFields` over the optional-field list `frCompanyId`, `frBranchId`, `frFromKm`,
  `frToKm`, `frFreightChrg`, `frFromWeight`, `frToWeight`, `frIsActive`). Missing fields are left
  untouched.
- The acting user is resolved from `frCreatedBy` / `frModifiedBy` in the body, falling back to
  `RequestContextService.getUserId()` and then `DEFAULT_ACTOR`.
- Both create and update run inside a `$transaction`. A Prisma unique-constraint violation maps to
  a `409` **"Sale freight charge already exists"** error on `frFromKm`
  (`throwOnUniqueConstraintError`); a foreign-key violation on `frCompanyId`/`frBranchId` maps to a
  `400` **"Invalid relation reference"** error (`isForeignKeyConstraintError`).

## Business rules

- **Soft delete only** — rows are never hard-deleted. `DELETE /delete` flags
  `frIsDeleted = true` / `frIsActive = false` and stamps `frModifiedOn` / `frModifiedBy`, via a
  guarded `updateMany` inside a transaction; a missing or already-deleted row raises a `404`
  "Sale freight charge not found" (`throwSalesNotFound`).
- **Reads exclude deleted rows** — `getById` and the delete/update lookups filter on
  `frIsDeleted: false`.
- **Decimal fields are normalized** in responses: `frFreightChrg`, `frFromWeight`, and `frToWeight`
  are converted to numbers (`toNumber`), returning `null` for absent/zero values.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`) with `screenType: 'master'`, a `FR-{frFromKm}-{frToKm}` display name, and the original
  vs. modified records.
