# Tender Detail

CRUD over the per-document tender lines — the money a customer actually handed
over, one row per tender (cash, card, UPI, loyalty points, voucher, …). Table:
`accounts.acc_tender_detail` (Prisma model `AccTenderDetail`, fragment
`prisma/accounts/accountTenderDetail.prisma`, migrations
`20260731090000_add_acc_tender_detail`,
`20260731110000_add_tender_actor_fk_constraints`).

The table is **polymorphic**: a row belongs to whichever document the
`(tdSrcModule, tdSrcDocType, tdSrcDocId)` triple names, which is why the parent
has no foreign key — and why the row snapshots the document's date
(`tdDocDate`) and party ledger (`tdPartyLedgerId`) rather than joining them.
Rows are written while the document is still a **draft**; `tdVoucherId` stays
NULL until it is posted.

Every `td_*` column except the amounts is a **snapshot** of `acc_tender_master`
(and its type / ledger) taken at tender time, so editing a tender master later
never rewrites what was already tendered.

## Endpoints (`/tender-details`, `API_VERSION`)

| Method | Path                     | Purpose                                          |
| ------ | ------------------------ | ------------------------------------------------ |
| POST   | `/tender-details/create` | Create (no `tdId`) or update (with `tdId`)       |
| GET    | `/tender-details/get`    | One line by `tdId`, or all lines of a document   |
| DELETE | `/tender-details/delete` | Soft delete by `tdId`                            |

## Notes

- **Relationship to the owning modules** — a document that captures its tenders
  as part of its own save calls this service rather than writing
  `acc_tender_detail` itself. Three methods exist for that, all taking the
  caller's transaction client so the parent header, its lines and its tenders
  commit or roll back together:
  - `syncDocumentTenders(tx, scope, tenders, actorId, audit?)` — reconciles a
    whole `tenders[]` array against one document: a line with `tdId` is updated,
    one without is created, an existing line missing from the array is soft
    deleted, and `undefined` leaves the stored lines alone. `tdRowNo` defaults to
    the line's 1-based position; a duplicate within one payload is a 409. The
    `scope` (`TenderDocumentScope`) carries the parent's document triple plus
    the `tdCompanyId` / `tdBranchId` / `tdTenantId` / `tdAccYear` / `tdDocDate` /
    `tdPartyLedgerId` / `tdUserId` / `tdSessionId` / `tdDeviceId` / `tdDrCr`
    each line inherits when it does not send its own — and a line may **not**
    name a different document (400).
  - `findDocumentTenders(client, srcModule, srcDocType, srcDocId)` — the
    document's stored lines in `tdRowNo` order, tender and ledger names
    included, readable inside a transaction. `getByDocument` is the same read
    for a plain HTTP GET.
  - `softDeleteDocumentTenders(tx, srcModule, srcDocType, srcDocId, actorId, on?)`
    — retires every line of a document in one statement, for when the parent
    header is soft deleted.

  `sales/bill` works this way — see
  [../../sales/bill/README.md#nested-tendered-amounts](../../sales/bill/README.md#nested-tendered-amounts).
  The optional `audit` argument (`TenderDocumentAudit`) only relabels the audit
  rows, so a tender saved with a bill is logged on the bill's screen
  (`BillService` passes `BILL_TENDER_AUDIT`) instead of "Tender Detail".
- **`POST /tender-details/create`**
  - Create requires the document triple (`tdSrcModule`, `tdSrcDocType`,
    `tdSrcDocId`), `tdCompanyId`, `tdBranchId`, `tdAccYear`, `tdDocDate`,
    `tdPartyLedgerId`, `tdUserId`, `tdDrCr` and `tdTenderId`. Nothing is marked
    required in the DTO, because an update only needs `tdId` plus what changes —
    "required on create" is enforced in the service (`requireField`).
  - The document triple is **immutable** on update: re-pointing a saved line at
    another document would move money between vouchers, so a mismatched value is
    a 400 (`ensureDocumentIsUnchanged`). Resending the same triple is fine.
  - `tdRowNo` is the line order within one document. Omit it and the next free
    number is assigned; send one already used by a non-deleted line on the same
    document and it is a 409. The DB has no unique index for this (the table's
    only index is its PK), so the service owns the rule.
- **Snapshots filled from the master** — `tdTenderTypeId` and `tdTenderLedgerId`
  are `NOT NULL` but are pure identity snapshots, so when the payload omits them
  they are read from the picked `acc_tender_master` row (which the service is
  already loading to validate it). Send them explicitly to override — a POS that
  lets the cashier redirect a tender to another ledger (`tnd_edit_ledger`) does
  exactly that. Re-picking the tender on an update re-snapshots both unless the
  payload names its own.
- **`tdTotalAmt` is derived, never trusted** — `ck_td_total_amt` requires it to
  equal `round(td_amount + td_surcharge_amt, 2)`, so the service computes it from
  the merged row. Sending a value that disagrees with that sum is a 400 naming
  `tdTotalAmt` rather than a Postgres 23514.
- **The remaining CHECK constraints are mirrored app-side** on the **merged**
  row (payload first, stored row next, column default last), so a bad value comes
  back as a 400 naming the field: the enum sets `ck_td_src_module` /
  `ck_td_src_doc_type` / `ck_td_dr_cr` / `ck_td_settle_status`
  (`TENDER_DETAIL_VALUE_GUARDS`), `ck_td_cash_change` (change cannot exceed a
  non-zero received amount), `ck_td_units` (`tdConversionRate > 0`),
  `ck_td_settled_on` (`SETTLED` needs a `tdSettledOn`), `ck_td_pdc` (a PDC needs
  a `tdInstrumentDate`) and `ck_td_card_last4` (exactly 4 digits). The
  non-negative amount checks (`ck_td_amounts`, `ck_td_mdr`,
  `ck_td_settle_amount`) and `ck_td_row_no` are covered by the DTO's
  `@OptionalNumber(0)` / `@OptionalInteger(1)` decorators.
- **`GET /tender-details/get` takes either `tdId` or all three of `tdSrcModule`,
  `tdSrcDocType` and `tdSrcDocId`** (neither, a partial triple, or a mix → 400).
  Soft-deleted lines are never returned by either lookup.
- **Soft delete** — sets `td_is_deleted = true`; there is no `is_active` column
  on this table, and rows are never physically removed.
- **References** — `tdTenderId`, `tdTenderTypeId`, `tdTenderLedgerId`,
  `tdSettleLedgerId`, `tdSurchargeLedgerId`, `tdPartyLedgerId`, `tdCompanyId`,
  `tdBranchId`, `tdUserId` and the two voucher ids all carry DB foreign keys. A
  foreign key only proves the row exists, so the service additionally rejects an
  inactive or soft-deleted `acc_tender_master`, a soft-deleted
  `acc_ledger_master` (posting / party / settlement / surcharge) and a
  soft-deleted `acc_tender_types` row with a 400; any other FK violation
  surfaces as a 400 rather than a 500.
- **`tdTenderName` / `tdTenderLedgerName`** are echoed on every payload from the
  mapped master rows. They are read-only display values, not stored on
  `acc_tender_detail`, and are deliberately excluded from the audit snapshots so
  they never show up as a change.
- **`tdTenderTypeId` is carried as a string** on the API (the column is an
  integer), the same convention the tender master module uses for `tndTypeId`.
- **Date-only columns** (`tdDocDate`, `tdInstrumentDate`, `tdExpectedSettleOn`,
  `tdSettledOn`) are emitted as `YYYY-MM-DD`, not a UTC-midnight timestamp.
- **Partitioning** — `acc_tender_detail` is declaratively partitioned by
  `LIST (td_acc_year)` with the composite primary key `(tdId, tdAccYear)`, like
  `sales.sale_bill`. Every single-row `.update()` therefore addresses the
  `tdId_tdAccYear` compound key, and **a partition must exist for the accounting
  year** (e.g. `acc_tender_detail_2026_2027`) before any row can be inserted —
  that is a separate bootstrap migration per year, not something this module
  does.
- Audit entries are written under screen name **"Tender Detail"**, screen type
  `transaction` (auto-created on first write) — unless an owning module passed
  its own `TenderDocumentAudit`, in which case the row lands on that module's
  screen.
