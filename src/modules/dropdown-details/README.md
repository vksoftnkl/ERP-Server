# Dropdown Details

Configuration-driven API for the UI's **lookup dropdowns**. Each dropdown is a stored record
holding a SQL query plus a set of display columns; the `/run` endpoint executes that query on
demand and returns paginated, searchable rows to populate the actual select box. The rest of the
endpoints manage the dropdown configuration and its per-column display settings.

- **Base route:** `dropdown-details` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Dropdown Details`
- **Auth:** Bearer `access-token` (required)
- **Caching:** controller-level `@CacheTTL(1)`
- **Primary table:** `dropdown_details` (`fixed` schema) — PK `dropdown_id` (autoincrement int)
- **Child table:** `dropdown_columns` (`fixed` schema) — PK `dropdown_columns_id` (uuidv7),
  FK `dropdown_columns_dropdown_id → dropdown_id` (`onDelete: Cascade`)
- **Run source:** any table referenced by a dropdown's stored `dropdown_sql` (e.g.
  `inventory.item_master`), executed read-only through `ConfiguredGridSqlService`

## Files

| File | Purpose |
| --- | --- |
| [dropdown-details.module.ts](dropdown-details.module.ts) | Module wiring — imports `AuditLogModule` |
| [dropdown-details.controller.ts](dropdown-details.controller.ts) | HTTP routes + Swagger docs |
| [dropdown-details.service.ts](dropdown-details.service.ts) | Config persistence, SQL execution, audit logging |
| [dropdown-detail-exception.filter.ts](dropdown-detail-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `dropdown_*` field names) |
| [dto/save-dropdown-detail.dto.ts](dto/save-dropdown-detail.dto.ts) | Create/update payload for a dropdown + its nested columns |
| [dto/save-dropdown-column.dto.ts](dto/save-dropdown-column.dto.ts) | A single nested dropdown column entry |
| [dto/list-dropdown-detail-query.dto.ts](dto/list-dropdown-detail-query.dto.ts) | Query params for `GET /get` (`dropdownId`, `search`) |
| [dto/run-dropdown-query.dto.ts](dto/run-dropdown-query.dto.ts) | Query params for `GET /run` (`dropdown_id`, `search`, `page`, `limit`, `dropdown_param`) |
| [dto/save-column-width.dto.ts](dto/save-column-width.dto.ts) | Batch column-width update payload (`{ columns: [...] }`) |
| [dto/save-filter-settings.dto.ts](dto/save-filter-settings.dto.ts) | Batch column filter-flag update payload |
| [dto/save-visibility-settings.dto.ts](dto/save-visibility-settings.dto.ts) | Batch column visibility-flag update payload |
| [dto/dropdown-detail-response.dto.ts](dto/dropdown-detail-response.dto.ts) | Swagger response models |
| [dto/dropdown-run-response.dto.ts](dto/dropdown-run-response.dto.ts) | Swagger response model for `GET /run` |
| [types/dropdown-detail-api.types.ts](types/dropdown-detail-api.types.ts) | Payload / response TypeScript contracts |
| [types/dropdown-detail-enum.types.ts](types/dropdown-detail-enum.types.ts) | Device-type value set (see below) |

## Endpoints

All routes are versioned via `@Version(API_VERSION)`.

| Method | Path | Query / Body | Description |
| --- | --- | --- | --- |
| `POST` | `/create` | Body `SaveDropdownDetailDto` | Create **or** update a dropdown config with nested columns. |
| `GET` | `/get` | `dropdownId?`, `search?` | List dropdown configs (with their columns), optionally filtered. |
| `GET` | `/run` | `dropdown_id`, `search?`, `page?`, `limit?`, `dropdown_param?` | Execute a dropdown's configured SQL and return paginated rows. |
| `PUT` | `/column-width` | Body `{ columns: [{ dropdown_columns_id, dropdown_columns_width }] }` | Update width for one or more columns. |
| `PUT` | `/filter-settings` | Body `{ columns: [{ dropdown_columns_id, dropdown_columns_filter }] }` | Update the filter flag for one or more columns. |
| `PUT` | `/visibility-settings` | Body `{ columns: [{ dropdown_columns_id, dropdown_columns_visiblity }] }` | Update the visibility flag for one or more columns. |
| `DELETE` | `/column-delete` | `dropdown_columns_id` (UUID) | Delete a single dropdown column. |
| `DELETE` | `/delete` | `dropdown_id` (numeric) | Delete a dropdown config (cascades to its columns). |

## Requesting a specific dropdown's data

The module has two layers: the **configuration** (`dropdown_details` + `dropdown_columns`,
managed via `/create`, `/get`, the `PUT` setting routes and the `DELETE` routes) and the
**live data** for a dropdown, fetched through `GET /run`.

To populate a dropdown, a caller selects it by its numeric key and asks the server to run it:

```
GET /dropdown-details/run?dropdown_id=1&page=1&limit=20&search=abc&dropdown_param={"company_id":2}
```

What the service does ([`run`](dropdown-details.service.ts)):

1. Looks up `dropdown_details` by `dropdown_id` and reads its stored `dropdown_sql`
   (404 if the dropdown does not exist; 400 if it has no configured SQL).
2. Validates the base SQL via `ConfiguredGridSqlService` (`extractTopLevelFromTableName` +
   `validateBaseSql`); an invalid configuration returns 400.
3. If `dropdown_param` is supplied, its values are substituted into the SQL
   (`substituteGridPrm`) before execution.
4. Runs the query as a **read-only paged query** (`runPagedQuery`, alias `cdropdown`) applying
   `limit`/`skip` from `page`/`limit` and the optional `search` term.
5. If the configured SQL is malformed (it is **not** execution-validated at save time), the raw
   DB failure is translated into a clean 400 rather than a 500.

**Response shape** — rows come back exactly as the configured SQL projects them (not a fixed
`{ value, label }` shape), wrapped with pagination metadata:

```json
{
  "success": true,
  "message": "Dropdown data fetched successfully",
  "data": {
    "items": [ { "...": "columns from dropdown_sql" } ],
    "meta": { "page": 1, "limit": 20, "total": 100 }
  }
}
```

**Search scope** — when `search` is present, only columns flagged with
`dropdown_columns_filter = true` are searched. Their SQL field names are derived from the
configured columns via `deriveSearchableFieldNamesFromColumns`.

**`dropdown_param` rules** — must be a JSON **object**; each key must match
`^[a-z_][a-z0-9_]*$`; each value must be `boolean` / `number` / `string` / `null` (non-finite
numbers are rejected). Malformed JSON, arrays, or bad key/value types return 400.

**Pagination** — `page` defaults to `1`, `limit` defaults to `20` (min `1`, max `100`).

**Sort config is metadata** — `dropdown_sort_order` / `dropdown_sort_column` are stored on the
config and returned with the dropdown, but `GET /run` does not inject an `ORDER BY`; ordering
comes from the configured SQL itself.

## Listing dropdown configs

`GET /get` returns the dropdown configurations themselves (each with its `columns` array),
ordered by `dropdownName` then `dropdownId`; columns are ordered by `dropdown_columns_no` then
`dropdown_columns_id`. It accepts `dropdownId` (select one config) and `search`
(case-insensitive match on `dropdown_name` or `dropdown_description`).

## Create / update semantics

- **Omit `dropdown_id` → create; include `dropdown_id` → update** ([`save`](dropdown-details.service.ts)).
- Nested `dropdown_columns[]` are upserted: an item **with** `dropdown_columns_id` updates that
  row, an item **without** one inserts a new column. `dropdown_columns_name` and
  `dropdown_columns_data_type` must be non-empty (revalidated server-side).
- **`replace_columns`** (default `false`): when `true`, columns not present in the payload are
  deleted (full replace); when `false`/omitted, the provided columns are only created/updated and
  existing ones are left in place. Removal otherwise goes through `DELETE /column-delete`.
- Each create/update runs in a single `$transaction`.

## Business rules

- **Hard delete.** `DELETE /delete` removes the `dropdown_details` row (its `dropdown_columns`
  cascade away); `DELETE /column-delete` removes a single column. There is no soft-delete flag.
- **Auditing.** Create, update and both delete flows call
  `AuditLogService.logEntityChange` (`New` / `update` / `cancel`) with screen name
  `Dropdown Details`. The acting user comes from `RequestContextService.getUserId()`, falling
  back to `DEFAULT_ACTOR`. The per-column setting updates (`/column-width`, `/filter-settings`,
  `/visibility-settings`) run in a transaction but are **not** audited.

## Device types

[types/dropdown-detail-enum.types.ts](types/dropdown-detail-enum.types.ts) exports
`dropDownDeviceTypes` — a plain constant object describing the intended values for
`dropdown_device_type`:

- `Desktop` · `Mobile` · `Tablet` · `All`

It is a value set, not a TypeScript `enum`, and is not enforced by the DTO — `dropdown_device_type`
is validated as a nullable free-text string.
