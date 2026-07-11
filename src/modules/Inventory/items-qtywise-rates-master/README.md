# Item Qtywise Rates Master

CRUD API for **quantity-slab-wise rates** on inventory items — each row prices a quantity
band (`iqr_start_qty` … `iqr_end_qty`, open-ended when the end is null) at a given price
level for a base unit-rate row, along with its per-slab sales price, margin, and discount.

- **Base route:** `item-qtywise-rates` (each route is API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item Qtywise Rates`
- **Auth:** Bearer `access-token` (required)
- **Controller cache:** `@CacheTTL(60)`
- **Primary table:** `item_qtywise_rates` (`inventory` schema) — PK `iqrId` (`iqr_id`, UUIDv7)
- **Foreign key:** `iqrUnitRateId → item_price_master.ipmId` (`ItemPriceMaster`, `onDelete: Restrict`) — the base item + unit + godown rate the slab hangs off

## Files

| File | Purpose |
| --- | --- |
| [items-qtywise-rates-master.module.ts](items-qtywise-rates-master.module.ts) | Module wiring — imports `AuditLogModule` (service is **not** exported) |
| [items-qtywise-rates-master.controller.ts](items-qtywise-rates-master.controller.ts) | HTTP routes + Swagger docs |
| [items-qtywise-rates-master.service.ts](items-qtywise-rates-master.service.ts) | Business logic, persistence, validation, audit logging |
| [item-qtywise-rate-exception.filter.ts](item-qtywise-rate-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `iqr_*` field names) |
| [dto/save-item-qtywise-rate.dto.ts](dto/save-item-qtywise-rate.dto.ts) | Single create/update payload |
| [dto/item-qtywise-rate-response.dto.ts](dto/item-qtywise-rate-response.dto.ts) | Swagger response models |
| [types/item-qtywise-rate-api.types.ts](types/item-qtywise-rate-api.types.ts) | Payload / response TypeScript contracts (re-exports shared inventory error/success types) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a qty-wise rate, chosen by presence of `iqr_id` in the body. |
| `GET` | `/get` | Fetch one active (non-deleted) rate by `iqr_id` (UUID v7). |
| `DELETE` | `/delete` | Toggle soft-delete state of a rate by `iqr_id` (UUID v7) — deletes if active, restores if already deleted. |

## Create / update semantics

- **Omit `iqr_id` → create; include `iqr_id` → update** the existing row. The controller
  reports `created` vs `updated` in the response message based on that same flag.
- Both create and update run inside a `$transaction` together with the audit-log write.
- **Update** first loads the existing non-deleted row and throws **404** if it is missing or
  already soft-deleted.
- Optional columns are applied only when the key is present on the payload
  (`applyOptionalFields`, keyed by `hasOwnProperty`): `iqr_branch_id`, `iqr_end_qty`,
  `iqr_sales_price`, `iqr_price_wot`, `iqr_price_margin`, `iqr_disc_perc`, `iqr_disc_qty`,
  `iqr_valid_from`, `iqr_valid_to`, `iqr_priority`, `iqr_is_active`, `iqr_remarks`. On update,
  omitted quantity/date fields fall back to the stored values before validation.

## Validation rules

- **Quantity range** (`validateQuantityRange`): when `iqr_end_qty` is provided (non-null),
  `iqr_start_qty` must be `<= iqr_end_qty`, else **400** on `iqr_end_qty`. A null
  `iqr_end_qty` means an open-ended slab and skips the check.
- **Validity range** (`validateDateRange`): when both `iqr_valid_from` and `iqr_valid_to` are
  present, `iqr_valid_from` must be `<= iqr_valid_to`, else **400** on `iqr_valid_to`.
- **Date parsing** (`parseOptionalDate`): a non-empty `iqr_valid_from` / `iqr_valid_to` that is
  not a valid date yields **400** on that field.
- **DTO constraints**: `iqr_unit_rate_id` is a required non-empty UUID; `iqr_id` and
  `iqr_branch_id` are UUIDs; `iqr_remarks` ≤ 250 chars; `iqr_created_by` / `iqr_modified_by`
  ≤ 100 chars.

## Delete / restore semantics

- `DELETE /delete` is a **toggle** (`toggleDelete`) run in a `$transaction`: it loads the row
  regardless of current deleted state (**404** if it does not exist), flips `iqrIsDeleted`, and
  stamps `iqrModifiedOn` / `iqrModifiedBy`.
- The flip is a **guarded `updateMany`** scoped to the previously-read `iqrIsDeleted` value, so
  a concurrent change since the read results in **404** rather than a lost update.
- **Soft delete only** — rows are never hard-deleted; the audit action is `cancel` on delete
  and `update` on restore.

## Write-error mapping

`handleWriteError` (via the module error helpers) translates Prisma failures:

- A **unique-constraint** violation → **409 Conflict** (`Item qty-wise rate already exists`).
- A **foreign-key** violation → **400** on `iqr_unit_rate_id` (`Referenced unit rate does not exist`).

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` inside the same transaction,
under screen `Item Qtywise Rate Master` (`screenType: 'master'`, table `item qtywise rates`):

- Create → `New`, update → `update`, soft-delete → `cancel`, restore → `update`, capturing
  original vs. modified records.
- The acting user is resolved from the payload's `iqr_created_by` / `iqr_modified_by` and
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- The audit `displayName` is built as `<iqr_unit_rate_id>:L<price_level>:<start_qty>-<end_qty|MAX>`
  (`buildDisplayName`).
