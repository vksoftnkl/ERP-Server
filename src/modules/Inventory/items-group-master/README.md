# Item Groups

CRUD API for **item groups** — the hierarchical classification tree that item masters are
filed under, with each group carrying pricing/tax defaults and an optional photo.

- **Base route:** `item-groups` (API-versioned via `@Version(API_VERSION)`, where `API_VERSION` comes from the environment)
- **Swagger tag:** `Item Groups`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_group_master` (`inventory` schema) — PK `itgId` (`itg_id`, UUID v7)

## Files

| File | Purpose |
| --- | --- |
| [items-group-master.module.ts](items-group-master.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter as providers |
| [items-group-master.controller.ts](items-group-master.controller.ts) | HTTP routes + Swagger docs; handles the multipart photo upload |
| [items-group-master.service.ts](items-group-master.service.ts) | Business logic, persistence, hierarchy path-cache maintenance, audit logging |
| [item-group-exception.filter.ts](item-group-exception.filter.ts) | Extends `InventoryExceptionFilter`, matching `itg_*` field names in error messages |
| [dto/save-item-group.dto.ts](dto/save-item-group.dto.ts) | Single create/update payload; normalizes the photo input |
| [dto/item-group-response.dto.ts](dto/item-group-response.dto.ts) | Swagger response models |
| [types/item-group-api.types.ts](types/item-group-api.types.ts) | Payload / response TypeScript contracts (re-exports the shared inventory error/success types) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an item group (decided by `itg_id` presence). Accepts `application/json` or `multipart/form-data`. |
| `GET` | `/get` | Fetch one item group by `itg_id` (UUID v7). |
| `DELETE` | `/delete` | Soft-delete an item group by `itg_id`. Not a toggle: 409 when already deleted. |
| `POST` | `/restore` | Restore a soft-deleted item group by `itg_id`. |

### Create / update semantics

- **Omit `itg_id` → create; include `itg_id` → update** the existing (non-deleted) group.
- Optional fields are only written when the key is **present** in the payload
  (`applyOptionalFields` keys off `hasOwnProperty`), so partial updates leave omitted columns
  untouched.
- `itg_name` is trimmed before persistence.
- Each write runs in a `$transaction` covering the row change, the hierarchy path-cache updates,
  and the audit log entry.

### Photo upload

- The DTO accepts `itg_photo` as a raw base64 string, a `data:*;base64,...` data URL, or an
  object carrying `data_base64` / `data_url` (normalized in `toNullablePhotoString`).
- Alternatively, send `multipart/form-data` with a file field named `itg_photo`; the controller
  (`FileInterceptor('itg_photo')` → `withUploadedPhoto`) base64-encodes the buffer into the DTO.
- The service (`decodePhotoInput`) validates/strips the base64, rejecting malformed content with
  a `400`, and stores the decoded bytes in `itg_photo`; responses re-encode the bytes to base64.

### Delete / restore

- `DELETE /delete` **deletes only** — it is not a toggle (notes 70 C1). An already deleted group
  is a **409**; `POST /item-groups/restore` brings one back, and is itself a 409 when the group is not
  deleted or its parent is (the row would come back an orphan).
- DELETE is refused (**409**, naming what is in the way) while live sub-groups or live items still use it.
- Both run in one transaction with a guarded `updateMany`; rows are never hard-deleted. On delete the
  active subtree ids leave the ancestors' path caches; on restore they are read back AFTER the row
  is live again and re-appended.
- **Levels are depths** (a root is 1), computed by `relevelSubtree` on every create and update and
  never taken from the payload; a re-parent re-levels the whole subtree. A node cannot move under
  itself or one of its descendants (400). All three rules live in `../utils/master-tree.helper.ts`
  (notes 70 B1-B3).

## Hierarchy & path cache

Groups form a self-referencing tree via `itgParentId`, and each row caches its full ancestor
path in `itgPathIdsCache` (`itg_path_ids_cache`, a UUID array):

- On create/update the node is ensured into its own path (`ensureSelfInPath`) and appended to its
  ancestors' caches (`appendPathIds`).
- Changing a group's parent recomputes the affected subtree (`getActiveSubtreeIds`) and moves it
  between the old and new ancestor caches (`removePathIds` → `appendPathIds`).
- Soft-deleting a group removes its subtree ids from ancestor caches; restoring re-appends them.
- Ancestor/subtree walks are cycle-guarded (visited sets) and only traverse **active**
  (`itgIsDeleted = false`) rows.

## Business rules

- **A group cannot be its own parent** — `itg_parent_id === itg_id` on update raises a `400`.
- **The parent must exist and be active** — `ensureParentExists` validates `itg_parent_id`,
  otherwise `400`.
- **`itg_name` uniqueness** is enforced by the DB unique index `uq_itg_name`; a duplicate is
  mapped to a conflict error via `throwOnUniqueConstraintError` (`handleWriteError`).
- `GET /get` returns only non-deleted groups and enriches the payload with `itg_parent_name`
  (resolved from the parent row).
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), capturing original vs. modified records. The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
