# UI Table Master

CRUD API for **UI table definitions** — the per-grid metadata the frontend uses to render data
tables — together with each table's nested **column definitions** (name, order, width,
visibility, focus, position, necessity, and next/previous links).

- **Base route:** `ui-table-masters` (API-versioned via `@Version(API_VERSION)`, driven by the `API_VERSION` env var)
- **Swagger tag:** `UI Table Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `ui_tables` (`fixed` schema) — PK `uiTblId`
- **Nested table:** `ui_table_columns` — PK `uiTblClmId`, FK `uiTblClmTableId → uiTblId`
- **Caching:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [ui-table-master.module.ts](ui-table-master.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service, and filter |
| [ui-table-master.controller.ts](ui-table-master.controller.ts) | HTTP routes + Swagger docs |
| [ui-table-master.service.ts](ui-table-master.service.ts) | Business logic, persistence, audit logging |
| [ui-table-master-exception.filter.ts](ui-table-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `uiTbl*` field names via regex) |
| [dto/save-ui-table-master.dto.ts](dto/save-ui-table-master.dto.ts) | Create/update payload for a table (with nested `uiTblColumns[]`) |
| [dto/save-ui-table-column.dto.ts](dto/save-ui-table-column.dto.ts) | A single nested column create/update entry |
| [dto/save-ui-table-column-width.dto.ts](dto/save-ui-table-column-width.dto.ts) | Batch column-width update payload (`{ columns: [...] }`) |
| [dto/save-ui-table-visibility-settings.dto.ts](dto/save-ui-table-visibility-settings.dto.ts) | Batch column display-settings payload (`{ columns: [...] }`) — width, visibility, focus, position, necessity, next/previous |
| [dto/list-ui-table-master-query.dto.ts](dto/list-ui-table-master-query.dto.ts) | Query filters for the list endpoint |
| [dto/ui-table-master-response.dto.ts](dto/ui-table-master-response.dto.ts) | Swagger response models (success + delete/update results; re-exports the shared error DTOs) |
| [dto/ui-table-column-response.dto.ts](dto/ui-table-column-response.dto.ts) | Swagger response model for a single column |
| [types/ui-table-master-api.types.ts](types/ui-table-master-api.types.ts) | Payload / response TypeScript contracts (re-exports the shared `Fixed*` error/success types) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a table (chosen by `uiTblId` presence), including its nested columns. |
| `GET` | `/get` | List active tables with their active columns; filter by `uiTableId`/`uiTblId` or `search` (name). |
| `PUT` | `/column-width` | Batch-update `uiTblClmColumnWidth` for one or more columns. |
| `PUT` | `/visibility-settings` | Batch-update column display settings (width, visibility, focus, position, necessity, next/previous) for one or more columns. |
| `DELETE` | `/column-delete` | Soft-delete a single column by `uiTblClmId` (query param). |
| `DELETE` | `/delete` | Soft-delete a table by `uiTblId` (query param). |

### Create / update semantics

- **Omit `uiTblId` → create; include `uiTblId` → update** the existing table.
- `uiTblName` is **required on create** (`ValidateIf(!uiTblId)`), trimmed, max 500 chars. On
  update it is only applied when a non-empty value is sent.
- The whole save runs inside a single `$transaction` (all-or-nothing).

### Nested columns

A table's columns are managed through the `uiTblColumns[]` array on the create/update payload
(`saveColumnsInTx` / `upsertColumnInTx`):

- Item **with** `uiTblClmId` → updates that row; item **without** → inserts a new row.
- `uiTblClmName` is required per column (empty is rejected as a bad request).
- The server always sets each column's `uiTblClmTableId` to the parent table's id.
- On **update**, omitting `uiTblColumns` leaves existing columns untouched.
- **`replaceColumns: true`** performs a full replace: after the provided columns are upserted,
  any other non-deleted column of that table is soft-deleted. Freshly created columns are kept
  (their ids are collected into `keptIds` so the replace step does not wipe them).
- `applyPresentFields` copies only present optional column fields (`uiTblClmColumnWidth`,
  `uiTblClmColumnVisibility`, `uiTblClmColumnFocus`, `uiTblClmColumnPosition`,
  `uiTblClmColumnNecessity`, `uiTblClmNextColumn`, `uiTblClmPreviousColumn`, `uiTblClmIsActive`).

### Batch column updates

- `PUT /column-width` and `PUT /visibility-settings` each iterate their `columns[]` in one
  `$transaction`, verify every column exists and is not deleted (else `404`), update only the
  target fields plus `uiTblClmModifiedOn`/`uiTblClmModifiedBy`, and return `{ updated: <count> }`.
- `PUT /visibility-settings` takes `uiTblClmId` (required) plus any of `uiTblClmColumnWidth`,
  `uiTblClmColumnVisibility`, `uiTblClmColumnFocus`, `uiTblClmColumnPosition`,
  `uiTblClmColumnNecessity`, `uiTblClmNextColumn`, `uiTblClmPreviousColumn`. Fields omitted from
  an item are left untouched; `uiTblClmColumnWidth`, `uiTblClmNextColumn` and
  `uiTblClmPreviousColumn` accept `null`.
- These two batch updates are **not** written to the audit log.

## Business rules

- **Table name uniqueness** is case-insensitive among non-deleted rows (`ensureNameIsUnique`),
  and a DB unique-constraint violation is also mapped to a conflict on `uiTblName`
  (`throwOnUniqueConstraintError`).
- **Soft delete only** — deleting a table sets `uiTblIsDeleted = true` / `uiTblIsActive = false`;
  deleting a column sets `uiTblClmIsDeleted = true` / `uiTblClmIsActive = false`. (Deleting a
  table does not cascade to its columns.)
- **Numeric id validation** — `uiTblId` / `uiTblClmId` path/query values must be all-digit
  strings (`parseBigIntId`), else a bad request. BigInt ids are serialized to strings in
  responses.
- **List/get** returns only non-deleted tables (ordered by `uiTblId`) with their non-deleted
  columns (ordered by `uiTblClmNo`, then `uiTblClmId`).

## Audit logging

Table create/update/delete mutations are audited via `AuditLogService.logEntityChange`, capturing
original vs. modified records:

- Create → `New`, update → `update`, soft delete → `cancel`.
- Table events log under `tableName` `ui tables`; column soft-delete logs under `ui table columns`;
  both use `screenName` `UI Table Master`, `screenType` `master`.
- The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`
  (via `resolveActor`).
