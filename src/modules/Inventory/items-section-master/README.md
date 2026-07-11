# Item Sections Master

CRUD API for **item sections** — a self-referencing classification/grouping of items
(categories and sub-categories) with a materialized ancestor path, level, and POS-display
attributes (color, icon, photo).

- **Base route:** `item-sections` (each route is API-versioned via `@Version(API_VERSION)`, value from the `API_VERSION` env var)
- **Swagger tag:** `Item Sections`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_section_master` (`inventory` schema) — PK `sec_id`
- **Self-reference:** `sec_parent_id → sec_id` (parent/child hierarchy)

## Files

| File | Purpose |
| --- | --- |
| [items-section-master.module.ts](items-section-master.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service, and exception filter |
| [items-section-master.controller.ts](items-section-master.controller.ts) | HTTP routes + Swagger docs; merges multipart `sec_photo` upload into the payload |
| [items-section-master.service.ts](items-section-master.service.ts) | Business logic, persistence, hierarchy/path maintenance, audit logging |
| [item-section-exception.filter.ts](item-section-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `sec_*` field names) |
| [dto/save-item-section.dto.ts](dto/save-item-section.dto.ts) | Single create/update payload |
| [dto/item-section-response.dto.ts](dto/item-section-response.dto.ts) | Swagger response / payload models |
| [types/item-section-api.types.ts](types/item-section-api.types.ts) | Payload and error/response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an item section (chosen by `sec_id` presence). Accepts `application/json` **or** `multipart/form-data` (file field `sec_photo`). |
| `GET` | `/get` | Fetch one item section by `sec_id` (required, UUID v7). Only active (non-deleted) records. |
| `DELETE` | `/delete` | Toggle soft-delete **or** restore an item section by `sec_id` (UUID v7). |

## Create / update semantics

- **Omit `sec_id` → create; include `sec_id` → update** the existing section
  (`ItemsSectionMasterService.save` branches on `sec_id`).
- `sec_name` is trimmed before persistence. Optional fields are applied only when present on the
  payload (`applyOptionalFields` uses `hasOwnProperty`), so omitted keys are left unchanged on update.
- Each write runs inside a Prisma `$transaction`.
- **Photo input** (`sec_photo`) accepts a base64 string, a `data:*;base64,...` URL, or raw bytes
  (`Buffer` / `Uint8Array`); for `multipart/form-data` the uploaded file's buffer is injected by
  the controller. Empty or malformed base64/binary is rejected as a bad request (`decodePhotoInput`).
  Responses return `sec_photo` as a base64 string.

## Hierarchy, level and path

- **Level** is derived, not client-controlled: a root section (no parent) is level `1`; a child is
  `parentLevel + 1` (`resolveSectionLevel`).
- **Parent must exist and be active** — an invalid `sec_parent_id` is a bad request
  (`ensureParentExists`).
- A section **cannot be its own parent** on update (`sec_parent_id === sec_id` → bad request).
- `sec_path_ids` holds a materialized ancestor-path (each node's id plus its ancestors). On create,
  the node is added to its own path and appended to every ancestor's path. When a parent changes on
  update, the moved subtree's ids are removed from old ancestors and appended to new ancestors
  (`getActiveSubtreeIds`, `getAncestorIds`, `appendPathIds`, `removePathIds`); cycles are guarded via a
  visited set.

## Soft delete / restore

- `DELETE /delete` **toggles** state: an active section is soft-deleted (`sec_is_deleted = true`), a
  deleted one is restored. The response `deleted` flag reports the resulting state and drives the
  response message.
- Rows are never hard-deleted; the update is guarded (`updateMany` filtered on the previously-read
  `sec_is_deleted`) so it no-ops if state changed concurrently.
- On delete, the section's active-subtree ids are pulled out of ancestor paths; on restore they are
  re-appended.

## Validation & uniqueness

- `sec_name` — required, non-empty, max 150 chars. Other fields are optional with max lengths:
  `sec_alias` 100, `sec_short` 50, `sec_description` 250, `sec_color_code` 20, `sec_icon` 100;
  `sec_sort` / `sec_level` / `sec_position` are integers; `sec_parent_id` is a nullable UUID.
- `sec_id` (body) is validated as a UUID; the `sec_id` query param is parsed as **UUID v7**.
- **Name uniqueness** — a DB unique-constraint violation on the section name is surfaced as a
  conflict on `sec_name` (`handleWriteError` → `throwOnUniqueConstraintError`).

## Audit logging

- Every mutation is recorded via `AuditLogService.logEntityChange` with screen name
  `Item Section Master`, screen type `master`, table `item section master`, and actions
  `New` (create), `update` (update / restore) or `cancel` (soft delete), capturing original vs.
  modified records.
- The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Response shape

- Get/single responses embed the parent's name as `sec_parent_name` (resolved via `getParentName`);
  create/update responses do not populate it.
