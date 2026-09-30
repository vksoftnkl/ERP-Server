# Godowns Master

CRUD API for **godown locations** — the warehouses / storage locations (and their nested
sub-locations such as racks and bins) where inventory is held. Locations form a self-referential
tree per branch, with a cached ancestor path on every node.

- **Base route:** `godowns` (API-versioned per route via `@Version(API_VERSION)`)
- **Swagger tag:** `Godowns`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `godown_locations` (`inventory` schema) — PK `gdl_id`
- **Self relation:** `gdl_parent_id → gdl_id` (hierarchy); `gdl_branch_id → branch_master.br_id`
- **Response caching:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [godowns-master.module.ts](godowns-master.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service, and exception filter (service is **not** exported) |
| [godowns-master.controller.ts](godowns-master.controller.ts) | HTTP routes + Swagger docs; binds `GodownExceptionFilter` via `@UseFilters` |
| [godowns-master.service.ts](godowns-master.service.ts) | Business logic, persistence, hierarchy path-cache maintenance, audit logging |
| [godown-exception.filter.ts](godown-exception.filter.ts) | Extends `InventoryExceptionFilter`; maps DB/domain errors to the module's error shape (matches `gdl_*` / `godown_*` field names) |
| [dto/save-godown.dto.ts](dto/save-godown.dto.ts) | Single create/update payload (with legacy field aliases) |
| [dto/delete-godown-query.dto.ts](dto/delete-godown-query.dto.ts) | `gdl_id` (UUID) query param — reused by the GET and DELETE routes |
| [dto/godown-response.dto.ts](dto/godown-response.dto.ts) | Swagger response models |
| [types/godown-api.types.ts](types/godown-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a godown location — routed by presence of `gdl_id` in the body. Returns `201` on create, `200` on update. |
| `GET` | `/` | Fetch one location by `gdl_id` query param (alias of `/get`). |
| `GET` | `/get` | Fetch one active location by `gdl_id` query param. |
| `DELETE` | `/delete` | Soft-delete a location by `gdl_id` query param. Not a toggle: 409 when already deleted. |
| `POST` | `/restore` | Restore a soft-deleted location by `gdl_id` query param. |

Both `GET` routes require a `gdl_id` query parameter and return a single record — there is no
"list all" endpoint.

### Create / update semantics

- **Omit `gdl_id` → create; include `gdl_id` → update** the existing location
  ([`save`](godowns-master.service.ts) dispatches on `gdl_id`).
- **Create requires** `gdl_name` (trimmed, non-empty) and `gdl_branch_id`; both are validated
  explicitly in `validateCreatePayload`.
- **Update is partial** — only fields present in the body are applied (via `hasOwnProperty`
  checks in `applyOptionalFields`). If `gdl_name` is sent it must be non-empty; if no writable
  fields are present the existing record is returned unchanged.
- Each mutation runs inside a Prisma `$transaction`.
- Fetched single records embed related display names resolved on the get path:
  `gdl_parent_name` (from the parent location) and `gdl_branch_name` (from `branch_master`).

### Hierarchy & path cache

- A location may reference a **parent** via `gdl_parent_id`, forming a per-branch tree.
- **Parent assignment is validated** (`validateParentAssignment`): the parent must be an active
  location, cannot equal the node's own id, and must belong to the **same `gdl_branch_id`**.
- Each node maintains `gdl_path_ids_cache` — the set of ancestor ids plus itself
  (`ensureSelfInPath`, `appendPathIds` / `removePathIds`, built by walking ancestors with
  `getAncestorIds` and the subtree with `getActiveSubtreeIds`). On a parent change during
  update, the moved node's whole active subtree has its cached paths re-pointed from the old to
  the new ancestor chain.

### Soft delete / restore

- `DELETE /delete` **deletes only** — it is not a toggle (notes 70 C1). An already deleted location
  is a **409**; `POST /godowns/restore` brings one back, and is itself a 409 when the location is not
  deleted or its parent is (the row would come back an orphan).
- DELETE is refused (**409**, naming what is in the way) while child locations, stock on hand there, or a branch's default godown still point at it.
- Both run in one transaction with a guarded `updateMany`; rows are never hard-deleted. On delete the
  active subtree ids leave the ancestors' path caches; on restore they are read back AFTER the row
  is live again and re-appended.
- **Levels are depths** (a root is 1), computed by `relevelSubtree` on every create and update and
  never taken from the payload; a re-parent re-levels the whole subtree. A node cannot move under
  itself or one of its descendants (400). All three rules live in `../utils/master-tree.helper.ts`
  (notes 70 B1-B3).
- An update that OMITS `gdl_parent_id` or `gdl_name` keeps them (notes 70 B5); `null` or `""`
  still makes the location a root. `gdl_type` is one of WAREHOUSE / ZONE / AISLE / RACK / SHELF /
  BIN (DTO 400, `ck_gdl_type`).

### Uniqueness & validation

- **Name is unique per `(gdl_branch_id, gdl_parent_id, gdl_name)`** — DB constraint
  `uq_gdl_unique_name_per_parent`. A violation is mapped to a conflict error:
  "Duplicate gdl_name under the same parent is not allowed" (`handleWriteError` →
  `throwOnUniqueConstraintError`).
- A foreign-key violation is mapped to a bad-request on `gdl_parent_id`
  ("Invalid gdl_parent_id reference").

### Legacy field aliases

`normalizeLegacySaveGodownDto` maps older payload keys onto the canonical `gdl_*` fields before
saving (only when the canonical field is absent): `gdl_location_id → gdl_id`,
`branch_id → gdl_branch_id`, `godown_name → gdl_name`, `godown_code → gdl_code`,
`godown_short` / `godown_alias → gdl_short`, `godown_description → gdl_remarks`,
`godown_sort → gdl_sort`, `parent_id → gdl_parent_id`, `is_active → gdl_is_active`. These alias
fields are hidden from Swagger (`@ApiHideProperty`).

## Business rules

- **Soft delete only** — rows are never hard-deleted; delete flips `gdl_is_deleted` and active
  reads filter on `gdl_is_deleted = false` (`findActiveLocation`).
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` on create,
  `update` on update/restore, `cancel` on soft delete), capturing original vs. modified records
  under screen "Godown Location Master". The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- `gdl_volume` (Decimal in the DB) is normalized to a JS number in the response payload
  (`toNumber`).
