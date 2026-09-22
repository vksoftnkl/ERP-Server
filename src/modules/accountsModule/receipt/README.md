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
| 2 | `GET` | `/party-context` | Their last ten receipts, their cheques still in flight, and their totals |
| 2a | `GET` | `/adjacent` | The receipt entered just before or just after this one (R-B4) |
| 2b | `GET` | `/duplicate-check` | "Has this party already paid this much today?" A warning, never a refusal (R-B6) |
| 3 | `POST` | `/create` | Save a draft. Upsert on `avhVoucherId` |
| 4 | `POST` | `/post` | The one-way door. One transaction, fifteen ordered steps |
| 5 | `GET` | `/get` | One receipt in full — also the print dataset |
| 6 | `POST` | `/cancel` | Reverse it — the receipt and every PDC voucher |
| 7 | `PUT` | `/update-header` | The optional one. Narration and references on a posted receipt |
| 8 | `POST` | `/delete` | Throw a DRAFT away. The four keys, no reason |
| 9 | `POST` | `/amend` | Restate a POSTED receipt in place. **Behind a company setting, default OFF** |
| — | `POST` | `/regularise-pdc` | Maintenance. Matured post-dated settlements into the bills. **For cron** |

### Not built, on purpose

`POST /receipts/approve` · `POST /receipts/reject` · `GET /receipts/list`

There is **no approval step**: a receipt is DRAFT, then POSTED, then CANCELLED,
and `/post` runs straight from the DRAFT. And there is **no list route** — the
list is a registered grid (below).

### `/delete` is not `/cancel` under another name

They cover **disjoint statuses** and do opposite things, and each refuses the
other's with a 409 naming the route that applies.

| | `/delete` | `/cancel` |
|---|---|---|
| Applies to | DRAFT | POSTED |
| Takes | the four keys | the four keys **and a reason** |
| Writes | `avh_is_deleted` on the header, its tenders | a numbered REVERSAL voucher, negative adjustment rows, reopened bills |
| Status after | DRAFT, unchanged | CANCELLED |
| Trail | `DELETED` in `txn_status_log` | `CANCELLED`, plus the reversal in the day book |

The asymmetry is the point. A POSTED receipt took a number, wrote legs into the
day book and adjustment rows against bills, and every one of those has to be
**answered for** — so `ck_avh_cancel` refuses a CANCELLED voucher with no
reason, and the reversal is a real voucher the day book for the day of the
cancellation shows. A DRAFT wrote none of it (R10): no number, no legs, no
adjustment rows, not even an `acc_pdc_register` entry. Abandoning one is
abandoning a piece of paper on a desk, and asking the operator to justify it is
asking them to justify a typo.

`/cancel` refusing a DRAFT is correct — there is nothing to reverse — but it
left an abandoned draft **permanent**, with the only way past it being to post
a receipt nobody wanted. That is what this route is for.

The schema already agreed with this before the route existed:
`ck_tsl_reason_required` names **CANCELLED, CLOSED and REJECTED** as the three
events that must say why, and `DELETED` is deliberately not among them.

**The status column is left at DRAFT.** `DELETED` is an *event*, not a status:
`avh_voucher_status` has no such value, and stamping CANCELLED instead would
put a receipt that was never posted into the cancelled list beside receipts
that were — with no reason against it, which `ck_avh_cancel` would refuse
anyway. `TxnStatusEvent.DELETED` exists to draw exactly this distinction.

**`avh_draft_lines` is left intact**, not nulled. The other-ledger lines and
cheque details *are* the deleted draft's contents, and a "soft" delete that
destroys them is a hard delete that kept the key. The header's
`avh_is_deleted` already takes them out of play: every reader in this module
goes through `loadHeaderOrThrow`, which refuses a deleted row.

One check guards the whole route: a DRAFT with legs or adjustment rows against
it is **refused, not deleted**. It cannot happen if R10 holds, and if R10 ever
stops holding — a post that failed between writing legs and flipping the
status — deleting the header would orphan rows the bills are still netting
against. Refusing with counts is recoverable; deleting is not.

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
| `receipt-amend.service.ts` | R20 — the unwind-and-re-apply. Orchestrates the two above; reimplements neither |
| `receipt-unwind.guards.ts` | The two refusals `/cancel` and `/amend` MUST share, in one place |
| `receipt-cheque-links.ts` | "What belongs to this receipt?" — its cheques, and the vouchers it raised. Neither is answered by a column pointing at it |
| `receipt.service.ts` | §5.1 draft, §4.3a approve/reject, §4.5 get, §5.4 header edit |
| `open-items.service.ts` | §4.1 and §4.2 — everything the screen reads before a figure is keyed |
| `receipt-lines.ts` | §5.1 rules 3–4 — tenders and other-ledger lines, normalised. Shared by draft and post |
| `receipt-draft-lines.ts` | What `avh_draft_lines` holds — other lines, cheque detail, and the remembered settlement |
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

Migration 20260915120000 §11 adds `accounts.tr_av_refresh_totals` on
`acc_vouchers`, so both columns are derived from the legs and **nothing in the
application may write them**. On a database that has it: a header stamped
99999 / 11111 is corrected to 6000 / 0 by the first leg; POSTED with debit ≠
credit is then refused by the constraint; the balancing leg makes it pass.

> ### ✅ Installed 2026-09-17 by migration 20260917170000 — and how it was missed
>
> It was **absent from this database until then**, and the section above
> overstated it for two days. Verified before the fix: `pg_trigger` had no
> trigger on `accounts.acc_vouchers`, neither `fn_avh_refresh_totals` nor
> `fn_avh_recompute_totals` existed in any schema, and **39 POSTED vouchers had
> live legs reading 0 / 0** — so `ck_avh_balanced` was comparing 0 with 0 on
> every one of them, which is the exact hole this section exists to close.
>
> **Nothing was half-executed.** §11 was *appended to the migration file after
> that migration had already been applied*, so Prisma had it recorded as applied
> and would never run the added text — `20260915130000` lines 17–24 and 123–130
> say so in as many words. The DDL was well-formed; the database simply never
> saw it.
>
> `20260917170000_install_missing_voucher_totals_trigger` carries that tail
> verbatim, so there is one definition of the arithmetic. After it: the trigger
> and both functions are present, all 39 headers back-filled from 0/0 to their
> true figures, and **zero POSTED headers unbalanced**. Probed on `rct00033` in
> rolled-back transactions — retiring the CR legs alone is refused by
> `ck_avh_balanced`, and so is tampering with one leg's amount.
>
> **The lesson, since it has now cost two days twice over: never edit a
> migration that has been applied anywhere.** The added text runs on fresh
> databases and silently never runs on existing ones — the file claims the
> object exists, every environment that ran it before the edit disagrees, and
> nothing reports the difference. `prisma migrate status` will not tell you;
> read the objects back. An audit of all 342 recorded migrations found **five**
> with checksum drift, of which this was the damaging one.

A trigger and not a helper, because the check has to hold for **every** writer
of `acc_vouchers` — the payment voucher, the journal, the contra, every
accounts screen after this one. A TypeScript helper protects the callers that
remember to call it; a trigger protects the table.

`deriveVoucherTotals()` survives as a **read**: the posting service re-derives
the totals just before it flips a header to POSTED and refuses with *"rct00018
is out by 1000.00"* rather than letting the constraint answer with a 23514 that
names nothing.

**One consequence worth knowing before you meet it** — on a database that HAS
the trigger, and stated more carefully than it was here originally: soft-deleting
a leg of a POSTED voucher may fail, because the totals follow and the header can
stop balancing. That is why cancelling writes a reversal voucher instead of
deleting anything.

It is not the blanket rule the old wording claimed. PostgreSQL queues AFTER-ROW
triggers to the **end of the statement**, so one `UPDATE` that retires *every*
leg of a voucher leaves the totals at 0 / 0, which balances and is **accepted**
while POSTED; only a one-sided subset is refused. Verified against rct00039 —
first with the trigger simulated in a rolled-back transaction, then re-run
against the real trigger after `20260917170000` installed it, same result both
times. See the R20 section for what `/receipts/amend` relies on instead.

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

## §2.13 / §2.14 — bill-wise TCS, and the 27EQ / 26Q register

Added to the endpoint sheet on 2026-09-15, built by migration
**20260917160000_receipt_tcs_tds_registers**. Three things:

| | what | where |
|---|---|---|
| §2.13 | `acc_bill_balance.abl_tcs_amount`, `numeric(14,2)` default 0 | the column the invoice stamps |
| §2.13 | `accounts.v_bill_tcs` | collected / pending, pro-rata of the allocation |
| §2.14 | `acc_tcs_register` · `acc_tds_register` | the quarterly return projection |

`/receipts/open-items` therefore returns two more fields per bill —
**`tcsAmount`** and **`tcsPending`** — both 0 unless `accounts.tcs_basis` is
`SALES`.

### The premise the sheet states does not hold yet

The sheet says `abl_tcs_amount` is *"stamped by the sale bill when it raises
the `abl_` row, from the same figure it already puts in `gdr_tcs_value`"*. As
at this migration that is not true, and nothing was invented to make it true:

- **nothing writes `acc_voucher_doc_register.gdr_tcs_value`.** The table holds
  zero rows.
- **the sale bill has no TCS column of its own** — there is no `sb_tcs_*` —
  and computes no TCS figure anywhere.
- **there is no TCS rate anywhere in this schema.** `led_is_tcs_applicable`,
  `comp_tcs_applicable` and `cus_tcs_applicable` are *flags*: they say the
  party is in scope, not what to charge. This is the same gap already recorded
  above against §5.1 rule 4 — *no rate, no amount to seed*.

So the column lands with `DEFAULT 0` and every existing bill reads 0, which is
the truthful value: no TCS has been charged on any of them. The view and both
registers are built in full, so when a rate master exists the only work left is
the stamp itself. Building the column now is deliberate — it has to exist
before a bill can carry the figure, and adding a column to a partitioned table
with rows in it is the expensive half.

### Why the split is pro-rata

A part payment against a bill is a payment against the **whole** bill. The
customer does not choose to pay for the goods and withhold the tax, and the
department does not accept that they did. So a 50% collection has collected 50%
of the TCS — the only reading that leaves the liability proportional to the
money actually received, which is what 206C(1H) charges on.

Discount and write-off are deliberately **not** in the collected base: only
`abl_alloc_amount` counts, because TCS is collected on money received and
neither of those arrived.

`tcs_collected + tcs_pending = abl_tcs_amount` **exactly**, by construction —
pending is the remainder of the same rounding, never its own pro-rata, so a
half-paisa cannot land in both or neither. Verified on the dev database: 24 of
24 rows satisfy it, and a bill 3.16% paid with 9.50 of TCS charged reports 0.30
collected and 9.20 pending.

### Why a view and not two more columns

Both figures are functions of `abl_alloc_amount`, which
`BillBalanceRecomputeService` rewrites on every post, cancel and PDC maturity.
A stored column would be a second copy of a derived number with a second writer
to forget, and it would go stale the instant a reversal landed — exactly the
failure mode §2.1 above describes for `abl_alloc_amount` itself. The arithmetic
is three multiplications on a row already being read.

### The registers are written at post, never edited, never re-summed

A row is a statement about a moment: at the instant this document posted, this
much tax was collected at this rate on this base for this PAN. A quarterly
return is a `SELECT` over these rows and **not** a re-derivation from the
invoices — because the rate that applied in July is not the rate that applies
in November, and a return that recomputed would silently restate a quarter
already filed with the department.

So there is no update path and no roll-up column. A cancelled or amended
document gets a **new** row carrying the reversal (`atc_reversal_of_id`,
negative tax, enforced by `ck_atc_reversal_sign`), the way
`acc_bill_adjustment` does. The original stays, because the return that quoted
it was filed.

`*_rate_source` is declared with **four** values — `MASTER`, `CERTIFICATE`,
`NO_PAN`, `BELOW_THRESHOLD` — though only three can occur until a
lower-deduction certificate can be recorded against a party. `CERTIFICATE` is
there now because a reduced rate with no recorded reason is indistinguishable
from a keying error when the department asks two years on.

### Which document raises the row

206C(1H) liability arises on **receipt** of the money, not on the invoice:

- `tcs_basis = 'RECEIPT'` — the receipt raises the `TCS_PAYABLE` leg and the
  register row, for the whole receipt.
- `tcs_basis = 'SALES'` — the invoice already carries the TCS inside its bill
  amount, so the receipt raises **no TCS leg at all**, and the register row is
  raised at the receipt for the TCS slice of that allocation.

The two never both apply.

### These two tables are NOT partitioned

Every other accounts transaction table is LIST-partitioned on its accounting
year. These are not, on purpose: every read is one company, one FY, one quarter
— which an index serves exactly, with no scan-every-partition read like "this
party's outstanding across all years" to justify it; nothing addresses a
register row by `(id, year)`; and nobody detaches a filed quarter, because the
department can ask for it years later.

The practical gain is that they need no `ensure_acc_year_partitions` call, so
they cannot fail a receipt at the moment an operator is taking money — which is
the failure the partition gap above describes.

### Still to do

The register **write** at post is not wired: `receipt-posting.service.ts` does
not yet insert `acc_tcs_register` rows, because there is no rate to write. That
is the same blocker as the stamp, and both unblock together the day a TCS rate
master exists.

---

## Wire the cron

```
5 0 * * *  curl -fsS -X POST https://<host>/api/v1/receipts/regularise-pdc \
             -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
             -d '{"companyId":"<company uuid>"}'
```

**One call per company.** `companyId` is required (R-B1): the route used to take
nothing but `asOf`, so a single authenticated call regularised every company in
the database — idempotent, and still a write across a tenant boundary.

`branchId` and `accYear` are filters and are **not** the house keys here. Leave
both out of the cron. Outstanding is company-wide and a bill raised at one
branch is settled at another; and `acc_bill_balance` is partitioned by the year
the bill *originated* in and is never carried forward, so a sweep pinned to this
year walks past nearly everything it exists to find.

`billsRegularised` counts bills whose stored figures actually **moved**, so a
second run over the same data reports `0`. It used to report the size of the
batch, which told an operator nothing about whether the run had done anything.
`billsExamined` sits beside it so a `0` reads as "nothing left to do" rather
than as "nothing ran".

It sweeps everything maturing **on or before** the date, not only on it, so a
run after an outage repairs every day that was missed. Idempotent. `/post` also
runs the recompute for any cheque dated today or earlier, so nothing waits for
midnight.

---

## Nine things that are easy to get wrong

### 0. A DRAFT remembers its allocation, and still touches no bill

Reopening a draft used to lose the bill-wise settlement — the tenders and the
other lines came back, the allocation did not — so every reopened draft was
re-settled by hand. Alt+A covers "spread down the bills, oldest first" and
nothing else: not a split, and not a deliberate out-of-order settlement, which
is exactly the receipt somebody saves as a draft to think about.

`/receipts/create` now takes optional `allocations[]` and `creditsApplied[]` in
the same shape `/post` takes them, stores them in `avh_draft_lines` beside
`cheques` and `otherLines`, and `/receipts/get` hands them back **for a DRAFT
only**.

**R10 is not undone.** No `acc_bill_adjustment` row is written and no
`abl_pending_amount` moves. The allocation is *remembered*, not applied — which
is what keeps two people able to hold drafts against the same party without
reserving each other's outstanding, and what keeps an abandoned draft free of
cleanup.

**It is a suggestion, and it is deliberately not validated** — on the way in or
the way out. Somebody else may settle the same bill between the save and the
reopen, so a remembered 5,000 against a bill now showing 1,200 pending is
stale, and it is handed back stale. The screen re-reads `/receipts/open-items`
on reopen and clamps. Refusing the load would cost the operator the whole draft
to save one figure.

`/post` and `/amend` never read it. They use the payload they are given, and
`/post` nulls the column at step 15.

Three things the client should know about the shape:

- **`abjId` is `null`** on every remembered row. Nothing is written until the
  receipt posts, and that null is the signal. Never send it back.
- **Discount and write-off come back as their own DISCOUNT and WRITEOFF rows**,
  because that is what a post writes — so one rendering path paints a reopened
  draft and a posted receipt.
- **A `creditsApplied` row names the CREDIT in `billId`, with `againstBillId`
  null.** On a POSTED receipt the two are the other way round. That is not an
  inconsistency to be smoothed over: which invoices a credit settles is the
  allocation engine's decision at post, and a draft has not run it.

`docRefno` and `docDate` are filled by one lookup of the named bills. That is a
convenience so a row can label itself, not a check: a row whose bill has been
deleted still comes back, with a blank refno and a null date — and that is
precisely the row the operator needs to see.

### 0b. A receipt may round a bill off

Reported as "received 10, disc 1, r.off 1 but i cant post", and it was exactly
that: the round-off had nowhere to go. `PostReceiptAllocationDto` carried
`amount`, `discount` and `writeoff` and nothing else, so a client folded the
round-off into `amount` — which the engine reads as **money** — and §5.2 step 4
refused the receipt as *"Out by -1.00"*. The figure was right; there was no box
for it. `ROUND_OFF` was not an acceptable other-line role either, so both doors
were shut.

`roundoff` now sits beside `discount` on the allocation and behaves exactly
like it: it settles the bill, posts its own DR leg to the ROUND_OFF ledger
(which `accounts.acc_ledger_map` has pointed at a real "Round Off" account all
along), and is **not** money received. So `10` received with `discount: 1` and
`roundoff: 1` settles the bill by 12 and posts DR Cash 10 / DR Discount Allowed
1 / DR Round Off 1 / CR party 12.

**Positive only.** Not an oversight: `ck_abj_reversal_sign` refuses a negative
non-reversal adjustment row, so a round-off is a reduction in the customer's
favour or it is nothing. Collecting *more* than the bill is already what
`onAccount` is for.

**No approver, unlike a write-off.** A write-off forgives a balance somebody
decided to stop chasing. Rounding 4,999.60 to 5,000 is what the counter does to
make change, and an approval gate on forty paise only teaches the operator to
route around it.

#### Why ROUND_OFF is its own `abj_adj_type`

Reusing DISCOUNT would have needed no migration and was rejected: the leg is
debited to **Round Off** and a discount's to **Discount Allowed**, so a row
saying DISCOUNT beside a leg saying Round Off leaves anyone reconciling the two
with an unexplained gap, and inflates every discount report built on
`abj_adj_type`. A discount is a concession somebody decided to give; a round-off
is arithmetic.

It nevertheless folds into **`abl_disc_amount`**, not a fourth column.
`abl_pending_amount` and `abl_status` are GENERATED from
`(bill − alloc − disc − writeoff)`, so a new bucket means dropping and
recreating both expressions on a LIST-partitioned table — a rewrite of every
partition — to split a cache that nothing reads as "discounts": every consumer
in this codebase adds it to `abl_writeoff_amount` and asks *how much of this
bill is already accounted for*. A round-off is. The exact split stays on the
rows, where `abj_adj_type` answers it precisely.

#### `ck_abj_against` enumerates every type, on both sides

Worth knowing before adding a seventh: `ck_abj_adj_type` is not the only
constraint that lists them. `ck_abj_against` names all six — the three that must
point at an opposite bill and the three that must not — so a new type is refused
by it outright rather than falling through to a default. Migration
`20260918120000` widens both, plus `ck_abj_settlement_mode`.

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

### 7. A cheque's `apd_voucher_id` MOVES, so it cannot answer "whose cheque is this?"

`acc_pdc_register.apd_voucher_id` names the voucher the instrument is
**currently** carried by. `/cheques/re-present` repoints it at the re-issue
voucher it writes — correctly, because a bounced cheque going back to the bank
is a fresh act of taking a cheque in — and from that moment the receipt that
actually took the cheque in owns nothing by that column.

Every query that asked "which cheques belong to this receipt?" through it was
therefore wrong from the day re-presentation shipped, and two of them were the
refusals above:

```
rct00821 posted, cheque 500 -> bill A78561
bounce / re-present / clear         apd_voucher_id now names the re-issue
amend cheque -> cash                201, and NOTHING was reversed
-> bill A78561 settled 1,000 on a payment of 500
```

`/cancel` had the same hole, leaving a CANCELLED receipt whose CLEARED cheque
was still settling a bill. Both measured on live `rct00819`, 2026-09-19.

`receipt-cheque-links.ts` answers it once, from what the cheque was **taken in
on**: the union of the receipt's vouchers and the receipt's **tender rows**
(`apd_tender_id`, which nothing repoints). Four callers share it — both unwind
guards, the amend's register retire, the cancel's, and the detail read that
paints the screen and feeds the print dataset — because a set the guard checks
and a set the unwind updates that differ is the same bug wearing a different
hat. `sale-order/order-pdc-posting.helper.ts` has always resolved its
instruments this way, which is why that module never had the hole.

### 8. `avh_against_voucher_id` is an "answers" link, not a parent link

`/post` raises one voucher per post-dated cheque and points it at the receipt
through `avh_against_voucher_id`, which is what keeps it off the receipt list
and under its parent (§4.6). Reading that backwards — *everything pointing at me
is one of mine* — is wrong, because the cheques module files vouchers that
**answer** a receipt without being part of it. A `ChqBnc` names the voucher the
cheque was carried by, and that is the receipt.

Two things followed:

- **`/receipts/get`** listed the bounce under `pdcVouchers` and folded the
  bounce's reversal rows into the receipt's own `allocations` — a receipt that
  settled 500 once painted a +500 and a −500, and a post-dated cheque voucher it
  never had.
- **the `/amend` unwind** swept it into the vouchers it takes apart: DRAFT, legs
  soft-deleted, header soft-deleted, while its bill rows kept counting. Three
  bounce vouchers on the dev box are in exactly that state (`chqbnc00017`,
  `00061`, `00062`) — each against a receipt that had been amended through the
  §7 hole, which is the only way an amend ever got that far.

The discriminator is the voucher **TYPE**: `receipt-posting.service.ts` raises a
post-dated cheque's voucher with the receipt's own `avh_voucher_type_id`,
deliberately, because it *is* another receipt document for the same money
arriving later. Everything the cheques module writes has a type of its own —
`ChqClr`, `ChqBnc`. `receiptPdcVoucherWhere` is same-type + pointed-at-me +
alive, and the three readers share it.

A re-presentation itself never touched the bounce: §4.5 of the cheques module
adds the re-issue voucher and changes nothing behind it, which is what the
bounce columns already do (*"that it bounced on the 14th stays true"*). The
bounce stays **POSTED**, with its totals stamped off its legs.

### 9. `avh_src_*` stays empty on a keyed receipt

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
| 2.6 | `avh_draft_lines` holds the other-ledger lines | It holds `{ otherLines, cheques, allocations, creditsApplied }` | A draft cheque's branch, IFSC, MICR, drawer and deposit bank have no columns on `acc_tender_detail` and are needed by `acc_pdc_register` at post. See `receipt-draft-lines.ts` for the two alternatives and why both are worse. The bare-array form is still read |
| 2.12 | A new "CUSTOMERS BY AREA" dropdown | Done, id **54**. Dropdown 39 untouched | Narrowing 39 would narrow every other screen using it |
| 2.7 | Five new roles | Five new roles, plus `ck_alr_group` widened with a `RECEIPT` band | The existing CHECK admits six group names and none of them fits. The payment voucher adds `PAYMENT` the same way |
| R3 | Money on a posted receipt changes ONLY by cancel and re-enter | That, **plus** `/amend` behind `accounts.allow_posted_amend` | R20, 2026-09-17, on a client request. The setting is OFF by default, so R3 is unchanged for every client that does not ask for this. The refusal list is identical either way |
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

## R20 — `/amend`, editing a POSTED receipt whole

Taken 2026-09-17, on a client request. **Both**: cancel-and-re-enter stays the
model, and `accounts.allow_posted_amend` turns on an in-place restatement for
the client who needs it. Default OFF.

### Why it exists

The rest of this module assumes the person who keys a receipt is not the person
who approves it, so a mistake is corrected by cancelling and re-entering (R3).
That is right for a client with an accounts department and wrong for a
one-person shop: the owner keys the receipt, spots a wrong cheque number a
minute later, and has to unmake and re-key the whole document — party, tenders,
allocations — to change six characters.

### What it takes, and why the whole payload

**Exactly what `/create` and `/post` take together**, plus the four keys, a
`baseRevision` and an `editRemark`.

The first shape proposed was a tier of small routes — one for header text, one
for instrument detail. It was rejected, correctly: the operator does not think
in tiers. They think *"this receipt is wrong, here it is again, right this
time."* A route per field also multiplies the number of places the posting rules
have to be re-implemented, and each one drifts. The screen already assembles
both payload halves, so there is no new payload code and no new dialog.

### What it does

One transaction, and it **orchestrates §5.2 and §5.3 rather than reimplementing
them** — `receipt-amend.service.ts` calls `ReceiptService.saveInTransaction` and
`ReceiptPostingService.postInTransaction`, both unmodified.

1. Lock the header; refuse unless POSTED, permitted and current.
2. Refuse on the facts — cheques, advances, years — **before anything writes**.
3. Unwind in place: a negative row per live adjustment, the advances and the
   register rows and the legs and the old PDC vouchers retired.
4. Recompute the bills, so the re-apply reads what is pending *now*.
5. Re-apply §5.1 and §5.2 from the new payload.
6. `avh_revision_no + 1`, the trail, the audit rows.

**Step 3 is the whole difference from cancel.** No reversal voucher is written
and the status does **not** become CANCELLED. The document is not being unmade,
it is being restated: same `avh_voucher_id`, same `avh_voucher_no`, same
`avh_voucher_refno`, POSTED before and POSTED after.

**Numbering is not re-allocated.** A receipt is not a GST document; the customer
is holding a slip with that number on it, and issuing a second number for the
same money is how a shop ends up explaining two receipts for one payment. The
revision counter carries the change instead. (The *cheque* vouchers do get fresh
numbers — a post-dated voucher's number belongs to the cheque it was raised for,
and that cheque may not be on the receipt any more.)

### `baseRevision` is mandatory

It is the `avhRevisionNo` the client loaded from `/receipts/get`, sent straight
back. A mismatch is a 409 naming the current revision.

> Two people have rct00015 open. A amends the cheque number and saves. B, who
> loaded it before that, amends the party's name and saves. Without the check
> B's payload is the whole receipt, so it silently puts the wrong cheque number
> back — and the audit log faithfully records that B did it on purpose.

A last-writer-wins race is survivable on a master record. On a posted voucher it
rewrites ledger legs, so it is not. The client **reloads** on that 409; retrying
with the revision it was just told would defeat the entire point of the lock.

### It refuses exactly what cancel refuses

A setting cannot make these negotiable, because they are facts about the world
rather than rules about the software. The first two live in
`receipt-unwind.guards.ts` **precisely so there is only one copy** — two copies
is how `allow_posted_amend` would quietly become a way around a rule cancel
still enforces.

| refuse when | why |
|---|---|
| any cheque is **DEPOSITED or later** | the bank has acted on it — unwind it on Received Cheques first. "Any cheque" is resolved by `receipt-cheque-links.ts`, never by `apd_voucher_id` alone — see §7 above |
| the **on-account ADVANCE has been spent** | the money is already settling somebody else's invoice |
| `baseRevision` **≠ `avh_revision_no`** | somebody amended it since this client loaded it |
| the receipt is **not POSTED** | a DRAFT is edited by `/create`; a CANCELLED one is history |
| **`avhPartyId` differs from the stored one** | who paid is not a detail of the restatement — see below |
| the **period is locked / the year is closed** | for the receipt *and* every PDC voucher |
| `accounts.allow_posted_amend` is **off** | the business has not chosen this way of working |

The window amend actually serves is the one that matters: a cheque still in the
drawer, minutes after entry. That is where the reported pain is.

### The party is not amendable, and it is not self-enforcing

It was assumed a party change failed on its own — the allocations would still
name the OLD party's bills, and a bill cannot be settled by a stranger. **That
is wrong, and it was verified wrong on 2026-09-18.** Send the NEW party *and*
that party's own bills and the payload is internally consistent, so every
downstream check is satisfied and the amend is accepted.

Afterwards nothing looks broken: the old party's bill reopens, the new party's
bill is settled, the legs and adjustment rows net exactly. That is what makes it
dangerous. **The receipt keeps its number** — the whole point of an amend — and
the first customer is holding a slip with that number on it, so a well-formed
amend could make the ledger say their slip was somebody else's money, leaving no
anomaly for anyone to notice.

`assertPartyUnchanged` refuses it with a 409 naming both customers. Changing the
party is what `/cancel` plus a new receipt is for.

### Cancel had to learn about amend

An amend does not delete the post it replaces — it reverses it in place and
leaves both on the voucher, because the trail is the whole argument for allowing
an in-place edit of posted money. The voucher id never changes, so after one
amend the receipt carries the first post's rows, their negatives, and the second
post's rows, and **only the last of those is still live money**.

`/cancel` reversed all of them. That was wrong twice: it would have taken out
three times the money on a twice-amended receipt, and it never got that far
because `ux_abj_reversal` permits one live reversal per row and refused the
second with a 23505 — surfacing as
`{"success":false,"message":"Internal server error","errors":[]}`. Amend was a
one-way door: amend a receipt once and it could never be cancelled.

`reverseVoucher` now asks the database which rows already have a live reversal
(`abj_reversal_of_id`) and skips them. It asks rather than inferring from the
rows in hand, because **an amend files its negatives against the RECEIPT even
when they undo a row a post-dated cheque's voucher wrote** — so a per-voucher
scan would not see them while reversing that child.

### `AmendReceiptDto.avhVoucherId` — why it carries `= ''`

Because `declare avhVoucherId: string` — TypeScript's own suggestion for
narrowing a base property (TS2612) — silently broke the field. **TypeScript
emits nothing for a `declare` field, decorators included**, so neither
`@ApiProperty` nor `@RequiredUuid` ever reached the metadata: the field was
absent from Swagger's `required` list, the ValidationPipe had no rule, and a
body with no id reached the raw SQL and came back a 500.

An initializer is the only other thing TS2612 accepts, and it must not be null
or undefined: `SaveReceiptDto` marks the property `@IsOptional()`, which
class-validator inherits, and that skips every validator on a null or undefined
value. `''` is neither, so the rule runs.

The two halves of that defect have **opposite** causes, which is why the
`@ApiProperty` also says `required: true` explicitly — the Swagger CLI plugin
reads the AST and treats a property with an initializer as optional, so the
initializer that fixes the validator would, on its own, leave the field out of
`required` all over again. `dto/amend-receipt.dto.spec.ts` pins both.

### Two things that look wrong and are not

**The header drops to DRAFT in the middle.** Committed and undone inside one
transaction, so no client observes it. Two reasons, and the first is the
load-bearing one:

1. **The re-apply demands a DRAFT.** `saveInTransaction` admits only a DRAFT and
   `assertStatusMayPost` demands one — which is precisely what lets amend call
   them **unmodified**. Nothing is relaxed for this route; by the time it calls
   them the header honestly is a DRAFT. Without the step, the re-apply would
   answer its own caller with the 409 `/create` gives a POSTED voucher.
2. **`ck_avh_balanced`, in the general case.**

The second is worth stating precisely, because the obvious version of it is
wrong and was believed here first. PostgreSQL queues AFTER-ROW triggers to the
*end of the statement*, so the single `updateMany` that retires the legs lets
the trigger see only the final state — 0 debit, 0 credit, which **balances**.
Verified against rct00039 on the dev box, with the real trigger in place since
`20260917170000`: removing all five legs while POSTED is allowed; removing only
its CR leg is refused with `ck_avh_balanced`. So the constraint does not bite
this unwind as written — it would bite the moment the removal stopped being one
statement, and relying on "we happen to do it in one statement" is true until
somebody refactors. The DRAFT window makes it not matter.

The whole cycle has been walked at SQL level against that trigger, in a
rolled-back transaction: POSTED 400/400 → *(control: retiring the CR legs while
POSTED is refused)* → DRAFT → legs retired, totals fall to 0/0 → new legs from
`row_no` 1, totals derived back to 400/400 → POSTED, `avh_voucher_refno` still
`rct00039`, `avh_revision_no` 0 → 1. That control is the point: with the trigger
live the DRAFT window is **load-bearing, not merely defensive**.
`/post`'s step 15 restores POSTED.

**Everything is soft-deleted, nothing is dropped.** Every uniqueness rule that
could have stood in the way is partial on the soft-delete flag —
`ux_av_voucher_row`, `ux_apd_instrument`, `ux_abl_doc_refno` — so retiring a row
frees its number for the re-apply while the row itself stays readable. That is
what lets the operator re-key the cheque as the number they first meant, and
what lets the new ADVANCE bill carry the same receipt reference as the old one.
Register rows are soft-deleted and **not** marked CANCELLED, which is where this
parts company with cancel: a cancelled register row says the instrument was
cancelled, and these instruments were not.

### The trail is what makes this acceptable

This is the point on which amend was argued against and then accepted. An
in-place edit of posted money is unacceptable when nothing records what changed;
with a before/after snapshot per money table, the same edit is **better**
evidence than cancel-and-re-enter, which leaves two documents and makes the
reader infer the difference.

`audit.audit_log` now covers `acc_voucher_header`, `acc_vouchers`,
`acc_bill_adjustment` and `acc_pdc_register` — it already covered
`receipt tender` and the masters. **No migration was needed for that:**
`logEntityChange` resolves its audit screen by NAME and creates the row on first
write, so registering a table is a matter of writing to it.

`txn_status_log` reads `POSTED → AMENDED → POSTED`, two rows, carrying the
`editRemark`. Two and not one because both halves really happened; a single row
saying POSTED → POSTED would be a status trail recording no status. **AMENDED is
a `tsl_event` and never an `avh_voucher_status`** — `ck_avh_status` admits four
values and this is not one of them, which is the whole decision in one line.

### Its own route, not a mode on `/create`

Asked and settled the same day, because it is the obvious first thought:
`/create` is already an upsert on `avhVoucherId`, so why not let a POSTED id
mean "amend"?

**Because `/create` is the route the screen calls on every draft save** — every
save, every retry after a timeout, every double-submit. Today a POSTED voucher
there is a harmless 409. Make POSTED mean "amend" and every one of those becomes
a silent restatement of a posted document that nobody asked to change. **That
409 stays exactly as it is.**

There is also an asymmetry that does not go away: the normal flow is `/create`
then `/post`, two calls; an amend is inherently ONE call that does both. Folding
it in would make `/create` sometimes write ledger legs and sometimes not,
decided by a status the caller may not know it has.

A middle option was considered — one URL with an explicit `mode: "AMEND"` rather
than an inferred status — and it is sound. It was not taken for one practical
reason: **amend is the only route in this module gated by a company setting**,
and a route that can be switched off is easier to reason about than a mode flag
inside a DTO every client already sends and must be checked against a setting on
every request.

### Amend does not replace cancel

A receipt taken from the **wrong party** is cancelled, not restated. Amend
rewrites what a document says; cancel says the document should not have existed,
and only cancel leaves the reversal voucher that proves it. `btnCancelVoucher`
and the register's F3 are unaffected.

---

## Settings (§2.8)

All but the last are `asd_max_scope = 'BRANCH'`, module `ACCOUNTS`, read through
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
| `accounts.allow_posted_amend` | bool, **COMPANY scope** | `false` — cancel-and-re-enter, the model every client has today |

Every reader falls back to the seeded default rather than to an extreme. A blank
value, a token outside the catalogue, or a key a database one migration behind
must not stop an operator taking money.

`accounts.allow_posted_amend` is **COMPANY** and not BRANCH, alone among these.
The other six are branch-level *operating* decisions — one branch takes
post-dated cheques, another insists a collection names its salesman. This one is
a decision about how the business is **controlled**: whether the person who keys
money may restate it afterwards. Precedence runs
GLOBAL < COMPANY < BRANCH < DEVICE < USER, so a BRANCH ceiling would let a branch
manager switch on for their own branch what head office had turned off. COMPANY
is the narrowest scope that cannot be overridden from below.

---

## Do not build

- **No in-place edit of money** on a POSTED receipt — *except* `/amend`, and
  only when `accounts.allow_posted_amend` is on. See R20 below. With the
  setting off, which is the default, this line still reads as written.
- **No stamped totals.** `avh_total_*` from the legs, `avh_doc_amount` from the
  tenders, `avh_adjust_amount` from the adjustment rows.
- **No adjustment rows for a DRAFT**, and no writes to
  `abl_alloc/_disc/_writeoff` — the recompute owns them.
- **No allocation logic in two places.** `allocation-engine.ts` is the only one;
  the client previews with a port of it.
- **No ledger-name lookups.** Roles through the map, `av_role` on the leg.
- **One cheque table: `acc_pdc_register`.** `acc_voucher_cheques` was dropped by
  20260922080000 without ever holding a row.
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

## The 2026-09-18 backend gaps (R-B1 … R-B9)

The client's route test of 2026-09-18 raised nine items and one incident. What
each of them turned out to be, so none of it is re-raised:

| | Item | Outcome |
|---|---|---|
| **1a** | Cancel leaves the PDC voucher posted | **Not a defect** — see below |
| **R-B1** | `/regularise-pdc` has no tenant scope; counts rows considered | Fixed. `companyId` required; `billsRegularised` now counts rows *changed* |
| **R-B2** | `/update-header` took two collectors | Fixed. Calls `/create`'s own `assertSalesman`, not a second copy of it |
| **R-B3** | `/party-context` 200s on a party that does not exist | Fixed. `loadParty` first, so it 404s exactly as `/open-items` does |
| **R-B4** | No previous / next voucher | Added: `GET /receipts/adjacent` |
| **R-B5** | Deposit account not choosable per tender row | **Already built** — see below |
| **R-B6** | No duplicate-receipt guard | Added: `GET /receipts/duplicate-check` |
| **R-B7** | No profit per bill | Derivable, with caveats — see below |
| **R-B8** | No customer reference per bill | Added: `usrRefno` on `open-items` `bills[]` |
| **R-B9** | Party totals the band needs | Added: `summary` on `party-context` |

### 1a — cancel does reverse the PDC voucher

The report found nine POSTED vouchers whose parent is CANCELLED and concluded
that cancel abandons the post-dated child. It does not: `receipt-cancel.service`
loads every child through `avh_against_voucher_id` and reverses each one in the
same transaction, before the parent is marked CANCELLED.

**The diagnostic query cannot tell a PDC child from a reversal.**
`avh_against_voucher_id` carries both relationships — a post-dated cheque's
voucher points at its receipt, and *so does the reversal voucher that cancel
writes*. A reversal is a real, numbered, POSTED voucher by design (the day book
for the day of the cancellation has to show it), so every cancelled receipt
leaves exactly one row matching that query, forever and correctly.

Checked against the same data: all nine rows satisfy
`parent.avh_reversal_voucher_id = child.avh_voucher_id`. The count of genuine
orphans is **zero**:

```sql
SELECT count(*)
  FROM accounts.acc_voucher_header c
  JOIN accounts.acc_voucher_header p ON p.avh_voucher_id = c.avh_against_voucher_id
 WHERE p.avh_voucher_status = 'CANCELLED'
   AND c.avh_voucher_status = 'POSTED'
   AND p.avh_reversal_voucher_id IS DISTINCT FROM c.avh_voucher_id;
```

Use that form. The 5,400.00 the original query totalled is the reversals' own
debits, which offset 5,400.00 of cancelled receipts rather than stranding it.

### R-B5 — already built, both halves

`receipt-lines.ts` has honoured `tnd_edit_ledger` since the module was written:
a tender row's `tdTenderLedgerId` is taken when the master allows an override
and *refused* — rather than silently ignored — when it does not. The flag is on
the tender master's response DTO as `tndEditLedger`. Nothing was needed.

### R-B7 — derivable, but read this before shipping it

**Nothing stores a profit per bill.** `open-items` now answers `billProfit` and
`billProfitPreTax`, and both are derived, per request, from the invoice behind
the bill. Three things the client must know:

- **The stored figure is PER UNIT.** `sbi_item_profit` and `sbi_profit_pre_tax`
  are `numeric(15,2)` like the line amounts beside them, which makes this easy
  to get wrong — but the data settles it: two lines of the same item at the same
  rate, one for 3 units and one for 10, both carry `25.23`. So the bill's margin
  is `Σ (per-unit profit × sbi_net_qty)`.
- **The server never computes it.** It arrives on `/bills/create` from the
  billing screen and is stored as sent, so the figure is only as good as what
  that screen put there.
- **`null` means "not answerable" and must render blank, never as 0.** Either
  the bill has no sale bill behind it (OPENING, JOURNAL, ADVANCE, a return), or
  at least one live line was never costed. A partial sum understates the margin,
  and the one decision this figure exists to inform is whether a discount can be
  afforded — an understated margin talks the operator out of one they could have
  given, silently.

Both figures are returned because they answer different questions: a settlement
discount comes off the gross, so `billProfit` is what it eats into, while
`billProfitPreTax` is what a margin report means by profit.

### Where `branchId` is a key and where it is a filter

Not arbitrary, and the three routes differ on purpose:

- `/adjacent` **requires** it. It walks a *list*, and that list is one branch's
  register; a walk that wandered into another branch's receipts would not match
  what is on screen.
- `/duplicate-check` takes it **optionally**. It asks whether the company has
  already taken this money, and the answer does not stop being yes because the
  first receipt was keyed on another beat — that is the duplicate an operator is
  least likely to find alone.
- `/regularise-pdc` takes it **optionally, and the cron omits it.** Outstanding
  is company-wide; pinning the sweep to a branch leaves matured cheques
  uncounted.

---

## Not in this phase

Received Cheques (menu 51: deposit / clear / bounce / replace), `ON_CLEARING`
posting, the Payment voucher (menu 100 — the same module with `td_dr_cr = 'CR'`,
`apd_tra_type = 'P'` and PURCHASE bills), Collection Entry / Approval
(187 / 188), bank reconciliation (`av_recon_date` is the hook) and a day-close
lock (`fy_lock_date` is the only lock).

The `acc_pdc_register` rows this module writes, and the `HELD` status they carry,
are exactly what menu 51 is built on.
