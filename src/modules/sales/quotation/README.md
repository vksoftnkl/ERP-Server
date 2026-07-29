# Quotation

CRUD API for **sales quotations** — the price quote a company issues to a customer,
composed of a quotation **header** and its nested **line items** (one row per quoted
product/service, with its rates, discounts and tax breakup).

- **Base route:** `quotations` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Quotations`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_quotation` (`sales` schema) — PK `sqId` (uuidv7)
- **Line-item table:** `sale_quotation_item` (`sales` schema) — PK `sqiId` (uuidv7), FK `sqiQuoteId → sqId`
- **Applied-charge table:** `sale_charge_detail` (`public` schema) — PK `cdId`, addressed
  polymorphically by `(cdDocType = 'QUOTATION', cdDocId = sqId)`; there is **no FK** to
  `sale_quotation` because the table is shared by every module (sales, purchase, GRN, invoice)

## Files

| File | Purpose |
| --- | --- |
| [quotation.module.ts](quotation.module.ts) | Module wiring — imports `AuditLogModule`, **exports `QuotationService`** |
| [quotation.controller.ts](quotation.controller.ts) | HTTP routes + Swagger docs |
| [quotation.service.ts](quotation.service.ts) | Business logic, persistence, line-item reconciliation, audit logging |
| [quotation-exception.filter.ts](quotation-exception.filter.ts) | Registered via `@UseFilters`; a pass-through that re-throws the `HttpException` (error shaping is done in the service) |
| [dto/save-quotation.dto.ts](dto/save-quotation.dto.ts) | Create/update payload for the header + nested `items[]` |
| [dto/save-quotation-item.dto.ts](dto/save-quotation-item.dto.ts) | A single quotation line-item entry |
| [dto/save-quotation-charge.dto.ts](dto/save-quotation-charge.dto.ts) | A single applied-charge entry (`sale_charge_detail` snapshot) |
| [dto/quotation-response.dto.ts](dto/quotation-response.dto.ts) | Swagger success/error response models |
| [types/quotation-api.types.ts](types/quotation-api.types.ts) | Payload / response / error TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a quotation, chosen by `sqId` presence in the body. |
| `GET` | `/get` | Fetch one active quotation by `sqId` (query param), including its active line items and applied charges. |
| `DELETE` | `/delete` | Soft-delete a quotation by `sqId` (query param), cascading to its line items and applied charges. |

Both `/get` and `/delete` take `sqId` as a query parameter validated by `ParseUUIDPipe({ version: '7' })`.

### Create / update semantics

- **Omit `sqId` → create; include `sqId` → update** the existing quotation.
- Each operation runs inside a single `$transaction` (header, all line items, and audit entries
  are all-or-nothing).
- On **update**, the header must still be active (`sqIsDeleted = false`) or a not-found error is
  raised.
- On **create**, `sqCustName` and `sqQuoteRefno` are normalized via `normalizeRequiredText`
  (trimmed and required-non-empty), `sqQuoteDate` defaults to *now* when omitted, and `sqStatus`
  defaults to `'DRAFT'`.
- Optional header fields are copied through only when present on the payload
  (`applyPresentFields` over the `QUOTATION_OPTIONAL_FIELDS` list); absent fields are left as-is
  on update.

### Nested line items

Line items are managed through the `items[]` array on the create/update payload
(`syncItems` reconciliation):

- Item **with** `sqiId` → updates that existing line (it must belong to this quotation, else a
  not-found error).
- Item **without** `sqiId` → inserts a new line; `sqiItemId` and `sqiItemUnitId` are required for a
  new line (`requireItemField`).
- An existing active line **absent** from the array → **soft deleted** (`sqiIsDeleted = true`).
- Omitting the `items` property entirely (`undefined`) leaves the current lines **untouched**.
- Scope keys (`sqiQuoteId`, `sqiCompanyId`, `sqiBranchId`, `sqiTenantId`, `sqiAccYear`,
  `sqiPriceLevel`) are inherited from the parent quotation; any values sent on the item default to
  the parent scope.
- Returned line items are sorted by `sqiLineNo` ascending.

### Nested applied charges

Freight / loading / packing / cash-discount lines are managed through the `charges[]` array on the
same create/update payload (`syncCharges` reconciliation), with **exactly** the item semantics:

- Charge **with** `cdId` → updates that existing charge line (it must belong to this quotation, else
  a not-found error).
- Charge **without** `cdId` → inserts a new line; `cdChgId` (the `charge_master` row) and
  `cdLedgerCode` are required for a new line (`requireChargeField`).
- An existing active charge **absent** from the array → **soft deleted** (`cdIsDeleted = true`).
- Omitting the `charges` property entirely (`undefined`) leaves the current charges **untouched**.
- Scope keys are set by the service: `cdDocType = 'QUOTATION'`, `cdDocId = sqId`, and
  `cdCompId` / `cdBranchId` / `cdAccYear` / `cdVoucherNo` default to the parent quotation's
  company / branch / accounting year / `sqQuoteSlno`.
- `cdSlno` defaults to the 1-based position in the array; a duplicate within one payload raises a
  conflict on `cdSlno`. Returned charges are sorted by `cdSlno` ascending.
- Every `cd*` value other than the amounts is a **snapshot** of the charge master taken at save
  time, so the client sends them explicitly — editing a charge master later never rewrites what was
  already quoted.
- `cdVoucherNo` is a `bigint` column and is emitted as a **string** in the response (JSON has no
  bigint), matching the header's `sqQuoteSlno`.

### Line numbering & uniqueness

- `sqiLineNo` defaults to the **1-based position** of the item within the `items[]` array when
  omitted.
- A **duplicate line number within one payload** raises a conflict (`throwSalesConflict` on
  `sqiLineNo`). At the DB level, `ux_sqi_quote_line` enforces unique `(sqiQuoteId, sqiLineNo)` among
  non-deleted lines.
- Header reference number `sqQuoteRefno` is unique per `(sqCompanyId, sqBranchId, sqAccYear,
  sqQuoteRefno, sqRevisionNo)` among non-deleted rows (`ux_sq_quote_no`); `sqQuoteSlno` is unique
  per `(sqCompanyId, sqBranchId, sqAccYear, sqQuoteSlno)` (`ux_sq_slno`). A unique-constraint
  violation is mapped to a "Duplicate quotation reference number is not allowed" conflict on
  `sqQuoteRefno` (`throwOnUniqueConstraintError`).

### Soft delete

- `DELETE /delete` sets `sqIsDeleted = true` (plus `sqModifiedOn` / `sqModifiedBy`) on the header,
  then cascades the same to all its active line items **and applied charges** so nothing stays
  active under a logically deleted header. Rows are never hard-deleted.
- `GET /get` and the update lookups only ever see rows with `sqIsDeleted = false` (and items with
  `sqiIsDeleted = false`, charges with `cdIsDeleted = false`).

### Validation

- Enforced by the DTO decorators under the global `ValidationPipe`: `sqCompanyId`, `sqBranchId`,
  `sqTenantId`, `sqUserId` are required UUIDs; `sqAccYear` is a fixed 9-char string; `sqPriceLevel`
  and `sqQuoteSlno` are required integers; `sqQuoteRefno` (max 100) and `sqCustName` (max 200) are
  required non-empty strings; nested `items[]` are validated per-element (`@ValidateNested`), each
  requiring `sqiItemId` and `sqiItemUnitId` as UUIDs (`sqiItemUnitId` references
  `item_unit_conversion.iucId`, not `item_unit_master.unit_id`).
- Nested `charges[]` are validated the same way, each requiring `cdChgId` and `cdLedgerCode` as
  UUIDs. The enum columns are `@IsEnum`-checked against the shared charge enums
  (`ChargeRole` / `ChargeMethod` / `ChargeType` / `ChargeApplyOn` / `ChargeCostAlloc` in
  `master/charge-master/types/charge-enum.ts`, where `ChargeDocType.QUOTATION` — the discriminator
  this module writes — also lives).
- `ensureChargeValuesAreAllowed` re-checks those values on the write path (against
  `CHARGE_DETAIL_VALUE_GUARDS`) plus the mutually-exclusive `cdTaxApl` / `cdBeforeTax` pair, so the
  DB CHECK constraints `ck_cd_doc_type` / `ck_cd_type` / `ck_cd_method` / `ck_cd_apply_on` /
  `ck_cd_cost_alloc` / `ck_cd_tax_apl` surface as a 400 with the offending field rather than a raw
  Postgres 23514. On update the stored row supplies whatever the payload omitted, since the
  constraint judges the merged row.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` inside the same transaction,
  capturing original vs. modified records.
  - Header: actions `New` / `update` / `delete`, `tableName = 'sale_quotation'`,
    `screenName = 'Sale Quotation'`, `screenType = 'transaction'`.
  - Each line-item insert/update/soft-delete is logged separately against
    `sale_quotation_item`.
  - Each applied-charge insert/update/soft-delete is logged separately against
    `sale_charge_detail`, displayed as `cdChgName` (falling back to `Charge <cdSlno>`).
- The acting user is resolved from the payload's `sqCreatedBy` / `sqModifiedBy`, then the request
  context user (`RequestContextService.getUserId()`), falling back to `DEFAULT_ACTOR`
  (`resolveActor`).

### Response shape

Success responses follow `{ success: true, message, data }` (`QuotationSuccessResponse`), where
`data` is the quotation payload (header fields with date-times serialized to ISO strings, plus
`items[]` and `charges[]` arrays). Errors use `{ success: false, message, errors: [{ field, message }] }`
(`QuotationErrorResponse`), produced by the shared sales helpers rather than by the exception
filter.
