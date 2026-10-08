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
| `DELETE` | `/delete` | Soft-delete an item by `item_id` with its live children and derived track policy. **Not a toggle**: already deleted → 409. |
| `POST` | `/restore` | Restore a soft-deleted item and **only** the children deleted with it; re-derives its track policy. Not deleted → 409. |

### Create / update semantics

- **Omit `item_id` → create; include `item_id` → update** the existing (non-deleted) item.
- `item_name_en` is trimmed and required on both create and update.
- On create/update only the fields the client actually sent are applied: an omitted key keeps its DB
  default / current value, and only an explicit `null` clears it. The `hasOwnProperty` guards in
  [applyOptionalFields](items-master.service.ts) do NOT decide that — every field declared on a DTO
  instance is an own property (target ES2022), sent or not; what keeps an unsent field untouched is
  that its value is `undefined`, which Prisma skips. So nothing may be written as `value ?? x`: until
  2026-09-30 `item_company_id`, `item_base_unit_id` and `item_packing_item_ids` were, and an update
  that omitted them wiped them (notes 50 #1 / 67).
- `item_photo` accepts a base64 string; it is validated (`BASE64_PATTERN`, length % 4) and decoded to
  bytes before storage, and re-encoded to base64 on read. An empty string decodes to `null`.
- `item_packing_item_ids` is coerced by the DTO from a UUID array, JSON-array string, or
  comma-separated string.
- The item and every child collection are saved in **one `$transaction`** (`saveComposite`): a
  child failure rolls the item back too.
- A foreign-key failure names the field whose constraint failed (`ITEM_FOREIGN_KEYS`, from the
  Prisma error's `meta.constraint`) — `item_default_tax_id` is a FK to **`tax_rate_master`**.

### Composite child collections

The `POST /create` body may include `unit_conversions[]`, `prices[]`, `ean_codes[]` and `reorders[]`.
[ItemMasterUpdateService.syncChildren](item-master-update.service.ts) diff-syncs each provided
collection, in dependency order (unit-conversions → prices → EAN codes → reorders), against the
item's existing non-deleted rows:

- Rows are matched by **natural key** (or by an explicit row id when supplied):
  - unit conversions → `iuc_unit_id`
  - prices → `ipm_company_id` + `ipm_branch_id` + `ipm_uc_unit_id` — `uq_item_price_master_scope`'s
    own key; `ipm_godown_id` is an attribute of the row, not part of it. Until 2026-09-30 the key was
    unit + godown, so a NEW row for branch Y took branch X's `ipm_id` and overwrote X's price
    (notes 67 B1).
  - EAN codes → `ean_code`
  - reorders → `ir_branch_id` + `ir_unit_id` + `ir_godown_id`
- An omitted company / branch / godown on a price or reorder row reads as `null` — what a create
  would store — so a client that sends no row id must send the scope columns. Two payload rows with
  one key are refused (400) before anything is written.
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
row, else the first price. It also folds in the item's default tax from **`tax_rate_master`**
(`tax_rate_perc`, `tax_cess_basis` NONE / PERCENT / PER_UNIT / BOTH, `tax_cess_perc`,
`tax_cess_per_unit`; the retired `item_tax_master` holds none of the items' tax ids) and derives a
`tracking_type` of `MRP` / `BATCH` / `NONE` from `item_batch_config`, `item_is_batch_based` and
`item_is_expiry_item`.

### Soft delete / restore

Two routes, each **one transaction** (`softDeleteComposite` / `restoreComposite`):

- `DELETE /delete` soft-deletes the item (a guarded `updateMany`), then every live unit conversion,
  price, EAN code and reorder, and retires the item's derived ITEM-scope stock track policy
  (`StockTrackPolicyService.retireForItem`). An item already deleted is a **409** — this used to be a
  toggle, and a second DELETE restored it (notes 50 #5).
- `POST /restore` restores the item and **only the children deleted with it**: those soft-deleted at
  or after the item's deletion instant (its `item_modified_on`, which nothing moves while the item is
  deleted; the children are stamped after it in the same transaction). Rows an earlier save removed —
  an old base unit, a replaced EAN — stay deleted (notes 67 B4). The track policy is re-derived. A
  name or EAN code another live item has taken since is a **409** naming the field, and nothing is
  restored.

## Business rules

- **Item name uniqueness is global among live items** — `uq_item_name_en_global` is partial on
  `item_is_deleted = false` (as are `uq_ean_code` and `uq_ir_item_unit_godown`, since
  `20260930120000`), so a deleted item's name, a removed EAN or reorder rule can be used again. The
  indexes are DB-only: Prisma cannot declare a partial index. A duplicate surfaces as a conflict on
  `item_name_en` ([handleWriteError](items-master.service.ts)); a bad foreign key as a bad-request
  "Invalid relation reference" on the field whose constraint failed.
- **Stock track policy**: create / update / restore call `StockTrackPolicyService.syncFromItem`.
  **An item follows its group unless it names its own preset** (notes 68): an item with no
  `item_track_preset_id` gets **no** ITEM row, whatever its own batch / expiry / MRP /
  negative-stock flags say (a
  derived one is retired), so its group's / company's policy governs — an ITEM row always outranks
  the group's. A preset, NONE included, is the only item-level choice and is written as the item's
  row (notes 50 #8, 67, 68). The flags still feed sales' negative-stock answer and bulk-load's
  `tracking_type` hint.
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
`toggleDelete` methods (on the caller's transaction), so all child validation and audit behaviour is
reused as-is. Price and unit-conversion rows stamp the request's user as `*_created_by` /
`*_updated_by` when the payload names none (notes 50 #2).
