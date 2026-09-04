# Opening Stock

API for **opening stock documents** — the voucher that records each item's initial
per-item (and per-batch / per-godown) balance and valuation at the start of a period.
Saving a document also **posts those balances into the shared inventory stock tables**
(ledger, balance, batch stock).

- **Base route:** `opening-stocks` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Opening Stock`
- **Auth:** Bearer `access-token` (required)
- **Cache:** `@CacheTTL(60)` on the controller
- **Primary tables** (`stock` schema):
  - `opening_stock_header` — PK `oshId`, unique `(oshAccYear, oshCompanyId, oshBranchId, oshVoucherId)`
  - `opening_stock_detail` — PK `oslId`, unique `(oslCompanyId, oslBranchId, oslAccYear, oslVoucherId, oslLineNo)`
- **Linked document:** `acc_voucher_header` (`avhVoucherId`) — created/updated/soft-deleted through the
  account-voucher-header helper; the opening-stock header mirrors its voucher no / ref no.
- **Stock side-effect tables** (`inventory` schema): `item_stock_ledger`, `item_stock_balance`,
  `item_batch_stock`, `item_batch_master`.

## Files

| File | Purpose |
| --- | --- |
| [opening-stock.module.ts](opening-stock.module.ts) | Module wiring — imports `AuditLogModule`; registers `OpeningStockService`, `ItemStockLedgerService`, and the exception filter (nothing is exported) |
| [opening-stock.controller.ts](opening-stock.controller.ts) | HTTP routes + Swagger docs; sets 201/200 by create-vs-update |
| [opening-stock.service.ts](opening-stock.service.ts) | Document persistence (header + detail lines), reference validation, audit logging |
| [item-stock-ledger.service.ts](item-stock-ledger.service.ts) | Posts each saved document into the inventory ledger / balance / batch stock tables (the stock engine) |
| [opening-stock-exception.filter.ts](opening-stock-exception.filter.ts) | Maps DB/domain/validation errors to the module's `{ success, message, errors[] }` shape (infers `avh_`/`osh_`/`osl_` field names) |
| [opening-stock.enums.ts](opening-stock.enums.ts) | App-layer enums for the header/detail columns (see below) |
| [dto/save-opening-stock.dto.ts](dto/save-opening-stock.dto.ts) | Create/update payload — `{ header, details[], audit_notes? }` |
| [dto/list-opening-stock-query.dto.ts](dto/list-opening-stock-query.dto.ts) | List/get query params (paging, search, scope filters) |
| [dto/opening-stock-id-query.dto.ts](dto/opening-stock-id-query.dto.ts) | Required `avh_voucher_id` query param |
| [dto/save-item-stock-ledger.dto.ts](dto/save-item-stock-ledger.dto.ts) | Swagger/contract DTOs for `item_stock_ledger` / `item_stock_balance` rows (defined but not bound to any endpoint) |
| [dto/opening-stock-response.dto.ts](dto/opening-stock-response.dto.ts) | Swagger response models |
| [types/opening-stock-api.types.ts](types/opening-stock-api.types.ts) | Header/detail/document payload + response TypeScript contracts |
| [types/item-stock.types.ts](types/item-stock.types.ts) | Stock ledger/balance row interfaces + enums (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/opening-stocks` | Create **or** update a document. Presence of `header.avh_voucher_id` selects update (`200`); absence creates (`201`). |
| `GET` | `/opening-stocks` | List documents, **or** return one when `avh_voucher_id` or `avh_voucher_refno` is supplied. |
| `GET` | `/opening-stocks/get` | Get one document by `avh_voucher_id`. |
| `GET` | `/opening-stocks/list` | Same behaviour as `GET /opening-stocks` (list, or single when an id/refno is supplied). |
| `DELETE` | `/opening-stocks` | Soft-delete (cancel) a document by `avh_voucher_id`. |
| `DELETE` | `/opening-stocks/delete` | Alias of `DELETE /opening-stocks` (delegates to the same handler). |

## Create / update semantics

- **Omit `avh_voucher_id` → create; include it → update.** `save()` branches on that field.
- Both paths run inside a single `prisma.$transaction`; a failure rolls the whole document back.
- The payload is `{ header, details[], audit_notes? }`; **at least one detail row is required**
  (`ArrayMinSize(1)` plus a service-level `ensureDetailsPresent` check).
- **Voucher-type aliases:** the header accepts `avh_voucher_type_id`, `vchr_type_id`, or
  `voucher_type_id` (first positive integer wins; normalized by `normalizeOpeningStockHeaderAliases`
  / `resolveVoucherTypeId`).
- **Create** issues the linked voucher via `createAccountVoucherHeader`, then inserts the
  `opening_stock_header` and the detail rows (`createMany`, line numbers assigned `index + 1`).
- **Update** is **replace-all**: it updates the header/voucher, hard-deletes existing detail rows for
  the voucher (`deleteMany`), and re-inserts the submitted lines.
- **Acting user** comes from `header.osh_user_id`, else `RequestContextService.getUserId()`; if neither
  is present the request is rejected.
- Header totals (`osh_total_lines/qty/value`) are taken from the payload (defaulting to 0), with qty
  rounded to 6 dp and value to 2 dp.

## Soft delete

`softDelete(avh_voucher_id)` runs in a transaction and:

- calls `softDeleteAccountVoucherHeader` (cancel reason `"Opening stock cancelled"`),
- flags the header `oshStatus = CANCELLED`, `oshIsActive = false`, `oshIsDeleted = true`,
- flags every detail row `oslIsActive = false`, `oslIsDeleted = true` (`updateMany`, not a hard delete),
- **reverses the posted stock movements** by re-syncing the now-deleted document (see below),
- audits the change with action `cancel`,
- returns `{ avh_voucher_id, deleted: true }`.

## Detail lines, batch & godown handling

Each detail line carries item / unit / **godown** / optional base-UOM, quantities (`osl_qty`,
`osl_free_qty`, `osl_base_qty`, `osl_conv_factor`), cost & sale rates (A–D, with/without tax `wot`),
tax & cess, and batch/lot fields. During `normalizeDetailLines`:

- `osl_base_qty` defaults to `qty * conv_factor`; free base qty is derived from free qty × factor.
- `osl_stock_value` / `osl_stock_value_wot` are computed as `qty × cost_rate` (with/without tax).
- `osl_expiry_date` must be ≥ `osl_mfg_date`.

**Batch resolution** happens in the stock engine when `osl_tracking_type` is `BATCH` or `MRP`
(`resolveOrCreateBatchIdentity`):

- an existing batch is matched within the `(company, branch, godown, item, unit)` scope by batch id or
  case-insensitive batch no; conflicting id/no combinations raise `409 Conflict`;
- when no batch no is supplied, the next one is generated via `generateNextBatchNo` using the prefix
  from the `batch_prefix` table;
- a missing batch triggers creation of an `item_batch_master` row (status `ACTIVE`);
- the resolved `oslBatchId`/`oslBatchNo` are **written back** onto the `opening_stock_detail` row and
  audited.

## Stock-balance side effects (the stock engine)

After the document is persisted, `OpeningStockService` calls
`ItemStockLedgerService.syncFromOpeningStockDocument(tx, document, previousDocument?)`, which:

- deletes and re-creates the `item_stock_ledger` rows for the voucher (one per detail, `stlTxnType =
  OPENING`, `stlStockEffect = 1`);
- builds movements — **reversing** the previous document (direction `-1`) and **applying** the current
  one (direction `+1`); a deleted header produces no forward movements, so the net effect is a full
  reversal;
- applies each movement into the `SALEABLE` bucket:
  - **batch/MRP-tracked** items post to `item_batch_stock` per batch, then roll up to the
    `item_stock_balance` summary;
  - **untracked** items post straight to `item_stock_balance`;
- recomputes opening/in/out/**closing** and free quantities, reserved/available qty, weighted-average
  rates, and stock value (with a parallel tax-exclusive `wot` valuation);
- **enforces** non-negative quantities/values, `closing = opening + in − out`,
  `available = closing − reserved`, reserved ≤ closing, and sufficient stock on outward moves.

Every write (ledger, balance, batch stock, batch master, detail batch update) is recorded through
`AuditLogService.logEntityChange`; the whole sync runs inside the caller's transaction.

## Listing & filtering

`list` / `getList` page results (`resolvePagination`) and return header payloads plus
`{ page, limit, total, total_pages }`. The `where` (`buildListWhere`):

- always excludes soft-deleted headers (`oshIsDeleted = false`);
- optional scope filters: `osh_acc_year`, `osh_company_id`, `osh_branch_id`, `osh_status`, and a
  `date_from`/`date_to` range over `oshVoucherDate` (`date_from` must be ≤ `date_to`);
- `search` matches (case-insensitive) `oshRefNo`, `oshNarration`, and the linked voucher's
  `avhVoucherRefno` / `avhBillRefno`;
- ordering is `oshVoucherDate` desc, then `oshVoucherNo` desc, then `oshId` desc.

Single-document reads (`getByVoucherId`, `getByVoucherRefNo`) throw `404` when no active document
matches. Header payloads embed the resolved voucher/opening user names, and detail payloads embed
item code/name, unit, base-UOM, godown, and tax names via batched lookups.

## Validation

- **Reference checks** (fail with `400`, missing ids listed): header validates company, branch, party
  ledger, optional opposite ledger, and opening user; details validate item, unit, optional base-UOM
  price, godown, and optional tax — all requiring non-deleted rows.
- **DTO validation** (`class-validator`) enforces UUIDs, required strings, numeric minimums, date
  strings, and the enums below.
- Unique-constraint violations surface as `409` (`"Opening stock already exists"`); foreign-key
  violations surface as `400`.

## Enums (app-layer)

The status/tracking/device columns are plain `VARCHAR(20)`; validation lives in the app (via
`@IsEnum`), not in Postgres. See [opening-stock.enums.ts](opening-stock.enums.ts):

- `OpeningStockStatus` — `DRAFT` · `APPROVED` · `POSTED` · `CANCELLED`
- `OpeningStockDeviceType` — `PC` · `MOBILE` · `WEB`
- `OpeningStockDetailTrackingType` — `NONE` · `MRP` · `BATCH`
- `OpeningStockDetailCessType` — `NONE` · `PERCENT` · `PER_UNIT`

The stock engine uses further enums in [types/item-stock.types.ts](types/item-stock.types.ts):

- `StockTrackingType` / `ItemStockBalanceTrackingType` — `NONE` · `MRP` · `BATCH`
- `ItemStockBucket` — `SALEABLE` · `DAMAGED` · `EXPIRED` · `HOLD` · `RETURN`
- `StockTxnType` — `OPENING` · `PURCHASE` · `PURCHASE_RETURN` · `SALE` · `SALES_RETURN` ·
  `TRANSFER_IN` · `TRANSFER_OUT` · `ADJUSTMENT_IN` · `ADJUSTMENT_OUT` · `PRODUCTION_IN` ·
  `CONSUMPTION` · `DAMAGE` · `EXPIRED` (opening stock always posts `OPENING`)

## Status: disabled

Every implementation file in this folder is commented out and `OpeningStockModule`
is unregistered in `src/app.module.ts`, so the feature ships no routes. This was
done in `61f16c1` alongside dropping the `AccVoucherHeader` and bill models.

Its unit tests are parked as `*.spec.ts.disabled` rather than deleted, because
Jest's `testRegex` (`.*\.spec\.ts$`) and `tsc` would otherwise pick up tests whose
subject no longer exports anything — that failed the suite with *0 tests run* and
broke `npm run typecheck`. Commenting them out is not an option: Jest rejects an
empty suite with "must contain at least one test".

To re-enable the feature, uncomment the sources and drop the `.disabled` suffix.
The tests were written against the pre-`61f16c1` schema and will need field names
reconciled (e.g. `avhBillRefno`, `avhBillDate`, `avhUpdatedOn` no longer exist).
