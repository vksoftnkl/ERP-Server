# Item EAN Codes

CRUD API for **item EAN / barcode codes** — the scannable barcodes assigned to an inventory
item for a given unit (and optionally a godown), with one code flagged as the default per scope.

- **Base route:** `item-ean-codes` (each route is API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item EAN Codes`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_ean_codes` (`inventory` schema) — PK `eanId` (`ean_id`, uuidv7)
- **Unique index:** `uq_ean_code` on `eanCode`; plus a partial unique index `uq_ean_one_default`
  (kept in SQL migration, not expressible in Prisma)
- **FK:** `eanUnitId → inventory.units.unit_id`
- Responses are cached with `@CacheTTL(1)`.

## Files

| File | Purpose |
| --- | --- |
| [items-ean-code-master.module.ts](items-ean-code-master.module.ts) | Module wiring — imports `AuditLogModule`, **exports the service** for reuse |
| [items-ean-code-master.controller.ts](items-ean-code-master.controller.ts) | HTTP routes + Swagger docs; payload validation for single-or-array bodies |
| [items-ean-code-master.service.ts](items-ean-code-master.service.ts) | Business logic, persistence, default-scope enforcement, audit logging |
| [item-ean-code-exception.filter.ts](item-ean-code-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `ean_*` field names) |
| [dto/save-item-ean-code.dto.ts](dto/save-item-ean-code.dto.ts) | Single create/update payload |
| [dto/get-item-ean-code-query.dto.ts](dto/get-item-ean-code-query.dto.ts) | Query params for get/list (extends the inventory list-query base) |
| [dto/delete-item-ean-code.dto.ts](dto/delete-item-ean-code.dto.ts) | Delete payload (`ean_id`) |
| [dto/item-ean-code-response.dto.ts](dto/item-ean-code-response.dto.ts) | Swagger response models |
| [types/item-ean-code-api.types.ts](types/item-ean-code-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an EAN code. Accepts a single object **or** an array. |
| `GET` | `/get` | Fetch one EAN code by `ean_id`, or list with optional filters and pagination. |
| `DELETE` | `/delete` | Soft-delete **or** restore one EAN code (toggle). Accepts a single object, an array, or an `ean_id` query param. |

### Create / update semantics

- **Omit `ean_id` → create; include `ean_id` → update** the existing (non-deleted) row.
- The `/create` body is a union (single object **or** array); the controller resolves and
  validates it with `validateSingleOrArrayDto` against `SaveItemEanCodeDto`.
- **Batch mode is all-or-nothing:** every item is saved inside one `$transaction`; if any entry
  fails, nothing is persisted.
- On both create and update, `ean_code` is trimmed and must be non-empty (otherwise a
  `Validation failed` bad request is thrown).
- Optional fields (`ean_godown_id`, `ean_is_default`, `ean_is_active`, `ean_remarks`) are only
  written when present on the payload (`applyOptionalFields` / `hasOwnProperty`).
- The acting user for `ean_created_by` / `ean_modified_by` is resolved from the payload value,
  falling back to `RequestContextService.getUserId()` (then `DEFAULT_ACTOR`).

### Delete / restore semantics

- `DELETE /delete` **toggles** `eanIsDeleted`: deleting an active row soft-deletes it, calling
  again restores it. A guarded `updateMany` only flips when the row's state is unchanged since
  it was read.
- Accepts a request body (single object or array of `{ ean_id }`) or, when no body is present,
  an `ean_id` query param; a missing `ean_id` yields a bad request.
- The response `deleted` flag is `true` when the row was soft-deleted, `false` when restored,
  and the success message reflects deleted / restored / mixed (for arrays).

## Business rules

- **EAN code uniqueness** is enforced by the DB (`uq_ean_code`); a duplicate surfaces as an
  `EAN code already exists` conflict (`handleWriteError` → `throwOnUniqueConstraintError`).
- **At most one default per scope** — when a saved row has `eanIsDefault = true`,
  `enforceSingleDefaultInScope` clears the default flag on every other non-deleted row sharing
  the same `(eanItemId, eanUnitId, eanGodownId)`, backed by the partial unique index
  `uq_ean_one_default`.
- **Invalid relation reference** — a foreign-key violation (e.g. an unknown `ean_unit_id`) is
  mapped to a bad request `Invalid relation reference`.
- **Soft delete only** — rows are never hard-deleted; delete flips `eanIsDeleted` and stamps
  `eanModifiedOn` / `eanModifiedBy`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), under screen `Item EAN Code Master`, capturing original vs. modified records.
- **Listing** filters to non-deleted rows, supports `ean_item_id` / `ean_unit_id` /
  `ean_godown_id` / `ean_is_default` / `ean_is_active` filters plus `search` and pagination,
  and can source rows from a configured grid SQL (`configured-grid-sql`) or a direct Prisma
  query ordered by `eanItemId`, then `eanId`.

## Reuse from other modules

The module **exports `ItemsEanCodeMasterService`** so the **items master** composes an item's
EAN codes into its own reads and cascade operations. The intentionally non-private helpers:

- `findByItemId(itemId)` — return an item's active EAN code payloads (used to embed them in the
  item composite `get` response).
- `findIdsByItemId(itemId, isDeleted)` — return EAN ids for an item at a given deleted state
  (used when the item master cascades soft-delete / restore).

The `ItemEanCodePayload` also carries optional resolved `ean_unit_name` / `ean_godown_name`
fields that the item composite `get` endpoint populates.
