# Configs

CRUD API for **application configuration settings** — flat key/value records where each row
carries a name (`configName`), a value (`configValue`), and an optional last-sync timestamp,
keyed by a client-supplied numeric id.

- **Base route:** `configs` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Configs`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `configs` (`public` schema) — PK `configId` (`Int`, client-supplied, not auto-generated)
- **Response caching:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [configs.module.ts](configs.module.ts) | Module wiring — imports `AuditLogModule`; provides the controller, service, and exception filter (service is **not** exported) |
| [configs.controller.ts](configs.controller.ts) | HTTP routes + Swagger docs |
| [configs.service.ts](configs.service.ts) | Business logic, persistence, audit logging |
| [configs-exception.filter.ts](configs-exception.filter.ts) | Extends the shared `SettingsExceptionFilter`, mapping DB/domain errors to `config*` field names |
| [dto/save-configs.dto.ts](dto/save-configs.dto.ts) | Create/update request payload + validation |
| [dto/configs-response.dto.ts](dto/configs-response.dto.ts) | Swagger response models (success single/list/delete + error shapes) |
| [types/configs-api.types.ts](types/configs-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a config, chosen by whether a row with the given `configId` already exists. |
| `GET` | `/get` | Fetch one config by `configId` (required integer query param). |
| `DELETE` | `/delete` | Delete a config by `configId` (required integer query param). |

All routes return the shared success envelope `{ success, message, data }`
([ConfigsSuccessResponse](types/configs-api.types.ts)).

## Create / update semantics

- `configId` is **always required** in the body ([`RequiredInteger(1)`](dto/save-configs.dto.ts));
  it is the caller-supplied primary key, not auto-generated.
- [`save()`](configs.service.ts) looks the row up by `configId`: **found → update, not found →
  create**. There is no separate insert/update route.
- Both create and update copy only the fields **present** on the payload
  (`configName`, `configValue`, `configSyncDate`) via `applyPresentFields`; omitted keys are
  left untouched, so updates behave as partial patches.
- `configSyncDate` is transformed from its ISO-8601 string to a `Date` (or `null`) before
  persistence (`CONFIGS_FIELD_TRANSFORMS`).
- On **create**, the service stamps `configCreatedOn = now` and `configCreatedBy`; on **update**,
  `configModifiedOn = now` and `configModifiedBy`. Each actor is resolved with `resolveActor`
  (payload-supplied `configCreatedBy` / `configModifiedBy` → request-context user id →
  `DEFAULT_ACTOR`).
- Create runs in a `$transaction`; a duplicate-`configId` unique-constraint violation is mapped
  to a conflict error (`Config already exists`) via `throwOnUniqueConstraintError`.
- Reads/writes/deletes on a missing `configId` throw `throwSettingsNotFound` (`Config not found`).

## Config values

The stored value is the plain nullable text column `configValue`, labelled by `configName` (both
`@db.Text`, both optional). Values are read verbatim through
[`getById`](configs.service.ts) and returned by [`toPayload`](configs.service.ts), which serialises
the timestamp columns (`configSyncDate`, `configCreatedOn`, `configModifiedOn`) to ISO strings.

## Delete

`DELETE /delete` performs a **hard delete** (`tx.configs.delete`) inside a transaction — the model
has no soft-delete/active columns. The removal is still audit-logged (action `cancel`) before the
response `{ configId, deleted: true }` is returned.

## Validation

- `configId` — required integer, minimum `1`.
- `configName`, `configValue` — nullable strings (`NullableString`).
- `configSyncDate` — nullable ISO-8601 date string (`NullableDateString`).
- `configCreatedBy`, `configModifiedBy` — nullable strings, max length `100`.

## Audit logging

Every mutation is recorded through `AuditLogService.logEntityChange` (run inside the same
transaction) with `tableName = 'configs'`, `screenName = 'Configs'`, `screenType = 'settings'`,
and `displayName = configName`:

- **create** → action `New` (original `null`, modified = new record).
- **update** → action `update` (original vs. modified records).
- **delete** → action `cancel` (original record, modified `null`).

The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
