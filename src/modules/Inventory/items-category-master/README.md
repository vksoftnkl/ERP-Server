# Items Category Master

CRUD API for **item categories** — the inventory category tree, where each category may
optionally hang off a parent category to form a hierarchy.

- **Base route:** `item-categories` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item Categories`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_category_master` (`inventory` schema) — PK `categoryId` (`category_id`)
- **Self-relation:** `categoryParentId → categoryId` (a category's parent), with a materialized
  `categoryPathIdsCache` array on each row

## Files

| File | Purpose |
| --- | --- |
| [items-category-master.module.ts](items-category-master.module.ts) | Module wiring — imports `AuditLogModule` (service is **not** exported) |
| [items-category-master.controller.ts](items-category-master.controller.ts) | HTTP routes + Swagger docs; accepts multipart photo upload |
| [items-category-master.service.ts](items-category-master.service.ts) | Business logic, hierarchy path-cache maintenance, persistence, audit logging |
| [item-category-exception.filter.ts](item-category-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `category_*` field names) |
| [dto/save-item-category.dto.ts](dto/save-item-category.dto.ts) | Single create/update payload (with photo normalization transform) |
| [dto/item-category-response.dto.ts](dto/item-category-response.dto.ts) | Swagger response models |
| [types/item-category-api.types.ts](types/item-category-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a single item category, decided by `category_id` presence. Accepts `application/json` or `multipart/form-data`. |
| `GET` | `/get` | Fetch one active item category by `category_id`. |
| `DELETE` | `/delete` | Soft-delete a category by `category_id`. Not a toggle: 409 when already deleted. |
| `POST` | `/restore` | Restore a soft-deleted category by `category_id`. |

- `GET /get` and `DELETE /delete` read `category_id` from the query string, validated by
  `ParseUUIDPipe({ version: '7' })`.
- The controller carries `@CacheTTL(1)`.

### Create / update semantics

- **Omit `category_id` → create; include `category_id` → update** the existing category
  ([service `save`](items-category-master.service.ts)).
- `category_name` is required (max 150) and is `trim()`-ed before persisting.
- Optional fields are only written when the key is present on the payload
  (`applyOptionalFields`, keyed by `hasOwnProperty`): `category_alias`, `category_short`,
  `category_description`, `category_parent_id`, `category_sort`, `category_level`,
  `category_photo`, `category_photo_url`.
- The DTO also accepts `category_tax_claim`, `category_default_tax_id`, `category_default_hsn`,
  and `category_default_uom_id`, but the service does **not** persist them and always returns
  them as `null` in the payload (there are no matching columns on the table).

### Photo handling

- `category_photo` accepts a raw base64 string, a data URL (`data:*;base64,...`), or an object
  containing `data_base64` / `data_url` — normalized to a string by the DTO's `Transform`
  (`toNullablePhotoString`).
- For `multipart/form-data`, upload a file under the field name `category_photo`; the controller
  reads the buffer and base64-encodes it before handing off to the service
  (`withUploadedPhoto`).
- The service validates the base64 (`decodePhotoInput`), stripping any data-URL prefix and
  whitespace, rejecting empty or malformed content with a bad-request error, and stores the
  decoded bytes; the response re-encodes stored bytes back to base64.

### Validation rules

- **Name uniqueness** on `category_name` is enforced by the DB unique index `uq_category_name`;
  a conflicting write surfaces as `Item category name already exists`
  (`throwOnUniqueConstraintError`).
- **Parent must exist and be active** — when `category_parent_id` is supplied, the service checks
  for a non-deleted category (`ensureParentExists`), else raises a bad request.
- **A category cannot be its own parent** — on update, `category_parent_id === category_id` is
  rejected with a bad request.

## Hierarchy path cache

Each row carries `categoryPathIdsCache`, a materialized list of ids used to track ancestry/subtrees:

- On create, the category adds itself to its own path (`ensureSelfInPath`), and its id is appended
  to every ancestor's path (`getAncestorIds` → `appendPathIds`).
- On update, if the parent changed, the moved node's active subtree (`getActiveSubtreeIds`) is
  removed from the old ancestors' paths and appended to the new ancestors' paths.
- On soft-delete the subtree ids are removed from ancestors' paths; on restore they are re-appended.
- Traversals guard against cycles (visited sets) and only consider non-deleted rows.

## Soft delete / restore

- `DELETE /delete` **deletes only** — it is not a toggle (notes 70 C1). An already deleted category
  is a **409**; `POST /item-categories/restore` brings one back, and is itself a 409 when the category is not
  deleted or its parent is (the row would come back an orphan).
- DELETE is refused (**409**, naming what is in the way) while live sub-categories or live items still use it.
- Both run in one transaction with a guarded `updateMany`; rows are never hard-deleted. On delete the
  active subtree ids leave the ancestors' path caches; on restore they are read back AFTER the row
  is live again and re-appended.
- **Levels are depths** (a root is 1), computed by `relevelSubtree` on every create and update and
  never taken from the payload; a re-parent re-levels the whole subtree. A node cannot move under
  itself or one of its descendants (400). All three rules live in `../utils/master-tree.helper.ts`
  (notes 70 B1-B3).

## Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange`, inside the same
  transaction — actions `New` (create), `update` (update / restore), and `cancel` (soft delete),
  capturing original vs. modified payloads.
- Audit entries use `tableName` `item category master`, `screenName` `Category Master`,
  `screenType` `master`.
- The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Errors

Domain and DB errors are shaped by [ItemCategoryExceptionFilter](item-category-exception.filter.ts),
which extends the shared `InventoryExceptionFilter` and is configured to recognize `category_*`
field names in error messages.
