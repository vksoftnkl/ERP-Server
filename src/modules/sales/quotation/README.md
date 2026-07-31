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

Both `/get` and `/delete` take the same query scope — `sqId`, `sqCompanyId` and `sqBranchId`
validated by `ParseUUIDPipe({ version: '7' })`, plus `sqAccYear` as a plain string. A quotation is
only found when all four match, so an id from another company, branch or accounting year answers
not-found rather than reading or deleting across tenants.

### Create / update semantics

- **Omit `sqId` → create; include `sqId` → update** the existing quotation.
- Each operation runs inside a single `$transaction` (header, all line items, and audit entries
  are all-or-nothing).
- On **update**, the header must still be active (`sqIsDeleted = false`) or a not-found error is
  raised.
- On **create**, `sqCustName` is normalized via `normalizeRequiredText` (trimmed and
  required-non-empty), `sqQuoteSlno` / `sqQuoteRefno` are **server-assigned** (see
  [Document numbering](#document-numbering)), `sqQuoteDate` defaults to *now* when omitted, and
  `sqStatus` defaults to `'DRAFT'`.
- Optional header fields are copied through only when present on the payload
  (`applyPresentFields` over the `QUOTATION_OPTIONAL_FIELDS` list); absent fields are left as-is
  on update.

### Document numbering

`sqQuoteSlno` and `sqQuoteRefno` are **not** client-supplied. On create the service consumes the
next number from `accounts.acc_voucher_seq` through
[`allocateVoucherNumber`](../../../common/Sequence/voucher-sequence.helper.ts), using the
`Quo` / *Sales Quotation* voucher type (`vchr_type_id = 21`, `QUOTATION_VCHR_TYPE_ID`):

- The counter is scoped to `(vchr_type_id 21, company, branch, accounting year, device code
  `MAIN`, period key)`. The period key comes from the voucher type's reset frequency — `ALL` for
  `NEVER`, the accounting year for `YEARLY` (what type 21 uses today), otherwise the quote date's
  month or day.
- The consumed running number becomes `sqQuoteSlno`; its printable form —
  `seq_voucher_prefix` + the number zero-padded to `seq_no_width` + `seq_voucher_suffix` — becomes
  `sqQuoteRefno` and is stamped back onto `seq_last_refno`. The row's `seq_company_code` /
  `seq_branch_code` are a format snapshot only and are **not** part of the printed number; company
  and branch are already part of the scope the counter runs in. With the current configuration the
  numbers read `quo00001`, `quo00002`, …
- The sequence row is **created on first use**, seeded from the voucher type's
  `vchr_no_prefix` / `vchr_no_suffix` / `vchr_no_width` plus the company's and branch's codes.
  Editing the voucher type afterwards never rewrites numbers already issued from that row.
- Because type 21 is `AUTO`-numbered with `vchr_allow_manual_no = false`, anything the client sends
  for `sqQuoteSlno` / `sqQuoteRefno` is **ignored**. Both fields remain on the DTO (marked
  `readOnly`) only so `forbidNonWhitelisted` does not reject clients that still send them.
- Neither field is in `QUOTATION_OPTIONAL_FIELDS`, so an **update never renumbers** a quotation —
  the reference number is immutable once issued.
- A sequence row that has been deactivated (`seq_is_active = false`) or soft-deleted makes the save
  fail with a 400 naming the row, rather than silently reviving it.
- The number is allocated inside the caller's transaction, under a `pg_advisory_xact_lock` keyed on
  the sequence scope, so concurrent saves cannot hand out the same number or race each other into
  creating the row twice.

> Switching voucher type 21 to a `DAILY` / `MONTHLY` reset would restart the counter inside an
> accounting year and collide with `ux_sq_slno`, which is unique per
> `(company, branch, accYear, sqQuoteSlno)`. Keep it `YEARLY` (or `NEVER`).

### Nested line items

Line items are managed through the `items[]` array on the create/update payload
(`syncItems` reconciliation):

- Item **with** `sqiId` → updates that existing line (it must belong to this quotation, else a
  not-found error).
- Item **without** `sqiId` → inserts a new line; `sqiItemId` and `sqiItemUnitId` are required for a
  new line (`requireItemField`).
- An existing active line **absent** from the array → **soft deleted** (`sqiIsDeleted = true`).
- Omitting the `items` property entirely (`undefined`) leaves the current lines **untouched**.
- **Write order** (why `syncItems` validates the whole array before writing anything):
  `ux_sqi_quote_line` is unique over the **active** lines only, so the replaced lines are soft
  deleted **first** — a client re-posting its grid without `sqiId` reuses line numbers 1..n, and
  those numbers have to be free before the inserts land. Surviving lines that the payload
  **reorders** are then parked above every requested number in one `updateMany` before being
  renumbered down, so a 1↔2 swap never passes through a state where both rows want the same number.
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
  per `(sqCompanyId, sqBranchId, sqAccYear, sqQuoteSlno)` (`ux_sq_slno`).
- A unique-constraint violation (P2002) is reported as the duplicate it actually is, resolved from
  the index Postgres names in `meta.target` (`describeDuplicate`): `ux_sqi_quote_line` → conflict on
  `sqiLineNo`, `ux_sq_slno` → conflict on `sqQuoteSlno`, otherwise → "Duplicate quotation reference
  number is not allowed" on `sqQuoteRefno`. Mapping every violation to the refno is what once made a
  line-number clash on update look like the server renumbering the quotation.

### Soft delete

- `DELETE /delete` sets `sqIsDeleted = true` (plus `sqModifiedOn` / `sqModifiedBy`) on the header,
  then cascades the same to all its active line items **and applied charges** so nothing stays
  active under a logically deleted header. Rows are never hard-deleted.
- The header is matched on `(sqId, sqCompanyId, sqBranchId, sqAccYear)`; the cascades key off
  `sqId` alone, which is already the header's primary key. A mismatched scope deletes nothing.
- `GET /get` and the update lookups only ever see rows with `sqIsDeleted = false` (and items with
  `sqiIsDeleted = false`, charges with `cdIsDeleted = false`).

### Validation

- Enforced by the DTO decorators under the global `ValidationPipe`: `sqCompanyId`, `sqBranchId`,
  `sqTenantId`, `sqUserId` are required UUIDs; `sqAccYear` is a fixed 9-char string; `sqPriceLevel`
  is a required integer; `sqCustName` (max 200) is a required non-empty string; `sqQuoteSlno` and
  `sqQuoteRefno` are accepted but ignored (see [Document numbering](#document-numbering));
  nested `items[]` are validated per-element (`@ValidateNested`), each
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
  - Header: actions `New` / `update` / `cancel`, `tableName = 'sale_quotation'`,
    `screenName = 'Sale Quotation'`, `screenType = 'transaction'`.
  - A **soft delete is logged as `cancel`**, at every level (header, line, charge). The
    `audit.audit_log_action` enum is `insert | update | approve | cancel` — it has no `delete`
    member, so `AuditLogService.normalizeAction` answers
    `400 Unsupported audit action: delete` and takes the whole save down with it. This is the
    convention every other module already follows.
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

### Resolved master names (GET only)

`/get` also returns the display name behind each master id on the header, so the client does not
have to call the lookup APIs to render a stored quotation. They are **read-only** — never accepted
on `/create` — and are `null` on the create/update responses, exactly like the line items'
`sqiItemName` / `sqiUnitName`.

| Response field | Source | Reached by |
| --- | --- | --- |
| `sqCustAreaName` | `sales.area_master.arm_name` | `custArea` relation on `sqCustAreaId` |
| `sqCustAreaDistanceKm` | `sales.area_master.arm_distance_km` | same relation |
| `sqSalesmanName` | `public.employee_master.emp_name` | `salesman` relation on `sqSalesmanId` |
| `sqAgentName` | `sales.sale_agents.sa_name` | separate `findUnique` — `sq_agent_id` has **no FK** |

A soft-deleted or inactive master row still resolves: a stored quotation must keep showing the
area/salesman/agent it was raised under after that master is retired.

Each line item carries the same kind of resolved fields for its own masters, so the client can
render quantity/rate inputs (decimal places, batch behaviour) and group/brand-driven UI without a
second round trip:

| Response field | Source | Reached by |
| --- | --- | --- |
| `sqiItemName` | `inventory.item_master.item_name_en` | `item` relation on `sqiItemId` |
| `sqiBatchConfig` | `inventory.item_master.item_batch_config` | same relation |
| `sqiGroupId` | `inventory.item_master.item_group_id` | same relation |
| `sqiBrandId` | `inventory.item_master.item_brand_id` | same relation |
| `sqiSectionId` | `inventory.item_master.item_section_id` | same relation |
| `sqiCategoryId` | `inventory.item_master.item_category_id` | same relation |
| `sqiUnitName` | `inventory.item_unit_master.unit_name` | `itemUnitConversion` → `unit` on `sqiItemUnitId` |
| `sqiDecimalCount` | `inventory.item_unit_master.unit_decimal_count` | same relation chain |
