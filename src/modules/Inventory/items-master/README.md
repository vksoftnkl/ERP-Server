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
- **Clearing** (notes 137 A2): `item_company_id: null` (or `""`) makes the item SHARED by every
  company; `item_expiry_days`, `item_intimate_before_days` and `item_sort_order` clear on `null`
  too. They were Optional* decorators, which read null as "not sent", so an item could never be
  made shared again. **Yes/no fields** read their raw value (`OptionalNotNullBoolean`): `null` is
  "not sent" (it used to reach the NOT NULL column as a 500, A3) and the string `"false"` is false
  (implicit conversion made it true, D8). `item_hsn_code` is digits only (D6); the day counts are
  `Min(0)` (D5).
- **References** (notes 137 B9): a master this save CHOOSES — group, category, base unit, tax,
  preset, brand, section, supplier, customer group — must exist (`ITEM_UNKNOWN_*`) and be live and
  active (`ITEM_REFERENCE_RETIRED`). Brand, section, supplier and customer group have no foreign
  key at all. A value the save leaves as it was is not re-checked.
- **Actor** (notes 137 C2): `item_created_by` / `item_modified_by` — and every child row's actor
  columns — are the token's user. The payload's values are accepted and ignored.
- **Base unit** (notes 137 B7): a header `item_base_unit_id` other than the unit of the base
  conversion row is a 400 `ITEM_BASE_UNIT_MISMATCH`; a blank header (not sent or null) is filled
  from the base row. Only checked when the save sends either.
- **Company moves** (notes 137 C3): moving into a company (from shared or another company) is a
  409 `ITEM_COMPANY_MOVE_BLOCKED` while another company still holds stock with quantity or a price
  row of the item — checked against the rows the save leaves, so prices moved along in the same
  payload pass. A move to shared is never refused.

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
  - EAN codes → `upper(ean_code)`
  - reorders → `ir_branch_id` + `ir_unit_id` + `ir_godown_id`
- An omitted company / branch / godown on a price or reorder row reads as `null` — what a create
  would store — so a client that sends no row id must send the scope columns. Two payload rows with
  one key are refused (400 `ITEM_DUPLICATE_CHILD_ROWS`) before anything is written — in all four
  collections since notes 137 B8 (two EAN rows with one code came back as 409
  `ITEM_EAN_CODE_TAKEN`, which read as another item owning it).
- A row that sends its own id (`iuc_id` / `ipm_id` / `ean_id` / `ir_id`) must name one of THIS
  item's live rows, else 400 `ITEM_CHILD_NOT_OF_ITEM` (notes 137 A1): the child services updated by
  id alone and rewrote the row's item, so item B's save could take item A's barcode.
- **A unit removed from `unit_conversions[]` takes its prices, EAN codes and reorders with it**, in
  the same transaction, after the three syncs — so it only touches collections the payload left
  out (notes 137 A4). The standalone `/item-unit-conversions/delete` refuses instead (409).
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
  toggle, and a second DELETE restored it (notes 50 #5). An item still in use is a 409
  `ITEM_IN_USE`: stock on hand or in transit (notes 70 C4), and since notes 137 D3 an open sale
  order line (`PENDING` / `PARTIAL` on a `DRAFT` / `CONFIRMED` / `PARTIAL` order), an open
  quotation line (`DRAFT` / `SENT` / `ACCEPTED`), a promotion item or free-item slab or a loyalty
  slab or gift of a scheme that is not `CLOSED`, or another live item's `item_packing_item_ids`.
- `POST /restore` restores the item and **only the children deleted with it**: those soft-deleted at
  or after the item's deletion instant (its `item_modified_on`, which nothing moves while the item is
  deleted; the children are stamped after it in the same transaction). Rows an earlier save removed —
  an old base unit, a replaced EAN — stay deleted (notes 67 B4). The track policy is re-derived
  and the prices are re-keyed under it (notes 137 D2). A name, code, SKU, header barcode or EAN code
  another live item has taken since — or a restored price that overlaps a live one (`ex_ipm_overlap`,
  a 500 until notes 137 D2) — is a **409** naming the field, and nothing is restored.

## Business rules

- **Name, code and SKU are unique per company, in any case** (notes 137 B5 / B6, the user's rule of
  2026-10-21): no two LIVE items of one company share one, and a SHARED item (no company) clashes
  with every company's items. `uq_item_name_en_company_ci` / `uq_item_code_company_ci` /
  `uq_item_sku_company_ci` (on `lower(<key>)` + company) hold the same-company half; the
  shared-vs-company half is `assertUniqueKeys`, under an advisory lock per value. The header
  barcode may not be another live item's EAN code or header barcode (`ITEM_BARCODE_TAKEN`).
  Checked on create, and on an update only for the keys (or the company) it changes, so stored data
  never blocks an unrelated edit. `uq_ean_code_ci` and `uq_ir_item_branch_unit_godown` complete the
  set; all are partial on "not deleted" and DB-only (Prisma cannot declare a partial index). A
  duplicate surfaces as a 409 on the key it hit ([handleWriteError](items-master.service.ts), notes
  137 D4 — it used to be `ITEM_NAME_TAKEN` whatever it was); a bad foreign key as a bad-request
  "Invalid relation reference" on the field whose constraint failed.
- **Company scoping (notes 137 C1) is NOT done**: any logged-in user can read, change, delete or
  restore any company's item by id, and `/bulk-load` with no company lists every company's. The
  token's company is the user's HOME company (`usr_company_id`), not the one they work in, so
  scoping by it would hide items from users who work in several. Left for a design decision
  (2026-10-21).
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
  capturing original vs. modified records under screen "Item Master". The acting user is
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`; the body's
  `item_created_by` / `item_modified_by` are ignored (notes 137 C2).

## Cross-module reuse

Unlike the leaf masters, this module **consumes** the four child modules rather than exporting its own
service. It injects `ItemUnitConversionService`, `ItemsPriceMasterService`, `ItemsEanCodeMasterService`
and `ItemsReorderMasterService` and drives them through their public `save` / `findByItemId` /
`toggleDelete` methods (on the caller's transaction), so all child validation and audit behaviour is
reused as-is. Price and unit-conversion rows stamp the request's user as `*_created_by` /
`*_updated_by` when the payload names none (notes 50 #2).
