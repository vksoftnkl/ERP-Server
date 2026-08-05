# Transaction Hold

CRUD over the parked transactions — a bill the till puts aside mid-entry so it
can serve the next customer and pull this one back later ("hold" / "park" /
"suspend" on a POS screen). Table: `public.transaction_hold` (Prisma model
`TransactionHold`, fragment `prisma/public/transactionHold.prisma`, migration
`20260804131134_transaction_hold_table_added`).

The table stores **no lines of its own**: `th_ui_state` carries the entire screen
(cart lines, discounts, focus) as JSONB, and `th_customer_name` /
`th_item_count` / `th_total_qty` / `th_total_amount` are the summary the
held-bills list renders from, snapshotted at hold time. The server never reads
into the UI state — it is stored and handed back verbatim.

## Endpoints (`/transaction-holds`, `API_VERSION`)

| Method | Path                       | Purpose                                   |
| ------ | -------------------------- | ----------------------------------------- |
| POST   | `/transaction-holds/create`| Create (no `thId`) or update (with `thId`)|
| GET    | `/transaction-holds/list`  | Search / filter / page the held bills     |
| GET    | `/transaction-holds/get`   | One hold by `thId`                        |
| DELETE | `/transaction-holds/delete`| Soft delete by `thId`                     |

## Notes

- **`POST /transaction-holds/create`**
  - Create requires `thCompanyId`, `thBranchId`, `thAccYear`, `thHoldNo`,
    `thDeviceId` and `thDeviceType`. Nothing is marked required in the DTO,
    because an update only needs `thId` plus what changes — "required on create"
    is enforced in the service (`requireField`).
  - The **scope is immutable** on update: `thCompanyId`, `thBranchId` and
    `thAccYear` may be resent but never changed (400), since re-scoping a hold
    would move it out from under its hold number and into another year's list.
  - `thHoldDate` is filled with the save instant when the payload omits it,
    rather than being left to the column default, so the guards below and the
    returned payload judge the timestamp the row actually carries.
- **`thHoldNo` is the till's number, not the server's.** It is required on
  create and is unique per **company + branch + accounting year + document
  type** over non-deleted rows — the partial unique index `ux_th_hold_no`.
  Because the index has a `WHERE` predicate Prisma cannot see it, so
  `ensureHoldNoIsUnique` restates the rule and answers a 409 naming `thHoldNo`;
  a `P2002` from two tills racing the same number is mapped to the same 409
  rather than a 500. The comparison is **exact**, matching the index (it is on
  the raw column, not `lower(th_hold_no)`). An update re-runs the check whenever
  **either** `thHoldNo` or `thDocType` moves, since the index keys on the pair.
  Holds are numbered by the device (they are local and may be taken offline),
  which is why this is not drawn from `acc_voucher_seq` the way a bill number is.
- **`thAccYear` is a SMALLINT** — the fiscal year as its starting year (2026 for
  `2026-2027`), unlike `sale_bill.sb_acc_year` / `acc_tender_detail.td_acc_year`
  which are `char(9)` strings. Only the column's own range (1 – 32767) is
  validated.
- **Indexes are all partial, so they are DB-only.** `ux_th_hold_no`, `ix_th_list`
  (the recall list), `ix_th_counter_session`, `ix_th_device`, `ix_th_expiry` (the
  expiry / purge job) and `ix_th_converted_doc` (which hold produced this
  document) live as raw SQL in the migration and as comments on the fragment.
  Prisma ignores indexes carrying a `WHERE` predicate, so declaring a matching
  `@@unique` / `@@index` on the model would make every `migrate dev` regenerate
  them **without** the predicate and fail `42P07` on the existing name — see the
  same note on `sale_quotation`.
- **The column rules live in this module.** `transaction_hold` carries no
  foreign keys, so every reference is checked here; the value rules mirror the
  `ck_th_*` CHECK definitions member for member and are judged on the **merged**
  row (payload first, stored row next, column default last), so a bad value is a
  400 naming the field rather than a raw Postgres 23514:

  | Rule | Enforced by |
  | --- | --- |
  | `ck_th_status` | `TransactionHoldStatus` — `HELD`, `LOCKED`, `RESUMED`, `CONVERTED`, `CANCELLED`, `EXPIRED` |
  | `ck_th_doc_type` | `TransactionHoldDocType` — `SALE_INVOICE`, `POS_BILL`, `DELIVERY_CHALLAN`, `SALE_ORDER`, `SALE_RETURN`, `PURCHASE_INVOICE`, `PURCHASE_ORDER`, `GRN`, `PURCHASE_RETURN` (also the set for `thConvertedDocType`) |
  | `ck_th_device_type` | `TransactionHoldDeviceType` — `DESKTOP`, `POS_TERMINAL`, `TABLET`, `MOBILE`, `HANDHELD`, `KIOSK` |
  | `ck_th_total_amount` | `thTotalAmount >= 0` — DTO decorator on the payload, `ensureValuesAreAllowed` on the merged row |
  | `ck_th_converted` | `thStatus = CONVERTED` requires **both** `thConvertedDocId` and `thConvertedAt` |

  The three enum sets are declared once in
  [types/transaction-hold-api.types.ts](./types/transaction-hold-api.types.ts)
  and consumed twice: as `@IsEnum` on the DTO (rejects the payload) and as
  `TRANSACTION_HOLD_VALUE_GUARDS` in the service (rejects the merged row, which
  is what a partial update actually writes). The columns stay plain varchars —
  none of these is a native PG enum type. **Keep the enums in step with the
  constraints.**

  Two further rules have no constraint counterpart, because a CHECK only ever
  sees one row:
  - `thExpiresAt` must be after `thHoldDate`, and any `thConvertedDocId` needs a
    `thConvertedDocType` — `th_converted_doc_id` is polymorphic (no FK), so the
    pair is the only thing naming the document.
  - **Terminal statuses are terminal**: a hold already `CONVERTED`, `CANCELLED`
    or `EXPIRED` cannot be moved back to an open status (409). Reopening a
    converted hold would let the same parked cart be billed twice. Resending the
    same terminal status is fine.

  Reference checks, same place:
  - `thCompanyId` / `thBranchId` are checked against non-deleted `companies` /
    `branch_master` rows on create, and `thUserId` / `thSessionId` against
    `user_master` / `audit.user_login_sessions` whenever they are sent — a 400
    rather than an orphaned reference, since the DB will not catch it.
  - `thCounterId` is **not** validated: there is no counter master table in the
    schema yet, so the column is carried as an opaque id.
- **`th_ui_state`** accepts any JSON object and is returned as stored. Sending
  `null` clears it to SQL NULL (`Prisma.DbNull`), not the JSON literal `null`,
  so the column reads back as unset.
- **`GET /transaction-holds/list`** answers newest first (`thHoldDate` desc,
  `thId` desc as the tie-break) and never returns soft-deleted holds. Filters:
  `thCompanyId`, `thBranchId`, `thAccYear`, `thCounterId`, `thSessionId`,
  `thUserId`, `thDeviceId`, `thDeviceType`, `thStatus`, `thDocType`,
  `holdDateFrom` / `holdDateTo`, and `expired` (`true` → past `thExpiresAt`;
  `false` → still valid, which includes holds with no expiry at all). The
  company + branch + doc type + status + date shape is what `ix_th_list` covers.
  A configured grid is used
  for the plain `search` + paging case only — sending any of the filters above
  takes the query onto the module's own Prisma query, because the stored grid
  SQL cannot apply them.
- **Soft delete** sets `th_is_deleted = true` and **leaves `th_status` alone** —
  a deleted hold that had already been `CONVERTED` must keep saying so, and every
  read path filters on `th_is_deleted` anyway. Rows are never physically removed.
- **No display-name joins.** The model declares no relations, so the payload
  mirrors the stored row exactly; a screen needing the company / branch / user
  name resolves it from its own masters.
- Audit entries are written under screen name **"Transaction Hold"**, screen type
  `transaction` (auto-created on first write).
- **Not in scope here** — this is CRUD only. Resuming a hold onto a till
  (locking it, bumping `th_resume_count`) and converting it into a bill are
  workflow endpoints: they would set the same columns this module already
  validates, and `TransactionHoldService` is exported from the module so the
  flow that raises the document can stamp the conversion trace inside its own
  transaction.
