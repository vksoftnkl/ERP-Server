# State Master

CRUD API for **state masters** — the geography reference used across the sales domain. Each state
is created together with a linked **account group** that shares its primary key, so the state also
appears in the chart of accounts.

- **Base route:** `states` (API-versioned via `API_VERSION`)
- **Swagger tag:** `States`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `state_master` (`sales` schema) — PK `stmId`
- **Linked table:** `acc_group_master` (`accounts` schema) — PK `accGroupId`; a state's group row reuses the state's `stmId` as its id
- **Related table:** `city_master` — checked (via `ctmStateId`) to block deleting a state that still has cities

## Files

| File | Purpose |
| --- | --- |
| [state.module.ts](state.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [state.controller.ts](state.controller.ts) | HTTP routes + Swagger docs |
| [state.service.ts](state.service.ts) | Business logic, persistence, linked account-group sync, audit logging |
| [state-exception.filter.ts](state-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `stm*` field names) |
| [utils/state.utils.ts](utils/state.utils.ts) | Helpers + constants — name normalize/uniqueness, payload mapping, error throwers, fixed parent group id |
| [dto/save-state.dto.ts](dto/save-state.dto.ts) | Single create/update payload |
| [dto/state-response.dto.ts](dto/state-response.dto.ts) | Swagger response models |
| [types/state-api.types.ts](types/state-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a state, dispatched by `stmId` presence. |
| `GET` | `/get` | Fetch one active state by `stmId` (UUID v7). |
| `DELETE` | `/delete` | Soft-delete a state by `stmId` (UUID v7). |

## Create / update semantics

`POST /create` is a single write endpoint that branches on `stmId`:

- **Omit `stmId` → create.** Returns `StateMasterCreateResult` (`{ stateMaster, accGroupId }`) with
  HTTP `201`. The acting user is resolved in the controller from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- **Include `stmId` → update** the existing state. Returns the updated `StatePayload` with HTTP `200`.

### Create

Runs inside one `$transaction` (the rollback boundary — the group insert and the state insert
commit together; any throw rolls back **both** rows):

1. `ensureStateNameIsUnique` rejects a duplicate name.
2. Loads the **fixed parent "States" account group** (`STATES_ACCOUNT_GROUP_ID`,
   `019f081c-6764-73b0-b397-3f30a6efe73e`); a missing/deleted parent is a bad request. `parentId`
   is a service argument defaulting to this constant, so callers may override it.
3. Creates a child `acc_group_master` row: `accGroupName/Short/Description/Sort` are **mirrored from**
   the state's `stmName/stmShort/stmDescription/stmOrder`, while `company / type / nature / ledger
   profile` are **inherited from the parent** (they are `NOT NULL` and never client-supplied).
4. Creates the `state_master` row with `stmId` set **explicitly** to the new `accGroupId` — the two
   rows share a PK (the model has no `uuidv7()` default, so the assigned id is what persists).

### Update

Runs inside one `$transaction`: loads the existing non-deleted row, re-runs
`ensureStateNameIsUnique` (excluding itself), updates the mirrored/optional fields
(`applyStateOptionalFields`), then **syncs the linked account group** with the same derived subset.
The group sync uses `updateMany` on `accGroupId = stmId`, so it is a harmless no-op for legacy state
rows that have no linked group.

### Linked account-group mirroring notes

- `accGroupDescription` is capped to **250 chars** (the column is `VarChar(250)` while the master
  column is unbounded `Text`) so an over-long description can't abort the transaction.
- `accGroupSort` is `Math.trunc(stmOrder)` because it is an `Int` while `stmOrder` is a `Decimal`.
- `stmIsActive === false` collapses onto soft-delete state on both rows
  (`is_active = false` / `is_deleted = true`).

## Soft delete

`DELETE /delete` runs inside one `$transaction`:

- **Blocked when cities exist:** counts non-deleted `city_master` rows with `ctmStateId = stmId`;
  a positive count raises a bad request ("Cannot delete state with active cities").
- Flags the state `stmIsDeleted = true` / `stmIsActive = false` via `updateMany`.
- **Mirrors the soft delete** onto the linked account group (`accGroupIsDeleted = true` /
  `accGroupIsActive = false`) so it can't stay active while the state is logically deleted; no-op for
  legacy rows.
- **Soft delete only** — rows are never hard-deleted.

## Uniqueness & validation

- **State name uniqueness** is case-insensitive across non-deleted rows (`ensureStateNameIsUnique`),
  surfaced as a `409` conflict on `stmName`. `handleStateWriteError` is a safety net that also maps a
  DB unique-constraint violation to the same conflict shape.
- `stmName` is trimmed, required, and max 150 chars; `normalizeRequiredStateName` enforces a
  non-empty value.
- `stmId` on `GET /get` and `DELETE /delete` is validated by `ParseUUIDPipe({ version: '7' })`.

## Audit logging

Every mutation is recorded via `AuditLogService.logEntityChange` (`New` on create, `update` on
update, `cancel` on soft delete), capturing original vs. modified `StatePayload` records under
table name `state master` / screen `State Master` (`master` screen type). The acting user comes from
`RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
