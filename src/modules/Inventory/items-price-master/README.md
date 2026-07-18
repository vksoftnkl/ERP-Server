# Item Prices

CRUD API for **item price master** rows — the per-item, per-unit pricing record that carries
cost/sales price levels (A–D), markups, discounts, charges and the unit-conversion factors used
to price an item in a given unit at a company/branch/godown.

- **Base route:** `item-prices` (API-versioned via `@Version(API_VERSION)`, from `API_VERSION`)
- **Swagger tag:** `Item Prices`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_price_master` (`inventory` schema) — PK `ipmId` (`ipm_id`)
- **Also written:** `item_unit_conversion` — the unit-conversion chain for the item is re-derived
  and persisted when a unit factor is supplied (see [Unit-conversion sync](#unit-conversion-sync))

## Files

| File | Purpose |
| --- | --- |
| [items-price-master.module.ts](items-price-master.module.ts) | Module wiring — imports `AuditLogModule`, **exports the service** for reuse |
| [items-price-master.controller.ts](items-price-master.controller.ts) | HTTP routes + Swagger docs; class-level `@CacheTTL(60)` |
| [items-price-master.service.ts](items-price-master.service.ts) | Business logic, persistence, unit-conversion sync, audit logging |
| [item-price-exception.filter.ts](item-price-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `ipm_*` field names) |
| [dto/save-item-price.dto.ts](dto/save-item-price.dto.ts) | Single create/update payload |
| [dto/get-item-price-query.dto.ts](dto/get-item-price-query.dto.ts) | Query params for `GET /get` (extends the shared inventory list-query base) |
| [dto/delete-item-price.dto.ts](dto/delete-item-price.dto.ts) | Delete/restore key (`ipm_id`) |
| [dto/item-price-response.dto.ts](dto/item-price-response.dto.ts) | Swagger response models |
| [types/item-price-api.types.ts](types/item-price-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an item price (by `ipm_id` presence). Accepts a single object **or** an array. |
| `GET` | `/get` | Fetch one price by `ipm_id`, or list active prices with optional filters and pagination. |
| `DELETE` | `/delete` | Soft-delete **or restore** an item price (toggle) by `ipm_id`. Accepts a single object, an array, or `?ipm_id=`. |

### Create / update semantics

- **Omit `ipm_id` → create; include `ipm_id` → update** the existing (non-deleted) row.
- The `/create` body is a union (single object or an array); the controller resolves and validates
  it explicitly via `validateSingleOrArrayDto` against `SaveItemPriceDto`.
- **Batch mode is all-or-nothing:** the whole array runs in one `$transaction`; if any entry
  fails, nothing is saved. A batch returns an array; a single object returns a single payload.
- `ipm_profit_type` is **required and non-empty** on both create and update (trimmed in code),
  and must be one of `BY_PERCENT` · `BY_AMOUNT` · `MANUAL` (`@IsIn` in the DTO, also enforced by
  the `chk_ipm_profit_type` DB check constraint).
- Optional scalar fields are only written when present on the payload (`hasOwnProperty` guards),
  so an update patches just the supplied keys.

### List / get (`GET /get`)

- With `ipm_id` → returns that single price (404 if not found or soft-deleted).
- Without `ipm_id` → paginated list of non-deleted rows, filterable by `ipm_item_id`,
  `ipm_company_id`, `ipm_branch_id`, and `ipm_is_active`; a `search` term routes through the
  configured-grid SQL path, otherwise Prisma (`findMany` ordered by `ipmItemId`, `ipmUnitSlno`,
  `ipmId`) with a `meta` pagination block.

### Delete / restore (`DELETE /delete`)

- **Soft toggle only** — the row is looked up regardless of state and `ipmIsDeleted` is flipped.
  The response `deleted` flag is `true` when the row was soft-deleted, `false` when restored; the
  success message reflects delete vs. restore (and "updated" for mixed batches).
- Keys may come from the body (single or array) or, when the body is empty, from the `?ipm_id=`
  query param; a missing id yields a 400 (`ipm_id is required`).

## Unit reference

A price row does not describe a unit — it points at one. `ipm_uc_unit_id` is a FK to
`item_unit_conversion(iuc_id)`, and that conversion row owns the whole unit shape (base unit,
`to_base_factor`, `unit_slno`, `unit_factor`, `is_default_unit`, `is_base_unit`, `is_big_unit`).
`item_price_master` stores no copy of any of it, so neither the save DTO nor the response payload
carries those fields; clients that need them read the item's conversion rows.

On write the service resolves `ipm_uc_unit_id` against the item's live conversion rows
(`requireUnitConversion`). The conversion must exist, not be soft-deleted, and belong to
`ipm_item_id` — the FK alone would let a price point at another item's unit. A miss is a `400`
naming `ipm_uc_unit_id` rather than an opaque foreign-key violation. The conversion's
`iuc_uom_remarks` seeds `ipm_uom_remarks` when the caller sends none.

The items-master composite endpoint is more forgiving: it accepts either the `iuc_id` or the
`unit_id` behind it and resolves the latter through the item's conversion index before saving,
exactly like the `ean_unit_id` / `ir_unit_id` collections.

## Business rules

- **Uniqueness:** a partial unique index `uq_item_price_master_scope` on
  (`ipm_company_id`, `ipm_branch_id`, `ipm_item_id`, `ipm_uc_unit_id`) `NULLS NOT DISTINCT`, where
  the row is not deleted. `ipm_godown_id` is deliberately NOT part of the key, so two godowns
  cannot hold different prices for the same item + unit + branch. A duplicate raises `409`
  "Item price already exists" (field `ipm_item_id`) via `handleWriteError`.
- **Invalid relations:** a foreign-key violation on write → `400` "Invalid relation reference"
  (referenced company, branch, item, unit, base unit, or godown does not exist); on delete →
  `400` "Item price is referenced by related records".
- **Soft delete only** — rows are never hard-deleted; deleting flips `ipmIsDeleted = true`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`) under screen `Item Price Master` (table `item price master`, `master` screen type),
  capturing original vs. modified payloads. The actor is resolved from the record's
  `ipm_updated_by` / `ipm_created_by`, falling back to `system`.
- **Profit type** is constrained by `chk_ipm_profit_type` to `BY_PERCENT`, `BY_AMOUNT` or
  `MANUAL`; the DTO enforces the same set so an invalid value fails validation, not the insert.
- A DB check constraint (not expressible in Prisma) also enforces non-negative price/charge
  columns (`chk_ipm_nonnegative`).

## Reuse from other modules

The module **exports `ItemsPriceMasterService`** so the **items-master** composite can compose an
item's prices without going through HTTP. Consumed methods:

- `findByItemId(itemId)` — list an item's active prices (used to embed prices in the item
  composite response and its update service).
- `findIdsByItemId(itemId, isDeleted)` — resolve price ids for cascade soft-delete / restore of a
  parent item.

The response payload also exposes optional resolved-name fields (`ipm_company_name`,
`ipm_branch_name`, `ipm_unit_master_id`, `ipm_unit_name`, `ipm_godown_name`) that the item
composite get endpoint populates; this module's own endpoints leave them unset.
`ipm_unit_master_id` is the unit behind `ipm_uc_unit_id`, one hop out through the conversion row.
