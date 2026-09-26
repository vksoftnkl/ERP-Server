# Item Tax Master

CRUD API for **item tax slabs** — GST tax-rate definitions (CGST/SGST/IGST/cess component
percentages, taxability type, reverse-charge flag) plus the sales/purchase and output/input
posting ledgers attached to each slab. These slabs are the tax rates referenced by items.

- **Base route:** `item-taxes` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Item Taxes`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_tax_master` (`inventory` schema) — PK `taxId` (`tax_id`)
- **Caching:** controller sets `@CacheTTL(1)`

## Files

| File | Purpose |
| --- | --- |
| [items-tax-master.module.ts](items-tax-master.module.ts) | Module wiring — imports `AuditLogModule`; declares controller, service, and exception filter |
| [items-tax-master.controller.ts](items-tax-master.controller.ts) | HTTP routes + Swagger docs |
| [items-tax-master.service.ts](items-tax-master.service.ts) | Business logic, persistence, ledger-name resolution, audit logging |
| [item-tax-exception.filter.ts](item-tax-exception.filter.ts) | Extends `InventoryExceptionFilter`; maps DB/domain errors to the module's error shape (matches `tax_*` field names) |
| [dto/save-item-tax.dto.ts](dto/save-item-tax.dto.ts) | Single create/update payload |
| [dto/item-tax-response.dto.ts](dto/item-tax-response.dto.ts) | Swagger response models (payload, delete result, success wrappers) |
| [types/item-tax-api.types.ts](types/item-tax-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a tax slab, chosen by `tax_id` presence in the body. |
| `GET` | `/get` | Fetch one active tax slab by `tax_id` (required UUID v7 query param), with related ledger names resolved. |
| `DELETE` | `/delete` | Soft-delete **or** restore a tax slab by `tax_id` (toggles `tax_is_deleted`). |

### Create / update semantics

- **Omit `tax_id` → create; include `tax_id` → update** the existing slab
  ([`save`](items-tax-master.service.ts) dispatches on `tax_id`).
- The controller's success `message` reflects the branch: `Item tax updated successfully` when
  `tax_id` was supplied, otherwise `Item tax created successfully`.
- Only a single object is accepted — there is **no batch/bulk mode**.
- **Create:** `tax_name` is trimmed and required (empty/whitespace → `400 Validation failed`).
  `tax_created_by` / `tax_modified_by` are resolved via `resolveActor`, falling back to
  `RequestContextService.getUserId()`.
- **Update:** the target row must exist and be active (`tax_is_deleted = false`), else
  `404 Item tax not found`. `tax_name` is re-validated (non-empty after trim).
- Optional fields are applied only when present on the payload (`hasOwnProperty` guard in
  [`applyOptionalFields`](items-tax-master.service.ts)), so omitted keys are left untouched on
  update rather than overwritten with defaults.
- Both create and update run inside a `$transaction` together with their audit-log write.

### Soft delete / restore semantics

- `DELETE /delete` is a **toggle**: it finds the row regardless of current state, flips
  `tax_is_deleted`, and stamps `tax_modified_on` / `tax_modified_by`
  ([`toggleDelete`](items-tax-master.service.ts)).
- Response `deleted` is `true` when the slab was soft-deleted, `false` when restored; the
  controller message follows suit (`Item tax deleted successfully` / `Item tax restored
  successfully`).
- The write is **guarded** (`updateMany` filtered on the previously-read `tax_is_deleted`
  value) so a concurrent flip yields `count === 0` → `404`.
- **Soft delete only** — rows are never hard-deleted (the `item_tax_history` FK
  `ith_tax_id → tax_id` uses `onDelete: Restrict`).

## Validation & uniqueness

- **`tax_name` is globally unique** — enforced by the DB constraint `uq_tax_name_global` on
  `item_tax_master`. On write, unique-constraint violations are caught by
  [`handleWriteError`](items-tax-master.service.ts) →
  `throwOnUniqueConstraintError` and surfaced as
  `409 Item tax name already exists` (`Duplicate tax_name is not allowed`).
- `tax_name` DTO rules: trimmed, required, `MaxLength(100)`.
- `tax_code` up to 30 chars (nullable); `tax_taxability_type` up to 30 chars (default
  `TAXABLE`); `tax_cess_type` up to 20 chars (default `NONE`).
- All `tax_*_ledger_id` fields are optional nullable UUIDs; all `*_perc` / cess `*_unit` fields
  are optional numbers (stored as `Decimal`, returned as numbers via `toNumber`).
- `GET /get` and `DELETE /delete` require `tax_id` as a **UUID v7** (`ParseUUIDPipe({ version:
  '7' })`).

## Ledger-name resolution (get)

`GET /get` returns the stored payload plus resolved display names for each attached ledger.
[`loadLedgerNameMap`](items-tax-master.service.ts) collects the non-null ledger ids
(sales, sales-return, purchase, purchase-return, and the CGST/SGST/IGST/cess output & input
ledgers), looks them up in `acc_ledger_master` (`ledId → ledName`), and populates the
`tax_*_ledger_name` fields. These names are **only** set on the get endpoint — create/update
responses carry the ids without resolved names.

## Audit logging

Every mutation is recorded via `AuditLogService.logEntityChange` (table name `item tax master`,
screen `Item Tax Master`, screen type `master`), inside the same transaction as the write:

- **Create** → action `New` (original `null`, modified = new payload).
- **Update** → action `update` (original vs. modified payloads).
- **Soft delete** → action `cancel` (note `Item tax soft deleted`).
- **Restore** → action `update` (note `Item tax restored`).

The acting user comes from `tax_modified_by` / `tax_created_by` where supplied, otherwise
`RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Relationship to item tax history

`ItemTaxMaster` is the parent of the **item tax history** master
([items-tax-history-master](../items-tax-history-master)): `item_tax_history.ith_tax_id`
references `item_tax_master.tax_id` (`taxHistory` relation, `onDelete: Restrict`). A slab is
also referenced by items as their default tax (`defaultItems` → `ItemMaster[]`). This module
itself does **not** read or write history rows — it only maintains the tax-slab definitions;
the `Restrict` FK is why deletion here is a soft toggle rather than a physical delete.
