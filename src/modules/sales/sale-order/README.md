# Sale Order

CRUD API for **sales orders** — the commitment a company takes from a customer ahead of billing,
composed of an order **header**, its nested **line items** (one row per ORDERED LINE — not per
batch: an order allocates no stock), and its **advance allocations** (where money taken up front
actually went).

- **Base route:** `sale-orders` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Sale Orders`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_order` (`sales` schema) — **partitioned by LIST (`so_acc_year`)**,
  composite PK `(soId, soAccYear)`
- **Line-item table:** `sale_order_item` (`sales` schema) — also partitioned by `soiAccYear`,
  composite PK `(soiId, soiAccYear)`, composite FK `(soiOrderId, soiAccYear) → (soId, soAccYear)`
- **Advance-allocation table:** `sale_order_advance_alloc` (`sales` schema) — also partitioned by
  `soaAccYear` (the year of the APPLICATION, which may differ from the order's), composite PK
  `(soaId, soaAccYear)`, composite FK `(soaOrderId, soaOrderAccYear) → (soId, soAccYear)`.
  **Owned by this module** — unlike the charge/tender lines there is no separate owner service.
- **Applied-charge table:** `txn_charge_detail` (`public` schema) — partitioned by `cdAccYear`,
  composite PK `(cdId, cdAccYear)`, addressed polymorphically by
  `(cdDocType = 'ORDER', cdDocId = soId)`. `ORDER` was added to `ChargeDocType` alongside this
  module; by then `txn_charge_detail` carried no `ck_cd_doc_type` CHECK any more, so the enum
  alone defines the allowed set. Owned by [../../master/charge-detail](../../master/charge-detail).
- **Tender table:** `acc_tender_detail` (`accounts` schema) — partitioned by `td_acc_year`,
  addressed polymorphically by `(tdSrcModule = 'SALES', tdSrcDocType = 'SALES_ORDER',
  tdSrcDocId = soId)`. Owned by
  [../../accountsModule/tenderDetail](../../accountsModule/tenderDetail). For an order this is the
  **advance money** the customer handed over — `SALES_ORDER` has been a `TenderSrcDocType` member
  since the tender module shipped, waiting for this module.

This module is the sibling of [../bill](../bill) — same create/get/delete surface, same nested
reconciliation shape for line items / charges / tenders, same audit and soft-delete conventions —
with the structural differences called out below: a fourth nested array (`advances[]`), a device
FK instead of a free-text device pair, DB CHECK constraints that actually exist, and no accounts
posting (an order is a commitment, not an accounting document).

## Files

| File | Purpose |
| --- | --- |
| [sale-order.module.ts](sale-order.module.ts) | Module wiring — imports `AuditLogModule` + `ChargeDetailModule` + `TenderDetailModule`, **exports `SaleOrderService`** |
| [sale-order.controller.ts](sale-order.controller.ts) | HTTP routes + Swagger docs |
| [sale-order.service.ts](sale-order.service.ts) | Business logic, persistence, nested reconciliation, CHECK mirrors, audit logging |
| [sale-order-exception.filter.ts](sale-order-exception.filter.ts) | Registered via `@UseFilters`; recognises `so*` (covers `soi*`/`soa*`), `cd*` and `td*` field names |
| [dto/save-sale-order.dto.ts](dto/save-sale-order.dto.ts) | Create/update payload for the header + nested `items[]` / `charges[]` / `tenders[]` / `advances[]` |
| [dto/save-sale-order-item.dto.ts](dto/save-sale-order-item.dto.ts) | A single order line-item entry |
| [dto/save-sale-order-advance.dto.ts](dto/save-sale-order-advance.dto.ts) | A single advance-allocation entry |
| [dto/sale-order-response.dto.ts](dto/sale-order-response.dto.ts) | Swagger success/error response models |
| [types/sale-order-api.types.ts](types/sale-order-api.types.ts) | Payload / response / error TypeScript contracts |

Charge and tender lines have **no DTO, payload type or writer of their own here** — `charges[]` is
the charge-detail module's [`SaveChargeDetailDto`](../../master/charge-detail/dto/save-charge-detail.dto.ts)
and `tenders[]` the tender-detail module's
[`SaveTenderDetailDto`](../../accountsModule/tenderDetail/dto/save-tender-detail.dto.ts). The
`advances[]` array **does** have its own DTO here, because the table is this module's own.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a sale order, chosen by `soId` presence in the body. |
| `GET` | `/get` | Fetch one active order by `soId` (query param), including its active line items, applied charges, tender lines and advance allocations. |
| `DELETE` | `/delete` | Soft-delete an order by `soId` (query param), cascading to its line items, applied charges, tender lines and advance allocations. |

`GET /get` and `DELETE /delete` both additionally require `soCompanyId`, `soBranchId` and
`soAccYear` as query parameters — the row is looked up by all four together, so an order can only
be read or deleted from within its own company/branch/year scope.

### Create / update semantics

- **Omit `soId` → create; include `soId` → update** the existing order.
- Each operation runs inside a single `$transaction` (header, all line items, applied charges,
  tender lines, advance allocations, and audit entries are all-or-nothing).
- On **update**, the header must still be active (`soIsDeleted = false`) or a not-found error is
  raised. Because `sale_order`'s primary key is the composite `(soId, soAccYear)`, the update
  targets that compound key (`soId_soAccYear`), resolved from the row `findFirst` already loaded.
- On **create**, `soCustName` is normalized via `normalizeRequiredText`, `soOrderSlno` /
  `soOrderRefno` are allocated from the voucher sequence, `soOrderDate` defaults to *now* when
  omitted, and `soStatus` defaults to `'DRAFT'`.
- Optional header fields are copied through only when present on the payload
  (`applyPresentFields` over the `SALE_ORDER_OPTIONAL_FIELDS` list); absent fields are left as-is on
  update. The partition/scope keys (`soCompanyId`, `soBranchId`, `soTenantId`, `soAccYear`,
  `soPriceLevel`, `soUserId`) and the server-assigned number (`soOrderSlno` / `soOrderRefno`) are
  **not** in that list — they are immutable after creation. `soDeviceId` **is** updatable
  (matching the bill's device columns), and required on every payload.

### Order numbering

Exactly like [../bill](../bill), **`soOrderSlno` and `soOrderRefno` are server-assigned**:
`createOrder` calls `allocateVoucherNumber` (`src/common/Sequence/voucher-sequence.helper.ts`)
inside the save transaction and writes back what it consumed. Whatever the client sends for either
field is ignored.

- The numbers come from the `accounts.acc_voucher_seq` counter for **voucher type 4** (`SOr` /
  Sales Order, seeded by `prisma/seed/Acc_Voucher_Types_Sale_Order.sql`). `lastNo` becomes
  `soOrderSlno`; its printable form — `prefix + zero-padded number + suffix`, e.g. `sor00001` —
  becomes `soOrderRefno`.
- Scope: `(vchrTypeId, companyId, branchId, accYear, deviceCode, periodKey)`. The order passes no
  `deviceCode`, so all counters share the default `MAIN` series, and voucher type 4 resets
  `YEARLY`, so `periodKey` is the accounting year. `soOrderDate` is passed as the document date, so
  a back-dated order draws from its own period's bucket rather than today's.
- **The DDL imagined per-device series** (`ux_so_slno` is unique per company/branch/year/**device**,
  and `so_device_id` is commented as owning the number series). The central `MAIN` series satisfies
  both unique indexes trivially — a slno unique per branch/year is unique per device too. A
  deployment that really numbers per device should pass the device's code as `deviceCode` into
  `allocateVoucherNumber` **and** change the refno format to embed it, or `ux_so_order_no`
  (unique per branch/year on the refno alone) will reject the second device's first order.
- **Create only.** `allocateVoucherNumber` is called from `createOrder` and nowhere else, and both
  fields are excluded from `SALE_ORDER_OPTIONAL_FIELDS`, so an **update never renumbers** an order.

### Partitioning

`sale_order`, `sale_order_item` and `sale_order_advance_alloc` are declaratively partitioned by
`LIST (accYear)`, following `sale_bill` / `sale_bill_item` / `acc_tender_detail` /
`txn_status_log`. Consequences that shape this module:

- Every primary key is composite (`soId, soAccYear` / `soiId, soiAccYear` / `soaId, soaAccYear`)
  because Postgres requires the partition key in every unique index including the PK. Prisma's
  generated compound unique input names (`soId_soAccYear`, `soiId_soiAccYear`, `soaId_soaAccYear`)
  are used wherever the service calls `.update()` on a single row.
- Partitions are created by `public.ensure_acc_year_partitions('YYYY-YYYY')` (extended by
  migration `20260808132323` to cover the three order tables). **Opening a new fiscal year means
  calling that function again** — until then every save in the new year fails with
  `no partition of relation "sale_order" found for row`.
- The DB **keeps** its CHECK constraints (`ck_so_*`, `ck_soi_*`, `ck_soa_*` — unlike `sale_bill`,
  whose `ck_sb_*` were dropped before ever being applied). The service mirrors every one of them
  app-side so a bad value comes back as a 400 naming the field instead of a raw Postgres 23514;
  the DB is the backstop. See [Validation](#validation).
- `ux_so_slno`, `ux_so_order_no` and `ux_soi_order_line` are **DB-only partial unique indexes**
  (`WHERE ... is_deleted = false`); Prisma cannot express them, so they are absent from the model
  (see the comments in `prisma/sales/saleOrder.prisma`). A P2002 from them reports the
  **partition-local, truncated, positional** index name (e.g.
  `sale_order_2026_2027_so_company_id_..._idx4`) — never `ux_so_order_no` — so `describeDuplicate`
  can only distinguish the line-number index (a different table name) from the two header indexes,
  which share a truncated prefix. Header duplicates answer a generic "Order number already exists".

### Nested line items

Line items are managed through the `items[]` array (`syncItems` reconciliation) — identical
semantics to the bill module:

- Item **with** `soiId` → updates that existing line (it must belong to this order, else a
  not-found error).
- Item **without** `soiId` → inserts a new line; `soiItemId` and `soiItemUnitId` are required.
  Unlike a bill line there is **no godown/stock requirement** — an order allocates no stock, so
  `soiGodownId` is optional (a soft reservation), and there is no `soiStockId` at all.
- An existing active line **absent** from the array → **soft deleted** (`soiIsDeleted = true`).
- Omitting the `items` property entirely (`undefined`) leaves the current lines **untouched**.
- **Write order**: the bill/quotation dance — replaced lines soft deleted first, surviving
  reordered lines parked above every requested number, then renumbered down. Here the dance is
  **load-bearing rather than precautionary**: `ux_soi_order_line` is a real partial unique index in
  the DB, so a naive 1↔2 swap would actually fail.
- Scope keys (`soiOrderId`, `soiCompanyId`, `soiBranchId`, `soiTenantId`, `soiAccYear`,
  `soiPriceLevel`) are inherited from the parent order; values sent on the item default to the
  parent scope.
- **Quantity balance** (`ck_soi_qty_balance`: ordered = delivered + cancelled + pending): when the
  payload carries `soiPendingQty` the equation is judged and a mismatch is a 400; when it does
  **not**, the pending quantity is **derived** as ordered − delivered − cancelled — a new line
  starts fully pending without the client having to restate the obvious, and an edit that moves
  the ordered quantity keeps the caches consistent. Delivered + cancelled exceeding ordered is a
  400 either way.
- Returned line items are sorted by `soiLineNo` ascending.

### Nested applied charges

Same delegation as the bill: `BillService`→`ChargeDetailService` becomes
`SaleSaleOrderService`→`ChargeDetailService.syncDocumentCharges(tx, scope, charges, actor, audit)` with
`cdDocType = 'ORDER'`, `cdDocId = soId`, and `cdCompId` / `cdBranchId` / `cdAccYear` /
`cdVoucherNo` (the order's own `soOrderSlno`) inherited from the header. Reconciliation, guards,
error shapes and audit relabelling (`screenName = 'Sale Order'`, notes `Order charge ...`) all
follow the bill's — see [../bill/README.md#nested-applied-charges](../bill/README.md#nested-applied-charges).

### Nested tendered amounts

Same delegation again — `TenderDetailService.syncDocumentTenders(tx, scope, tenders, actor,
audit)` inside the order's transaction. For an order the tender lines are the **advance receipts**:
the money the customer handed over when booking.

- Document triple: `tdSrcModule = 'SALES'`, `tdSrcDocType = 'SALES_ORDER'`, `tdSrcDocId = soId`.
- Inherited scope: `tdCompanyId` / `tdBranchId` / `tdTenantId` / `tdAccYear` / `tdDocDate` (the
  order's date) / `tdUserId` / `tdSessionId` / `tdDeviceId` (the order's device uuid as text —
  `td_device_id` is a free-text column) / `tdDrCr = 'DR'` (money in) / `tdPartyLedgerId = soCustId`
  (a customer and its account ledger share one primary key).
- The header's advance roll-up (`soAdvanceRecdAmt`) and settlement caches (`soTenderAmt`,
  `soPayStatus`, …) are **not** recomputed from `tenders[]` — like every other amount on this
  module they are whatever the client sends. The tender lines are the detail behind them.

### Nested advance allocations

Where the money went afterwards is the `advances[]` array — **this module's own**
(`syncAdvances`), since `sale_order_advance_alloc` has no owner module:

- Row **with** `soaId` → update; **without** → create (`soaAllocType`, `soaAllocDate`, `soaAmount`
  required); **absent** from the array → soft deleted; property omitted → untouched.
- `soaOrderId` / `soaOrderAccYear` always name the parent order — a payload naming a different
  order or year is a 400, the mirror of the charge module's document-immutability rule.
- `soaAccYear` (the application year) defaults to the order's but may be overridden **on create
  only** — it is a partition key, immutable afterwards like every other scope key.
- The `ck_soa_*` constraints are mirrored app-side on the merged row: `soaAllocType` ∈ ADJUSTED /
  REFUNDED / FORFEITED / TRANSFERRED; `soaAmount > 0`; `soaRefundMode` ∈ CASH / BANK / UPI / CARD
  / CREDIT_NOTE / ADJUSTMENT (nullable); **each type names its target and only its own target**
  (ADJUSTED → `soaBillId`+`soaBillAccYear`, TRANSFERRED → `soaTargetOrderId`+`soaTargetAccYear`,
  REFUNDED/FORFEITED → neither); no self-transfer; `soaTenderId`/`soaTenderAccYear` travel as a
  pair.
- Sum(`soaAmount`) per order, grouped by `soaAllocType`, reproduces the header's four advance
  roll-ups — the service does **not** enforce that reconciliation (the roll-ups are client-sent
  caches, consistent with the rest of the module), it only enforces each row's own shape.

### Advance roll-ups on the header

`ck_so_advance_amounts` / `ck_so_advance_balance` / `ck_so_advance_policy_input` are judged on the
merged header values (payload falling back to the stored row):

- All six advance amounts must be non-negative.
- `soAdvanceBalanceAmt` must equal received − adjusted − refunded − forfeited. **When the payload
  omits the balance but moves any of the four components, the balance is derived** rather than
  rejected — an ordinary save never trips the equation by omission. A payload that states a
  mismatched balance is a 400.
- A `PERC` policy needs `soAdvancePerc > 0`; a `FIXED` one needs `soAdvanceRequired > 0`.

### Soft delete

- `DELETE /delete` sets `soIsDeleted = true` (plus `soModifiedOn` / `soModifiedBy`) on the header,
  then cascades the same to all its active line items, applied charges, tender lines **and advance
  allocations**. Rows are never hard-deleted.
- **A deleted order is also a cancelled one**: the same write sets `soStatus = 'CANCELLED'`.
  Unlike the bill there are **no cancellation columns** (`sale_order` carries no
  `so_cancelled_on/by/reason`) — who cancelled and why is `public.txn_status_log`'s fact by
  design. No status-trail writer exists yet, so today the audit log entry is the record.
- **An order holding an unsettled advance cannot be deleted**: if `soAdvanceBalanceAmt > 0` the
  delete answers **400** — refund, forfeit or transfer the money first (which also moves the
  roll-ups). The mirror of the bill's "a settled bill cannot be deleted" rule, pointed the other
  way: there the block protects the books, here it protects the customer's money.
- There is **no accounts cascade** — an order never posted anything, so there is nothing to
  cancel in `acc_voucher_header` (no equivalent of the bill's `deleteBillPosting`).
- `GET /get` and the update lookup only ever see rows with the deleted flags false at every level.

### Validation

- Enforced by the DTO decorators under the global `ValidationPipe`: `soCompanyId`, `soBranchId`,
  `soDeviceId`, `soCustId`, `soUserId` are required UUIDs (`soDeviceId` is a real FK to
  `fixed.device_master`, RESTRICT — not the bill's free-text device pair); `soAccYear` is a fixed
  9-char string; `soPriceLevel` is a required integer; `soOrderSlno` / `soOrderRefno` are optional
  and **ignored**; `soCustName` (max 200) is a required non-empty string; nested `items[]` /
  `advances[]` are validated per-element (`@ValidateNested`).
- `soSalesmanId` and `soPackedId` are `uuid[]` columns: the DTO accepts an array, a
  comma-separated string, or `null`/`''` to clear (`toUuidArray` → `[]`, never `null` — a Prisma
  scalar list has no nullable form; see [[prisma-scalar-list-null]] in the bill README).
- `ensureOrderValuesAreAllowed` re-checks the header's enum-shaped columns on every save against
  the `ck_so_*` value sets: `soDocType` (SALES_ORDER / BOOKING / CUSTOM_ORDER), `soOrderType`
  (CASH / CREDIT), `soPriority` (LOW / NORMAL / HIGH / URGENT), `soDeliveryMode` (STORE_PICKUP /
  HOME_DELIVERY / SHIP_FROM_STORE / COURIER / TRANSPORT), `soStatus` (DRAFT / CONFIRMED / PARTIAL
  / COMPLETED / CANCELLED / CLOSED / EXPIRED), `soFulfilStatus` (PENDING / PARTIAL / COMPLETED /
  CANCELLED), `soPayStatus` (UNPAID / PARTIAL / PAID), `soAdvancePolicy` (NONE / FIXED / PERC /
  FULL), `soAdvanceStatus` (NONE / PENDING / PARTIAL / RECEIVED / ADJUSTED / REFUNDED /
  FORFEITED).
- `ensureOrderItemValuesAreAllowed` does the same per line: `soiFreeType` (SCHEME / SAMPLE /
  REPLACEMENT, nullable), `soiLineStatus` (PENDING / PARTIAL / DELIVERED / CANCELLED), the
  quantity sign rules, `soiReservedQty` ∈ [0, `soiOrderQty`] (`ck_soi_reserved`), and `soiSize`
  non-blank (`ck_soi_size`). Cross-field rules are judged on the **merged** row (payload falling
  back to the stored line), the same way the bill judges `ck_sbi_batch_split`.
- `ensureAdvanceValuesAreAllowed` mirrors the `ck_soa_*` set — see
  [Nested advance allocations](#nested-advance-allocations).

### Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` inside the same transaction —
header actions `New` / `update` / `cancel` against `tableName = 'sale_order'`,
`screenName = 'Sale Order'`, `screenType = 'transaction'`; each line-item, charge, tender and
advance-allocation write is logged separately against its own table name. The acting user is
resolved from the payload's `soCreatedBy` / `soModifiedBy`, then the request context user, falling
back to `DEFAULT_ACTOR`. All `*CreatedBy` / `*ModifiedBy` columns on the three order tables are
`VarChar(50)` free text (not uuid).

### Response shape

Success responses follow `{ success: true, message, data }` (`SaleOrderSuccessResponse`), where `data`
is the order payload (header fields with date-times serialized to ISO strings, plus `items[]`,
`charges[]`, `tenders[]` and `advances[]` arrays). `soOrderSlno` (bigint) is emitted as a string
because JSON has no bigint. `charges[]` / `tenders[]` entries are the owning modules' payloads
verbatim, plus the resolved master names described below. Errors use `{ success: false, message, errors: [{ field, message }] }`
(`SaleOrderErrorResponse`).

### Resolved master names (GET only)

Each line item carries the same resolved-name fields the bill module's items do, read via the
identical `item` / `itemUnitConversion` → `unit` relations: `soiItemName`, `soiGroupId`,
`soiBrandId`, `soiSectionId`, `soiCategoryId`, `soiUnitName`, `soiDecimalCount`, and
`soiGodownName` (batched `findMany` over the order's distinct non-null `soiGodownId`s —
`soi_godown_id` has no FK to `godown_locations`). These are read-only — never accepted on
`/create` — and are `null` on the create/update responses.

The scope and people columns are labelled the same way. None of them has an FK to join on
(`sale_order` declares no relation for its company / branch / salesman columns, and the charge and
tender rows are polymorphic), so `resolveDisplayNames` issues one batched `findMany` per master over
the distinct ids the whole document uses — a column that is null everywhere costs no query at all:

| Payload field | Id it labels | Source |
| --- | --- | --- |
| `soCompanyName` / `soBranchName` | `soCompanyId` / `soBranchId` | `company.comp_name` / `branch_master.br_name` |
| `soSalesmanName` | `soSalesmanId` (uuid[]) | `employee_master.emp_name`, one entry per id, same order |
| `soiCompanyName` / `soiBranchName` / `soiSalesmanName` | the line's own scope + salesman | same three masters |
| `soaCompanyName` / `soaBranchName` | `soaCompanyId` / `soaBranchId` | company / branch |
| `cdCompName` / `cdBranchName` | `cdCompId` / `cdBranchId` | company / branch |
| `tdCompanyName` | `tdCompanyId` | company |
| `tdPartyLedgerName` | `tdPartyLedgerId` | `acc_ledger_master.led_name` |
| `tdUserName` | `tdUserId` | `user_master.usr_display_name` |

An id whose master row is missing (or soft-deleted out from under the order) resolves to `null`
rather than failing the read; `soSalesmanName` carries the null in position, so index *n* of the
names always lines up with index *n* of `soSalesmanId`. The charge / tender name fields are the only
additions this module makes to those modules' payloads — every other `cd_*` / `td_*` field is theirs
verbatim.
