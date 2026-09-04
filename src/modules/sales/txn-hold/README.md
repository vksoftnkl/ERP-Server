# Transaction Hold

CRUD and lease handling over the parking bay for half-finished transactional
work — a sale the till puts aside mid-entry so it can serve the next customer
("hold" / "park" / "suspend" on a POS screen), the screen's own crash-recovery
snapshot, or a saved starting point. Table: `public.txn_hold` (Prisma model
`TxnHold`, fragment [prisma/public/txnHold.prisma](../../../../prisma/public/txnHold.prisma),
migration `20260810160000_add_txn_hold`).

It **replaces** `public.transaction_hold`, which was dropped by the same
migration: that table was sales/POS-only, unpartitioned, keyed its lock on a
free-text device name, and kept the screen in an untyped `th_ui_state`.

The table stores **no lines of its own**: `txh_payload` carries the module's
entire save body (header, items, charges, tenders, screen state) as JSONB, and
the party columns plus the three roll-ups (`txh_item_count` / `txh_total_qty` /
`txh_net_amount`) are the summary the pick list renders from, snapshotted at
hold time. The server never reads into the payload — it is stored and handed
back verbatim.

Two facts shape everything below:

- **The primary key is `(txh_id, txh_acc_year)`**, because the table is
  LIST-partitioned by the accounting year (like `txn_status_log`, `sale_bill`,
  `sale_order`). An id alone does not name a row. Every single-row route takes
  `txhAccYear` as an **optional** hint: sent, the lookup is pruned to one
  partition; omitted, it scans every year on record and still answers correctly.
  A new fiscal year needs `SELECT public.ensure_acc_year_partitions('YYYY-YYYY')`
  or every insert fails with *no partition of relation "txn_hold" found for row*.
- **The DB carries 21 CHECK constraints and 13 indexes**, all of the indexes
  partial. The constraints are the authority; the rules restated in this module
  exist to answer a 400 / 409 naming the field instead of a raw 23514 / 23505.

## Endpoints (`/txn-holds`, `API_VERSION`)

| Method | Path                          | Purpose                                     |
| ------ | ----------------------------- | ------------------------------------------- |
| POST   | `/txn-holds/create`           | Create (no `txhId`) or update (with `txhId`) |
| GET    | `/txn-holds/list`             | Search / filter / page the pick list        |
| GET    | `/txn-holds/get`              | One hold by `txhId` (+ optional `txhAccYear`) |
| POST   | `/txn-holds/:id/resume`       | Take the lease — `HELD` → `LOCKED`          |
| POST   | `/txn-holds/:id/release`      | Give it back — `LOCKED` → `HELD`            |
| POST   | `/txn-holds/:id/force-release` | Take it off another device                 |
| POST   | `/txn-holds/:id/convert`      | Close it onto its document — `LOCKED` → `CONVERTED` |
| DELETE | `/txn-holds/delete`           | Soft delete by `txhId`                      |

## Notes

- **`POST /txn-holds/create`**
  - Create requires `txhCompanyId`, `txhBranchId`, `txhAccYear`, `txhSrcModule`,
    `txhDocType`, `txhDeviceId`, `txhHeldBy` and `txhPayload`. Only `txhPayload`
    is marked required in the DTO, because an update needs `txhId` plus what
    changes — "required on create" is enforced in the service (`requireField`).
  - `txhHoldNo` and `txhHoldSlno` are **optional and nullable** (both columns
    dropped their `NOT NULL` in `20260831070000_txn_hold_optional_hold_no`).
    Only a `HOLD` prints a token slip, so an `AUTOSAVE` snapshot or a `TEMPLATE`
    parks unnumbered instead of burning a slot in the device's series on a
    throwaway value. On update, sending `null` clears a number the row already
    carries; omitting the field leaves it alone.
  - The **scope is immutable** on update: `txhCompanyId`, `txhBranchId` and
    `txhAccYear` may be resent but never changed (400). The year is half the
    primary key *and* the partition key, so re-scoping means moving the row to
    another partition under a new identity.
  - `txhHoldOn` is filled with the save instant when the payload omits it, rather
    than being left to the column default, so the guards below and the returned
    payload judge the timestamp the row actually carries.
  - Every update bumps **`txh_revision`**, so an offline till that re-syncs an
    older snapshot loses to the higher revision.
- **Three identities, three partial unique indexes.** All are partial on
  `txh_is_deleted = false` (so a soft delete frees the number for reuse), which
  is exactly why Prisma cannot see them and the module restates them:

  | Index | Key | Restated by |
  | --- | --- | --- |
  | `ux_txh_hold_no` | company + branch + year + doc type + `txh_hold_no` | `ensureHoldNoIsUnique` → 409 on `txhHoldNo` |
  | `ux_txh_device_slno` | company + branch + year + device + doc type + `txh_hold_slno` | `ensureHoldSlnoIsUnique` → 409 on `txhHoldSlno` |
  | `ux_txh_autosave` | year + device + operator + doc type, `WHERE kind = 'AUTOSAVE' AND status = 'HELD'` | `findLiveAutosave` → **upsert**, see below |

  `txhHoldNo` is the printed token number and `txhHoldSlno` the raw per-device
  counter behind it — split so an offline till can number a hold with no server
  round trip, the same split as `sale_order`'s `so_order_slno` / `so_order_refno`.
  Numbers are the device's, not the server's, which is why they are not drawn
  from `acc_voucher_seq` the way a bill number is. Both may be null, and Postgres
  treats NULLs as distinct, so unnumbered holds never collide with each other —
  `ensureHoldNoIsUnique` / `ensureHoldSlnoIsUnique` return early on one. An
  update re-runs each check whenever **any** column its index keys on moves. A `P2002` from two tills
  racing the same number is mapped to the same 409 rather than a 500.
- **`txhKind` decides what a row is.** `HOLD` appears in the pick list;
  `TEMPLATE` is copied on resume and never consumed; `AUTOSAVE` is the screen's
  own crash-recovery snapshot and behaves differently on write:
  - Posting a create with `txhKind=AUTOSAVE` **overwrites this screen's live
    snapshot in place** and bumps `txh_revision`, instead of creating a second
    row (which `ux_txh_autosave` would refuse anyway). That is what makes crash
    recovery an upsert: the screen posts every few seconds and the table does not
    grow without bound.
  - The overwrite does **not** rewrite the identity the row was created with
    (`txhHoldNo`, `txhHoldSlno`, scope) and cannot move the row out of
    `AUTOSAVE` / `HELD` — that is what keeps the next post finding this row
    rather than colliding with it.
  - `resume` refuses a `TEMPLATE` (400): leasing one would take a starting point
    out of circulation. Read it and create a hold from its payload instead.
- **The column rules live in this module too.** They mirror the `ck_txh_*`
  definitions and are judged on the **merged** row (payload first, stored row
  next, column default last), since a rule judges the row that will actually be
  written:

  | Constraint | Enforced by |
  | --- | --- |
  | `ck_txh_kind` | `TxnHoldKind` — `HOLD`, `AUTOSAVE`, `TEMPLATE` |
  | `ck_txh_src_module` | `TxnHoldSrcModule` — `SALES`, `PURCHASE`, `INVENTORY`, `ACCOUNTS`, `POS`, `SERVICE`, `OTHER` |
  | `ck_txh_doc_type` | `TxnHoldDocType` — the sales five, the purchase three, the two stock ones, `RECEIPT` / `PAYMENT` / `JOURNAL`, `OTHER`. Kept in step with `ck_tsl_src_doc_type` on `txn_status_log`, so one join reads a hold's status trail |
  | `ck_txh_status` | `TxnHoldStatus` — `HELD`, `LOCKED`, `RESUMED`, `CONVERTED`, `EXPIRED`, `CANCELLED`, `ABANDONED` |
  | `ck_txh_party_type` | `TxnHoldPartyType` — `CUSTOMER`, `SUPPLIER`, `EMPLOYEE`, `LEDGER`, `BRANCH`, `OTHER` |
  | `ck_txh_party_typed` | a `txhPartyId` needs a `txhPartyType` (the reference is polymorphic, so the type is the only thing naming the master). A type with **no** id is fine — a walk-in |
  | `ck_txh_amounts` | `txhItemCount` / `txhTotalQty` / `txhNetAmount` ≥ 0 — DTO decorators on the payload, `ensureValuesAreAllowed` on the merged row |
  | `ck_txh_expires_after_hold` | `txhExpiresOn` must be after `txhHoldOn` |
  | `ck_txh_printed` | `txhLastPrintedOn` is set exactly when `txhPrintCount > 0` |
  | `ck_txh_payload_object` | `txhPayload` must be a JSON **object** — not an array, not a scalar, not null |

  The enum sets are declared once in
  [types/txn-hold-api.types.ts](./types/txn-hold-api.types.ts) and consumed
  twice: as `@IsEnum` on the DTO (rejects the payload) and as
  `TXN_HOLD_VALUE_GUARDS` in the service (rejects the merged row, which is what a
  partial update actually writes). The columns stay plain varchars — none is a
  native PG enum. **Keep the enums in step with the constraints.**

  Two rules have no constraint counterpart, because a CHECK only ever sees one
  row:
  - **Terminal statuses are terminal.** A hold already `CONVERTED`, `EXPIRED`,
    `CANCELLED` or `ABANDONED` cannot be moved back to an open status (409).
    Reopening a converted hold would let the same parked work be billed twice.
    Resending the same terminal status is fine.
  - **The lease and the conversion trail are not the CRUD route's to write.**
    `ck_txh_lock_block` and `ck_txh_converted_block` are all-or-nothing, so half
    a block through a partial payload could only ever produce a raw 23514: those
    ten columns are absent from the save DTO, and a payload asking for
    `txhStatus=LOCKED` or `CONVERTED` is a 400 pointing at the endpoint that owns
    the transition.

  Reference checks, same place: `txhCompanyId` / `txhBranchId` on create,
  `txhDeviceId` (which must exist **and not be blocked** — `fk_txh_device` is
  RESTRICT and knows nothing about blocking), `txhHeldBy` against `user_master`,
  `txhSessionId` against `audit.user_login_sessions`, `txhStaffId` against
  `employee_master` (`fk_txh_staff`). `txhCounterId` is **not** validated: there
  is no counter master table in the schema yet, so it is carried as an opaque id.
- **`GET /txn-holds/list`** answers newest first (`txhHoldOn` desc, `txhId` desc
  as the tie-break) and never returns soft-deleted holds. Pass **`txhKind=HOLD`**
  for the operator-facing pick list — autosave snapshots and templates share the
  table. Filters: the scope (`txhCompanyId`, `txhBranchId`, `txhAccYear` — worth
  sending, it prunes to one partition), `txhKind`, `txhSrcModule`, `txhDocType`,
  `txhStatus`, `txhDeviceId`, `txhCounterId`, `txhSessionId`, `txhHeldBy`, the
  party (`txhPartyType`, `txhPartyId`, `txhPartyMobile`), `txhStaffId`,
  `holdOnFrom` / `holdOnTo`, `expired` (`true` → past `txhExpiresOn`; `false` →
  still valid, which includes holds with no expiry at all) and `stockReserved`.
  `ix_txh_pick_list` covers the company + branch + doc type + status + instant
  shape. A configured grid is used for the plain `search` + paging case only —
  sending any filter takes the query onto the module's own Prisma query, because
  the stored grid SQL cannot apply them.
- **Soft delete** sets `txh_is_deleted = true` and **leaves `txh_status` alone** —
  a deleted hold that had already been `CONVERTED` must keep saying so, and every
  read path filters on `txh_is_deleted` anyway. Rows are never physically removed.
- **`txh_is_stock_reserved` is a flag only.** Does this hold owe stock back? Who
  reserved it and when is a `txn_status_log` event; the reserved quantities are
  in the payload. A sweeper must release the reservation before retiring the row
  (`ix_txh_stock_reserved` is its queue).
- Audit entries are written under screen name **"Transaction Hold"**, screen type
  `transaction` (auto-created on first write). Each lease transition writes one
  `update` entry naming the device.

## The lease

A hold may be open on **one device at a time**, and the lock is a **lease**, not
an open-ended flag: `txh_locked_by` (the operator) / `txh_locked_device_id` /
`txh_locked_on` / `txh_lock_expires_on` / `txh_lock_token` are all-or-nothing
(`ck_txh_lock_block`), so every lock carries an end and a token that proves who
may release it. Ownership is matched on the **device** — two operators sharing a
till are the same holder, one operator on two tills is not.

```
HELD ──(resume)──▶ LOCKED ──(convert)──▶ CONVERTED
  ▲                   │
  └───(release)───────┘
```

- **Every transition is one conditional `updateMany`** — the status it is moving
  *from* (and, on release / convert, `txh_locked_device_id = <this device>` plus
  `txh_lock_token` when sent) sits in the WHERE clause, never in a preceding
  SELECT. Two tills resuming the same parked bill therefore serialize on the row:
  Postgres makes the loser re-evaluate the predicate against the winner's
  committed row, it matches nothing (`count = 0`), and the loser is told who
  holds it. A read-then-update would let both pass the check and both write. The
  service *does* read the row first, but only to snapshot the "before" side of
  the audit entry and to refuse a `TEMPLATE` — that read gates nothing, and the
  tests prove it by racing two resumes through `Promise.allSettled`.
- **Resume** (`HELD` → `LOCKED`) bumps `txh_resume_count`, stamps the whole lease
  block with a fresh `txh_lock_token` and an expiry `lockTtlSeconds` away
  (default 900, bounds 30 – 86 400), and answers the whole hold **including
  `txh_payload`** so the till can redraw the screen.
  - A hold whose lease has **already lapsed** is taken over without a
    force-release. That is the point of the lease: a till that died mid-edit does
    not strand the cart, and nobody has to know to intervene.
  - Under a **live** lease held by another device → **409** naming it and the
    instant it expires; already closed → 409.
  - Held by the **same** device → **200 without a second increment and without a
    longer lease**, so a retried request or a double tap is harmless — and a
    stuck till cannot keep a cart by retrying.
  - The caller must be authenticated: `txh_locked_by` is a uuid, so there has to
    be somebody to name as the holder (400 otherwise).
- **Release** (`LOCKED` → `HELD`) clears the whole lease block —
  `txh_resumed_by` / `txh_resumed_on` / `txh_resume_count` are history, not lease
  state. A hold that is already `HELD` answers 200 unchanged (the caller asked
  for the state it is in); one leased by another device, or by this device under
  a different token, is **403**.
- **Convert** (`LOCKED` → `CONVERTED`) stamps the conversion trail, drops the
  lease and closes the hold for good — it can never be resumed or billed again
  (409). There is **no converted doc type to send**: a hold becomes the document
  it was parked as, so the stored `txh_doc_type` already names the table
  `txh_converted_doc_id` points into. `txhConvertedAccYear` *is* required and
  travels with the id, because a March hold can become an April document and
  `ck_txh_converted_block` wants the whole trail (id + year + when + who) or none
  of it. No idempotent path: a device that does not hold the lease gets **403**
  and nothing is written.
- **Scope and soft delete are part of every lease query** (`txh_company_id`,
  `txh_branch_id`, `txh_is_deleted = false`, and `txh_acc_year` when the caller
  sends it), so a hold can be neither taken nor spent from another company,
  branch or year — those answer 404, the same as an unknown id, rather than
  confirming the row exists elsewhere.
- **`X-Device-Id` is a `fixed.device_master` uuid**, not the free-text till name
  the old table carried — `txh_locked_device_id` and `txh_device_id` are real FKs
  now. A missing or non-uuid header is a 400.
- **`force-release` is for what a lease cannot wait for**: a cart the floor needs
  back before the current lease lapses. It is the same conditional update **minus
  the ownership predicates** — a separate route rather than a flag on `/release`,
  because it is a decision to interrupt whoever holds the lease, not another way
  to give one back; `/release` therefore stays unconditionally ownership-checked.
  It cannot reopen a closed hold (409), an already-`HELD` one answers 200
  unchanged, and the audit entry names **both** devices. It also clears
  `RESUMED`, which is what "in use" means for a row driven through the CRUD
  route: such rows are otherwise stuck for good — un-resumable (409, not `HELD`)
  and un-releasable (403, no lease to match).
- **The lease clock and the expiry clock are different.** `txh_expires_on` is the
  sweeper's (when the hold itself may be retired, `ix_txh_expiry`); the lease is
  the till's. None of these paths reads or writes the expiry.
- The pick list already carries `txhStatus`, `txhLockedDeviceId`,
  `txhLockExpiresOn`, `txhCounterId` and `txhDeviceId` on every row (the payload
  mirrors the stored row, nothing is narrowed by a `select`), which is what a
  screen needs to grey out a `LOCKED` row and show "In use — &lt;device&gt;, until
  &lt;time&gt;".
- **Still not in scope here**: raising the document itself. `TxnHoldService` is
  exported from the module so the flow that bills a hold can call `convertHold`
  inside its own transaction.
