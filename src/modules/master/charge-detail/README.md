# Charge Detail

Standalone CRUD over the per-document applied charges — freight, loading,
packing, cash discount, … Table: `public.sale_charge_detail` (Prisma model
`SaleChargeDetail`, fragment `prisma/public/saleChargeDetail.prisma`, migrations
`20260728130000_create_sale_charge_detail`,
`20260728140000_sale_charge_detail_check_constraints`,
`20260728150000_sale_charge_detail_relations`).

The table is **polymorphic**: a row belongs to whichever document the
`(cdDocType, cdDocId)` pair names, which is why the parent has no foreign key.
Every `cd_*` column except the amounts is a **snapshot** of `charge_master` (and
its ledger) taken at save time, so this module stores what the client sends
rather than re-reading the master — editing a charge master later never rewrites
what was already invoiced.

## Endpoints (`/charge-details`, `API_VERSION`)

| Method | Path                     | Purpose                                              |
| ------ | ------------------------ | ---------------------------------------------------- |
| POST   | `/charge-details/create` | Create (no `cdId`) or update (with `cdId`)           |
| GET    | `/charge-details/get`    | One line by `cdId`, or all lines of a document       |
| DELETE | `/charge-details/delete` | Soft delete by `cdId`                                |

## Notes

- **Relationship to the owning modules** — a document that saves its charge
  lines as part of its own transaction calls this service rather than writing
  `sale_charge_detail` itself. Three methods exist for that, all taking the
  caller's transaction client so the parent header, its lines and its charges
  commit or roll back together:
  - `syncDocumentCharges(tx, scope, charges, actorId, audit?)` — reconciles a
    whole `charges[]` array against one document: a line with `cdId` is updated,
    one without is created, an existing line missing from the array is soft
    deleted, and `undefined` leaves the stored lines alone. `cdSlno` defaults to
    the line's 1-based position; a duplicate within one payload is a 409. The
    `scope` (`ChargeDocumentScope`) is the parent's `cdDocType` / `cdDocId` plus
    the `cdCompId` / `cdBranchId` / `cdAccYear` / `cdVoucherNo` each line
    inherits when it does not send its own — and a line may **not** name a
    different document (400, the same rule as `ensureDocumentIsUnchanged`).
  - `findDocumentCharges(client, cdDocType, cdDocId)` — the document's stored
    lines in `cdSlno` order, ledger name included, readable inside a
    transaction. `getByDocument` is the same read for a plain HTTP GET.
  - `softDeleteDocumentCharges(tx, cdDocType, cdDocId, actorId, modifiedOn?)` —
    retires every line of a document in one statement, for when the parent
    header is soft deleted.

  Both entry points share one set of writers, one set of guards and one payload
  shape; the optional `audit` argument (`ChargeDocumentAudit`) only relabels the
  audit rows, so a charge saved with a bill is logged on the bill's screen
  (`BillService` passes `BILL_CHARGE_AUDIT`) instead of "Charge Detail".
  `sales/bill` works this way; `sales/quotation` still has its own `syncCharges`
  and has not been moved over yet.
- **`POST /charge-details/create`**
  - Create requires `cdDocType`, `cdDocId`, `cdCompId`, `cdBranchId`,
    `cdAccYear`, `cdChgId` and `cdLedgerCode`. Nothing is marked required in the
    DTO, because an update only needs `cdId` plus what changes — "required on
    create" is enforced in the service (`requireField`).
  - `cdDocType` / `cdDocId` are **immutable** on update: re-pointing a saved line
    at another document would move money between vouchers, so a mismatched pair
    is a 400 (`ensureDocumentIsUnchanged`). Resending the same pair is fine.
  - `cdSlno` is the line order within one document. Omit it and the next free
    number is assigned; send one already used by a non-deleted line on the same
    document and it is a 409. The DB has no unique index for this (the table's
    only index is on the discriminator pair), so the service owns the rule.
- **`GET /charge-details/get` takes either `cdId` or both `cdDocType` and
  `cdDocId`** (neither, or a mix → 400).
  - `cdId` → `data` is a single charge line.
  - `cdDocType` + `cdDocId` → `data` is an array ordered by `cdSlno` (nulls
    last) then `cdCreatedOn`. Add `isActive=true` to restrict to active lines;
    by default active and inactive lines are both returned.
  - Soft-deleted lines are never returned by either lookup.
- **Soft delete** — sets `cd_is_deleted = true` / `cd_is_active = false`; rows
  are never physically removed and are excluded from all reads.
- **Enum fields** (`cdDocType`, `cdRole`, `cdMethod`, `cdType`, `cdApplyOn`,
  `cdCostAlloc`) are TypeScript enums — `ChargeDocType`, `ChargeRole`,
  `ChargeMethod`, `ChargeType`, `ChargeApplyOn`, `ChargeCostAlloc` in
  [`../charge-master/types/charge-enum.ts`](../charge-master/types/charge-enum.ts).
  They live with the charge master because every `cd_*` value is a snapshot of the
  matching `chg_*` one, so there is a single definition; the `CHARGE_*` arrays and
  `CHARGE_DETAIL_VALUE_GUARDS` are derived from them and cannot drift.
  Values are upper-cased on input and validated twice: by the DTO's `@IsEnum` on
  the HTTP path, and again by `ChargeDetailService.ensureValuesAreAllowed` on
  every write. Unlike `charge_master`, these columns **are** still `CHECK`
  constrained in the database (`ck_cd_doc_type` / `ck_cd_type` / `ck_cd_method` /
  `ck_cd_apply_on` / `ck_cd_cost_alloc`) — keep the enums in step with those
  constraints; the app-side guard exists so a bad value comes back as a 400
  naming the field instead of a raw Postgres 23514. The columns themselves stay
  `varchar`: nothing here is a native Postgres enum type, so the service asserts
  the enum when reading a row back.
- **`cdTaxApl` vs `cdBeforeTax`** are mutually exclusive (DB constraint
  `ck_cd_tax_apl`): `cdBeforeTax` folds the charge into the goods' taxable value
  so it is taxed at each item's own GST rate, `cdTaxApl` means the charge carries
  its own GST after tax. Both at once would tax it twice; neither = a flat,
  untaxed adjustment. On update the check is applied to the **merged** row, so
  turning one flag on while the stored row has the other is rejected.
- **`cdRate = 0` with a non-zero `cdAmount` is valid, not missing data** — the
  operator priced the charge by typing its total and the client spreads it in the
  method's shape. There is deliberately no rate-is-required rule.
- **References** — `cdChgId`, `cdLedgerCode`, `cdCompId` and `cdBranchId` all
  carry DB foreign keys (the last three added in
  `20260728150000_sale_charge_detail_relations`). A foreign key only proves the
  row exists, so the service additionally rejects a soft-deleted `charge_master`
  or `acc_ledger_master` row with a 400; any other FK violation surfaces as a
  400 rather than a 500. `cdTaxCode` has no FK — it is a snapshot value.
- **`cdLedgerName`** is echoed on every payload from the mapped
  `acc_ledger_master` row. It is a read-only display value, not stored on
  `sale_charge_detail`, and is deliberately excluded from the audit snapshots so
  it never shows up as a change.
- **`cdVoucherNo`** is a `bigint` column, carried in and out as a string/number
  so large voucher numbers survive JSON.
- Audit entries are written under screen name **"Charge Detail"**, screen type
  `transaction` (auto-created on first write) — unless an owning module passed
  its own `ChargeDocumentAudit`, in which case the row lands on that module's
  screen. Add an entry to `audit-screen-sql.constants.ts` if you want
  field-level projection/snapshots.
