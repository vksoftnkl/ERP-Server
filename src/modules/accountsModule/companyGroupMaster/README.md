# Company Group Master

CRUD API for **company groups** — named groupings that map a set of companies together via a
UUID list (`cogCompanyIds`) for cross-company reporting/selection.

- **Base route:** `company-group-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Company Group Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `company_group_master` (`public` schema) — PK `cogGroupId` (UUID v7)

## Files

| File | Purpose |
| --- | --- |
| [company-group-master.module.ts](company-group-master.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [company-group-master.controller.ts](company-group-master.controller.ts) | HTTP routes + Swagger docs |
| [company-group-master.service.ts](company-group-master.service.ts) | Business logic, persistence, audit logging |
| [company-group-master-exception.filter.ts](company-group-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `cog*` field names) |
| [dto/save-company-group-master.dto.ts](dto/save-company-group-master.dto.ts) | Single create/update payload |
| [dto/company-group-master-response.dto.ts](dto/company-group-master-response.dto.ts) | Swagger response models |
| [types/company-group-master-api.types.ts](types/company-group-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a company group (chosen by `cogGroupId` presence). |
| `GET` | `/get` | Fetch one active company group by `cogGroupId` (required UUID v7 query param). |
| `DELETE` | `/delete` | Soft-delete a company group by `cogGroupId` (required UUID v7 query param). |

The controller is decorated with `@CacheTTL(1)`.

### Create / update semantics

- **Omit `cogGroupId` → create; include `cogGroupId` → update** the existing group.
- **Single object only** — there is no batch/bulk mode; the payload is one
  [SaveCompanyGroupMasterDto](dto/save-company-group-master.dto.ts).
- `cogGroupName` is trimmed, required, non-empty, and capped at 80 chars
  (`TrimmedString(80)` / `normalizeRequiredText`).
- `cogCompanyIds` is a **UUID list**. The DTO accepts an array, a JSON-encoded array, or a CSV
  string, then trims and **de-duplicates** it (`toUniqueStringArray`); every entry must be a valid
  UUID (`IsUUID('all', { each: true })`, `ArrayUnique`). The service de-duplicates again
  (`toUniqueIds`) before persisting.
- `cogIsActive` is optional and only written when present on the payload; new rows default to the
  DB default (`true`).
- Each write runs in its own `$transaction`.

## Business rules

- **Group name uniqueness** is global across non-deleted rows and **case-insensitive**
  (`ensureGroupNameIsUnique`, excludes the current row on update) → `409 Conflict`. A Prisma
  unique-constraint violation is also caught and mapped to the same conflict shape
  (`throwOnUniqueConstraintError`).
- **Not found** — get/update/delete against a missing or already-deleted id returns `404`
  (`throwAccountsNotFound`).
- **Soft delete only** — rows are never hard-deleted. Deleting flags `cogIsDeleted = true` /
  `cogIsActive = false` and stamps `cogModifiedOn` / `cogModifiedBy`, all inside a transaction.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), with `screenType: 'master'`, capturing original vs. modified records. The acting user
  comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- Responses are serialized through `toPayload`, exposing the group fields with timestamps rendered
  as ISO strings (`cogSyncDate` may be `null`).
