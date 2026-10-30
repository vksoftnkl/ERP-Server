# Widget Master

CRUD API for **dashboard/form widget definitions** — the **sections** (heading rows such as
"Primary Information", "Price Details") that drive a screen's widget layout, together with each
section's nested **fields**.

- **Base route:** `widget-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Widget Master`
- **Auth:** Bearer `access-token` (required)
- **Response cache:** controller-wide `@CacheTTL(1)`
- **Primary table:** `form_section` (`fixed` schema) — PK `sectionId`, FK `sectionMenuId → menu.menuId`
- **Nested table:** `form_field` — PK `fieldId`, FK `fieldSectionId → sectionId` (`onDelete: Cascade`)

## Files

| File | Purpose |
| --- | --- |
| [widget-master.module.ts](widget-master.module.ts) | Module wiring — declares the controller, service, and exception filter |
| [widget-master.controller.ts](widget-master.controller.ts) | HTTP routes + Swagger docs |
| [widget-master.service.ts](widget-master.service.ts) | Business logic, persistence, field sync |
| [widget-master-exception.filter.ts](widget-master-exception.filter.ts) | Maps `HttpException` / validation errors to the module's `{ success, message, errors }` shape |
| [dto/save-widget.dto.ts](dto/save-widget.dto.ts) | Single section upsert payload (`SaveWidgetDto`) with its nested `SaveWidgetFieldDto` |
| [dto/save-bulk-widget.dto.ts](dto/save-bulk-widget.dto.ts) | Batch upsert payload (`{ data: [...] }`) |
| [dto/list-widget-query.dto.ts](dto/list-widget-query.dto.ts) | Query params for `GET /get` (filter by section id, menu id, platform, search) |
| [dto/widget-config-query.dto.ts](dto/widget-config-query.dto.ts) | Query params for `GET /config` (`menu_id`, `visibility`, `platform`) |
| [dto/update-widget-visibility.dto.ts](dto/update-widget-visibility.dto.ts) | Bulk visibility-update payload (`{ data: [...] }`) |
| [dto/widget-master-response.dto.ts](dto/widget-master-response.dto.ts) | Swagger response models |
| [types/widget-master-api.types.ts](types/widget-master-api.types.ts) | Payload / response TypeScript contracts + enums (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a single section together with its fields. |
| `POST` | `/create-bulk` | Create **or** update a non-empty array of sections in one transaction. |
| `GET` | `/get` | List sections (each with its ordered `fields[]`). Optional filters: `sectionId`, `sectionMenuId`, `sectionPlatform`, `search`. |
| `GET` | `/config` | Return a menu's widget config for `menu_id`, optionally filtered by `visibility` and `platform`. |
| `PATCH` | `/visibility` | Bulk-update section/field visibility config in one transaction. |
| `DELETE` | `/delete` | Delete a section by `sectionId` (query param, `ParseIntPipe`). |

## Create / update semantics

- **Omit `sectionId` → create; include `sectionId` → update** the existing section.
- On update, a missing `sectionId` returns **404** (`throwNotFound`).
- **`fields` is a full-sync of the section's children** ([`syncFields`](widget-master.service.ts)):
  fields with a `fieldId` (that still belongs to the section) are updated, fields without one are
  created, and any existing field not present in the array is deleted.
- **Omit `fields` entirely to leave existing fields untouched; send `[]` to remove all fields.**
- On create, defaults are applied: `sectionPosition = 0`, `sectionVisibility = true`,
  `fieldPosition = 0`, `fieldVisibility = true`. On update, omitted `sectionPosition` /
  `sectionVisibility` fall back to the existing row's value.
- `sectionName`, `sectionGuiName`, and `fieldName` are **trimmed** before persistence.

### Bulk create (`/create-bulk`)

- Each section in `data` follows the same create/update rules as `/create`.
- **All-or-nothing:** the whole array runs in one `$transaction`; if any section fails (e.g. a
  missing id 404) the batch is rolled back and nothing is persisted.

### Bulk visibility update (`/visibility`)

- Each section's `sectionVisibility` / `sectionGuiName` is updated by `sectionId`, and each field's
  `fieldVisibility` / `fieldSecondaryText` is updated by `fieldId`.
- A field must belong to its parent section (`fieldSectionId === sectionId`), otherwise **404**.
- Runs in a single transaction — any missing `sectionId` / `fieldId` aborts and rolls back the whole
  batch. Returns the updated sections (with their fields).

## Read semantics

- **`GET /get`** returns sections without pagination, ordered by `sectionPosition` then `sectionId`,
  each with its `fields[]` ordered by `fieldPosition` then `fieldId`. `search` matches the section
  name/gui name or any field's name / gui name / secondary text, **case-insensitive**.
- **`GET /config`** returns the sections for `menu_id`:
  - `visibility=false` → only hidden sections (`sectionVisibility = false`), each carrying its
    hidden fields **plus** any field that has secondary text (even when that field is itself visible).
  - `visibility=all` (or omitted) → both visible and hidden sections (and all their fields).
  - `platform`, when provided, restricts results to sections scoped to that platform.

## Delete semantics

- **Hard delete** — `DELETE /delete` removes the `form_section` row outright; its child fields are
  removed automatically via the `form_field` FK cascade (`onDelete: Cascade`).
- A missing `sectionId` returns **404**.

## Validation & other rules

- **No uniqueness constraints:** duplicate `sectionName` (per menu/platform) and duplicate
  `fieldName` within a section are allowed.
- `sectionId` / `fieldId` are re-validated in the service (`normalizeSectionId` /
  `normalizeFieldId`) to be positive integers, returning a **400** validation error otherwise.
- **Actor stamping (no audit-log module):** every mutation records the acting user in the
  `*CreatedBy` / `*UpdatedBy` columns. The actor comes from `RequestContextService.getUserId()`,
  falling back to `DEFAULT_ACTOR` for unauthenticated/background calls.
- The exception filter passes through the module's own error responses, reshapes Nest
  `ValidationPipe` errors into the `{ success, message, errors }` contract (inferring the offending
  `section*` / `field*` / `widget*` field name), and returns a generic **500** for anything else.

## Enums (app-layer)

Defined in [types/widget-master-api.types.ts](types/widget-master-api.types.ts). `sectionPlatform`
is stored as a free `varchar(255)`, but the API still validates against the known platforms.

- `WidgetPlatform` — `Mobile` · `Desktop` · `Web`
- `WidgetVisibilityFilter` (used by `GET /config`) — `false` · `all`
