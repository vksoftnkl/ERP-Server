# Freight Charges

CRUD API for **freight charges** — a sales master that stores freight/loading rates keyed to
distance (`from`/`to` km) and weight (`from`/`to`) ranges, plus load and unload charges.

- **Base route:** `freight-charges` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Freight Charges`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `freight_charges` (`sales` schema) — PK `frId`

## Files

| File | Purpose |
| --- | --- |
| [freight-charges.module.ts](freight-charges.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service, and exception filter |
| [freight-charges.controller.ts](freight-charges.controller.ts) | HTTP routes + Swagger docs |
| [freight-charges.service.ts](freight-charges.service.ts) | Business logic, persistence, audit logging |
| [freight-charges-exception.filter.ts](freight-charges-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `fr*` field names) |
| [dto/save-freight-charges.dto.ts](dto/save-freight-charges.dto.ts) | Single create/update payload |
| [dto/freight-charges-response.dto.ts](dto/freight-charges-response.dto.ts) | Swagger response models |
| [types/freight-charges-api.types.ts](types/freight-charges-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a freight-charges row (by presence of `frId`). |
| `GET` | `/get` | Fetch one freight-charges row by `frId` query param. |
| `DELETE` | `/delete` | Soft-delete a freight-charges row by `frId` query param. |

- `GET /get` and `DELETE /delete` take `frId` as a query param validated by `ParseUUIDPipe({ version: '7' })`.
- Responses use the shared envelope `{ success, message, data }`
  ([FreightChargesSuccessResponse](types/freight-charges-api.types.ts)).

## Create / update semantics

- **Omit `frId` → create; include `frId` → update** the existing row. The controller inspects
  `dto.frId`: with it, the request routes through `save`/`updateFreightCharges` and returns
  `200 OK`; without it, `createFreightCharges` runs and returns `201 Created`.
- **Create** seeds every numeric field, defaulting `frFromKm`, `frToKm`, `frFreightChrg`,
  `frFromWeight`, `frToWeight`, `frLoadChrg`, and `frUnloadChrg` to `0` when omitted. Active state
  is derived from the payload: `frIsActive === false` stores the row as inactive **and** deleted
  (`frIsDeleted = true`).
- **Update** is a partial patch — only fields actually present in the body are applied
  (`applyPresentFields` over the optional-field list `frFromKm`, `frToKm`, `frFreightChrg`,
  `frFromWeight`, `frToWeight`, `frLoadChrg`, `frUnloadChrg`, `frIsActive`). Missing fields are
  left untouched.
- The acting user is resolved from `frCreatedBy` / `frModifiedBy` in the body, falling back to
  `RequestContextService.getUserId()` and then `DEFAULT_ACTOR`.
- Both create and update run inside a `$transaction` and map any Prisma unique-constraint
  violation to a `409` **"Freight charges already exists"** / "Duplicate freight charges range is
  not allowed" error on `frFromKm` (`throwOnUniqueConstraintError`).

## Business rules

- **Soft delete only** — rows are never hard-deleted. `DELETE /delete` flags
  `frIsDeleted = true` / `frIsActive = false` and stamps `frModifiedOn` / `frModifiedBy`, via a
  guarded `updateMany` inside a transaction; a missing or already-deleted row raises a `404`
  "Freight charges not found" (`throwSalesNotFound`).
- **Reads exclude deleted rows** — `getById` and the delete/update lookups filter on
  `frIsDeleted: false`.
- **Decimal fields are normalized** in responses: `frFreightChrg`, `frFromWeight`, `frToWeight`,
  `frLoadChrg`, and `frUnloadChrg` are converted to numbers (`toNumber`), returning `null` for
  absent/zero values.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`) with `screenType: 'master'`, a `FR-{frFromKm}-{frToKm}` display name, and the original
  vs. modified records.
