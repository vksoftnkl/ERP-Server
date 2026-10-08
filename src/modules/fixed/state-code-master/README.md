# State Code Master

CRUD API for **Indian GST state codes** — each row pairs a 2-character state code
(e.g. `MH` for Maharashtra, the primary key) with a state name, an optional 2-character
GST TIN code, and a union-territory flag.

- **Base route:** `state-code-masters` (API-versioned — every route carries `@Version(API_VERSION)`)
- **Swagger tag:** `State Code Master`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller-level `@CacheTTL(1)`
- **Primary table:** `state_codes` (`fixed` schema) — PK `stateCode` (`Char(2)`)

## Files

| File | Purpose |
| --- | --- |
| [state-code-master.module.ts](state-code-master.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service, and exception filter |
| [state-code-master.controller.ts](state-code-master.controller.ts) | HTTP routes + Swagger docs |
| [state-code-master.service.ts](state-code-master.service.ts) | Business logic, persistence, configured-grid listing, audit logging |
| [state-code-master-exception.filter.ts](state-code-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `stateCode` / `stateName` / `tinCode` / `isActive` / `stateUt`) |
| [dto/save-state-code-master.dto.ts](dto/save-state-code-master.dto.ts) | Create/update payload |
| [dto/list-state-code-master-query.dto.ts](dto/list-state-code-master-query.dto.ts) | List query params (search / pagination / boolean filters) |
| [dto/state-code-master-response.dto.ts](dto/state-code-master-response.dto.ts) | Swagger response models |
| [types/state-code-master-api.types.ts](types/state-code-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a state code (upsert keyed on `stateCode`). |
| `GET` | `/list` | List state codes with search + pagination via the configured grid. |
| `GET` | `/get` | Fetch one active state code by `stateCode` query param. |
| `DELETE` | `/delete` | Soft-delete a state code by `stateCode` query param. |

### Create / update semantics

- `/create` is an **upsert keyed on `stateCode`**: the service normalizes the code, looks it up
  with `findUnique`, then **updates when a row exists, otherwise creates** one.
- `stateCode` is normalized to **trimmed uppercase and must be exactly 2 characters**
  (`normalizeStateCode`); anything else is a `400`.
- `stateName` is required and trimmed (`normalizeRequiredText`).
- Optional fields (`stateUt`, `tinCode`, `isActive`) are applied only when present in the body
  (`applyPresentFields`); `tinCode` is a nullable 2-character uppercase value.
- On create, `createdOn` is stamped and `createdBy` resolved from the payload's `createdBy` or the
  request context; on update `modifiedOn` / `modifiedBy` are set the same way.
- **Update also restores:** a row is written back with `isDeleted = false`, so updating a
  previously soft-deleted code revives it (audit note *"State code restored and updated"* vs.
  *"State code updated"*).
- Each create/update runs inside a `$transaction` alongside its uniqueness check and audit write.

### Uniqueness & validation

- **State code uniqueness** is enforced by the primary key; a duplicate surfaces as a `409`
  via `throwOnUniqueConstraintError` (*"Duplicate stateCode is not allowed"*).
- **State name uniqueness** is case-insensitive across non-deleted rows
  (`ensureStateNameIsUnique`, excluding the current code) → `409`.

### Soft delete

- **Soft delete only** — rows are never hard-deleted. `/delete` runs in a `$transaction`, verifies
  an active (`isDeleted = false`) row exists, then sets `isDeleted = true`, `isActive = false`, and
  stamps `modifiedOn` / `modifiedBy`. Returns `{ stateCode, deleted: true }`.
- Missing / already-deleted codes on `get` and `delete` return `404`.

### Listing

- `/list` is served by `ConfiguredGridSqlService` through `runConfiguredGridQuery` (table
  `state codes`, alias `state_code_master_grid`), forwarding the `search` term and resolved
  pagination (`page` / `limit` / `skip`). If no configured grid is registered, the request fails
  with a `400`.
- The query DTO also declares optional `isActive` and `stateUt` boolean filters (accepting
  `true/false/1/0/yes/no/on/off`) alongside the inherited search/pagination params.

### Audit logging

Every mutation is recorded via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`),
capturing original vs. modified payloads under screen `State Code Master` (`screenType: 'master'`,
`pk = stateCode`). The acting user comes from `RequestContextService.getUserId()`, falling back to
`DEFAULT_ACTOR`.
