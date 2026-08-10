# Bill

CRUD API for **sale bills** — the tax invoice a company raises against a customer,
composed of a bill **header** and its nested **line items** (one row per BATCH
ALLOCATION, with rates, discounts, tax breakup and the stock it was picked from).

- **Base route:** `bills` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Bills`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_bill` (`sales` schema) — **partitioned by LIST (`sb_acc_year`)**,
  composite PK `(sbId, sbAccYear)`
- **Line-item table:** `sale_bill_item` (`sales` schema) — also partitioned by `sbiAccYear`,
  composite PK `(sbiId, sbiAccYear)`, composite FK `(sbiBillId, sbiAccYear) → (sbId, sbAccYear)`
- **Applied-charge table:** `txn_charge_detail` (`public` schema) — partitioned by `cdAccYear`,
  composite PK `(cdId, cdAccYear)`, addressed
  polymorphically by `(cdDocType = 'INVOICE', cdDocId = sbId)`; a bill IS the tax invoice, so it
  reuses the `INVOICE` discriminator rather than a `BILL` value `ck_cd_doc_type` does not allow.
  There is **no FK** to `sale_bill` because the table is shared by every module (sales, purchase,
  GRN, quotation). It is **owned by [../../master/charge-detail](../../master/charge-detail)** —
  this module hands that service the `charges[]` array and its own transaction rather than writing
  the table itself.
- **Tender table:** `acc_tender_detail` (`accounts` schema) — **partitioned by LIST
  (`td_acc_year`)**, composite PK `(tdId, tdAccYear)`, addressed polymorphically by
  `(tdSrcModule = 'SALES', tdSrcDocType = 'SALE_BILL', tdSrcDocId = sbId)`. Also has **no FK** to
  `sale_bill`, and is likewise **owned by
  [../../accountsModule/tenderDetail](../../accountsModule/tenderDetail)** — the money the customer
  handed over, captured on the draft bill and carried through to posting.

This module is the sibling of [../quotation](../quotation) — same reconciliation shape for line
items and applied charges, same audit/soft-delete conventions — with two structural differences
called out below: the partitioned/composite-key tables, and how the document is numbered. A bill
additionally carries the **tendered amounts** a quotation has no use for: a quote is never paid.

## Files

| File | Purpose |
| --- | --- |
| [bill.module.ts](bill.module.ts) | Module wiring — imports `AuditLogModule` + `ChargeDetailModule` + `TenderDetailModule`, **exports `BillService`** |
| [bill.controller.ts](bill.controller.ts) | HTTP routes + Swagger docs |
| [bill.service.ts](bill.service.ts) | Business logic, persistence, line-item reconciliation, audit logging |
| [bill-exception.filter.ts](bill-exception.filter.ts) | Registered via `@UseFilters`; a pass-through that re-throws the `HttpException` (error shaping is done in the service) |
| [dto/save-bill.dto.ts](dto/save-bill.dto.ts) | Create/update payload for the header + nested `items[]` / `charges[]` / `tenders[]` |
| [dto/save-bill-item.dto.ts](dto/save-bill-item.dto.ts) | A single bill line-item entry |
| [dto/bill-response.dto.ts](dto/bill-response.dto.ts) | Swagger success/error response models |

| [types/bill-api.types.ts](types/bill-api.types.ts) | Payload / response / error TypeScript contracts |

Charge and tender lines have **no DTO, payload type or writer of their own here** — `charges[]` is
the charge-detail module's [`SaveChargeDetailDto`](../../master/charge-detail/dto/save-charge-detail.dto.ts)
and `tenders[]` the tender-detail module's
[`SaveTenderDetailDto`](../../accountsModule/tenderDetail/dto/save-tender-detail.dto.ts); the rows
are written and read back by `ChargeDetailService` / `TenderDetailService`. See
[Nested applied charges](#nested-applied-charges) and
[Nested tendered amounts](#nested-tendered-amounts).

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a bill, chosen by `sbId` presence in the body. |
| `GET` | `/get` | Fetch one active bill by `sbId` (query param), including its active line items, applied charges and tender lines. |
| `DELETE` | `/delete` | Soft-delete a bill by `sbId` (query param), cascading to its line items, applied charges and tender lines. |

`GET /get` and `DELETE /delete` both additionally require `sbCompanyId`, `sbBranchId` and
`sbAccYear` as query parameters — the row is looked up by all four together, so a bill can only be
read or deleted from within its own company/branch/year scope.

### Create / update semantics

- **Omit `sbId` → create; include `sbId` → update** the existing bill.
- Each operation runs inside a single `$transaction` (header, all line items, applied charges,
  tender lines, and audit entries are all-or-nothing).
- On **update**, the header must still be active (`sbIsDeleted = false`) or a not-found error is
  raised. Because `sale_bill`'s primary key is the composite `(sbId, sbAccYear)`, the update
  targets that compound key (`sbId_sbAccYear`), resolved from the row `findFirst` already loaded.
- On **create**, `sbCustName` is normalized via `normalizeRequiredText` (trimmed and
  required-non-empty), `sbBillSlno` / `sbBillRefno` are allocated from the voucher sequence,
  `sbBillDate` defaults to *now* when omitted, and `sbStatus` defaults to `'DRAFT'`.
- Optional header fields are copied through only when present on the payload
  (`applyPresentFields` over the `BILL_OPTIONAL_FIELDS` list); absent fields are left as-is on
  update. The partition/scope keys (`sbCompanyId`, `sbBranchId`, `sbAccYear`, `sbPriceLevel`,
  `sbUserId`) and the server-assigned number (`sbBillSlno` / `sbBillRefno`) are **not** in that
  list — they are immutable after creation.

### Bill numbering

Exactly like [../quotation](../quotation), **`sbBillSlno` and `sbBillRefno` are server-assigned**:
`createBill` calls `allocateVoucherNumber` (`src/common/Sequence/voucher-sequence.helper.ts`)
inside the save transaction and writes back what it consumed. Whatever the client sends for either
field is ignored.

- The numbers come from the `accounts.acc_voucher_seq` counter for **voucher type 22** (`Bil` /
  Sales Bill, seeded by `prisma/seed/Acc_Voucher_Types_Sale_Bill.sql`). `lastNo` becomes
  `sbBillSlno`; its printable form — `prefix + zero-padded number + suffix`, e.g. `bil00001` —
  becomes `sbBillRefno`.
- Scope: `(vchrTypeId, companyId, branchId, accYear, deviceCode, periodKey)`. The bill passes no
  `deviceCode`, so all counters share the default `MAIN` series, and voucher type 22 resets
  `YEARLY`, so `periodKey` is the accounting year. `sbBillDate` is passed as the document date, so
  a back-dated bill draws from its own period's bucket rather than today's.
- The sequence row is created on first use, seeded from the voucher type's format;
  `prisma/seed/Acc_Voucher_Seq_Sale_Bill.sql` pre-creates it for a known company/branch/year.
  A row that has been deactivated (`seq_is_active = false` / `seq_is_deleted = true`) makes the
  save fail with a 400 rather than being silently revived.
- Concurrency: the helper takes a transaction-scoped advisory lock on the counter and increments
  with a relative `{ increment: 1 }`, so two simultaneous saves in the same scope cannot draw the
  same number. The document insert commits in the same transaction as the number it consumed.
- `sale_bill` defines **no unique index** on `(company, branch, accYear, billRefno)` or `billSlno`;
  the sequence's own scope constraint is what keeps numbers unique. If you want belt-and-braces,
  add that partial unique index and extend `describeDuplicate` in `bill.service.ts` to name it,
  the same way `ux_sq_quote_no` / `ux_sq_slno` are named in the quotation module.
- **Create only.** `allocateVoucherNumber` is called from `createBill` and nowhere else, and both
  fields are excluded from `BILL_OPTIONAL_FIELDS`, so an **update never renumbers** a bill and
  never consumes a number from the sequence — a `sbBillSlno` / `sbBillRefno` sent on an update is
  dropped along with the rest of the non-whitelisted fields. The reference number is immutable
  once issued, exactly like the quotation module's `sqQuoteSlno` / `sqQuoteRefno`.
- Offline counters: `sbCounterId` still records which till raised the document, but it no longer
  owns the number series — a save now needs to reach the central sequence. A deployment that
  really raises bills offline should give each counter its own series by passing `deviceCode` into
  `allocateVoucherNumber`.

### Partitioning

`sale_bill` and `sale_bill_item` are declaratively partitioned by `LIST (accYear)` — the first
partitioned tables in this schema. Consequences that shape this module:

- Every primary key is composite (`sbId, sbAccYear` / `sbiId, sbiAccYear`) because Postgres
  requires the partition key in every unique index including the PK. Prisma's generated compound
  unique input names are `sbId_sbAccYear` and `sbiId_sbiAccYear` — `bill.service.ts` uses these
  wherever it calls `.update()` on a single row (`.updateMany()` calls, like the ones `softDelete`
  uses, filter by `sbId` alone and do not need the compound key).
  `sale_bill_item.sbiBillId` is likewise a **composite FK** — `(sbiBillId, sbiAccYear) →
  (sbId, sbAccYear)` — so `sbiAccYear` must always match the parent bill's, and every line-item
  `.update()` needs the item's own `sbiId_sbiAccYear` key (the loaded row's `sbiAccYear`, not the
  bill's, though the two are always equal).
- The `CREATE TABLE ... PARTITION BY LIST` statement only declares the **parent shell**. Postgres
  rejects any insert until at least one child partition exists for that `sbAccYear` value (e.g.
  `sale_bill_2026_2027`). This module does not create partitions — migration
  `20260804112944_add_acc_year_partitions` is the bootstrap: it defines
  `public.ensure_acc_year_partitions('YYYY-YYYY')`, which idempotently creates the `sale_bill`,
  `sale_bill_item` and `acc_tender_detail` partitions for one accounting year, and runs it over
  every year in `public.fiscal_years`. **Opening a new fiscal year means calling that function
  again** — until then every save in the new year fails with
  `no partition of relation "sale_bill" found for row`.
- The DB originally defined CHECK constraints for the enum-shaped columns (`ck_sb_doc_type`,
  `ck_sb_bill_type`, `ck_sb_status`, `ck_sb_pay_status`, `ck_sb_return_status`, `ck_sbi_free_type`,
  `ck_sbi_split_no`, `ck_sbi_batch_split`). They were dropped from the migration SQL before it was
  ever applied (Prisma cannot express CHECK constraints, so they were never in `saleBill.prisma` /
  `saleBillItem.prisma` either) and are enforced in the application layer instead — see
  [Validation](#validation) below.

### Nested line items

Line items are managed through the `items[]` array on the create/update payload
(`syncItems` reconciliation) — identical semantics to the quotation module's `syncItems`, plus two
extra fields required for a new line:

- Item **with** `sbiId` → updates that existing line (it must belong to this bill, else a
  not-found error).
- Item **without** `sbiId` → inserts a new line; `sbiItemId`, `sbiItemUnitId`, `sbiGodownId` and
  `sbiStockId` are all required (`requireItemField`) — a bill line allocates real stock, so it
  must say which godown and which batch/stock row the quantity came from. (This module does not
  itself move stock or validate availability; it trusts the client, exactly as `sqiAvailableStock`
  is informational-only on a quotation. Actual stock deduction is a separate concern.)
- An existing active line **absent** from the array → **soft deleted** (`sbiIsDeleted = true`).
- Omitting the `items` property entirely (`undefined`) leaves the current lines **untouched**.
- **Write order**: exactly the quotation module's dance — replaced lines are soft deleted first
  (freeing their line numbers for reuse), then surviving lines the payload **reorders** are parked
  above every requested number in one `updateMany` before being renumbered down, so a 1↔2 swap
  never passes through a state where both rows want the same number. `sale_bill_item` has no DB
  unique index enforcing this today (see [Partitioning](#partitioning) above on why), but the
  in-memory duplicate check and the reorder dance are kept anyway, both for parity with the
  quotation module and so the invariant holds if that index is added later.
- Scope keys (`sbiBillId`, `sbiCompanyId`, `sbiBranchId`, `sbiTenantId`, `sbiAccYear`,
  `sbiPriceLevel`) are inherited from the parent bill; any values sent on the item default to the
  parent scope.
- Returned line items are sorted by `sbiLineNo` ascending.

### Nested applied charges

Freight / loading / packing / cash-discount lines are still sent as the `charges[]` array on the
same create/update payload, but **this module does not implement them** — `txn_charge_detail` is
owned by [../../master/charge-detail](../../master/charge-detail), and `BillService` delegates the
whole array to `ChargeDetailService.syncDocumentCharges(tx, scope, charges, actor, audit)`:

- The **payload entry is `SaveChargeDetailDto`**, the charge-detail module's own create/update DTO
  — the same body the standalone `POST /charge-details/create` takes. There is no bill-specific
  charge DTO, payload type or Swagger model.
- `syncDocumentCharges` takes **the bill's transaction**, so the header, its line items and its
  charges are still all-or-nothing.
- Reconciliation is unchanged in shape: a line with `cdId` updates that line, a line without one is
  created, an existing line absent from the array is soft deleted (`cdIsDeleted = true` **and**
  `cdIsActive = false`, matching the charge module's own soft delete), and omitting the property
  entirely leaves the stored charges untouched.
- `cdSlno` defaults to the line's 1-based position in the array; a duplicate within one payload is
  a 409 on `cdSlno`.
- The bill passes its **document scope** (`toChargeScope`): `cdDocType = 'INVOICE'` (a bill IS the
  tax invoice), `cdDocId = sbId`, and `cdCompId` / `cdBranchId` / `cdAccYear` / `cdVoucherNo`
  inherited from the header — the last one being the bill's own `sbBillSlno`. A line may override
  any of those except the document itself: sending a `cdDocType` / `cdDocId` that is not this bill
  is a 400, the mirror of the standalone endpoint's immutability rule.
- Every guard the charge module applies on its own endpoints now applies here too:
  `CHARGE_DETAIL_VALUE_GUARDS` over the snapshot enums, the `cdTaxApl` / `cdBeforeTax` mutual
  exclusion judged on the merged row, `cdChgId` / `cdLedgerCode` required on a new line, and both
  references checked to be **active** (a soft-deleted `charge_master` or `acc_ledger_master` row is
  a 400 naming the field rather than an FK error). Errors surface through the same
  `{ success, message, errors[] }` shape, and `BillExceptionFilter` already recognises `cd*` fields.
- Charge rows written during a bill save are audited against the bill (`tableName =
  'txn_charge_detail'`, `screenName = 'Sale Bill'`, notes `Bill charge created/updated/soft
  deleted`) — that labelling is the `BILL_CHARGE_AUDIT` argument, not a fork of the writer.

The quotation module still has its own `syncCharges`; see
[../quotation/README.md#nested-applied-charges](../quotation/README.md#nested-applied-charges).

### Nested tendered amounts

What the customer actually paid with — cash, card, UPI, loyalty points, a voucher, or several at
once — is sent as the `tenders[]` array on the same create/update payload, and is owned by
[../../accountsModule/tenderDetail](../../accountsModule/tenderDetail) exactly as the charges are
owned by the charge module. `BillService` delegates the array to
`TenderDetailService.syncDocumentTenders(tx, scope, tenders, actor, audit)` inside the bill's own
transaction, so header + items + charges + tenders remain all-or-nothing.

- The **payload entry is `SaveTenderDetailDto`**, the tender module's own create/update DTO. Only
  `tdTenderId` (which `acc_tender_master` row the operator picked) is required on a new line.
- Reconciliation is the same as everywhere else: `tdId` → update, no `tdId` → create, an existing
  line absent from the array → soft deleted (`tdIsDeleted = true`; this table has no `is_active`
  column), property omitted → stored tenders untouched. `tdRowNo` defaults to the 1-based position,
  and a duplicate within one payload is a 409 on `tdRowNo`.
- The bill passes its **document scope** (`toTenderScope`): `tdSrcModule = 'SALES'`,
  `tdSrcDocType = 'SALE_BILL'`, `tdSrcDocId = sbId`, plus `tdCompanyId` / `tdBranchId` /
  `tdTenantId` / `tdAccYear` / `tdDocDate` (the bill's date) / `tdUserId` / `tdSessionId` /
  `tdDeviceId` inherited from the header, `tdDrCr = 'DR'` (money in on a sale) and
  `tdPartyLedgerId = sbCustId`. That last default holds because a customer and its account ledger
  **share one primary key** — every customer is mirrored into `acc_ledger_master` under the same id
  — so the bill's customer *is* the ledger the money is owed by. Any of these may be overridden per
  line except the document itself, which is a 400 if it names another document.
- `tdTenderTypeId` / `tdTenderLedgerId` are snapshotted from the picked tender master when the line
  does not carry them, `tdTotalAmt` is derived as `round(tdAmount + tdSurchargeAmt, 2)`, and the
  remaining `ck_td_*` rules are enforced app-side on the merged row — see the tender module's
  [README](../../accountsModule/tenderDetail/README.md) for the full list.
- Tender rows written during a bill save are audited against the bill (`tableName =
  'acc_tender_detail'`, `screenName = 'Sale Bill'`, notes `Bill tender created/updated/soft
  deleted`) via the `BILL_TENDER_AUDIT` argument.
- The header's own money columns (`sbTenderAmt`, `sbPaidAmt`, `sbBalanceAmt`, `sbSurchargeAmt`,
  `sbRefundAmt`, `sbPayMode`, `sbPayStatus`) are **not** recomputed from `tenders[]` — like every
  other amount on this module they are whatever the client sends. The tender lines are the detail
  behind them, not their source.
- `acc_tender_detail` is partitioned by `td_acc_year`, so — exactly like `sale_bill` — **a
  partition must exist for the bill's accounting year** before a tender can be inserted.

### Line numbering & uniqueness

- `sbiLineNo` defaults to the **1-based position** of the item within the `items[]` array when
  omitted. A **duplicate line number within one payload** raises a conflict (`throwSalesConflict`
  on `sbiLineNo`) — enforced in application code only; see [Partitioning](#partitioning) above.
- `cdSlno` on a charge line likewise defaults to its 1-based position, and a duplicate within one
  payload raises a conflict on `cdSlno`.
- Because `sale_bill` has no unique index on `sbId` alone (only the composite PK), a P2002 in
  practice can only come from that PK — which should not happen given `sbId` / `sbiId` are
  uuidv7-generated. `describeDuplicate` in `bill.service.ts` therefore returns a generic "Bill
  already exists" conflict rather than guessing at a specific field, unlike the quotation module's
  `describeDuplicate`, which resolves the actual offending index by name.

### Soft delete

- `DELETE /delete` sets `sbIsDeleted = true` (plus `sbModifiedOn` / `sbModifiedBy`) on the header,
  then cascades the same to all its active line items, **applied charges and tender lines** so
  nothing stays active under a logically deleted header. Rows are never hard-deleted.
- **A deleted bill is also a cancelled one**: the same write sets `sbStatus = 'CANCELLED'`,
  `sbCancelledOn`, `sbCancelledBy` and — when the bill carries none of its own — `sbCancelReason`
  = `'Bill deleted'`, so anything reading the status rather than the flag still sees a document
  that is out of play. A reason the bill was already cancelled with is kept.
- **Accounts follow, in the same transaction** (`deleteBillPosting` in
  [bill-posting.helper.ts](bill-posting.helper.ts)). Only a bill that was **POSTED** has anything
  in accounts; for anything else this is a no-op. Located through the source document
  (`ux_avh_src`: company + accYear + `SALES` / `BILL` / `sbId`) rather than
  `sbPostedVoucherId`, which is client-writable — every non-deleted `acc_voucher_header` raised
  from the bill gets `avhIsDeleted = true` / `avhIsActive = false` and is moved to `CANCELLED`
  (with `avhCancelReason = 'Sale bill deleted'` and `avhStatusOn` / `avhStatusBy`, which
  `ck_avh_cancel` / `ck_avh_status_on` demand), and its `acc_vouchers` ledger lines and `acc_bills`
  receivables are flagged deleted with it.
- This is deliberately **not** what unposting does. Moving a bill out of `POSTED` through
  `POST /create` (`syncBillPosting`) only *cancels* the voucher and retires the receivable — the
  header stays live, holding the number it consumed and blocking a re-post of the same bill.
  Deleting the bill flags those rows deleted instead, because the document they were raised from is
  gone.
- **A settled bill cannot be deleted**: if any receivable carries a discount or write-off
  (`ablDiscAmount` / `ablWriteoffAmount` > 0), the delete answers **400** and the whole transaction
  rolls back — reverse the settlement first. `ablAllocAmount` on its own does not block it: a cash
  bill seeds that column with its own tender at post time, so it is not a separate settlement.
- `GET /get` and the update lookup only ever see rows with `sbIsDeleted = false` (and items with
  `sbiIsDeleted = false`, charges with `cdIsDeleted = false`, tenders with `tdIsDeleted = false`).

### Validation

- Enforced by the DTO decorators under the global `ValidationPipe`: `sbCompanyId`, `sbBranchId`,
  `sbCounterId`, `sbCustId`, `sbUserId` are required UUIDs; `sbAccYear` is a fixed 9-char string;
  `sbDeviceType` / `sbDeviceId` are required (non-uuid) strings; `sbPriceLevel` is a required
  integer; `sbBillSlno` and `sbBillRefno` are optional and **ignored** (server-assigned — see
  [Bill numbering](#bill-numbering)); `sbCustName` (max 200) is a required non-empty string;
  nested `items[]` are validated
  per-element (`@ValidateNested`), each requiring `sbiItemId`, `sbiItemUnitId`, `sbiGodownId` and
  `sbiStockId` as UUIDs (`sbiItemUnitId` references `item_unit_conversion.iucId`, not
  `item_unit_master.unit_id`, same as the quotation module).
- Nested `charges[]` are validated by the charge-detail module's own DTO and service guards (see
  [Nested applied charges](#nested-applied-charges)): `cdChgId` and `cdLedgerCode` are UUIDs
  required on a new line, and the enum-shaped columns use the shared charge enums from
  `master/charge-master/types/charge-enum.ts`.
- Nested `tenders[]` likewise carry the tender-detail module's DTO and guards (see
  [Nested tendered amounts](#nested-tendered-amounts)): `tdTenderId` is a UUID required on a new
  line, the amount columns are non-negative numbers, `tdRowNo` is at least 1, and the enum-shaped
  columns use `TenderSrcModule` / `TenderSrcDocType` / `TenderDrCr` / `TenderSettleStatus` from
  `accountsModule/tenderDetail/types/tender-detail-api.types.ts`. `BillExceptionFilter` recognises
  `td*` field names alongside `sb*` / `sbi*` / `cd*`, so a nested `tenders.0.tdX` validation error
  comes back naming the field.
- `sbSalesmanId`, `sbLoadmanId` and `sbPackedId` are `uuid[]` columns (a bill can have several
  salesmen/loadmen/packers on one document, unlike the quotation header's single `sqSalesmanId`):
  the DTO accepts an array, a comma-separated string, or `null`/`''` to clear it
  (`toUuidArray`), each entry validated as a UUID. "Clear" normalises to `[]`, **not** `null` — a
  Prisma scalar list has no nullable form, and passing `null` makes the create fall through to the
  checked input variant and fail with the unrelated-looking `Argument \`customer\` is missing`.
- `ensureBillValuesAreAllowed` re-checks the header's enum-shaped columns on every save — whatever
  the payload actually sends, an omitted field is left untouched and not re-validated —
  against the value sets the DB's `ck_sb_*` constraints used to define: `sbDocType` (`TAX_INVOICE` /
  `BILL_OF_SUPPLY`), `sbBillType` (`CASH` / `CREDIT`), `sbStatus` (`DRAFT` / `POSTED` /
  `CANCELLED`), `sbPayStatus` (`UNPAID` / `PARTIAL` / `PAID`), and the nullable `sbReturnStatus`
  (`PARTIAL` / `FULL`). A bad value comes back as a 400 naming the field rather than a raw Postgres
  23514.
- `ensureBillItemValuesAreAllowed` does the same for each line item: `sbiFreeType` (`SCHEME` /
  `SAMPLE` / `REPLACEMENT`, nullable) mirrors `ck_sbi_free_type`, and the cross-field
  `ck_sbi_batch_split` rule (`sbiSplitNo = 1 OR sbiBatchNo IS NOT NULL`) is judged on the line's
  final resolved values — the payload's, falling back to the existing row's on update — the same
  way `ChargeDetailService.ensureValuesAreAllowed` judges a charge line's `cdTaxApl` /
  `cdBeforeTax` on the merged row.
  `ck_sbi_split_no` (`sbiSplitNo >= 1`) is not separately re-checked in the service: the
  `@OptionalInteger(1)` decorator on `SaveBillItemDto.sbiSplitNo` already rejects a smaller value
  at the DTO layer whenever it is sent.

### Audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` inside the same transaction,
  capturing original vs. modified records — same conventions as the quotation module: header
  actions `New` / `update` / `cancel` against `tableName = 'sale_bill'`,
  `screenName = 'Sale Bill'`, `screenType = 'transaction'`; a soft delete is logged as `cancel` at
  every level (header, line, charge); each line-item and applied-charge insert/update/soft-delete
  is logged separately against `sale_bill_item` / `txn_charge_detail`.
- The acting user is resolved from the payload's `sbCreatedBy` / `sbModifiedBy`, then the request
  context user (`RequestContextService.getUserId()`), falling back to `DEFAULT_ACTOR`
  (`resolveActor`). Note `sbCreatedBy` / `sbModifiedBy` on the **header** are free-text columns
  (matching the quotation module), but `sbiCreatedBy` / `sbiModifiedBy` on the **line item** are
  `uuid` columns in the DB — the item DTO validates them as UUIDs accordingly, unlike the header
  and unlike the quotation module's line items (which are also free text).

### Response shape

Success responses follow `{ success: true, message, data }` (`BillSuccessResponse`), where `data`
is the bill payload (header fields with date-times serialized to ISO strings, plus `items[]`,
`charges[]` and `tenders[]` arrays). `sbBillSlno` (bigint) and each charge's `cdVoucherNo` (bigint) are emitted as
strings because JSON has no bigint. Each entry of `charges[]` is the charge-detail module's
`ChargeDetailPayload` verbatim — the same object `GET /charge-details/get` answers with, so its
decimal columns come back as **numbers** and it carries the mapped ledger's `cdLedgerName`
(read-only, resolved from `acc_ledger_master`, never stored). Each entry of `tenders[]` is likewise
the tender-detail module's `TenderDetailPayload` verbatim — decimals as numbers, date-only columns
as `YYYY-MM-DD`, plus the read-only `tdTenderName` / `tdTenderLedgerName`. Errors use
`{ success: false, message, errors: [{ field, message }] }` (`BillErrorResponse`), produced by the
shared sales helpers rather than by the exception filter.

### Resolved master names (GET only)

Unlike the quotation header (which resolves `sqCustAreaName` / `sqSalesmanName` / `sqAgentName`),
the bill header has no id-only columns that need this treatment: the customer, price level and
place-of-supply state are all either FK'd master ids with an adequate snapshot already stored on
the row (`sbCustName`, `sbStateName`, ...), or — for `sbSalesmanId` (now an array),
`sbAgentId`, `sbDriverId`, etc. — columns with no FK at all in the DDL. `GET /get` therefore
returns the header as-is.

Each line item **does** carry the same resolved-name fields the quotation module's items do, read
via the identical `item` / `itemUnitConversion` → `unit` relations:

| Response field | Source | Reached by |
| --- | --- | --- |
| `sbiItemName` | `inventory.item_master.item_name_en` | `item` relation on `sbiItemId` |
| `sbiGroupId` | `inventory.item_master.item_group_id` | same relation |
| `sbiBrandId` | `inventory.item_master.item_brand_id` | same relation |
| `sbiSectionId` | `inventory.item_master.item_section_id` | same relation |
| `sbiCategoryId` | `inventory.item_master.item_category_id` | same relation |
| `sbiUnitName` | `inventory.item_unit_master.unit_name` | `itemUnitConversion` → `unit` on `sbiItemUnitId` |
| `sbiDecimalCount` | `inventory.item_unit_master.unit_decimal_count` | same relation chain |
| `sbiGodownName` | `inventory.godown_locations.gdl_name` | batched `findMany` on the bill's distinct `sbiGodownId`s |

`sbi_godown_id` has no FK to `godown_locations`, so there is no relation to `include` — `getById`
issues one extra `godownLocation.findMany` over the distinct godown ids on the bill and maps the
names back onto the lines. A line whose godown row no longer exists comes back with
`sbiGodownName: null`.

These are read-only — never accepted on `/create` — and are `null` on the create/update responses.
