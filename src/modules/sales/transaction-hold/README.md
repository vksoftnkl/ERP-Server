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

| Method | Path                             | Purpose                                    |
| ------ | -------------------------------- | ------------------------------------------ |
| POST   | `/transaction-holds/create`      | Create (no `thId`) or update (with `thId`) |
| GET    | `/transaction-holds/list`        | Search / filter / page the held bills      |
| GET    | `/transaction-holds/get`         | One hold by `thId`                         |
| POST   | `/transaction-holds/:id/resume`  | Take the edit lock — `HELD` → `LOCKED`     |
| POST   | `/transaction-holds/:id/release` | Give it back — `LOCKED` → `HELD`           |
| POST   | `/transaction-holds/:id/force-release` | Take it off another device           |
| POST   | `/transaction-holds/:id/convert` | Bill it — `LOCKED` → `CONVERTED`           |
| DELETE | `/transaction-holds/delete`      | Soft delete by `thId`                      |

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
  | `ck_th_doc_type` | `TransactionHoldDocType` — `SALE_INVOICE`, `POS_BILL`, `DELIVERY_CHALLAN`, `SALE_ORDER`, `QUOTATION`, `SALE_RETURN`, `PURCHASE_INVOICE`, `PURCHASE_ORDER`, `GRN`, `PURCHASE_RETURN` (also the set for `thConvertedDocType`). `QUOTATION` was added after the quotation screen had already shipped parking carts under `SALE_ORDER`, so **rows written before it keep that type** — a picker that wants the old ones has to look under both. |
  | `ck_th_device_type` | `TransactionHoldDeviceType` — `DESKTOP`, `WEB`, `MOBILE` |
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
  `transaction` (auto-created on first write). Each lock transition writes one
  `update` entry naming the device (`Hold resumed on device …`).

## The device edit lock

A hold may be open on **one device at a time**. The holder is the **device**
(the `X-Device-Id` header), not the operator: two operators sharing a till are
the same holder, one operator on two tills is not.

```
HELD ──(resume by device)──▶ LOCKED ──(convert)──▶ CONVERTED
                               │
                               └──(release)──▶ HELD
```

- **The lock holder is `th_locked_by`**, which is why it (and `th_resumed_by`)
  are `varchar(64)` to match `th_device_id` — widened from 50 by migration
  `20260805110000_widen_transaction_hold_lock_columns`, a bare
  `ALTER COLUMN … TYPE` so the partial indexes below are left untouched. The
  device id is stored exactly as sent (trimmed only): upper-casing it would stop
  it matching itself on the ownership check. Longer than 64 is a 400 rather than
  a truncation that could never match again.
- **Every transition is one conditional `updateMany`** — the status it is moving
  *from* (and, on release / convert, `th_locked_by = <this device>`) sits in the
  WHERE clause, never in a preceding SELECT. Two tills resuming the same parked
  bill therefore serialize on the row: Postgres makes the loser re-evaluate the
  predicate against the winner's committed row, it matches nothing (`count = 0`),
  and the loser is told who holds it. A read-then-update would let both pass the
  check and both write. The service *does* read the row first, but only to
  snapshot the "before" side of the audit entry — that read gates nothing, and
  the tests prove it by racing two resumes through `Promise.all`.
- **Resume** (`HELD` → `LOCKED`) bumps `th_resume_count`, stamps
  `th_locked_by` / `th_locked_at` / `th_resumed_by` / `th_resumed_at`, and
  answers the whole hold **including `th_ui_state`** so the till can redraw the
  screen. Locked by another device → **409** naming it; already closed → 409.
  Locked by the **same** device → **200 without a second increment**, so a
  retried request or a double tap on the recall list is harmless.
- **Release** (`LOCKED` → `HELD`) clears `th_locked_by` / `th_locked_at` only —
  `th_resumed_by` / `th_resumed_at` / `th_resume_count` are history, not lock
  state. A hold that is already `HELD` answers 200 unchanged (the caller asked
  for the state it is in); one locked by another device is **403**.
- **Convert** (`LOCKED` → `CONVERTED`) stamps the conversion trace, drops the
  lock and closes the hold for good — it can never be resumed or billed again
  (409). There is no idempotent path: a device that does not hold the lock gets
  **403** and nothing is written.
- **Scope and soft delete are part of every lock query** (`th_company_id`,
  `th_branch_id`, `th_is_deleted = false`), so a hold can be neither taken nor
  spent from another company or branch — those answer 404, the same as an
  unknown id, rather than confirming the row exists elsewhere.
- **No timeouts, no auto-release, no crash recovery.** A `LOCKED` hold stays
  locked until the device that took it gives it back; `th_expires_at` is not
  read or written by any of these paths (the column and `ix_th_expiry` exist for
  a future purge job). Deliberately, so a half-finished bill is never pulled out
  from under a working till.
- **`force-release` is the escape hatch** for exactly that: a till that died
  holding a cart. It is the same conditional update **minus the `th_locked_by`
  predicate** — a separate route rather than a flag on `/release`, because it is
  a decision to interrupt whoever holds the lock, not another way to give one
  back; `/release` therefore stays unconditionally ownership-checked. It cannot
  reopen a closed hold (409), an already-`HELD` one answers 200 unchanged, and
  the audit entry names **both** devices (`force released by device A, taken
  from device B`). It also clears `RESUMED`, which is what "in use" meant before
  this lock existed — rows a client parked by writing `th_status` through the
  CRUD route are otherwise stuck for good: un-resumable (409, not `HELD`) and
  un-releasable (403, no `th_locked_by` to match).
- **`POST /transaction-holds/create` can still write `th_status` / `th_locked_by`
  directly.** It is the CRUD path and validates the columns rather than the
  transition, so it bypasses the ownership check; the lock endpoints are the
  supported way to move them.
- The recall list already carries `thStatus`, `thLockedBy`, `thCounterId` and
  `thDeviceId` on every row (the payload mirrors the stored row, nothing is
  narrowed by a `select`), which is what a screen needs to grey out a `LOCKED`
  row and show "In use — &lt;device&gt;". A **configured grid** would answer with
  its own column set instead — there is none for this table today, so the list
  always takes the Prisma path unless a plain `search` is sent.
- **Still not in scope here**: raising the document itself. `TransactionHoldService`
  is exported from the module so the flow that bills a hold can call
  `convertHold` inside its own transaction.
