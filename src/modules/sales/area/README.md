# Area Master

CRUD API for **sales areas** (territory master) — the geographic area a customer belongs to,
each created together with a mirrored **account group** that shares its primary key.

- **Base route:** `areas` (API-versioned via `@Version(API_VERSION)`, value from the `API_VERSION` env var)
- **Swagger tag:** `Areas`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `area_master` (`sales` schema) — PK `armId`
- **Linked table:** `acc_group_master` (`accounts` schema) — PK `accGroupId`, created with the **same id** as `armId`

## Files

| File | Purpose |
| --- | --- |
| [area.module.ts](area.module.ts) | Module wiring — imports `AuditLogModule`; provides the controller, service, and exception filter (service is **not** exported) |
| [area.controller.ts](area.controller.ts) | HTTP routes + Swagger docs; dispatches create vs. update on `armId` presence |
| [area.service.ts](area.service.ts) | Business logic, persistence, linked account-group sync, audit logging |
| [area-exception.filter.ts](area-exception.filter.ts) | Extends `SalesExceptionFilter`; maps DB/domain errors to the module's error shape, matching `arm*` field names |
| [dto/save-area.dto.ts](dto/save-area.dto.ts) | Single create/update payload |
| [dto/area-response.dto.ts](dto/area-response.dto.ts) | Swagger response models |
| [types/area-api.types.ts](types/area-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an area (dispatched by `armId` presence). |
| `GET` | `/get` | Fetch one area by `armId` (query param, UUID v7); resolves the linked city name. |
| `DELETE` | `/delete` | Soft-delete an area by `armId` (query param, UUID v7). |

There is no list-all endpoint — `GET /get` returns a **single** area, and `armId` is required
(validated by `ParseUUIDPipe({ version: '7' })`). All responses are wrapped as
`{ success, message, data }`.

## Create / update semantics

- **Omit `armId` → create; include `armId` → update** the existing area.
- **Create (`createAreaMaster`)** runs in a `$transaction` that is the rollback boundary: it
  first inserts an `acc_group_master` row, then inserts the `area_master` row with `armId` set
  **explicitly** to the new `accGroupId` (overriding the `uuidv7()` default) so the two rows
  share one primary key. If either insert throws, **both** roll back.
- The parent account group is fixed
  (`AREA_ACCOUNT_GROUP_PARENT_ID = 019f081c-6764-73b0-b397-3f30a6efe73e`); the create method
  accepts an optional `parentId` override argument. The parent must exist and be active, and the
  new group **inherits** `accGroupCompanyId`, `accGroupType`, `accLedgerProfile`, and
  `accGroupNature` from it (these are never client-supplied).
- **Update (`updateArea`)** runs in a `$transaction`, re-validates city and name uniqueness, then
  writes the area and re-syncs the linked account group.
- `armIsActive` collapses onto soft-delete state: `armIsActive === false` sets
  `armIsDeleted = true` (and the mirror sets `accGroupIsDeleted = true`).
- `armDistanceKm` is only written when the client actually sent it, so an omitted value keeps the
  DB default (`0`) instead of being forced to null. On create, `armCollectionDays` defaults to `[]`.
- Optional fields on update are applied only when present in the payload (`applyPresentFields`
  over `armAlias`, `armShort`, `armSort`, `armDistanceKm`, `armCollectionDays`, `armDescription`,
  `armIsActive`).

## Linked account-group sync

Every area master mirrors a subset of its fields into the account group that shares its `armId`:

- **On create** — `accGroupName ← armName`, `accGroupShort ← armShort`,
  `accGroupDescription ← armDescription` (**capped at 250 chars** because `acc_group_description`
  is `VarChar(250)` while the master column is unbounded `Text`), `accGroupSort ← Math.trunc(armSort)`
  (`acc_group_sort` is `Int`; `arm_sort` is `Decimal`), plus the active/deleted flags and audit
  columns.
- **On update** — the same mirrored subset is re-applied via `accountGroup.updateMany`.
- **On soft delete** — the group is flagged `accGroupIsActive = false` / `accGroupIsDeleted = true`.

The update and delete mirrors use `updateMany`, so they are a **no-op** for legacy area rows that
have no linked account group (they can't fail the area write).

## Soft delete

- **Soft delete only** — `softDelete` flags `armIsDeleted = true` / `armIsActive = false`; rows are
  never hard-deleted.
- **Guard:** deletion is refused (bad request) when active customers reference the area
  (`customer.count` on `cusAreaId` with `cusIsDeleted = false`), reporting how many customers use it.
- The linked account group is soft-deleted in the same transaction (see above).

## Validation & uniqueness

- **Area name required** — `armName` is trimmed and normalized (`normalizeRequiredText`); empty
  names are rejected.
- **Name uniqueness is per city, case-insensitive** (`ensureNameIsUnique`) — a duplicate area name
  within the same `armCityId` raises a conflict. A Prisma unique-constraint violation is also mapped
  to a conflict (`throwOnUniqueConstraintError`).
- **City must exist and be active** (`ensureCityExists`) — `armCityId` is validated against
  `city_master` (`ctmIsDeleted = false`) on both create and update.
- The exception filter surfaces offending `arm*` field names in error details.

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange`, run inside the same transaction:

- Actions: `New` (create), `update`, `cancel` (soft delete).
- `tableName: 'area master'`, `screenName: 'Area Master'`, `screenType: 'master'`, capturing
  original vs. modified records.
- The acting user is resolved via `resolveActor` / `RequestContextService.getUserId()`, falling
  back to `DEFAULT_ACTOR`.
