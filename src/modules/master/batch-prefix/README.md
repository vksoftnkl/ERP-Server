# Batch Prefix

CRUD API for **batch prefixes** — the prefix values tracked for generating item batch numbers.

- **Base route:** `batch-prefixes` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Batch Prefix`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `batches_prefix` (`public` schema) — PK `id` (uuid v7)

## Files

| File | Purpose |
| --- | --- |
| [batch-prefix.module.ts](batch-prefix.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [batch-prefix.controller.ts](batch-prefix.controller.ts) | HTTP routes + Swagger docs |
| [batch-prefix.service.ts](batch-prefix.service.ts) | Business logic, persistence, audit logging |
| [batch-prefix-exception.filter.ts](batch-prefix-exception.filter.ts) | Maps validation / domain / unknown errors to the module's `{ success, message, errors }` shape |
| [dto/save-batch-prefix.dto.ts](dto/save-batch-prefix.dto.ts) | Create/update payload (`id`, `prefixUsed`, `syncDate`) |
| [dto/list-batch-prefix-query.dto.ts](dto/list-batch-prefix-query.dto.ts) | List query params (`search`, `page`, `limit`) |
| [dto/batch-prefix-response.dto.ts](dto/batch-prefix-response.dto.ts) | Swagger response models |
| [types/batch-prefix-api.types.ts](types/batch-prefix-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a batch prefix, chosen by presence of `id`. |
| `GET` | `/list` | List batch prefixes with search and pagination. |
| `GET` | `/get` | Fetch one batch prefix by `id` (uuid). |
| `DELETE` | `/delete` | Delete a batch prefix by `id` (uuid). |

The `/get` and `/delete` `id` query param is validated by `ParseUUIDPipe({ version: '7' })`. The controller is decorated with `@CacheTTL(1)`.

### Create / update semantics

- **Omit `id` → create; include `id` → update** the existing record (`save` dispatches on `id`).
- On update, a non-existent `id` returns not-found.
- `prefixUsed` is trimmed and must be non-empty (`normalizeRequiredPrefix`); a blank value is rejected as a bad request.
- `syncDate` is optional and nullable. On **create** it defaults to `null` when absent. On **update** it is only written when the property is present in the body (`hasOwnProperty`); send `null` to clear it. Values are parsed as ISO-8601 date-times.
- On create, the service sets `createdBy` / `createdOn`; on update it sets `modifiedBy` / `modifiedOn`. The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- Each write runs inside a `$transaction` that persists the row and writes the audit log together.

### List

- Pagination is resolved via `resolvePagination` (`page` default 1, `limit` default 20, max 100).
- Runs through `runMasterListQuery`, which first attempts a configured-grid SQL query (`runConfiguredGridQuery`, table `batch prefix`, alias `batch_prefix_grid`) and otherwise falls back to a Prisma `count` + `findMany` ordered by `prefixUsed asc`, then `id asc`.
- `search` (trimmed) matches case-insensitively against `prefixUsed`, `createdBy`, and `modifiedBy`.
- The fallback response maps each row through `toPayload`; grid styles are loaded via `loadPrimaryGridStyles`.

## Business rules

- **Prefix uniqueness** is enforced case-insensitively (`ensurePrefixIsUnique`, excluding the current row on update), returning a conflict on a duplicate `prefixUsed`. A DB unique-constraint violation is also mapped to the same conflict (`throwOnUniqueConstraintError`).
- **Hard delete** — `delete` removes the row via `tx.batchPrefix.delete`; there is no soft-delete flag on this table. A Prisma `P2025` (record not found) is mapped to a not-found error.
- **Every mutation is audited** via `AuditLogService.logEntityChange` with `screenType: 'master'` and actions `New` (create), `update`, and `cancel` (delete), capturing original vs. modified payloads. The display name is `prefixUsed` (trimmed) or the `id` as a fallback (`buildDisplayName`).

## Responses & errors

- Success responses follow `{ success: true, message, data, meta? }` (`BatchPrefixSuccessResponse`).
- The exception filter returns the module error shape (`{ success: false, message, errors[] }`): it passes through already-shaped domain errors, reshapes Nest `ValidationPipe` 400s (inferring a field name from the known fields `id`, `prefixUsed`, `syncDate`, `search`, `page`, `limit`), and returns a generic `Internal server error` for non-HTTP exceptions.
