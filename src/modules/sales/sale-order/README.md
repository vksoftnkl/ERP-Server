# Sale Order

CRUD API for **sales orders** — the commitment a company takes from a customer ahead of billing,
composed of an order **header**, its nested **line items** (one row per ORDERED LINE — not per
batch: an order allocates no stock).

- **Base route:** `sale-orders` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Sale Orders`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sale_order` (`sales` schema) — **partitioned by LIST (`so_acc_year`)**,
  composite PK `(soId, soAccYear)`
- **Line-item table:** `sale_order_item` (`sales` schema) — also partitioned by `soiAccYear`,
  composite PK `(soiId, soiAccYear)`, composite FK `(soiOrderId, soiAccYear) → (soId, soAccYear)`
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
- **Accounting tables:** `acc_voucher_header` + `acc_vouchers` + `acc_bill_balance` (`accounts`
  schema) — all partitioned by acc-year with composite PKs. The bill's key is
  `(abl_id, abl_acc_year)` on the year it was **raised** in; the row never moves partition, so a
  bill simply stays open across financial years where it started. The order itself
  posts nothing, but the money tendered against it does: every save raises / re-syncs / cancels an
  **advance receipt** and the **ADVANCE outstanding** behind it through
  [order-advance-posting.helper.ts](order-advance-posting.helper.ts). See
  [Advance receipt posting](#advance-receipt-posting-accounts) and
  [Advance outstanding](#advance-outstanding-acc_bill_balance).
- **Cheque register:** `acc_pdc_register` (`accounts` schema) — partitioned by `apd_acc_year` (the
  year the instrument was *received* in), composite PK `(apdId, apdAccYear)`. A tender line of
  **type 5 (`CHEQUE`)** is not only money but an instrument the company holds until the bank says
  otherwise, so every such line also opens a register row through
  [order-pdc-posting.helper.ts](order-pdc-posting.helper.ts). See
  [Cheque register](#cheque-register-acc_pdc_register).

This module is the sibling of [../bill](../bill) — same create/get/delete surface, same nested
reconciliation shape for line items / charges / tenders, same audit and soft-delete conventions —
with the structural differences called out below: a fourth nested array (`advances[]`), a device
FK instead of a free-text device pair, DB CHECK constraints that actually exist, and an accounts
posting that covers the **tendered money only** (the order itself is a commitment, not an
accounting document — and unlike the bill, this module writes the `acc_vouchers` ledger lines, not
just the header).

## Files

| File | Purpose |
| --- | --- |
| [sale-order.module.ts](sale-order.module.ts) | Module wiring — imports `AuditLogModule` + `ChargeDetailModule` + `TenderDetailModule`, **exports `SaleOrderService`** |
| [sale-order.controller.ts](sale-order.controller.ts) | HTTP routes + Swagger docs |
| [sale-order.service.ts](sale-order.service.ts) | Business logic, persistence, nested reconciliation, CHECK mirrors, audit logging, and `syncOrderFulfilment` — the entry point [../bill](../bill) calls when a bill is raised against an order |
| [order-advance-posting.helper.ts](order-advance-posting.helper.ts) | Posts the order's tender lines to accounts — `acc_voucher_header` + `acc_vouchers` + the `acc_bill_balance` ADVANCE row — and keeps all three in step on update / delete |
| [order-pdc-posting.helper.ts](order-pdc-posting.helper.ts) | Registers every cheque tender (type 5) in `acc_pdc_register`, and keeps it in step on update / delete |
| [sale-order-exception.filter.ts](sale-order-exception.filter.ts) | Registered via `@UseFilters`; recognises `so*` (covers `soi*`), `cd*` and `td*` field names |
| [dto/save-sale-order.dto.ts](dto/save-sale-order.dto.ts) | Create/update payload for the header + nested `items[]` / `charges[]` / `tenders[]` |
| [dto/save-sale-order-item.dto.ts](dto/save-sale-order-item.dto.ts) | A single order line-item entry |
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
| `GET` | `/get` | Fetch one active order by `soId` (query param), including its active line items, applied charges and tender lines. |
| `GET` | `/pending-amount` | `acc_bill_balance.abl_pending_amount` — and nothing else — for the bill rows raised against one source document, addressed by the `(ablSrcDocType, ablSrcDocId, ablSrcAccYear)` tuple. For an order that is the advance it still holds. |
| `PUT` | `/cancel-lines` | Cancel the remaining open quantity of one order line (`srcDocId` = `soi_id`) or of the whole order (`srcDocId` = `so_id`), addressed by the `(srcModule, srcDocId, srcAccYear)` tuple a downstream document holds it as. |
| `DELETE` | `/delete` | Soft-delete an order by `soId` (query param), cascading to its line items, applied charges and tender lines. |

`GET /get` and `DELETE /delete` both additionally require `soCompanyId`, `soBranchId` and
`soAccYear` as query parameters — the row is looked up by all four together, so an order can only
be read or deleted from within its own company/branch/year scope. `PUT /cancel-lines` and
`GET /pending-amount` are the exceptions: both are addressed by the document tuple alone (see
below).

### Create / update semantics

- **Omit `soId` → create; include `soId` → update** the existing order.
- Each operation runs inside a single `$transaction` (header, all line items, applied charges,
  tender lines, and audit entries are all-or-nothing).
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

`sale_order` and `sale_order_item` are declaratively partitioned by
`LIST (accYear)`, following `sale_bill` / `sale_bill_item` / `acc_tender_detail` /
`txn_status_log`. Consequences that shape this module:

- Every primary key is composite (`soId, soAccYear` / `soiId, soiAccYear`)
  because Postgres requires the partition key in every unique index including the PK. Prisma's
  generated compound unique input names (`soId_soAccYear`, `soiId_soiAccYear`)
  are used wherever the service calls `.update()` on a single row.
- Partitions are created by `public.ensure_acc_year_partitions('YYYY-YYYY')` (extended by
  migration `20260808132323` to cover the order tables). **Opening a new fiscal year means
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
- Storing a tender is not the same as **posting** it: what puts the money in the ledgers is the
  advance receipt below, raised from these rows in the same transaction.
- A line with `tdTenderTypeId = 5` (`CHEQUE`) is money *and* an instrument, so it also opens a
  [cheque register](#cheque-register-acc_pdc_register) row — and it must then carry `tdRefNo` (the
  cheque number) and `tdInstrumentDate` (the post-date on it).

### Advance receipt posting (accounts)

Every create and update ends with [`syncOrderAdvancePosting`](order-advance-posting.helper.ts),
called from `SaleOrderService.syncAdvanceVoucher` **inside the save transaction** — so an order
holding money and the voucher behind that money commit or roll back together.

**Why a receipt and not the order voucher.** Voucher type 4 (`SOr`) is `vchr_category = INVENTORY`
with `vchr_affects_accounts = false`: an order is a commitment, and the commitment itself belongs
in no ledger. The money handed over against it is a different fact, and its nature is `RECEIPT`.
So it gets **voucher type 5** (`ARc` / Order Advance Receipt, seeded by
`prisma/seed/Acc_Voucher_Types_Order_Advance_Receipt.sql`), its own `acc_voucher_seq` counter — the
order reads `sor00101` while its receipt reads `arc00007` — and its own row in the day book.

**What is written, and from where.** The two tables are filled from two different sources:

| Table | Filled from | Carries |
| --- | --- | --- |
| `acc_voucher_header` | the **sale order** | scope (`so_company_id` / `so_branch_id` / `so_tenant_id` / `so_acc_year`), party (`so_cust_id`), employees (`so_salesman_id[]`), `so_user_id` / `so_session_id` / `so_device_id`, remarks, and the `doc_*` face — `avh_doc_refno = so_order_refno`, `avh_doc_date = so_order_date`, `avh_doc_amount = so_order_amt`, `avh_round_off = so_round_off`, `avh_usr_refno = so_usr_refno` |
| `acc_vouchers` | the **tender detail** rows | one entry per `acc_tender_detail` row: the ledger the money landed in, the side, and the amount — linked back by the header's returned `avh_voucher_id` (`av_voucher_id` + `av_acc_year` → the header's composite PK) |

The header is what the voucher is *about*; the lines are what it *does*. So `avh_doc_amount` is the
**order's** value and `avh_total_debit` / `avh_total_credit` are the **tendered** amount — a
₹10,000 order with a ₹2,000 advance posts `doc_amount = 10000`, `total_debit = total_credit = 2000`.
`ck_avh_balanced` only judges the totals, which balance by construction.

Per tender row, in `tdRowNo` order, the lines are:

| Row | Side | Ledger | Opposite | Amount |
| --- | --- | --- | --- | --- |
| 1 | `DR` | `td_tender_ledger_id` (cash / bank / card clearing) | credit ledger | `td_total_amt` |
| 2 | `CR` | credit ledger | tender ledger | `td_amount` |
| 3 | `CR` | `acc_tender_master.tnd_surcharge_ledger_id` | tender ledger | `td_surcharge_amt` (only when > 0) |

The **credit ledger** is `so_advance_ledger_id` — the customer-advance *liability* ledger — falling
back to `so_cust_id` (a customer and its account ledger share one primary key). Money taken before
delivery is a liability, not a reduction of a receivable: nothing is owed yet. `ck_td_total_amt`
keeps `total = amount + surcharge`, so the voucher balances **row by row**, which is what
`ck_avh_balanced` checks in aggregate.

Other details worth knowing:

- The header's source document is the **order** (`avh_src_module = 'SALES'`,
  `avh_src_doc_type = 'SALES_ORDER'`, `avh_src_doc_id = soId`). `ux_avh_src` makes that unique, so
  one order can never raise two live receipts — and every path here finds its voucher through those
  columns rather than any client-writable field.
- `avh_voucher_no` comes from the `ARc` sequence; `avh_voucher_slno` is the **company-wide** serial
  across every voucher type, taken under an advisory lock by `allocateVoucherSlno`
  (`src/common/Sequence/voucher-sequence.helper.ts`, shared with the bill's posting helper).
- Each posted tender row gets `acc_tender_detail.td_voucher_id` stamped with the new voucher id, so
  the money can be traced from either end.
- Tenders with `td_total_amt = 0` are skipped — `ck_av_amount` insists every ledger line is
  positive.

**Transitions.** The order's own `soStatus` and its live tender rows are the whole input:

| Before | After the save | What happens |
| --- | --- | --- |
| no receipt | live order with tendered money | **created** — header + lines written |
| live receipt | tenders edited | **updated** — header amounts re-synced, lines soft-deleted and rebuilt from the current tenders (`ux_av_voucher_row` ignores deleted rows, so numbering restarts at 1). The voucher's identity — number, refno, date, posted-on — is fixed at first post |
| live receipt | last tender gone, **or** `soStatus = 'CANCELLED'` | **cancelled** — lines retired, header `CANCELLED` with a reason (`ck_avh_cancel`), `td_voucher_id` cleared |
| no receipt | no money | **unchanged** |

Two cases answer **400** rather than a raw Postgres error: a tender that charges a surcharge whose
tender master names no surcharge ledger, and a tender paid into the very ledger it would be
credited to (`ck_av_self` — the line would debit and credit the same ledger). A re-post after a
cancellation is also refused: the cancelled header still owns that voucher number.

### Advance outstanding (`acc_bill_balance`)

The receipt says the money **moved**; it does not say the customer now has a **credit** with us. That
is a bill fact, and every "what does this party have with us" question — the ageing report, the
adjustment screen, the order's own advance panel (`ix_abl_src_doc`) — is asked of
`acc_bill_balance`, not of the ledgers. So the same save that raises the receipt opens one
`ADVANCE` row alongside it:

| Column | Value |
| --- | --- |
| `abl_bill_type` / `abl_dr_cr` | `ADVANCE` / **`CR`** — the customer's money, held. The opposite of a sale bill's `SALES` / `DR` receivable: nothing is owed *by* the customer here |
| `abl_bill_amount` | `so_advance_recd_amt` when the payload states it, otherwise the tenders' `td_amount` total — **without** the surcharge, which is the company's income and never the customer's credit |
| `abl_alloc_amount` | seeded from `so_advance_adjusted_amt + so_advance_refund_amt + so_advance_forfeit_amt`, so the generated `abl_pending_amount` reads as what is still **held** — the order's own `so_advance_balance_amt`. Left alone once a real `acc_bill_adjustment` exists, which owns the column from then on |
| `abl_src_*` | the order (`SALES` / `SALES_ORDER` / `soId` / `so_acc_year`) — `ck_abl_src_doc` wants all three, and this is how an ADVANCE says *which* order it was taken against without a hop through the voucher |
| `abl_voucher_*` | the advance receipt and its type 5 (`ck_abl_voucher`: only an `OPENING` may have neither) |
| `abl_doc_refno` / `abl_doc_date` | `so_order_refno` / `so_order_date` — there is no bill number to quote, which is the point of an ADVANCE. `ux_abl_doc_refno` makes it unique per company, party, type and year |
| `abl_due_date` / `abl_credit_days` | left empty — nothing is due *from* the customer |

The row moves with the money, keyed off the source document like everything else here:

| Situation | What happens |
| --- | --- |
| order holds an advance, no row yet | **created** alongside the receipt |
| advance edited | **updated** — amount, party, salesman, agent, narration and the seeded allocation re-synced |
| advance edited to **0**, last tender gone, order `CANCELLED`, or order deleted | **retired** (`abl_is_deleted` / `abl_is_active`) — `ck_abl_amount` refuses a zero-value bill, and `ux_abl_doc_refno` skips deleted rows so the refno is freed |

An advance with a **real** settlement against it (an `acc_bill_adjustment` row, or a discount /
write-off) cannot be taken back out or edited below what is settled — that answers **400** rather
than the raw `ck_abl_settled` 23514. The seeded allocation is deliberately not counted as one: a
fully refunded advance is "allocated" to its own value with no adjustment existing, and must still
be deletable.

### Reading what is still outstanding (`GET /pending-amount`)

The write side above is what the save does; `GET /pending-amount` is how a screen asks the same
table what is **left**. It takes the source-document tuple the bill row carries and answers with
`abl_pending_amount` alone:

```
GET /v1/sale-orders/pending-amount?ablSrcDocType=SALES_ORDER
                                  &ablSrcDocId=<so_id>
                                  &ablSrcAccYear=2026-2027

{ "success": true, "message": "Pending amount fetched successfully",
  "data": { "ablPendingAmount": 5000 } }
```

- **Why not `so_advance_balance_amt`.** The header column is a cache this module writes on save.
  `abl_pending_amount` is a **generated** column (`bill − alloc − disc − writeoff`) that moves the
  moment an `acc_bill_adjustment` lands — an invoice eating the advance, a refund — with no save on
  the order at all. Accounts settle against the bill row, so "how much is left" has to be asked of
  the bill row.
- **No bill-year filter.** Only the three source columns and `abl_is_deleted = false` are matched.
  A bill lives in the partition of the year it was **raised** in and is never carried forward, which
  is not necessarily the year of the document it points at — an advance adjusted in the next FY is
  the ordinary case — so the read spans every partition on `ix_abl_src_doc`, exactly as the party
  credit summary does.
- **Summed, not single-row.** An order carries at most one live `ADVANCE` row today, but every row
  against one source document sits on the same side of the books (an order's advances are all `CR`),
  so the total is the amount outstanding however many rows exist.
- **0, not 404.** An order that took no advance, or one whose advance has been adjusted away in
  full, is an ordinary state; a screen asking "how much is left" wants the zero.
- `ablSrcDocType` is normalised the way `PUT /cancel-lines` normalises its `srcModule` — trimmed,
  uppercased, separators to `_`, so `sales order` and `Sales-Order` both name `SALES_ORDER`. An
  empty one is a **400** rather than a filter that would match every row having no source document,
  and `ablSrcAccYear` must be `YYYY-YYYY` or it is a 400 too — a malformed year would otherwise
  match nothing and read back as an innocent "nothing pending".

### Cheque register (`acc_pdc_register`)

A cheque is the one tender that does not end when the sale does. The receipt says the money came
in; the **instrument** still has to be deposited, and it will either clear or bounce — weeks later,
routinely in the next financial year. `acc_tender_detail` records only what was tendered, so a
tender line whose **`td_tender_type_id = 5`** (`CHEQUE`, from `accounts.acc_tender_types`) also
opens a row in `accounts.acc_pdc_register` through
[order-pdc-posting.helper.ts](order-pdc-posting.helper.ts), in the same transaction and off the
same tender rows as the receipt.

| Column | Value |
| --- | --- |
| `apd_acc_year` | the **order's** year — the FY the instrument was *received* in, and the partition key. It may mature in a later one; that is the register's business, not the order's |
| `apd_tra_type` | `R` — a customer's cheque we hold. An order only takes money in |
| `apd_party_id` | `so_cust_id` (customer and account ledger share one primary key) |
| `apd_instrument_type` / `apd_instrument_no` | `CHEQUE` / `td_ref_no` — `acc_tender_types.ttm_ref_label` for type 5 is *Cheque No*, so that is where the number lives |
| `apd_instrument_date` | `td_instrument_date` — the **post-date** on the cheque, which is what the due list works from |
| `apd_amount` | `td_total_amt` — a cheque is written for the whole sum it settles, surcharge included |
| `apd_received_on` | `so_order_date` — the day it arrived, and the floor `ck_apd_dates` puts under the instrument date |
| `apd_bank_name` / `apd_bank_ledger_id` | `td_bank_name` / `td_settle_ledger_id` — the drawee bank, and our own ledger it will be deposited into |
| `apd_drawer_name` | `so_cust_name` — nothing on the tender line says who signed it |
| `apd_posting_mode` | `ON_RECEIPT`, with `apd_voucher_id` / `apd_voucher_acc_year` naming the advance receipt. The order credits the party the day the cheque arrives rather than waiting for it to clear, which is exactly what that mode means (`ck_apd_posting` then insists the voucher is named) |
| `apd_tender_id` | the `acc_tender_detail` row it came in on — the **only** link back, since the register carries no source-document columns. An order's instruments are therefore found by way of its tender rows |
| `apd_status` | `HELD`. Everything past it — `DEPOSITED`, `CLEARED`, `BOUNCED` — belongs to the PDC screen |

The row moves with the tender line, exactly as the receipt does:

| Situation | What happens |
| --- | --- |
| cheque tender with no register row | **registered** `HELD` alongside the receipt |
| cheque tender edited (amount, number, date, bank) | **re-synced** — a tender is editable until the bank has the cheque |
| cheque line removed, paid by something else instead, or edited to 0; last tender gone; order `CANCELLED` | **cancelled** with a reason (`ck_apd_cancelled`). The row stays for audit, and `ux_apd_instrument` skips `CANCELLED` rows so the same cheque number is free again |
| order soft deleted | **cancelled and retired** (`apd_is_deleted`) — nothing may keep pointing at a document that is gone |

Five cases answer **400** rather than a raw Postgres error:

- a cheque tender with no `tdRefNo` (`apd_instrument_no` is NOT NULL) or no `tdInstrumentDate`;
- a cheque dated **before** the order (`ck_apd_dates` — an instrument cannot mature before the day
  it arrived);
- the same cheque number tendered twice on one order, or already registered for that customer in
  that year on another document (`ux_apd_instrument`);
- any change to — or removal of — an instrument that is no longer `HELD`. Once the bank has it, the
  deposit slip, the clearing voucher and the bounce charges all hang off the register row, and the
  order is no longer what tells its story. Settle it on the PDC screen first.

Nothing here is registered for the other tender types: card, UPI, wallet and bank transfer settle
through `td_settle_*` on the tender line itself, and cash settles on the spot.

### Advance roll-ups on the header

`ck_so_advance_amounts` / `ck_so_advance_balance` / `ck_so_advance_policy_input` are judged on the
merged header values (payload falling back to the stored row):

- All six advance amounts must be non-negative. Adjusted / refunded / forfeited are stated by the
  caller — this module keeps no per-application detail table behind them.
- `soAdvanceBalanceAmt` must equal received − adjusted − refunded − forfeited. **When the payload
  omits the balance but moves any of the four components, the balance is derived** rather than
  rejected — an ordinary save never trips the equation by omission. A payload that states a
  mismatched balance is a 400.
- A `PERC` policy needs `soAdvancePerc > 0`; a `FIXED` one needs `soAdvanceRequired > 0`.

### Cancelling the open quantity (`PUT /cancel-lines`)

Closes an order out without deleting it: the remaining quantity is written off, and whatever was
already delivered stays on the record. This is what the **sales line** screen calls when the
operator decides the balance of an order will never be delivered — soft-deleting the document
would be wrong for an order that genuinely part-delivered.

**Addressing.** The three query params are `srcModule` (`SALES`, `SALES_ORDER`, `BOOKING` or
`CUSTOM_ORDER`), `srcDocId` and
`srcAccYear` — the same source-document tuple a sale bill carries in `sb_src_doc_type` /
`sb_src_doc_id`, because the calling screen knows the order only as its source. No `soCompanyId` /
`soBranchId` is required: `(so_id, so_acc_year)` **is** the partitioned table's primary key, so it
already addresses exactly one row, and the company/branch are read off it.

`srcDocId` accepts **either id, and that choice is the scope**:

| `srcDocId` | Scope |
| --- | --- |
| `so_id` | the whole order — every line with pending quantity is closed out |
| `soi_id` | that **one line**; its siblings are left exactly as they are |

The line spelling exists because the screen calling this has the order *line* in front of it, so
`soi_id` is often the nearer id to hand — and cancelling one line of a multi-line order is a real
operation, not a mis-addressed whole-order cancel. Resolution is header-first: the `sale_order` read
runs on the id as given, and only when nothing matches is `sale_order_item` consulted, so the
whole-order path still costs one read. A soft-deleted line resolves to nothing (a 404) rather than
widening the call to its order. Step 2 below recomputes the header from **all** the order's lines
either way — that is what leaves a one-line cancel showing as still-open rather than settled.

`srcModule` takes any of those spellings because the tuple a downstream document stores discriminates
by **doc type** (`SALES_ORDER`), not module (`SALES`), and the sales line forwards what it holds;
`BOOKING` and `CUSTOM_ORDER` are the other two `so_doc_type` values, forwarded the same way by a
screen whose order carries one. Case and separators are normalised before matching, so `sales order`
and `Sales-Order` both land on `SALES_ORDER`. The word itself is still validated rather than ignored:
a bill or delivery-challan token (`SALE_BILL`, `DC`) is a 400 naming the field — those are documents
of their own, with their own endpoints — as is a screen passing its own module blindly, instead of
cancelling an order nobody meant to address.

**Body.** Optional `soiCancelReason` (≤ 250 chars) — why the balance is being written off. One
reason serves both places it is recorded: `sale_order_item.soi_cancel_reason` on every line the
call closes out, and the status trail, which is the only place the *header's* reason can live
(`sale_order` has no cancellation column). Omitted, the line column is left untouched rather than
blanked, so a line cancelled by an earlier call keeps the reason it was given then.

**Step 1 — the lines.** Every **addressed** active line with `soi_pending_qty > 0` — all of them
when `srcDocId` was the `so_id`, just the named one when it was a `soi_id` — gets
`soi_cancelled_qty += soi_pending_qty`, `soi_pending_qty = 0`, `soi_cancel_reason` (when the caller
stated one), and a line status of:

| Line had delivered | New `soi_line_status` |
| --- | --- |
| `soi_delivered_qty > 0` | `PARTIAL` — part of it went out, the rest is written off |
| nothing | `CANCELLED` — nothing ever left the godown |

Both quantity columns move in the **same** statement, because `ck_soi_qty_balance` compares
`round(order_qty, 3)` against `delivered + cancelled + pending` and there is no valid intermediate
state. That is also why this is a per-line `update` loop rather than an `updateMany`: the increment
is column-to-column (Prisma's `{ increment }` takes a literal) and the status is decided per row.
`soi_reserved_qty` is deliberately untouched — releasing a reservation is inventory's call.

**Step 2 — the header**, fully recomputed from what **all** the order's lines then say — including
the ones this call did not address (`summariseOrderLines` / `deriveOrderStatus`):

| Column | Derivation |
| --- | --- |
| `so_cancelled_amt` | Σ `cancelled_qty × (soi_net_amt / soi_order_qty)` — pro-rata from the line total |
| `so_pending_amt` | Σ `pending_qty × (soi_net_amt / soi_order_qty)` |
| `so_billed_amt` | Σ `soi_billed_amt` — a maintained cache, summed as-is so a bill that priced differently is not overwritten |
| `so_tot_items` | count of active lines |
| `so_delivered_items` | count of **fully** delivered lines (`delivered ≈ ordered`); a 2-of-10 line does not count |
| `so_fulfil_status` | Tracks **delivery**, not cancellation. Still pending → `PARTIAL` if anything delivered, else `PENDING`. Nothing pending → `CANCELLED` nothing delivered · `COMPLETED` nothing cancelled · `PARTIAL` some of each |
| `so_status` | mirrors the fulfilment outcome; a still-open order keeps its `DRAFT` / `CONFIRMED` |
| `so_completed_on` | stamped only on `COMPLETED`, and only if still null |

Nothing in the DB enforces these — `sale_order`'s CHECK set covers the status vocabularies and the
advance equations and stops there — so the invariant is stated in one place in the service. Note
the vocabularies differ: `ck_so_status` has no `DELIVERED`, `ck_soi_line_status` has no `COMPLETED`.

**One of the two server-side writers of the fulfilment caches** — the other is the bill conversion
below. Before either existed, `soi_delivered_qty` / `soi_cancelled_qty` / `soi_pending_qty` were
whatever the client last posted. This one owns `soi_cancelled_qty`; the bill conversion owns
`soi_delivered_qty` and never touches what was written off here.

**Advance guard, narrowed.** Unlike `DELETE /delete`, an unsettled advance is not a blanket block —
money held against an order that did deliver is legitimate. The call is refused with a **400** only
when it would take the header all the way to `CANCELLED` while `soAdvanceBalanceAmt > 0`. That
guard is also what keeps the accounting safe: this endpoint does **not** touch the advance posting
(the order is not deleted and its receipt is a real one), but once `so_status` is `CANCELLED` the
next save runs `syncOrderAdvancePosting`, which cancels the receipt, after which
`ensureNotPreviouslyCancelled` blocks re-posting for good.

**Idempotent.** A second call finds nothing open, writes no line, appends no trail step and answers
`cancelledLines: 0`. It still reconciles the header caches — cheap, and they were caller-stated
until this endpoint existed. This is what makes `PUT` the honest verb; it is also the first
`@Put` in `src/modules/sales`.

**Status trail.** A real status *move* appends one `CANCELLED` step to `public.txn_status_log` via
the shared `appendTxnStatusLog` helper (`SALES` / `SALES_ORDER`, partitioned by the order's own
`so_acc_year`), carrying `soiCancelReason`; `ck_tsl_reason_required` means an omitted reason is
recorded as *"No reason recorded"* rather than failing the call. A call that changes no status adds
nothing — that is `audit.audit_log`'s job. **This is the module's only status-trail writer so far**;
create / update / delete do not append steps yet.

**Audit.** One `'update'` entry per closed line against `sale_order_item`, plus one `'cancel'`
entry for the header against `sale_order`.

### Converting an order to a bill (`syncOrderFulfilment`)

Not an endpoint of this module — a service method the **sale-bill** module calls inside its own
save / delete transaction. A bill line says which order line it came from, and the order re-derives
its fulfilment caches from the bills standing against it.

**The link.** `sale_bill_item` carries the reference:

| Bill line column | Points at |
| --- | --- |
| `sbi_src_doc_type` | must be `SALES_ORDER` for any of this to happen |
| `sbi_src_doc_id` | **`soi_id`** — the order line itself. Also accepted: `so_id`, the order, which then needs `sbi_src_doc_line_no` with it |
| `sbi_src_doc_year` | the **order's** accounting year — `soi_acc_year` / `so_acc_year`, the same value either way, and the second half of whichever primary key `sbi_src_doc_id` belongs to |
| `sbi_src_doc_line_no` | `soi_line_no` (the printed line, not `soi_id`) — read only when `sbi_src_doc_id` is an order id, ignored when it is a line id |
| `sbi_src_doc_refno` | `so_order_refno`, carried for display / reprint only — nothing resolves off it |

**Two grains, one resolution.** `sbi_src_doc_id` is looked up as an order line id and as an order
id, the same pair `PUT /cancel-lines` accepts on its own `srcDocId` — no uuid is ever both. A line
id resolves to its own line number, so everything downstream of the lookup sees one `(order, line
number)` shape and neither grain is privileged. Bills written at either grain sum together against
the same order line, which is what stops `soi_delivered_qty` depending on which client keyed which
delivery. An id that is neither answers **400** naming `sbiSrcDocId` — the document being saved is
the bill, so a reference on its payload that addresses no order is a bad field on that payload, not
a missing bill. A 404 here was indistinguishable in the access log from an unrouted
`POST /bills/create`.

The bill **header** carries the same reference one grain coarser — `sb_src_doc_type` /
`sb_src_doc_id` / `sb_src_doc_year`, which name the order the bill as a whole was raised against.
It addresses no line and so draws nothing down; what it does is put that order into the recompute,
so a bill that fills in only its header still leaves `so_status` / `so_fulfil_status` telling the
truth. The quantities always come from the bill **lines** — a header reference carries none. An
order named there that no longer exists is a 400 naming `sbSrcDocId`, the same as for a line.

The arrow points **up** the chain, always. `soi_src_doc_*` on the order line is the same idea one
level higher — it names the *quotation* the order came from — and is never overwritten by a bill.
Reading "which bills delivered this order" is a query over `sale_bill_item`, which is exactly what
this method does.

**What it recomputes**, per referenced order line, from scratch rather than by increment:

| Column | Derivation |
| --- | --- |
| `soi_delivered_qty` | Σ **`sbi_net_qty`** over every **posted** bill line pointing at this order line — the quantity in the order line's own terms, which is what `soi_order_qty` is counted in. Not `sbi_bill_qty`: a bill keyed in cases against an order keyed in pieces would draw down the wrong number |
| `soi_billed_amt` | Σ `sbi_net_amt` over the same rows |
| `soi_pending_qty` | `soi_order_qty − delivered − cancelled`, which is what `ck_soi_qty_balance` demands |
| `soi_order_qty` | **only ever raised, and only by an over-delivery** — see below |
| `soi_cancelled_qty` | **untouched** — writing off what a customer no longer wants is `PUT /cancel-lines`' decision |
| `soi_line_status` | `PENDING` nothing yet · `DELIVERED` all of it · `CANCELLED` all written off · `PARTIAL` anything in between |

**Over-delivery revises the order, it is not refused.** When `delivered + cancelled` comes out above
`soi_order_qty` — the customer took more at the counter, or the order was keyed short —
`soi_order_qty` becomes `delivered + cancelled` and nothing is left pending, because
`ck_soi_qty_balance` leaves nowhere else to record what physically moved. It moves **upwards only**,
and only from a bill: a bill for *less* than the line ordered is a part delivery, and the shortfall
stays in `soi_pending_qty` where the pending-orders report expects it. Both quantities are written
in one statement, so the CHECK never sees a half-applied line.

The revision **sticks**. Nothing keeps the quantity the line was originally keyed with, so retiring
the bill that caused the raise releases the *revised* quantity back into `soi_pending_qty` — a line
raised 10 → 12 whose bill is then deleted sits at 12 pending, not 10. This is the one place the
recompute is not fully reversible; `PUT /cancel-lines` is how the difference is written off if the
customer never wanted it.

The header then goes through the same `summariseOrderLines` / `deriveOrderStatus` pair the cancel
endpoint uses, so both paths land on one definition of `so_fulfil_status` / `so_status` /
`so_completed_on`.

**Only a `POSTED` bill counts.** A draft is still being keyed and may never become a document, so it
draws nothing down. Taking a bill out of `POSTED`, cancelling it or deleting it releases its
quantity back into `soi_pending_qty` on the very next save.

**Which lines are recomputed.** The ones the calling bill points at *now*, the ones it pointed at
*before* the save (so a line the payload drops or repoints hands the abandoned order line its
quantity back), and any line that still carries billed quantity. Everything else is left exactly as
it stands — a quantity cancelled by hand is not this method's to reinterpret. A **header-only**
reference names no line at all, so it recomputes exactly the lines of that order which carry billed
quantity, and invents nothing for the rest.

**Idempotent and self-healing**, because it re-sums rather than increments: a repeat save, a
re-post, a retried transaction all land on the same numbers, and a cache the client had posted
something else into is corrected on the next bill. It runs in the **caller's** transaction, so an
order can never claim a delivery from a bill that rolled back.

**Rejections** (400, naming the bill's own field so the message matches what the client sent):

| Cause | Field |
| --- | --- |
| Id / year names no active order **and** no active order line | `sbiSrcDocId`, or `sbSrcDocId` when the header is what named it |
| The order is deleted between that resolution and the `FOR UPDATE` — or the reference resolved to a live line whose order is already gone | as above |
| Line number is not on that order — only reachable at the `so_id` grain | `sbiSrcDocLineNo` |

Each rejection is worded from the columns the reference was actually read out of, so a header-level
reference is never reported against a line-level field the client never sent.

**Status trail.** A real status move appends one step (`CONVERTED`, or `CANCELLED` when the order
ends up there) with the remark *"Order fulfilment recomputed from its sale bills"*. A save that
leaves the order where it was adds nothing, and — unlike the cancel endpoint — neither the header
row nor an audit entry is written when no value actually moved, so repeatedly saving a draft bill
against an order leaves no trace on it.

**Concurrency.** The order header is locked `FOR UPDATE` before anything is read. Two bills posted
against the same order line in overlapping transactions would otherwise each re-sum
`sale_bill_item` without seeing the other's uncommitted line, and the second to commit would write
a `soi_delivered_qty` that silently misses the first. A bill racing `PUT /cancel-lines` is left to
the database instead: that one ends in a `ck_soi_qty_balance` violation, so the losing transaction
rolls back with an error rather than committing a wrong number.

**Index.** The sum reads `sale_bill_item` by `(sbi_src_doc_id, sbi_src_doc_year)` across **every**
partition — an order taken in one accounting year is routinely billed in the next — which is what
`ix_sbi_src_doc` (migration `20260813050000`) is for.

### Soft delete

- `DELETE /delete` sets `soIsDeleted = true` (plus `soModifiedOn` / `soModifiedBy`) on the header,
  then cascades the same to all its active line items, applied charges and tender lines. Rows are
  never hard-deleted.
- **A deleted order is also a cancelled one**: the same write sets `soStatus = 'CANCELLED'`.
  Unlike the bill there are **no cancellation columns** (`sale_order` carries no
  `so_cancelled_on/by/reason`) — who cancelled and why is `public.txn_status_log`'s fact by
  design. This path does not append a trail step yet (`PUT /cancel-lines` is the only writer so
  far), so today the audit log entry is this operation's record.
- **An order holding an unsettled advance cannot be deleted**: if `soAdvanceBalanceAmt > 0` the
  delete answers **400** — refund, forfeit or transfer the money first (which also moves the
  roll-ups). The mirror of the bill's "a settled bill cannot be deleted" rule, pointed the other
  way: there the block protects the books, here it protects the customer's money.
- The cascade reaches **accounts** too: `deleteOrderAdvancePosting` retires the advance receipt
  raised for the order's tendered money — its `acc_vouchers` lines and its `acc_voucher_header` are
  both flagged deleted (and the header left `CANCELLED`, reason *"Sale order deleted"*), the
  `acc_bill_balance` ADVANCE row goes with them, every `acc_pdc_register` cheque the order took in
  is `CANCELLED` and retired, and `td_voucher_id` is cleared. This is the counterpart of the bill's
  `deleteBillPosting`, and it differs from the update path's *cancel* on purpose: cancelling leaves
  the row behind to keep the number consumed, deleting retires what pointed at a document that is
  gone. A cheque already `DEPOSITED` or `CLEARED` blocks the delete with a **400**, the same way an
  unsettled advance does.
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
  FORFEITED, **nullable** — the column dropped NOT NULL in migration
  `20260810150000`, and `ck_so_advance_status` is an `= ANY (...)` test that a NULL
  satisfies, so an explicit `null` on the payload is accepted and stored).
- `ensureOrderItemValuesAreAllowed` does the same per line: `soiFreeType` (SCHEME / SAMPLE /
  REPLACEMENT, nullable), `soiLineStatus` (PENDING / PARTIAL / DELIVERED / CANCELLED), the
  quantity sign rules, `soiReservedQty` ∈ [0, `soiOrderQty`] (`ck_soi_reserved`), and `soiSize`
  non-blank (`ck_soi_size`). Cross-field rules are judged on the **merged** row (payload falling
  back to the stored line), the same way the bill judges `ck_sbi_batch_split`.

### Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` inside the same transaction —
header actions `New` / `update` / `cancel` against `tableName = 'sale_order'`,
`screenName = 'Sale Order'`, `screenType = 'transaction'`; each line-item, charge and tender
write is logged separately against its own table name. The acting user is
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
| `cdCompName` / `cdBranchName` | `cdCompId` / `cdBranchId` | company / branch |
| `tdCompanyName` | `tdCompanyId` | company |
| `tdPartyLedgerName` | `tdPartyLedgerId` | `acc_ledger_master.led_name` |
| `tdUserName` | `tdUserId` | `user_master.usr_display_name` |

An id whose master row is missing (or soft-deleted out from under the order) resolves to `null`
rather than failing the read; `soSalesmanName` carries the null in position, so index *n* of the
names always lines up with index *n* of `soSalesmanId`. The charge / tender name fields are the only
additions this module makes to those modules' payloads — every other `cd_*` / `td_*` field is theirs
verbatim.
