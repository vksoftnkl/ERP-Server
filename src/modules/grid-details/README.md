# Grid Details

CRUD API for **configured data-grid definitions** — each grid stores a read-only base `SELECT`
(`grid_sql`) plus the ordered **column** definitions (width, alignment, visibility, filter,
formatting) that the UI renders. Configs are validated and stored here; the SQL is **executed
elsewhere** (see [Running a grid](#running-a-grid)), always on a read-only DB connection with
parameter binding — the same pattern used by dropdown-details.

- **Base route:** `grid-details` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Grid Details`
- **Auth:** Bearer `access-token` (required)
- **Caching:** controller-level `@CacheTTL(1)`
- **Errors:** all routes run through [GridDetailExceptionFilter](grid-detail-exception.filter.ts)
- **Primary table:** `grid_details` (`fixed` schema) — PK `gridId` (BigInt, autoincrement, maps `grid_id`)
- **Nested table:** `grid_columns` (`fixed` schema) — PK `gridColumnId` (UUID v7, maps `grid_column_id`), FK `gridId → grid_details.gridId` (`onDelete: Cascade`)

## Files

| File | Purpose |
| --- | --- |
| [grid-details.module.ts](grid-details.module.ts) | Module wiring — imports `AuditLogModule`; provides the service and exception filter |
| [grid-details.controller.ts](grid-details.controller.ts) | HTTP routes + Swagger docs (incl. a create/update example payload) |
| [grid-details.service.ts](grid-details.service.ts) | Business logic, persistence, `grid_sql` validation, audit logging |
| [grid-detail-exception.filter.ts](grid-detail-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `grid_*` field names) |
| [dto/save-grid-detail.dto.ts](dto/save-grid-detail.dto.ts) | Create/update payload for a grid, with a nested `grid_columns[]` array |
| [dto/save-grid-column.dto.ts](dto/save-grid-column.dto.ts) | A single column definition inside `grid_columns[]` |
| [dto/list-grid-detail-query.dto.ts](dto/list-grid-detail-query.dto.ts) | Query params for `GET /get` (`gridId`, hidden `grid_id`, `search`) |
| [dto/save-column-width.dto.ts](dto/save-column-width.dto.ts) | Bulk column-width update payload (`{ columns: [...] }`) |
| [dto/save-filter-settings.dto.ts](dto/save-filter-settings.dto.ts) | Bulk column-filter-flag update payload |
| [dto/save-visibility-settings.dto.ts](dto/save-visibility-settings.dto.ts) | Bulk column-visibility-flag update payload |
| [dto/grid-detail-response.dto.ts](dto/grid-detail-response.dto.ts) | Swagger response models (payload + success/error envelopes) |
| [types/grid-detail-api.types.ts](types/grid-detail-api.types.ts) | Payload / response TypeScript contracts |
| [types/grid-detail-enum.ts](types/grid-detail-enum.ts) | App-layer enum (see below) |

## Endpoints

All routes are `@Version(API_VERSION)`.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a grid config plus its nested columns. |
| `GET` | `/get` | List grid configs (each with active columns). Filter by grid id and/or search. |
| `PUT` | `/column-width` | Bulk-set `grid_column_width` for one or more columns (by `grid_column_id`). |
| `PUT` | `/filter-settings` | Bulk-set `grid_column_filter` for one or more columns. |
| `PUT` | `/visibility-settings` | Bulk-set `grid_column_visibility` for one or more columns. |
| `DELETE` | `/column-delete` | Soft-delete a single column by `grid_column_id` (UUID query param). |
| `DELETE` | `/delete` | Soft-delete a grid by `grid_id` (numeric query param) and its columns. |

### Selecting / listing grids (`GET /get`)

- `gridId` (or the hidden alias `grid_id`) → returns just that grid; omitted → all non-deleted grids.
- `search` matches `gridName` **or** `gridDescription`, case-insensitive (`contains`).
- Grids are ordered by `gridSortOrder` then `gridName`; each grid's columns are ordered by
  `gridColumnNumber` then `gridColumnId`, and only non-deleted columns are included.
- There is no dedicated get-by-id route — single-grid reads go through `GET /get?gridId=`.

### Create / update semantics (`POST /create`)

- **Omit `grid_id` → create; include `grid_id` → update** the existing grid.
- `grid_name` is required (trimmed, max 200) and `grid_device_type` is required (enum, see below);
  optional grid fields (`grid_description`, `grid_sort_column`, `grid_sort_order`, `grid_sql`,
  `grid_status`, `grid_device_type`) are written **only when the property is present** on the body
  (`hasOwnProperty`) — so updates are partial.
- The whole operation (grid + all columns + audit log) runs in a single `$transaction`.
- The response message reflects create vs. update based on whether `grid_id` was supplied.

### Nested columns

Columns are managed through the `grid_columns[]` array on the create/update payload:

- Item **with** `grid_column_id` (UUID) → updates that column; **without** → inserts a new one.
- Each column requires `grid_column_name` (trimmed, non-empty → else `400`) and
  `grid_column_number` (integer ≥ 1); other column fields apply only when present.
- On **update**, `replace_columns: true` soft-deletes any existing active column **not** listed in
  `grid_columns` (full replace); when `false`/omitted, listed columns are only created/updated and
  the rest are left untouched. On create the array is inserted as-is (empty/omitted → no columns).

### `grid_sql` validation (at save time)

`grid_sql` is normalized before it is stored, via `ConfiguredGridSqlService`:

- SQL comments (`--`, `/* */`) are stripped first, so inline notes are accepted and don't break the
  later `SELECT * FROM (<grid_sql>) AS ...` wrapping; an empty result is stored as `null`.
- The SQL must be a `SELECT` with a resolvable **top-level `FROM` table**
  (`extractTopLevelFromTableName`) and must pass `validateBaseSql`; failures raise `400`
  ("Invalid grid_sql configuration").
- The normalized SQL is persisted **as-is and is not executed at save time** (no `LIMIT 0` probe),
  so a query referencing columns/tables that don't yet exist in this environment can still be saved.

## Running a grid

This module only **stores and validates** grid configs — it does not execute `grid_sql`. Execution
lives in the sibling `common/configured-grid-sql` module (Swagger tag *Configured Grid SQL*):

- `GET /configured-grid-sql/columns?grid_id=` — column styles for a grid.
- `GET /configured-grid-sql/run?grid_id=` — runs the stored base SQL and returns rows + metadata.
  Supports pagination (`page`, `limit`), `search`, sorting (`sort_by`, `sort_dir`), and an optional
  `grid_param` JSON object. Parameter values are bound into the SQL's named `p_*` tokens as
  positional `$N` parameters (`bindGridParams`) — **never string-concatenated** — and the query runs
  on `PgService`'s read-only pool (`default_transaction_read_only=on`), so writes/DDL are rejected by
  PostgreSQL itself. Because the stored SQL was only checked syntactically, schema-drift errors
  (SQLSTATE class `42`) surface at run time as `400` rather than an opaque `500`.

## Business rules

- **Soft delete only** — nothing is hard-deleted. `DELETE /delete` sets `gridIsDeleted = true` and
  `gridStatus = false` on the grid and soft-deletes its columns; `DELETE /column-delete` soft-deletes
  a single column. List/get filter on `gridIsDeleted = false` / `gridColumnIsDeleted = false`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`)
  under screen name *Grid Details*, capturing original vs. modified records. The acting user comes
  from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`; it is written to
  `gridCreatedBy` / `gridModifiedBy` (and the column equivalents).
- **Id validation** — `grid_id` must be a numeric string (`parseBigIntId`) and `grid_column_id` a
  valid UUID (`parseUuidId`); malformed ids raise `400`. Missing rows on update/delete raise `404`.

## Enums

Defined in [types/grid-detail-enum.ts](types/grid-detail-enum.ts):

- `gridDeviceTypeEnum` — `desktop` · `mobile` · `web` (used for `grid_device_type`).
