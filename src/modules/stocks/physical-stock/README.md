# Physical Stock

API for **physical stock verification** — recording physically counted quantities against
system (book) stock for a godown, computing the variance per item (and per batch/lot/serial),
and adjusting batch stock balances for the counted difference.

- **Base route:** `physical-stock` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Physical Stock`
- **Auth:** Bearer `access-token` (required)
- **Response cache:** `@CacheTTL(60)` on the controller
- **Primary table:** `physical_stock_header` (`stock` schema) — PK `psId` (`psc_id`)
- **Detail table:** `physical_stock_detail` — PK `psdId` (`psd_id`), FK `psdPscId → psc_id`
- **Batch/lot/serial table:** `physical_stock_batch_detail` — PK `psbId` (`psb_id`), FK
  `psbPsdId → psd_id`, `psbPshId → psc_id`
- **Cross-module write:** `item_batch_stock` (`inventory` schema) — upserted on batch/serial rows

## Files

| File | Purpose |
| --- | --- |
| [physical-stock.module.ts](physical-stock.module.ts) | Module wiring — imports `AuditLogModule`; registers controller, service, exception filter |
| [physical-stock.controller.ts](physical-stock.controller.ts) | HTTP routes + Swagger docs; sets `201`/`200` by `psId` presence |
| [physical-stock.service.ts](physical-stock.service.ts) | Business logic, variance calculation, persistence, batch-stock adjustment, audit logging |
| [physical-stock-exception.filter.ts](physical-stock-exception.filter.ts) | Maps `HttpException` / validation errors to the module's `{ success, message, errors[] }` shape |
| [dto/create-physical-stock.dto.ts](dto/create-physical-stock.dto.ts) | Create/update payload — header + nested `details[]` + nested `batchDetails[]` |
| [dto/update-physical-stock.dto.ts](dto/update-physical-stock.dto.ts) | `PartialType(CreatePhysicalStockDto)` |
| [dto/list-physical-stock-query.dto.ts](dto/list-physical-stock-query.dto.ts) | List/get query params (paging, search, scope filters, `ps_id` / `ps_doc_refno`) |
| [dto/physical-stock-response.dto.ts](dto/physical-stock-response.dto.ts) | Swagger error-response model |
| [entities/physical-stock.entity.ts](entities/physical-stock.entity.ts) | Empty placeholder class (`PhysicalStock`); persistence is via Prisma |
| [types/physical-stock-response.types.ts](types/physical-stock-response.types.ts) | Response TypeScript contracts + Swagger success/response DTOs |
| [types/physical-stock.enums.ts](types/physical-stock.enums.ts) | App-layer enums (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/` | Create **or** update a document. `psId` present → update (`200`); absent → create (`201`). |
| `GET` | `/` | Single document when `ps_id` **or** `ps_doc_refno` is supplied; otherwise a paginated list. |
| `GET` | `/get` | Fetch one document by `ps_id`. |
| `GET` | `/list` | Same behaviour as `GET /` (delegates to it). |
| `GET` | `/:id` | Fetch one document by header id (path param, uuid). |
| `DELETE` | `/` | Soft-delete a document by `ps_id` (query). |
| `DELETE` | `/delete` | Soft-delete a document by `ps_id` (query). |
| `DELETE` | `/:id` | Soft-delete a document by header id (path param, uuid). |

A single document response is `{ header, details: [ { …, batch_details: [ … ] } ] }`, using
`psc_*` header keys and `psd_*` / `psb_*` detail keys (embedding godown/item/unit names).
List responses return `header`-shaped items plus `{ page, limit, total, total_pages }` meta.

### Create semantics

- `POST /` accepts a **single** [CreatePhysicalStockDto](dto/create-physical-stock.dto.ts)
  (header fields + optional `details[]`, each with optional `batchDetails[]`).
- Runs in one `$transaction`: validate header references → insert header → insert each detail
  (`psdRowNo` defaults to its 1-based position) → insert each batch detail (`psbRowNo` likewise).
- `psDocNo` is coerced with `toRequiredBigInt` — must be a **positive integer**.
- Batch snapshot fields fall back to their parent detail's values when omitted
  (acc-year/company/branch/godown/item/unit/base-unit/factor/MRP/barcode/reason/resolution).
- Only **create** writes an audit entry.

### Update semantics

- Loads the existing **active** header (`psIsDeleted = false`) or 404s, merges scope fields, and
  re-validates references before updating the header (`psModifiedOn`/`psModifiedBy` always set).
- **`details` is a full replace, all-or-nothing:** when the `details` array is present, every
  existing detail and batch row for the document is `deleteMany`-ed and recreated from the
  payload. Omitting `details` leaves detail/batch rows untouched (header-only update).
- `psTotalLines` defaults to `details.length` when not explicitly provided.

### Soft-delete semantics

- Rows are never hard-deleted. Delete runs in a `$transaction` and, using the header's
  `psModifiedBy ?? psCreatedBy` as actor: soft-deletes batch rows, then detail rows
  (`isActive = false`, `isDeleted = true`, modified stamps), then the header
  (`psStatus = 'CANCELLED'`, `psIsActive = false`, `psIsDeleted = true`, cancel + modified stamps).
- Returns `{ ps_id, deleted: true }`. Soft-delete does **not** reverse `item_batch_stock`.

## Variance calculation

[`calculateVarianceValues`](physical-stock.service.ts) fills any omitted difference/value columns
for both detail and batch rows:

- `diffQty = physicalQty − bookQty`, `diffBaseQty = physicalBaseQty − bookBaseQty` (base qty
  falls back to the non-base qty), rounded to 6 dp.
- `bookValueWot = bookBaseQty × stockRateWot`, `physicalValueWot = physicalBaseQty × stockRateWot`,
  `diffValueWot = diffBaseQty × stockRateWot`, `diffValueWithTax = diffBaseQty × stockRateWithTax`
  (rate-with-tax falls back to `stockRateWot`), rounded to 2 dp.
- Any value the client supplies explicitly is kept as-is (the formula only fills blanks).

## Stock-balance effects

For batch rows whose parent detail `psdTrackingType` is `BATCH` or `SERIAL` **and** which carry a
`psbBatchId`, [`adjustItemBatchStockForBatch`](physical-stock.service.ts) upserts an
`item_batch_stock` row keyed by
`(accYear, company, branch, godown, item, batch, stockBucket = 'SALEABLE')`:

- On create the delta is the batch's `psbDiffBaseQty`; on update it is the new diff minus the
  previously stored diff for that `psbId` (so re-saving a document nets the change).
- `delta > 0` increments `ibsInQty`; `delta < 0` increments `ibsOutQty`; `delta = 0` is skipped.
- `NONE` / `MRP` tracking rows do **not** touch `item_batch_stock`.

## Validation

- **Scope consistency** ([`validateDocumentScopes`](physical-stock.service.ts)): each detail's
  acc-year/company/branch/godown must match the header; each batch's acc-year/company/branch/
  godown/item/unit/base-unit must match its parent detail. `psbBatchId` is **required** for
  `BATCH`/`SERIAL`-tracked details. All mismatches are collected and returned together.
- **Reference existence** ([`validateHeaderReferences`](physical-stock.service.ts)): company,
  branch (belonging to the company), and godown location (belonging to the branch) must each be
  active and not deleted.
- **Duplicate document number**: a unique-constraint violation is mapped to a `psDocNo` error —
  duplicate doc numbers are rejected for the same accounting year, company, and branch.
- **Foreign-key violations** are mapped to the offending field via
  [`resolveForeignKeyField`](physical-stock.service.ts) (company/branch/godown/item/unit/
  base-unit/reason/batch, at header, detail, or batch level).

## Adjustment reason & resolution

- `psdReasonId` / `psbReasonId` are optional FKs to a reason master (enforced by DB FK
  constraints, surfaced as field errors on violation). A batch inherits the detail's reason when
  its own is omitted.
- `psdResolution` / `psbResolution` use [`PhysicalStockResolution`](types/physical-stock.enums.ts)
  (default `ADJUST_LOSS_GAIN`) to record how each variance is to be handled.

## Audit logging

Only **create** is audited, via `AuditLogService.logEntityChange` — action `New`, table
`physical_stock_header`, screen name `Physical Stock`, screen type `transaction`, keyed by the new
`psId`, with the built document header as the modified record and the payload's `psCreatedBy` /
`psBranchId` as actor/branch. Update and delete do not emit audit entries.

## Enums (app-layer)

Defined in [types/physical-stock.enums.ts](types/physical-stock.enums.ts):

- `PhysicalStockCountType` — `FULL` · `PARTIAL` · `ITEM_GROUP` · `BRAND` · `BIN` · `BATCH`
- `PhysicalStockPostingMode` — `ADJUST_DIFFERENCE_ONLY` · `REPLACE_BOOK_STOCK`
- `PhysicalStockRateSource` — `AVG_COST` · `LAST_PURCHASE` · `MANUAL` · `FIFO`
- `PhysicalStockResolution` — `ADJUST_LOSS_GAIN` · `RECLASSIFY` · `CORRECT_SOURCE_DOC` ·
  `RECOUNT_REQUIRED` · `IGNORE_ZERO`

Shared enums used by the DTOs come from module utils: `TransactionStatus` (`psStatus`,
default `DRAFT`), `StockTrackingType` (`psdTrackingType`, default `NONE`), and `DeviceType`
(`psDeviceType`, default `WEB`).
