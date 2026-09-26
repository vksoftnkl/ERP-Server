# Items Master

CRUD API for the **item / product master** — the central Inventory entity that every stock,
pricing and sales/purchase flow references. A single `POST` saves the item plus its four child
collections (**unit conversions**, **prices**, **EAN codes** and **reorders**) in one call.

- **Base route:** `items` (API-versioned — every route carries `@Version(API_VERSION)`, from `process.env.API_VERSION`)
- **Swagger tag:** `Items`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `item_master` (`inventory` schema) — PK `itemId` (`item_id`, uuidv7)
- **Child tables (owned via other modules):** `item_unit_conversion`, `item_price_master`, `item_ean_codes`, `item_reorders`
- **Tenant-scoped:** the owning company is taken from the caller's token, never the request body (see [applyOptionalFields](items-master.service.ts)); reads are auto-scoped to the token's company.

## Files

| File | Purpose |
| --- | --- |
| [items-master.module.ts](items-master.module.ts) | Module wiring — imports `AuditLogModule` and the four child modules (unit-conversion, price, EAN-code, reorder) |
| [items-master.controller.ts](items-master.controller.ts) | HTTP routes + Swagger docs |
| [items-master.service.ts](items-master.service.ts) | Item persistence, composite get, bulk-load, soft-delete cascade, name resolution, audit logging |
| [item-master-update.service.ts](item-master-update.service.ts) | Diff-syncs the four child collections against the payload by natural key |
| [item-exception.filter.ts](item-exception.filter.ts) | Maps DB/domain errors to the module error shape; preserves `item_`/`iuc_`/`ipm_`/`ean_`/`ir_` field names |
| [dto/save-item.dto.ts](dto/save-item.dto.ts) | Plain item create/update payload (the flat item fields) |
| [dto/save-item-composite.dto.ts](dto/save-item-composite.dto.ts) | Extends the item DTO with optional `unit_conversions[]`, `prices[]`, `ean_codes[]`, `reorders[]` |
| [dto/item-response.dto.ts](dto/item-response.dto.ts) | Swagger item payload / delete-result / error models |
| [dto/item-composite-response.dto.ts](dto/item-composite-response.dto.ts) | Swagger composite (item + children) success/delete models |
| [types/item-api.types.ts](types/item-api.types.ts) | `ItemPayload`, `BulkLoadItemPayload`, error/success type aliases |
| [types/item-composite-api.types.ts](types/item-composite-api.types.ts) | `ItemCompositePayload` / `ItemCompositeDeleteResult` contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an item (create vs update by `item_id` presence), optionally with its child collections. |
| `GET` | `/get` | Fetch one item by `item_id` (UUID v7) with its non-deleted unit conversions, prices, EAN codes and reorders, plus resolved names. |
| `GET` | `/bulk-load` | List active items with a chosen default price row, flattened for bulk opening-stock load. |
| `DELETE` | `/delete` | Soft-delete **or restore** an item by `item_id`, cascading the same state to its children. |

### Create / update semantics

- **Omit `item_id` → create; include `item_id` → update** the existing (non-deleted) item.
- `item_name_en` is trimmed and required on both create and update.
- On create/update only the fields the client actually sent are applied — every optional column is
  gated by `hasOwnProperty` in [applyOptionalFields](items-master.service.ts), so unsent fields keep
  their DB defaults / current value.
- `item_photo` accepts a base64 string; it is validated (`BASE64_PATTERN`, length % 4) and decoded to
  bytes before storage, and re-encoded to base64 on read. An empty string decodes to `null`.
- `item_packing_item_ids` is coerced by the DTO from a UUID array, JSON-array string, or
  comma-separated string.
- The item itself is saved in **its own `$transaction`**; then children are synced. Saving is
  **NON-ATOMIC** — if a child collection fails, the item and any earlier children stay persisted.

### Composite child collections

The `POST /create` body may include `unit_conversions[]`, `prices[]`, `ean_codes[]` and `reorders[]`.
[ItemMasterUpdateService.syncChildren](item-master-update.service.ts) diff-syncs each provided
collection, in dependency order (unit-conversions → prices → EAN codes → reorders), against the
item's existing non-deleted rows:

- Rows are matched by **natural key** (or by an explicit row id when supplied):
  - unit conversions → `iuc_unit_id`
  - prices → `ipm_uc_unit_id` + `ipm_godown_id`
  - EAN codes → `ean_code`
  - reorders → `ir_unit_id` + `ir_godown_id`
- Unmatched payload rows are **created**; matched rows are **updated only when a supplied field
  differs** (`rowChanged`, ignoring each table's PK, parent item id and actor columns); existing rows
  not claimed by any payload row are **soft-deleted** (stale rows are released *before* saving to
  avoid clashing on partial unique indexes).
- **Omitting** a child array leaves that table untouched (returns `[]`); an **empty array**
  soft-deletes all of that table's rows for the item.
- The parent `item_id` is always injected into every child row (any `*_item_id` sent in the body is
  ignored — see the `OmitType` overrides in [save-item-composite.dto.ts](dto/save-item-composite.dto.ts)).
- All child writes go through the respective child services, so their validation, unique-constraint
  handling and audit logging apply unchanged.

### Get / name resolution

`GET /get` returns the item plus its four non-deleted child collections. Every resolvable foreign-key
id is enriched with a flat sibling `*_name` field (company, branch, item group, category, brand,
section, supplier, customer group, base unit, default tax, godown). Reference tables are batch-loaded
(one query per table over the deduped id set) and resolved by id **regardless of soft-delete**, so a
name still shows even if the referenced master was later deleted. `item_company_category_id`,
`item_mfgr_id` and `item_barcode_sticker_id` have no master table and are not resolved.

### Bulk load

`GET /bulk-load` lists active, non-deleted items (optionally filtered by company, branch, group,
brand, section, category; default limit 500) and flattens one price row per item into a
`BulkLoadItemPayload`. The chosen price is: the row for the requested `godown_id`, else the default-unit
row, else the first price. It also folds in the item's default tax (rate, cess) and derives a
`tracking_type` of `MRP` / `BATCH` / `NONE` from `item_batch_config`, `item_is_batch_based` and
`item_is_expiry_item`.

### Soft delete / restore

`DELETE /delete` toggles the item: it soft-deletes if active, restores if already deleted (the
response `message` reflects which happened). A guarded `updateMany` flips `itemIsDeleted` only if the
state hasn't changed since the read. It then cascades the **same target state** to the item's
children — only children currently in the item's *old* state are flipped; children already in the
target state are left untouched. **NON-ATOMIC:** the item toggles in its own transaction, then each
child collection in its own.

## Business rules

- **Item name uniqueness is global** — the DB enforces a single unique index on `itemNameEn`
  (`uq_item_name_en_global`); a duplicate surfaces as a conflict on `item_name_en`
  ([handleWriteError](items-master.service.ts)). A bad foreign key (e.g. `item_group_id`) surfaces as a
  bad-request "Invalid relation reference".
- **Soft delete only** — rows are never hard-deleted; deleting flips `itemIsDeleted` (get/update
  operate on `itemIsDeleted = false` only).
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`),
  capturing original vs. modified records under screen "Item Master". The acting user comes from
  `RequestContextService.getUserId()` (or the body's `item_created_by` / `item_modified_by`), falling
  back to `DEFAULT_ACTOR`.

## Cross-module reuse

Unlike the leaf masters, this module **consumes** the four child modules rather than exporting its own
service. It injects `ItemUnitConversionService`, `ItemsPriceMasterService`, `ItemsEanCodeMasterService`
and `ItemsReorderMasterService` and drives them through their public `save` / `findByItemId` /
`findIdsByItemId` / `toggleDelete` methods, so all child validation and audit behaviour is reused as-is.
