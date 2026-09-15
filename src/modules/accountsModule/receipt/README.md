# Receipt

Money received from a party, split across instruments, allocated due-date-first
against their open bills and any credit they hold.

**The whole module in one line:** every non-money line is a role-tagged leg, the
remainder is held as an ADVANCE bill, and one voucher carries today's money
while each post-dated cheque gets a voucher of its own dated the cheque — the
bills settling on maturity.

Implements *Receipt voucher — backend plan (NestJS)*, revision 3, 2026-09-14.
Section numbers below refer to it.

This module is the **first writer of voucher legs in this database**.
`accounts.acc_vouchers` and `accounts.acc_voucher_header` both held zero rows
before it, which is why the header-total derivation and the `av_role` column are
built here rather than having been built with the tables.

---

## Endpoints

All under `/api/v1/receipts`.

| # | Method | Path | What it does |
|---|---|---|---|
| 1 | `GET` | `/open-items` | Everything a party owes and everything of theirs the company holds |
| 2 | `GET` | `/party-context` | Their last ten receipts, and their cheques still in flight |
| 3 | `POST` | `/create` | Save a draft. Upsert on `avhVoucherId` |
| 4 | `POST` | `/post` | The one-way door. One transaction, fifteen ordered steps |
| 5 | `GET` | `/get` | One receipt in full — also the print dataset |
| 6 | `POST` | `/cancel` | Reverse it — the receipt and every PDC voucher |
| 7 | `PUT` | `/update-header` | The optional one. Narration and references on a posted receipt |
| — | `POST` | `/regularise-pdc` | Maintenance. Matured post-dated settlements into the bills. **For cron** |

### Not built, on purpose

`POST /receipts/approve` · `POST /receipts/reject` · `GET /receipts/list`

There is **no approval step**: a receipt is DRAFT, then POSTED, then CANCELLED,
and `/post` runs straight from the DRAFT. And there is **no list route** — the
list is a registered grid (below).

### The four keys

Every route that acts on an existing voucher takes
**`avhCompanyId · avhBranchId · avhAccYear · avhVoucherId`**.

The year is not optional because `acc_voucher_header` is partitioned on it, so
`(avh_voucher_id, avh_acc_year)` is the primary key and an id alone does not
name a row. The company and the branch are not redundant with that: a uuid is a
bearer token, and without them anyone holding one could read, post or cancel a
receipt belonging to a company they have no business in. A mismatch is a **404,
not a 403** — a caller scoped elsewhere should not learn that this receipt
exists.

The same pairing rule applies to every bill reference: `billId` always travels
with `billAccYear`.

### One `partyId`

A customer id, a supplier id and a ledger id are **the same value**. A customer
is created by copying the new ledger's `led_id` into `cus_id` —
`CustomerService.create` says so in as many words, *"reuse its led_id as the
customer's cus_id so the two masters share one identity"* — and
`purchase.suppliers` does the same. So the receipt takes one `partyId`,
resolves nothing, and has no bridge column that could be missing. A `partyId`
naming no live ledger is simply not a party, and `loadParty` says that.

---

## Files

| File | Holds |
|---|---|
| `allocation-engine.ts` | §5.2 step 5. **Pure.** Inputs → adjustment rows. The only place allocation is decided |
| `ppd-slab.ts` | R16. **Pure.** Bill age + slabs → suggested discount |
| `receipt-posting.service.ts` | §5.2 — THE transaction |
| `receipt-cancel.service.ts` | §5.3 — the mirror of it |
| `receipt.service.ts` | §5.1 draft, §4.3a approve/reject, §4.5 get, §5.4 header edit |
| `open-items.service.ts` | §4.1 and §4.2 — everything the screen reads before a figure is keyed |
| `receipt-lines.ts` | §5.1 rules 3–4 — tenders and other-ledger lines, normalised. Shared by draft and post |
| `receipt-draft-lines.ts` | What `avh_draft_lines` holds, and why it holds two things |
| `receipt.guards.ts` | The checks no single endpoint owns — the year, the party, the row locks |
| `receipt.settings.ts` | §2.8's seven settings, read through the resolver |
| `receipt-ledger-roles.ts` | Every ledger found by ROLE, never by name |
| `receipt.utils.ts` | The arithmetic — Decimal end to end, and the pro-rata that sums exactly |
| `dto/receipt-response.dto.ts` | Every response shape, for Swagger. Each class `implements` its interface, so a field added to one and missed here is a compile error |

Two pieces live outside the module because they do not belong to it:

| File | Holds |
|---|---|
| `../billBalance/bill-balance-recompute.service.ts` | `fn_abl_recompute` + `fn_abl_regularise_pdc`, in TypeScript |
| `../accountVoucherHeader/voucher-totals.helper.ts` | `fn_avh_refresh_totals`, in TypeScript |

---

## The list is a registered grid

`fixed.grid_details` row **`MAIN LIST - RECEIPTS`**, added by migration
20260915120000, with the four key columns present and hidden
(`avh_voucher_id`, `avh_company_id`, `avh_branch_id`, `avh_acc_year`), then
refno, date, party, received, adjusted, on-account, instruments summary, PDC
count, status (filterable), your-ref, remarks, reversal refno, created-by and
created-on.

Run it through `/configured-grid-sql` — which is how every other main list here
works, and what makes the operator's saved column widths, filters and
visibility apply to it. A `findMany` in this module would be a second
definition of the same list with none of that.

Post-dated cheque vouchers do **not** list separately: the grid admits only
headers with no `avh_against_voucher_id`, so they show under their receipt. A
CANCELLED receipt still lists, with its reversal's number beside it.

`grid_id` is a serial and differs between environments — resolve it by name.

---

## §2.4 — the header totals are now DERIVED

This is the fix the endpoint sheet singles out, and it was wrong in the first
draft of this module.

`ck_avh_balanced` is

```sql
CHECK (avh_voucher_status <> 'POSTED' OR avh_total_debit = avh_total_credit)
```

and while `avh_total_debit` / `avh_total_credit` are **stamped** by whoever
writes the header, that constraint compares two numbers the writer chose
against each other — so it cannot fail. A writer that stamps 25,200 / 25,200
passes it while having written legs that come to 25,200 / 24,200. A writer that
sets POSTED before the legs exist passes it comparing 0 with 0.

Migration 20260915120000 adds `accounts.tr_av_refresh_totals` on
`acc_vouchers`, so both columns are derived from the legs and **nothing in the
application may write them**. Proven end to end: a header stamped 99999 /
11111 is corrected to 6000 / 0 by the first leg; POSTED with debit ≠ credit is
then refused by the constraint; the balancing leg makes it pass.

A trigger and not a helper, because the check has to hold for **every** writer
of `acc_vouchers` — the payment voucher, the journal, the contra, every
accounts screen after this one. A TypeScript helper protects the callers that
remember to call it; a trigger protects the table.

`deriveVoucherTotals()` survives as a **read**: the posting service re-derives
the totals just before it flips a header to POSTED and refuses with *"rct00018
is out by 1000.00"* rather than letting the constraint answer with a 23514 that
names nothing.

**One consequence worth knowing before you meet it:** soft-deleting a leg of a
POSTED voucher now fails, because the totals follow and the header stops
balancing. That is the point, and it is why cancelling writes a reversal
voucher instead of deleting anything.

---

## §2.1 is still TypeScript

| Plan asks for | This repo has |
|---|---|
| `fn_abl_recompute` + `tr_abj_refresh_balance` | `BillBalanceRecomputeService.recomputeBills(tx, bills, asOf)` |
| `fn_abl_regularise_pdc` + cron | `BillBalanceRecomputeService.regularisePostDated(asOf)`, exposed as `POST /receipts/regularise-pdc` |

**What is gained:** one round-trip per receipt instead of one per row; the same
transaction and snapshot as the rows being summed; failures that name a bill
instead of a SQLSTATE.

**What is lost, stated plainly:** a trigger cannot be forgotten and a service
can. A row written into `acc_bill_adjustment` by hand, by psql, or by a future
module that forgets to call the recompute leaves `abl_alloc_amount` stale, with
no database-level backstop. Every writer must call it.

If that trade reads worse for `acc_bill_adjustment` than it did for
`acc_vouchers` — and the argument is the same one — say so and it becomes a
trigger too. §2.4 was singled out; §2.1 was not.

---

## Wire the cron

```
5 0 * * *  curl -fsS -X POST https://<host>/api/v1/receipts/regularise-pdc \
             -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{}'
```

It sweeps everything maturing **on or before** the date, not only on it, so a
run after an outage repairs every day that was missed. Idempotent. `/post` also
runs the recompute for any cheque dated today or earlier, so nothing waits for
midnight.

---

## Seven things that are easy to get wrong

### 1. A credit applied posts NO voucher leg

§5.2 step 9 lists "the credit-applied pair (DR party / CR the credit's liability
ledger)" among the legs. **That pair is not posted**, and posting it would break
the books. The arithmetic, with `M` = instant money, `D` = settling deductions,
`X` = other DR lines that settle nothing, `Y` = other CR lines, `C` = credits
applied, `A` = Σ allocations, `O` = on account, `d` = discount, `w` = write-off:

```
the identity (§5.2 step 4):   M + D + X + C = A + O + Y
the ledger, party leg:        party CR = M + D + X + d + w − Y
the bill sub-ledger:          party CR = (A + d + w) + O − C
```

Substituting the first into the third gives exactly the second. They agree —
with no leg for the credit. Add the pair and the party ledger comes out `C`
short of the bill sub-ledger on every receipt that applies one, and a liability
ledger grows by `C` every time an advance is *consumed*.

The "pair" the plan means is real, but it is the pair of
`acc_bill_adjustment` rows — one on the bill being settled, one on the credit
being spent — which `ck_abj_against` requires and which the engine emits.

`allocation-engine.spec.ts` proves the invariant directly: *party CR equals what
the bills received, on every voucher*.

### 2. A post-dated row is written today and counts later

`abj_is_post_dated` + `abj_adj_date` in the future = excluded from
`abl_alloc_amount`. That single exclusion is the whole of R2: the cheque's
voucher, its legs and its adjustment rows are all written at post, and the bill
nevertheless stays open until the cheque matures. Nothing is re-posted on the
day; the row was always there, it simply started counting.

Which means **a bill's pending amount is a function of the date.** A bill whose
only cheque matures tomorrow becomes CLOSED at midnight with no writer involved.
`regularisePostDated` is what makes that visible in the stored columns.

The corollary that catches people: a reversal row must **copy** the original's
`abj_is_post_dated` and `abj_adj_date`. Dating it today so the bill "reopens at
once" drives `abl_alloc_amount` negative on an un-matured cheque and
`ck_abl_settled` refuses the write.

### 3. `pdcHeld` is why a bill does not get collected twice

A bill settled entirely by a cheque maturing next week shows its **full** pending
amount — correctly, because the money has not arrived. Without a column saying
why, it is indistinguishable from a bill nobody has paid, and the operator
collects it again. `open-items` returns `pdcHeld` per bill for exactly that.

### 4. Deductions are placed before credits, though §5.2 lists them after

A deduction is bill-**specific**; money is fungible. TDS withheld on bill 2
belongs on bill 2. If credits ran first they would fill bill 1 completely and a
pro-rata deduction would have no room on the bill it was actually withheld from
— §9's *"unpinned spreads pro-rata and sums exactly"* would be unsatisfiable.
So deductions RESERVE their share first, and the stated order
(credits → instant money → current cheques → post-dated by date) then governs
everything that fills what is left. It is the only reading with a solution.

### 5. Everything the client sends to `/post` is a preview

The server re-reads every bill under `SELECT … FOR UPDATE`, re-runs the engine
and refuses a mismatch. `onAccount` is the single figure that proves the client
and the server read the same receipt. Two concurrent posts against one bill: the
second blocks on the lock, re-reads after the first commits, and gets a **409
naming the bill and its current pending amount** — never a 500.

### 6. Ids that are serials are never hard-coded

`vchr_type_id`, `grid_id` and `dropdown_id` are all serials and differ between
the dev box and the live one. The receipt voucher type is resolved by
`vchr_type_code = 'Rct'`; the list grid by
`grid_name = 'MAIN LIST - RECEIPTS'`. A hard-coded id would post receipts as
whatever document type happens to hold that number in production.

### 7. `avh_src_*` stays empty on a keyed receipt

`avh_src_module` / `_doc_type` / `_doc_id` are covered by a UNIQUE index
(`ux_avh_src`) for every non-cancelled row, because they exist to make posting
a *source document* idempotent. Anything filed there that is not unique per
receipt would permit exactly **one receipt per that thing per year** and refuse
the second as a duplicate — a customer id, for instance, which is what an
earlier draft of this module tried.

They are left empty, and kept for the collection import
(`avh_src_doc_type = 'COLLECTION'`), which is what they are for.

---

## Deviations from the plan, and why

| § | Plan says | This does | Why |
|---|---|---|---|
| 5.2 step 9 | Credit applied posts DR party / CR liability | No leg; the bill-adjustment PAIR only | The pair unbalances the party ledger against the bill sub-ledger by the credit amount. See §1 above |
| 5.2 step 5 | credits → deductions → money | deductions reserved first, then that order | Pro-rata deductions are otherwise unsatisfiable. See §4 above |
| 2.1 | plpgsql trigger | TypeScript service, called explicitly | Asked for. Cost stated above. **§2.4 is a trigger** |
| 5.1 rule 4 | Server seeds a TDS / TCS line | Server **reports** the expectation; seeds only the instrument splits | There is no TDS or TCS **rate** anywhere in this schema — only `led_is_tds_applicable`, `led_tds_deductee_type`, `led_is_tcs_applicable` and `comp_tds_applicable`. No rate, no amount to seed. `expectedRoles` on the draft payload names them and the screen prompts |
| 2.6 | `avh_draft_lines` holds the other-ledger lines | It holds `{ otherLines, cheques }` | A draft cheque's branch, IFSC, MICR, drawer and deposit bank have no columns on `acc_tender_detail` and are needed by `acc_pdc_register` at post. See `receipt-draft-lines.ts` for the two alternatives and why both are worse. The bare-array form is still read |
| 2.12 | A new "CUSTOMERS BY AREA" dropdown | Done, id **54**. Dropdown 39 untouched | Narrowing 39 would narrow every other screen using it |
| 2.7 | Five new roles | Five new roles, plus `ck_alr_group` widened with a `RECEIPT` band | The existing CHECK admits six group names and none of them fits. The payment voucher adds `PAYMENT` the same way |
| — | (not mentioned) | `public.ensure_acc_year_partitions` extended, and back-filled | See below |

### Withdrawn on 2026-09-15, after the first build

| what | why it went |
|---|---|
| `/approve`, `/reject`, `um_can_approve`, `accounts.receipt_needs_approval` | There is no approval step. DRAFT → POSTED → CANCELLED, and `/post` runs from a DRAFT |
| `GET /receipts/list` | The list is a registered grid; the route was a second way to find the same thing |
| `POST /receipts/sync-print-count` | `avh_print_count` is a cache `public.print_log` owns; the receipt has no business writing it |
| `sales.customers.cus_ledger_id` | `cus_id` **IS** `led_id`. The bridge pointed a column at the value already in the row beside it — `CustomerService.create` even set it to `ledger.ledId`, the same id it had just assigned to `cus_id` |

### The partition gap, found while building this

`accounts.acc_voucher_header` and `accounts.acc_vouchers` are LIST-partitioned
on their accounting year, and `public.ensure_acc_year_partitions()` — the
function every other partitioned table in this database is created by — **did
not know about either of them**. Only the 2026-2027 partition existed, made by
hand, and nothing noticed because `acc_vouchers` held zero rows.

The receipt is the first document that routinely writes into a year that is not
the current one: a post-dated cheque dated 2 April posts its own voucher in the
next year (R2). Without the fix that is a raw *"no partition of relation
acc_voucher_header found for row"* at the moment an operator is taking cheques —
and every receipt keyed after the next year-end would fail the same way.

Migration 20260915120000 restates the function with the two tables appended and
back-fills the years the other partitioned tables already have.
`assertVoucherPartitionExists` in `receipt.guards.ts` is the belt to that
braces: a database that has not had the migration applied is refused with a 400
naming the year and the function to run, instead of a 500.

### Figures in §9 that could not be reconciled

`receipt_flow.md` is not in this repository, so the worked example §9 checks
against could not be read. The figures quoted in §9 are **not mutually
consistent** — §4.4's payload (allocations 48,600 + 11,650, credits 4,000,
onAccount 14,450, tenders 70,000) implies deductions of 700, while §4.3's
payload carries 1,060 of DR other-lines and §9's last bullet states 1,400. The
three cannot all be true of one receipt.

The engine is therefore built to the **rules** in §5.2 and §4.4, not to those
arithmetic examples, and `allocation-engine.spec.ts` tests the rules. When
`receipt_flow.md` surfaces, its worked example should be added as a test; if it
disagrees with this engine, the engine is what is wrong.

---

## Settings (§2.8)

All `asd_max_scope = 'BRANCH'`, module `ACCOUNTS`, read through
`AppSettingValueService.resolveEffective` and never by querying
`app_setting_value` — re-merging the GLOBAL < COMPANY < BRANCH < DEVICE < USER
precedence here would make this screen and the settings screen disagree.

| Key | Values | Default |
|---|---|---|
| `accounts.pdc_posting_mode` | `ON_RECEIPT` / `ON_CLEARING` | `ON_RECEIPT` — **`ON_CLEARING` is refused at post**; it belongs with menu 51 |
| `accounts.receipt_bill_sort` | `DUE_DATE` / `BILL_DATE` | `DUE_DATE` |
| `accounts.receipt_salesman_mandatory` | bool | `false` |
| `accounts.writeoff_approval_above` | decimal | `0` — every write-off needs an approver |
| `accounts.tcs_basis` | `RECEIPT` / `SALES` | `RECEIPT` |
| `accounts.ppd_slabs` | JSON `[{days,perc}]` | `[]` |

Every reader falls back to the seeded default rather than to an extreme. A blank
value, a token outside the catalogue, or a key a database one migration behind
must not stop an operator taking money.

---

## Do not build

- **No in-place edit of money** on a POSTED receipt. Cancel and re-enter.
- **No stamped totals.** `avh_total_*` from the legs, `avh_doc_amount` from the
  tenders, `avh_adjust_amount` from the adjustment rows.
- **No adjustment rows for a DRAFT**, and no writes to
  `abl_alloc/_disc/_writeoff` — the recompute owns them.
- **No allocation logic in two places.** `allocation-engine.ts` is the only one;
  the client previews with a port of it.
- **No ledger-name lookups.** Roles through the map, `av_role` on the leg.
- **No `acc_voucher_cheques` rows.** One cheque table: `acc_pdc_register`.
- **No second SELECT for "what does this party owe".** `open-items` is it, and
  `/transactions/party-balance` calls it.
- **No paging on `open-items`.** A capped list is a wrong collection, not a slow
  one.
- **No re-seeding of the PPD discount at post.** The slab suggests once, on
  `open-items`; what the operator left is what posts.
- **No batch endpoint.** N receipts are N posts.
- **No approval step.** DRAFT → POSTED → CANCELLED.
- **No `/list` route**, and no second query for the list — the grid is it.
- **No stamped `avh_total_*`.** The trigger owns them; writing them would put
  `ck_avh_balanced` back to comparing a writer's claim with itself.

---

## Not in this phase

Received Cheques (menu 51: deposit / clear / bounce / replace), `ON_CLEARING`
posting, the Payment voucher (menu 100 — the same module with `td_dr_cr = 'CR'`,
`apd_tra_type = 'P'` and PURCHASE bills), Collection Entry / Approval
(187 / 188), bank reconciliation (`av_recon_date` is the hook) and a day-close
lock (`fy_lock_date` is the only lock).

The `acc_pdc_register` rows this module writes, and the `HELD` status they carry,
are exactly what menu 51 is built on.
