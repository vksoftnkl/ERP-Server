# City Master

CRUD API for **city masters** — the geographic cities that live under a **state** and above
**areas** in the sales location hierarchy. Each city is created together with a linked
**account group** that shares its primary key.

- **Base route:** `cities` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Cities`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `city_master` (`sales` schema) — PK `ctm_id` (`ctmId`)
- **Linked table:** `acc_group_master` (`accounts` schema) — PK `acc_group_id`, created with the
  **same id** as `ctm_id`

## Files

| File | Purpose |
| --- | --- |
| [city.module.ts](city.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [city.controller.ts](city.controller.ts) | HTTP routes + Swagger docs |
| [city.service.ts](city.service.ts) | Business logic, persistence, linked account-group sync, audit logging |
| [city-exception.filter.ts](city-exception.filter.ts) | Extends `SalesExceptionFilter`; maps DB/domain errors to the module's error shape (matches `ctm*` field names) |
| [dto/save-city.dto.ts](dto/save-city.dto.ts) | Single create/update payload |
| [dto/city-response.dto.ts](dto/city-response.dto.ts) | Swagger response models |
| [types/city-api.types.ts](types/city-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a city, dispatched on `ctmId` presence. |
| `GET` | `/get` | Fetch one city by `ctmId` (validated as UUID v7). |
| `DELETE` | `/delete` | Soft-delete a city by `ctmId` (validated as UUID v7). |

### Create / update semantics

- **Omit `ctmId` → create; include `ctmId` → update** the existing city.
- The payload is a single object; there is no batch mode.
- **Create** (`createCityMaster`) and **update** (`updateCity`) each run inside a single
  `$transaction`, so the city write and the linked account-group write commit or roll back
  together.
- `ctmIsActive === false` collapses onto soft-delete state: **active → `ctmIsDeleted` false,
  inactive → true** (mirrored onto the account group's active/deleted flags).
- On update, optional fields are applied only when present in the payload
  (`applyPresentFields` over `ctmAlias`, `ctmShort`, `ctmOrder`, `ctmDescription`,
  `ctmIsActive`); `ctmStateId` falls back to the existing value when omitted.
- `GET /get` returns the city payload with `ctmStateName` resolved from `state_master`.

## Linked account group

A city master **shares its primary key** with an `acc_group_master` row.

- On **create**, the account group is inserted **first**, under the fixed parent group
  `CITY_ACCOUNT_GROUP_PARENT_ID` (`019f081c-6764-73b0-b397-3f30a6efe73e`), which must exist and
  be active; the parent must be found or the request fails with a bad-request. The city master
  is then inserted with `ctmId` set **explicitly** to the new `accGroupId`, overriding the
  `uuidv7()` default so the two rows share one id. `createCityMaster` accepts an optional
  `parentId` override argument (defaults to the fixed parent).
- Mirrored fields: `ctmName → accGroupName`, `ctmShort → accGroupShort`,
  `ctmDescription → accGroupDescription` (**capped to 250 chars** because the group column is
  `VarChar(250)` while `ctm_description` is unbounded `Text`), and
  `ctmOrder → accGroupSort` (**truncated to an integer** because `acc_group_sort` is `Int`).
  `accGroupCompanyId`, `accGroupType`, `accLedgerProfile`, and `accGroupNature` are **inherited
  from the parent group** (never client-supplied).
- On **update**, the same mirrored subset plus the active/deleted flags and modified
  audit fields are pushed to the account group via `updateMany`.
- On **soft delete**, `accGroupIsActive = false` / `accGroupIsDeleted = true` are mirrored the
  same way.
- All three sync writes use `updateMany` keyed on `accGroupId = ctmId`, so they are a **no-op
  for legacy city rows** that have no linked group and cannot fail the operation.

## Business rules

- **City name is required**, trimmed, max 150 chars (`ctmName`).
- **City name uniqueness is per state, case-insensitive** (`ensureNameIsUnique`, scoped by
  `ctmStateId`, excluding the current row on update).
- The target **state must exist and be active** (`ensureStateExists`, validates `ctmStateId`).
- **Database unique-constraint violations** are mapped to a conflict — `City already exists`
  (`throwOnUniqueConstraintError`).
- **Soft delete only** — deleting flags `ctmIsDeleted = true` / `ctmIsActive = false`; rows are
  never hard-deleted.
- **Delete is blocked while active areas reference the city** — if any `area_master` row has
  `armCityId = ctmId` and `armIsDeleted = false`, the request fails with a bad-request.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`) with `screenName` `City Master`, `screenType` `master`, capturing original vs.
  modified records. The acting user is resolved via `resolveActor(...)` from the payload's
  `ctmCreatedBy` / `ctmModifiedBy` and `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.
