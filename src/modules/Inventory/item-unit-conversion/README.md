# Item Unit Conversion

CRUD API for **item unit conversions** — the per-item chain of units (e.g. box ↔ piece) that
records each unit's factor to the item's base unit, so quantities entered in any unit can be
converted to the base unit.

- **Base route:** `item-unit-conversions` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Item Unit Conversions`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_unit_conversion` (`inventory` schema) — PK `iucId`
- **Foreign keys:** `iucItemId → item_master.itemId`, `iucUnitId → unit.unit_id`, `iucBaseUnitId → unit.unit_id`

## Files

| File | Purpose |
| --- | --- |
| [item-unit-conversion.module.ts](item-unit-conversion.module.ts) | Module wiring — imports `AuditLogModule`, **exports the service** for reuse |
| [item-unit-conversion.controller.ts](item-unit-conversion.controller.ts) | HTTP routes + Swagger docs (`@CacheTTL(60)`) |
| [item-unit-conversion.service.ts](item-unit-conversion.service.ts) | Business logic, factor normalization, persistence, audit logging |
| [item-unit-conversion-exception.filter.ts](item-unit-conversion-exception.filter.ts) | Extends `InventoryExceptionFilter`; maps DB/domain errors to the module's error shape (matches `iuc_*` field names) |
| [dto/save-item-unit-conversion.dto.ts](dto/save-item-unit-conversion.dto.ts) | Single create/update payload |
| [dto/delete-item-unit-conversion.dto.ts](dto/delete-item-unit-conversion.dto.ts) | Delete payload (`iuc_id`) |
| [dto/get-item-unit-conversion-query.dto.ts](dto/get-item-unit-conversion-query.dto.ts) | List/get query params (extends `InventoryListQueryBaseDto`) |
| [dto/item-unit-conversion-response.dto.ts](dto/item-unit-conversion-response.dto.ts) | Swagger response models |
| [types/item-unit-conversion-api.types.ts](types/item-unit-conversion-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a conversion (by `iuc_id` presence). Accepts a single object **or** an array. |
| `GET` | `/get` | Fetch one conversion by `iuc_id`, or list with optional filters/pagination (`iuc_item_id`, `iuc_is_active`, `search`). |
| `DELETE` | `/delete` | Soft-delete **or restore** (toggle) a conversion by id. Accepts `iuc_id` via query, or a single/array body. |

### Create / update semantics

- **Omit `iuc_id` → create; include `iuc_id` → update** the existing row.
- The `/create` body is a union (single object or array); the controller validates explicitly with
  `validateSingleOrArrayDto` since Nest's global `ValidationPipe` can't infer the shape.
- **Batch mode is all-or-nothing:** the whole array runs in one `$transaction`; if any entry fails,
  nothing is saved.
- On update, unprovided fields keep their persisted values; the constraint check runs against the
  **effective post-update state** (incoming values merged over the stored row).

### Delete / restore semantics

- `DELETE /delete` **toggles** `iucIsDeleted`: an active row is soft-deleted, an already-deleted row
  is restored. The row is looked up regardless of current deleted state.
- Accepts an `iuc_id` query param **or** a request body (single object or array of `{ iuc_id }`);
  the body takes precedence when present, otherwise `iuc_id` is read from the query.
- The response message reflects whether items were deleted, restored, or a mix.

## Base-unit & factor normalization

Before persistence, each save item for an item is reconciled into a coherent conversion chain:

- **Base unit resolution** (`normalizeItemUnitConversionBaseUnits`): if `iuc_base_unit_id` is absent,
  it is inferred from the payload's base row (`iuc_is_base_unit === true`), else from an existing
  persisted base/any row for the item, and finally from `item_master.itemBaseUnitId`. Falls back to
  the row's own `iuc_unit_id`.
- **Factor chain** (`normalizeItemUnitConversionFactors`): the item's persisted rows plus the incoming
  rows are merged and sorted by `iucUnitSlno` then `iucUnitId`. The first row's `iuc_unit_factor` is
  forced to `1`; each subsequent row's factor is taken from the payload or derived from adjacent
  `iuc_to_base_factor` values. Cumulative factors are then used to recompute every row's
  `iuc_to_base_factor` relative to the resolved base unit (rounded to 9 decimals). `iuc_is_base_unit`
  is set to `true` only for the row whose unit equals the resolved base unit.
- `iul_unit_factor` is accepted as an alias for `iuc_unit_factor` on input and is echoed alongside it.

## Validation rules

Application-layer replacements for dropped DB CHECK constraints, enforced immediately before write in
`assertItemUnitConversionConstraints` (and pre-checked in `validateItemUnitConversion`):

- `iuc_to_base_factor` must be `> 0` (`chk_iuc_to_base_factor`).
- `iuc_unit_factor` (or `iul_unit_factor`) must be `> 0` when provided.
- `iuc_uom_weight` must be `>= 0` (`chk_iuc_uom_weight`).
- **Base row rule** (`chk_iuc_base_row`): when `iuc_is_base_unit = true`, `iuc_unit_id` must equal the
  base unit and `iuc_to_base_factor` must be `1`.
- `iuc_uom_remarks` is capped at 250 chars; `iuc_sync_date` must be a valid date when provided.

## Uniqueness

Enforced by partial unique indexes on the table (not expressible in Prisma): `uq_item_unit_conversion`,
`uq_item_unit_conversion_default`, and `uq_item_unit_conversion_base`. A violation surfaces as a `409`
via `handleWriteError` — *"Duplicate item unit conversion, default-unit, or base-unit configuration is
not allowed"*. Invalid FK references (item, unit, base unit) surface as a `400`.

## Business rules

- **Soft delete only** — rows are never hard-deleted; `iucIsDeleted` is toggled and `iucUpdatedOn` is
  stamped. List and single-get queries filter on `iucIsDeleted = false`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`),
  capturing original vs. modified records under screen `Item Unit Conversion Master`. The actor is
  resolved from the record's `created_by` / `updated_by`, falling back to `system`.
- Lists go through the **configured-grid SQL** path (`ConfiguredGridSqlService`) with a Prisma
  `findMany` fallback ordered by `iucItemId`, `iucUnitSlno`, then `iucId`; results are paginated.

## Reuse from other modules

The module **exports `ItemUnitConversionService`** so **Items Master** can manage an item's unit
conversions as part of its own composite create/update flow. The intentionally non-private methods used
externally are:

- `findByItemId(itemId)` — list an item's active conversions (ordered by slno).
- `findIdsByItemId(itemId, isDeleted)` — fetch conversion ids for an item by deleted state.
- `save(dto | dto[])` — create/update conversions.
- `toggleDelete(id | id[])` — soft-delete/restore conversions.
