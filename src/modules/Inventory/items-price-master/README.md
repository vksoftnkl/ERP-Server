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

## One price table: headline rows and MRP buckets

Since `20260930160000_one_price_table` (plan `plan/plan-nestjs-one-price-table.md`) this table
also holds **MRP / sale-price buckets**: `ipm_bucket_mrp` / `ipm_bucket_sp` both NULL is the
headline row the item always had; one set is "stock of this item at THIS MRP sells for".

- **The bucket is derived, never sent.** `PriceBucketService.deriveBuckets` sets it on every
  create and update from the item's effective stock track policy — the rule lot identity uses
  (`bucketKeyFor`): `track_mrp` → `NULLIF(ipm_max_price, 0)`, `track_sale_price` → the price at
  `sales.default_price_level`, else NULL. `SaveItemPriceDto` has no field for it, so a client that
  sends one gets a 400. The payload echoes it read-only.
- **One row per company, branch, unit and bucket at a time** — `ex_ipm_overlap` (EXCLUDE,
  DEFERRABLE), which replaced `uq_item_price_master_scope`. A clash is a 409.
- **A bucket row never sells above its MRP** (`ck_ipm_not_above_mrp`, a 422) and its MRP is its
  `ipm_max_price` (`ck_ipm_bucket_mrp_is_max`). Headline rows are not checked.
- **Which row prices a line** is `resolveEffectivePrice` ([price-resolver.ts](price-resolver.ts)):
  the exact bucket before the headline, a branch row before the chain row. Pure — no Prisma.
- **Re-key.** `PriceBucketService.rekeyItem` re-derives an item's rows when its tracking can have
  changed (the item master calls it); two rows that would become one are refused, both named.

## Files

| File | Purpose |
| --- | --- |
| [items-price-master.module.ts](items-price-master.module.ts) | Module wiring — imports `AuditLogModule`, **exports the service** for reuse |
| [items-price-master.controller.ts](items-price-master.controller.ts) | HTTP routes + Swagger docs; class-level `@CacheTTL(1)` |
| [items-price-master.service.ts](items-price-master.service.ts) | Business logic, persistence, unit-conversion sync, audit logging |
| [price-bucket.service.ts](price-bucket.service.ts) | Derives a row's bucket from the stock track policy; re-keys an item's rows |
| [price-resolver.ts](price-resolver.ts) | The one rule for which row prices a line (pure; the till can reuse it) |
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
| `DELETE` | `/delete` | Soft-delete an item price by `ipm_id`. Deletes only (409 `ITEM_PRICE_ALREADY_DELETED`). Accepts a single object, an array, or `?ipm_id=`. |

### Create / update semantics

- **Omit `ipm_id` → create; include `ipm_id` → update** the existing (non-deleted) row **of
  `ipm_item_id`**; another item's row is a 404 and `ipm_item_id` is never rewritten (notes 137 A1).
  The item must be live (400 `ITEM_PRICE_ITEM_NOT_LIVE`, notes 137 D1).
- **Row scope** (notes 137 C4), for a new row and for an update that changes company, branch or
  godown: `ipm_company_id` is the item's company or blank (400 `ITEM_PRICE_OTHER_COMPANY`);
  `ipm_branch_id` is a branch of the row's company, else the item's
  (`ITEM_PRICE_BRANCH_OTHER_COMPANY`); `ipm_godown_id` is a godown of the row's branch, else of
  the row's / item's company (`ITEM_PRICE_GODOWN_OUT_OF_SCOPE`). Stored rows nobody touches are
  not re-checked.
- The `/create` body is a union (single object or an array); the controller resolves and validates
  it explicitly via `validateSingleOrArrayDto` against `SaveItemPriceDto`.
- **Batch mode is all-or-nothing:** the whole array runs in one `$transaction`; if any entry
  fails, nothing is saved. A batch returns an array; a single object returns a single payload.
- `ipm_profit_type` is **required and non-empty** on both create and update (trimmed in code),
  and must be one of `By %` · `By Rs` · `By User` (`@IsIn` in the DTO — the only check:
  `chk_ipm_profit_type` was dropped in 20260718140000). Rows still holding the older `BY_PERCENT` /
  `BY_AMOUNT` were mapped to `By %` / `By Rs` by 20260930120000 (notes 67 B3).
- Optional scalar fields are only written when present on the payload (`hasOwnProperty` guards),
  so an update patches just the supplied keys.

### List / get (`GET /get`)

- With `ipm_id` → returns that single price (404 if not found or soft-deleted).
- Without `ipm_id` → paginated list of non-deleted rows, filterable by `ipm_item_id`,
  `ipm_company_id`, `ipm_branch_id`, and `ipm_is_active`; a `search` term routes through the
  configured-grid SQL path, otherwise Prisma (`findMany` ordered by `ipmItemId`, `ipmUnitSlno`,
  `ipmId`) with a `meta` pagination block.

### Delete / restore (`DELETE /delete`)

- **Deletes only** (`delete()`, notes 137 D1): an already-deleted row is a 409
  `ITEM_PRICE_ALREADY_DELETED`, a row whose item is deleted a 409 `ITEM_PRICE_ITEM_NOT_LIVE`. It
  used to toggle, so a second DELETE restored the price. `toggleDelete` stays the item master's
  tool for deleting and restoring prices with their item.
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
  capturing original vs. modified payloads. `ipm_created_by` / `ipm_updated_by` are the token's
  user — the payload's values are accepted and ignored (notes 137 C2); the audit falls back to
  `system` when there is none.
- **Profit type** is `By %`, `By Rs` or `By User`, enforced by the DTO alone (see above). The
  column's DB default is `By User` since notes 137 D7 (it was `MANUAL`, which the DTO refuses).
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
`ipm_branch_name`, `ipm_unit_name`, `ipm_godown_name`) that the item composite get endpoint
populates; this module's own endpoints leave them unset. That endpoint also rewrites
`ipm_uc_unit_id` from the stored `iuc_id` to the unit-master id behind it, one hop out through
the conversion row; this module's own endpoints return the raw `iuc_id`.
