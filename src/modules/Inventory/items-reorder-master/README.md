# Items Reorder Master

CRUD API for **item reorder rules** — the per-item stock control thresholds
(min / max levels, reorder level, reorder quantity) and time parameters (lead time,
review cycle, expiry buffer) that drive when and how much of an item to re-stock,
scoped optionally by branch, unit and godown.

- **Base route:** `item-reorders` (per-route API version via `@Version(API_VERSION)`)
- **Swagger tag:** `Item Reorders`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_reorders` (`inventory` schema) — Prisma model `ItemReorder`, PK `ir_id` (`irId`)
- **Caching:** controller sets `@CacheTTL(60)`

## Files

| File | Purpose |
| --- | --- |
| [items-reorder-master.module.ts](items-reorder-master.module.ts) | Module wiring — imports `AuditLogModule`, **exports the service** for reuse |
| [items-reorder-master.controller.ts](items-reorder-master.controller.ts) | HTTP routes + Swagger docs; resolves single-or-array payloads |
| [items-reorder-master.service.ts](items-reorder-master.service.ts) | Business logic, persistence, audit logging |
| [item-reorder-exception.filter.ts](item-reorder-exception.filter.ts) | Extends `InventoryExceptionFilter`; maps DB/domain errors, tagging `ir_*` field names via `/\b(ir_[a-z0-9_]+)\b/i` |
| [dto/save-item-reorder.dto.ts](dto/save-item-reorder.dto.ts) | Create / update payload |
| [dto/get-item-reorder-query.dto.ts](dto/get-item-reorder-query.dto.ts) | Query params for get/list (extends `InventoryListQueryBaseDto`) |
| [dto/delete-item-reorder.dto.ts](dto/delete-item-reorder.dto.ts) | Delete payload — requires `ir_id` |
| [dto/item-reorder-response.dto.ts](dto/item-reorder-response.dto.ts) | Swagger response models |
| [types/item-reorder-api.types.ts](types/item-reorder-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a reorder rule. Accepts a single object **or** an array of them. |
| `GET` | `/get` | Fetch one rule by `ir_id`, or list active rules with optional filters + pagination. |
| `DELETE` | `/delete` | Soft-delete **or restore** (toggle) one or many rules by `ir_id`. |

### Create / update semantics

- **Omit `ir_id` → create; include `ir_id` → update** the existing row (`saveItemReorder`).
- The `/create` body is a union (single object or array). It is validated explicitly with
  `validateSingleOrArrayDto` against `SaveItemReorderDto`; the response message reflects create
  vs. update (single) or a batch save.
- **Batch mode is all-or-nothing:** every item runs inside one `$transaction`; if any entry fails,
  nothing is saved.
- On create, `ir_item_id` is required; `ir_unit_id` defaults to `null` when omitted; other optional
  columns are only written when the key is present on the payload (`applyOptionalFields`).
- `ir_created_by` / `ir_modified_by` are resolved via `resolveActor` from the payload, falling back
  to `RequestContextService.getUserId()`, then `DEFAULT_ACTOR`.

### Get / list

- `GET /get` with `ir_id` returns a single active rule (`getById`), else returns a paginated list
  (`list`).
- List filters: `ir_item_id`, `ir_branch_id`, `ir_unit_id`, `ir_godown_id`, `ir_is_active`, plus
  free-text `search` and pagination from the base query DTO. Only non-deleted rows
  (`irIsDeleted = false`) are returned.
- Listing runs through the **configured-grid SQL** path (`runConfiguredGridQuery` on table
  `item reorders`) with a Prisma `findMany` fallback ordered by `irItemId` then `irId`.
- Decimal columns (`ir_min_level`, `ir_max_level`, `ir_reorder_level`, `ir_reorder_qty`) are
  coerced to numbers in the response (`toPayload` / `toNumber`).

### Delete / restore semantics

- `DELETE /delete` accepts the `ir_id` either as a query param **or** in the body (single object or
  array). If a body payload is present it wins; otherwise the query `ir_id` is used, and a missing
  `ir_id` yields a `400` (`resolveDeletePayload`).
- **Toggle, not one-way:** `toggleDelete` flips `irIsDeleted` — deleting an active rule sets it
  `true` (audit action `cancel`), and re-issuing on a deleted rule restores it (`false`, action
  `update`). The response `deleted` flag reports the resulting state, and the success message adapts
  (deleted / restored / mixed for batches).
- The flip uses a **guarded `updateMany`** (`where: { irId, irIsDeleted: wasDeleted }`); if the state
  changed since the read (`count === 0`) it raises not-found.

## Business rules

- **Reorder range validation** — when both are supplied, `ir_min_level` must be `<=` `ir_max_level`,
  else a `400` on `ir_max_level` (`validateReorderRange`).
- **Uniqueness** — one rule per `(ir_item_id, ir_unit_id, ir_godown_id)` combination
  (DB unique index `uq_ir_item_unit_godown`); violations surface as a conflict
  ("Duplicate item + unit + godown combination is not allowed"). A `NULL` `ir_godown_id` denotes a
  global reorder rule.
- **Relational integrity** — a foreign-key violation (bad `ir_item_id` / `ir_unit_id`) is mapped to a
  `400` "Invalid relation reference" (`handleWriteError`).
- **Soft delete only** — rows are never hard-deleted; delete/restore just toggles `irIsDeleted` and
  stamps `irModifiedOn` / `irModifiedBy`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (actions `New` / `update` /
  `cancel`) under screen `Item Reorder Master` (`master`), capturing original vs. modified records
  and a display name of `item:unit:godown` (`buildDisplayName`).

## Reuse from other modules

The module **exports `ItemsReorderMasterService`**, consumed by the **items-master** module so an
item's reorder rules travel with the item:

- `findByItemId(itemId)` — returns all active reorder rules for an item; used by the composite item
  get (`items-master.service.ts`) and item update (`item-master-update.service.ts`).
- `findIdsByItemId(itemId, isDeleted)` — returns rule ids for an item in a given deleted state; used
  by the item soft-delete cascade in `items-master.service.ts`.
