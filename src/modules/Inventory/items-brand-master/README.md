# Item Brands

CRUD API for **item brands** — a self-referencing brand hierarchy (a brand can have a parent
brand and children) used to classify inventory items, with an optional brand photo/logo and a
materialized ancestor path.

- **Base route:** `item-brands` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Item Brands`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_brand_master` (`inventory` schema) — PK `brand_id` (uuidv7)
- **Self-relation:** `brand_parent_id → brand_id` (`BrandHierarchy`), plus a `brand_path_ids`
  uuid array holding each brand's ancestor/self path

## Files

| File | Purpose |
| --- | --- |
| [items-brand-master.module.ts](items-brand-master.module.ts) | Module wiring — imports `AuditLogModule`, registers controller, service, and exception filter |
| [items-brand-master.controller.ts](items-brand-master.controller.ts) | HTTP routes + Swagger docs; folds an uploaded photo file into the payload |
| [items-brand-master.service.ts](items-brand-master.service.ts) | Business logic, persistence, hierarchy/path maintenance, audit logging |
| [item-brand-exception.filter.ts](item-brand-exception.filter.ts) | Extends `InventoryExceptionFilter`, matching `brand_*` field names in DB/domain errors |
| [dto/save-item-brand.dto.ts](dto/save-item-brand.dto.ts) | Single create/update payload |
| [dto/item-brand-response.dto.ts](dto/item-brand-response.dto.ts) | Swagger response models |
| [types/item-brand-api.types.ts](types/item-brand-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a single item brand (create when `brand_id` is omitted, update when present). Consumes `application/json` **or** `multipart/form-data`. |
| `GET` | `/get` | Fetch one active item brand by required `brand_id` query param (validated as UUID v7). |
| `DELETE` | `/delete` | Toggle soft-delete/restore of an item brand by `brand_id`. |

### Create / update semantics

- **Omit `brand_id` → create; include `brand_id` → update** the existing brand
  ([`save`](items-brand-master.service.ts) dispatches on `brand_id` presence).
- The payload is a single object (not a batch). Optional fields are applied only when the key is
  present on the body (`hasOwnProperty` in `applyOptionalFields`), so an update touches only the
  fields sent; `brand_name` is always trimmed.
- Each write runs in a `$transaction`; on unique-constraint violation the write is remapped to a
  conflict error ("Item brand name already exists", field `brand_name`).
- **Brand photo** may be supplied three ways, all normalized to bytes stored in `brand_photo`:
  a raw base64 string, a data URL (`data:*;base64,...`), or a `multipart/form-data` file upload
  under the field name `brand_photo` (the controller base64-encodes the uploaded buffer). Base64
  input is validated (`decodePhotoInput`); invalid/empty content raises a bad-request error.

### Delete / restore semantics

- `DELETE /delete` **toggles** `brand_is_deleted` (delete when active, restore when deleted) via
  a guarded `updateMany` that only flips if the state hasn't changed since the read.
- Soft delete only — rows are never hard-deleted, and `GET /get` / updates only see rows where
  `brand_is_deleted = false`.

## Hierarchy & path maintenance

- `brand_path_ids` is a materialized path: every active brand always contains its own id
  (`ensureSelfInPath`), and each brand's id is appended to all of its ancestors' path arrays.
- **On create:** the new brand is added to itself and, if a parent is given, to every ancestor's
  path (`getAncestorIds` walks parents with cycle protection; `appendPathIds`).
- **On update:** if the parent changes, the moved brand's active subtree
  (`getActiveSubtreeIds`, BFS over children) is removed from the old ancestors' paths and added
  to the new ancestors' paths.
- **On delete/restore:** the affected subtree ids are removed from (`removePathIds`) or
  re-appended to (`appendPathIds`) the ancestors' path arrays.

## Business rules

- **Brand name uniqueness** is enforced by the `brand_name` DB unique constraint; violations
  surface as a conflict on field `brand_name` (`handleWriteError` / `throwOnUniqueConstraintError`).
- **Parent must exist and be active** — `ensureParentExists` validates `brand_parent_id`
  against a non-deleted brand before create/update.
- **A brand cannot be its own parent** — on update, `brand_parent_id === brand_id` is rejected
  as a bad request.
- **Not found** — `GET /get`, updates, and delete raise a not-found error when no matching
  (active, for reads/updates) brand exists for the given `brand_id`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), capturing original vs. modified records, screen `Item Brand Master`, screen type
  `master`. The acting user comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_ACTOR`.
- Get responses embed the parent brand's name (`brand_parent_name`), resolved from
  `brand_parent_id`; the stored photo is returned as a base64 string.
