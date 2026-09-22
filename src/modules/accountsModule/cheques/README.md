# Received Cheques

Menu 51. A customer's cheque from the drawer to the bank and back again.

**The whole module in one line:** move a received cheque through
HELD → DEPOSITED → CLEARED | BOUNCED → re-presented | REPLACED, or HELD →
RETURNED | CANCELLED, writing one register update, one status-log row and —
when money moves — one voucher per step, never editing a row.

Implements *Received cheques — backend plan (NestJS)*, revision 1, 2026-09-14.
Section numbers below refer to it.

The rows this module acts on are written by the **receipt** module, which
registers every cheque it takes as `acc_pdc_register` HELD. Read
`../receipt/README.md` first: this one assumes its conventions rather than
restating them.

---

## Endpoints

All under `/api/v1/cheques`.

| # | Method | Path | What it does |
|---|---|---|---|
| 1 | `GET` | `/list` | The register, plus the summary strip |
| 2 | `GET` | `/get` | One cheque and everything hanging off it |
| 3 | `GET` | `/history` | Every transition, with who and when |
| 4 | `POST` | `/deposit` | A bundle to the bank. **No voucher** |
| 5 | `POST` | `/clear` | The bank paid |
| 6 | `POST` | `/bounce` | The bank sent it back. THE transaction |
| 7 | `POST` | `/re-present` | The same paper, back to the bank |
| 8 | `POST` | `/replace` | Different paper |
| 9 | `POST` | `/return` | Give it back, or void it |
| — | `GET` | `/deposit-slip` | The dataset behind the printed slip |

### The four keys

Every route that acts on an existing cheque takes
**`apdId · apdAccYear · apdCompanyId · apdBranchId`**.

The year is part of the primary key — `acc_pdc_register` is LIST-partitioned on
it — and it is the year the cheque was **received** in, which never changes. A
cheque received in March and cleared in May stays in the 2025-2026 partition;
the clearing voucher carries its own year in its own columns.

The company and branch are what stop a bare uuid reaching another company's
cheque. A mismatch is a **404, not a 403**.

---

## Files

| File | Holds |
|---|---|
| `cheques.service.ts` | §4.1 list / get / history, §4.8 the slip. Nothing here writes |
| `cheque-deposit.service.ts` | §4.2 — the batch, and the argument for posting nothing |
| `cheque-clear.service.ts` | §4.3 — the contra, and the ON_CLEARING receipt |
| `cheque-bounce.service.ts` | §4.4 — THE transaction, nine ordered steps |
| `cheque-reissue.service.ts` | §4.5 / §4.6 — re-present and replace, which share the re-issue |
| `cheque-return.service.ts` | §4.7 — and `unwind()`, which replace-from-HELD reuses |
| `cheque-voucher.helper.ts` | **The only way a voucher is written here.** DRAFT → legs → totals → POSTED |
| `cheque-reversal.helper.ts` | Negative rows, the C4 cascade, and reading a bounce back out for a re-presentation |
| `cheque-allocation.ts` | The adapter onto the receipt's `allocation-engine.ts`, and the three ways bills are chosen |
| `cheques.guards.ts` | The row locks, the status refusals, the dates, Cheques in Hand |
| `cheque-ledger-roles.ts` | The two roles, resolved late and conditionally |
| `cheques.settings.ts` | §2.2's two settings, through the resolver |
| `types/cheque-enum.ts` | Every vocabulary this module owns. The shared ones are IMPORTED |
| `dto/cheque-response.dto.ts` | Every response shape. Each class `implements` its interface |

### What is shared with the receipt, and how

Nothing here injects a receipt service, and `ChequesModule` does not import
`ReceiptModule`. What is shared is shared as **pure functions and helpers
reached by path**: `allocation-engine.ts`, `receipt.guards.ts` (`lockBills`,
`assertBillUsable`, `assertAccYearWritable`, `accYearOf`,
`assertVoucherPartitionExists`), `receipt.utils.ts`, `receipt-enum.ts`,
`voucher-totals.helper.ts`, `ledger-map.helper.ts`.

Importing the module would make the dependency circular the moment the receipt
wants a cheque's status on its own screen, and it would buy nothing — a pure
function needs no provider.

---

## The two rules to keep in front of you (§5)

### 1. Cheques In Hand comes from the cheque's OWN tender row

`apd_tender_id → acc_tender_detail.td_tender_ledger_id`. **Never** from today's
tender master.

Because the master is configuration and configuration changes. A shop that
re-points its Cheque tender at a new ledger in April still holds cheques posted
to the old one in March, and clearing one of those against today's answer would
credit a ledger that never held it — leaving the old ledger overstated forever
and the new one negative.

### 2. ON_CLEARING is honoured PER ROW

`apd_posting_mode` on the register row, never `accounts.pdc_posting_mode`. A
cheque taken in March under ON_RECEIPT keeps clearing that way after somebody
flips the setting in April, because the receipt that took it in has already
posted. `cheques.settings.ts` deliberately does not read that key.

---

## The vouchers, and why each is the type it is

| Step | Type | Legs |
|---|---|---|
| Deposit | **none** | — |
| Clear, ON_RECEIPT | `ChqClr` CONTRA | DR bank / CR Cheques in Hand |
| Clear, ON_CLEARING | `Rct` | DR bank / CR party, + allocations |
| Bounce, ON_RECEIPT | `ChqBnc` JOURNAL | five — see below |
| Bounce, ON_CLEARING | `ChqBnc` JOURNAL | the charge legs only |
| Re-present / replace | `Rct` | DR Cheques in Hand / CR party, + allocations |
| Return | `Rct` | DR party / CR Cheques in Hand |

**Deposit posts nothing** because handing paper over a counter moves no money.
The bank has not paid us; it has taken custody and will say in two days whether
the paper was good. A voucher here would credit the bank two days before the
bank agrees, and every reconciliation afterwards would carry a permanent
difference of whatever was in transit that night.

**Clearing is a CONTRA** because it moves one asset of ours into another —
out of Cheques in Hand, into the bank. Filing it as a RECEIPT would double-count
collections in every "money received this month" report, because the receipt
that took the cheque in is already there.

**A bounce is a JOURNAL** because nothing moved. It is the undoing of a credit
plus two charges. Filing it as a bank voucher would claim the bank balance moved
by the cheque's amount, which it never did.

### The five legs of a bounce

For a cheque of `A`, a party charge `P` and a bank charge `B`:

```
DR  the party                     A + P
CR  Cheques in Hand               A
CR  BOUNCE_CHARGES_RECOVERED          P
DR  BANK_CHARGES                          B
CR  the bank                              B
```

Both sides come to `A + P + B`. §7's worked example — 18,500 with P = 300 and
B = 250 — gives 19,050 / 19,050 in five legs, and `test/cheques-bounce-flow.e2e-spec.ts`
asserts exactly that.

**The party is ONE leg carrying two reasons.** They are debited because the
credit for the cheque is taken back AND because they now owe the bounce charge,
and that is the same ledger on the same side of the same voucher. Five legs is
only reachable by merging them. The two reasons stay distinguishable anyway: the
charge has its own CR leg, its own `av_role`, and its own JOURNAL bill.

---

## Eight things that are easy to get wrong

### 1. `avh_src_*` is the clearing's idempotency key, and the bounce must NOT use it

`ux_avh_src` is UNIQUE over `(company, src_module, src_doc_type, src_doc_id,
acc_year)` for every live non-cancelled header. The clearing files
`('ACCOUNTS', 'PDC', apdId)` there, which makes a **second clearing of the same
cheque impossible** — refused by the index, not by a check that could be raced.
Two operators clearing at the same moment are serialised by the row lock and the
loser gets *"already cleared"*.

The bounce files nothing there **on purpose**. A cheque may bounce, be
re-presented and bounce again, and each of those is a real separate event that
the index would refuse as a duplicate. Its link back is
`avh_against_voucher_id`.

### 2. A reversal row copies the original's `abj_is_post_dated` and `abj_adj_date`

Dating it today so the bill "reopens at once" is tempting and wrong: an
un-matured post-dated row does not count towards `abl_alloc_amount`, so a
reversal that DID count would drive that column negative and `ck_abl_settled`
would refuse the write. Mirroring makes the pair net to zero whether the cheque
has matured or not — true on every day, not just today.

### 3. `abj_row_no` is threaded through the bounce, not restarted

The bounce writes the cheque's own reversals and then the cascade's onto the
**same** voucher. Restarting the counter at 1 would give two rows the same
number. `reverseChequeAdjustments` and `cascadeAdvances` both take and return a
row counter for exactly this.

### 4. A non-OPENING bill needs its voucher TYPE, not just its id

`ck_abl_voucher` demands both `abl_voucher_id` AND `abl_voucher_type_id`. The
ADVANCE a remainder raises is a non-OPENING bill, so `ChequeAllocationScope`
carries `voucherTypeId` / `voucherNo` / `voucherRefno` alongside the id. An
advance written without them is refused by the constraint at the moment an
operator is banking a cheque. (Found by the e2e suite, not by reading.)

### 5. `avh_total_*` are read from the LEGS, never off the header

Migration 20260915120000 §11 adds `accounts.tr_av_refresh_totals`, and that
section was appended to the file **after** it had been applied — so on any
database carrying that history the trigger does not exist and both columns sit
at 0. `loadVoucherRef` therefore derives from the legs, or `/cheques/get` would
report a balanced five-leg bounce as 0.00 / 0.00. Deriving is also the check on
the trigger: if the two ever disagreed, what the screen shows is the truth.

### 6. Re-presenting clears `apd_bounce_date` — and only that

`ck_apd_seq` is `bounce_date IS NULL OR deposit_date IS NULL OR bounce_date >=
deposit_date`, and a re-presentation is always banked after the bounce that
caused it. The register carries ONE set of deposit / clear / bounce dates while
a cheque can go to the bank many times, so those columns describe the **current**
presentation and `apd_present_count` says there were earlier ones.

Everything that is history survives: `apd_bounce_voucher_id`,
`apd_bounce_acc_year`, `apd_bounce_reason`, `apd_bounce_charges` and
`apd_charge_voucher_id` are untouched, the `ChqBnc` voucher and its five legs are
untouched, and `txn_status_log` still holds the BOUNCED step with its date, its
reason and who recorded it.

**`apd_voucher_id` moves too, and other modules depend on that.** The
re-presentation writes a re-issue voucher and points the register row at it,
because that voucher is what now carries the instrument. Anything asking "which
cheques belong to document X?" must therefore NOT read that column: it names who
owns the cheque now, not what it was taken in on. The receipt module learned
this the expensive way — `/receipts/amend` and `/receipts/cancel` waved a
re-presented cheque's receipt through and settled a bill twice — and now resolves
it through `apd_tender_id`, which nothing here repoints. See
`receipt/receipt-cheque-links.ts`. Keep it that way: if a future route in this
module moves `apd_voucher_id` again, nothing outside has to change.

### 7. An empty `allocations` means something DIFFERENT on `/re-present`

On `/clear` it means auto-FIFO, and that is right: an ON_CLEARING cheque is money
landing for the **first** time, nobody has decided where it goes, and due-date
order is the same answer the operator would get by pressing *auto*.

On `/re-present` auto-FIFO is never right. A re-presentation is **the same money
for the same debt** — the cheque did not become a fresh payment when the bank
returned it — so the bills are not a choice the caller is making. They are a fact
the sub-ledger already holds, in the very rows the bounce reversed. Filling the
party's oldest open invoice instead moves a customer's money onto a debt they did
not pay, silently, and `/cheques/get` then reports it as fact.

So with no `allocations`, `represent` reads back what the **bounce voucher**
reversed — `allocationsReversedBy` — and restores it bill by bill, amount,
discount, write-off and round-off alike. `allocations` remains the explicit
override. The two readings cannot be reached by accident because
`allocateChequeMoney` no longer takes an array that might be empty; it takes a
`ChequeAllocationRequest`, and the caller has to say which kind of empty it means.

**An empty restore is a real instruction.** A cheque whose money went wholly on
account settled no bill the first time and settles none this time either —
collapsing `[]` back to auto-FIFO there would reintroduce the whole bug for
exactly the cheques nobody looked at.

And the client cannot do this for itself: after a bounce every bill correctly
reports `settledByThisCheque: 0`, so a cheque split across several bills leaves
no client-visible record of how much went to each. The split exists only in the
reversal rows.

**Refusing beats re-pointing.** If a bill cannot take its share back — removed
since, or paid by something else — the whole re-presentation is refused with a
409 naming that bill, and nothing is written.

`/replace` keeps auto-FIFO, deliberately: the replacement cheque may be for a
different amount, and there is no arithmetic that restores an 18,500 split out of
12,000 without inventing which bill loses the difference.

### 8. `abj_reversal_of_id IS NULL` is not "this row still stands"

It means "this row is not itself a reversal", which is a different claim, and the
gap between them opens on the second trip to the bank: bounce → re-present →
bounce again. The first bounce reversed the receipt's rows and **left them in
place** (reverse, never delete — §2 above). The re-presentation wrote a fresh
positive set. A second bounce that swept up everything with a null
`abj_reversal_of_id` would reverse the first set a **second** time, and
`abl_alloc_amount` would fall by twice what the cheque ever settled.

`reverseChequeAdjustments` therefore reads both halves in one query and reverses
only the rows that nothing already points at. The register invites this path —
`apd_present_count` exists because a cheque can go back, and §1 above says a
second bounce is a real separate event.

---

## The C4 cascade, and the one judgment in this module

A receipt of 20,000 settling 18,500 of bills leaves 1,500 as an ADVANCE. Next
week that advance is applied to a new invoice. Then the cheque bounces.

Reversing only the cheque's own rows would leave the new invoice settled by money
that never existed. **Refusing the bounce is not available** (§10: "no refusing a
bounce because an advance was used"): the receipt's own `/cancel` may refuse when
its remainder has been spent, because cancelling is a choice — but a bounce is
not. The bank has returned the cheque and a system that cannot record that is not
usable. So the cascade unwinds the applications and the new invoice reopens.

### Attribution — a judgment, stated

The plan says to cascade the advances *"whose remainder came from this cheque
(`abj_tender_id` on the ADVANCE's origin = the cheque's tender row)"*. An ADVANCE
bill records which **voucher** raised it and not which tender, and the receipt
writes no origin adjustment row, so that test cannot be run as written. What is
decidable from what is actually stored:

- A post-dated cheque has a voucher **of its own** (receipt R2) whose only money
  is that cheque. Any advance on it is wholly the cheque's.
- A current-dated cheque shares the receipt's voucher with the cash, the card and
  the other cheques of the same receipt. An advance there was funded by all of
  them and no column says in what proportion.

So `cascadeAdvances` cascades when the cheque is the voucher's **only money
source** — no other live tender row, no sibling register row — and otherwise
leaves the advance alone and **says so**, in `cascade.advancesLeftMixed` on the
response. Removing a mixed advance in full would destroy money that is still
good; removing a guessed fraction would be arithmetic nobody could audit.

The party is not left short either way: the bounce still debits them the full
amount of the cheque, so the ledger is right. What the mixed case leaves open is
only which BILL the remaining credit belongs against, and the operator is told
which advance that is.

**If `received_cheques_flow.md` surfaces and says otherwise, it wins** — this is
the one place its absence forced a decision rather than a reading.

---

## Deviations from the plan, and why

| § | Plan says | This does | Why |
|---|---|---|---|
| 2.1 | "one `acc_ledger_map` row per company" | ONE GLOBAL row, through `fn_seed_ledger_map` | Every one of the 28 live roles is mapped globally; the resolver is built for branch-beats-company-beats-global. Per-company rows would make this the only role configured differently, and would leave a company created tomorrow unmapped |
| 2.2 | `bounce_charge_to_party` is NUMBER | DECIMAL | `ck_asd_data_type` admits BOOL / INT / DECIMAL / TEXT / UUID / DATE / JSON. 'NUMBER' is refused |
| 2.2 | `bounce_reasons` is TEXT (JSON list) | JSON | Same catalogue, the other way: the settings screen renders a list editor for JSON, where TEXT gives one line to hand-type an array into |
| 2.4 | A `cheque_deposit_slip` print DATASET | The print PURPOSE, + `GET /deposit-slip` | `print_template_dataset` rows hang off a `print_template_version` — a dataset cannot exist alone, so "register the dataset" means shipping a whole template with its layout, which is the printing module's work. §4.8 explicitly allows the endpoint |
| 4.1 | `/cheques/list` is "the grid" | BOTH: the grid for TxnMainView, this route for the summary strip | The strip is an aggregate over the whole register, not the page the grid returned, and §7's "IN HAND + WITH THE BANK equals the Cheques In Hand ledger" is about that total |
| 4.5 | (not mentioned) | `apd_bounce_date` clears on re-present | `ck_apd_seq` will not have it beside a later deposit date. See §6 above — every link and the reason survive |
| 4.5 | "fresh allocations" | With none sent, the allocation the BOUNCE reversed is restored | "Fresh" reads as auto-FIFO and auto-FIFO settles a bill the cheque was never against. The same money is settling the same debt, and the per-bill split survives nowhere but those reversal rows. See §7 above |
| 3 | Module at `src/modules/accounts/cheques/` | `src/modules/accountsModule/cheques/` | That is where the accounts module lives in this repo |
| 4.4 | `avh_src_*` unstated for the bounce | Left empty | `ux_avh_src` would refuse the second bounce of a re-presented cheque, which is a real event |

### Not carried out, and why

**§2.4's generic print layout.** The purpose `CHEQUE_DEPOSIT_SLIP` is seeded and
`GET /cheques/deposit-slip` returns the dataset; no `print_template` /
`print_template_version` / `print_template_dataset` rows are written. Building a
template means choosing a page size, a band layout and a font stack, which is the
printing module's business and not this plan's. When a template is built it reads
the same shape from the same place.

---

## Settings (§2.2)

Both `asd_max_scope = 'BRANCH'`, module `ACCOUNTS`, read through
`AppSettingValueService.resolveEffective` and never by querying
`app_setting_value` — re-merging the GLOBAL < COMPANY < BRANCH < DEVICE < USER
precedence here would make this screen and the settings screen disagree.

| Key | Type | Default |
|---|---|---|
| `accounts.bounce_charge_to_party` | DECIMAL | `0` — the operator types it every time |
| `accounts.bounce_reasons` | JSON | the seven reasons |

`bounce_reasons` is a **pre-fill, not a whitelist**. The service accepts any
non-blank reason, because a bank returns cheques for reasons no list anticipates
and a bounce that cannot be recorded is worse than one recorded with an
unfamiliar reason.

`accounts.pdc_posting_mode` is **not read here** — see rule 2 above.

---

## The status trail

One `public.txn_status_log` row per STEP, under
`srcModule = 'ACCOUNTS'`, `srcDocType = 'OTHER'`, `srcDocId = apd_id`.

`OTHER` and not `RECEIPT`: `ck_tsl_src_doc_type` admits fourteen types and a
cheque is none of them, the receipt has its own trail under its own id, and
filing the cheque's deposits there would interleave two documents' histories
under one heading. The helper's own comment says OTHER exists "so a new document
type never forces an ALTER on the table".

`tsl_acc_year` is the **cheque's** year, so a cheque received in March and
cleared in May files both steps in 2025-2026, beside each other — the only way
`/history` reads as one story.

---

## Tests

`test/cheques-bounce-flow.e2e-spec.ts` — fifteen cases over HTTP against the live
dev database, covering every write path and §7's worked example end to end:

- the deposit that posts nothing, and the refusal by date;
- the bounce: five legs at 19,050 / 19,050, both bills back to 12,500 / 6,000,
  the JOURNAL charge bill, `apd_bounce_voucher_id = apd_charge_voucher_id`, and
  the reversal rows mirroring their originals' date and post-dated flag;
- the two status refusals (clear a BOUNCED cheque, return a DEPOSITED one);
- the re-issue with `apd_present_count` 2, the bounce voucher still POSTED with
  its five legs, and `apd_bounce_date` cleared;
- the clearing: a `ChqClr` of nature CONTRA, two legs, `av_recon_date` on the
  bank leg and nowhere else, `avh_src_doc_id` set, and the second attempt
  refused;
- return and cancel, and that CANCELLED frees the cheque number while RETURNED
  does not;
- replace from HELD: the return reversal, the old row REPLACED and paired, the
  new HELD row re-issued for the new amount, and both ends of the chain
  reachable from `/get`;
- the three reads and the slip.

It **mutates** and cleans up after itself, building its own fixtures — a
receipt-shaped voucher, a tender row, a register row, two bills and the
adjustment rows — because a bounce cannot be verified by reading: the whole claim
is about what gets written.

It found three real bugs while being written, all of them constraint-ordering
faults that no amount of re-reading the code would have shown:

1. the ADVANCE bill written without `abl_voucher_type_id` (`ck_abl_voucher`);
2. `avh_user_id` stamped as `DEFAULT_ACTOR` rather than the request's user
   (`fk_avh_user`);
3. **replace created its register row before the re-issue voucher**, which
   `ck_apd_posting` refuses at the INSERT — an ON_RECEIPT row must already name
   its voucher. The voucher now comes first and the row is created inside a
   hook; see `onVoucherWritten` in `cheque-reissue.service.ts`.

---

## Do not build

- **No edit of a register row's cheque facts.** Return it and re-key, or replace
  it.
- **No delete.** CANCELLED is the deletion, and it keeps the history.
- **No second cheque table.** `acc_voucher_cheques` never took a row and was
  dropped by 20260922080000.
- **No clearing straight to the party after a bounce** — re-issue first (C5), so
  `/clear` has one shape. Without it, clearing would have to ask "was this
  bounced before?" and post a different voucher if so, and every later report
  would have to ask the same question.
- **No refusing a bounce because an advance was used** — cascade (C4).
- **No stored due bucket.** Computed from the date and today, in the grid's SQL
  and in `dueBucketOf`.
- **No ledger-name lookups.** Roles through the map, and the cheque's own tender
  row.
- **No cache on the reads.** The due buckets change at midnight.
- **No stamped `avh_total_*`.** Derived from the legs.

---

## Not in this phase

Bank reconciliation (`av_recon_date` is the hook, and the clearing sets it),
Issued Cheques (menu 52 — `apd_tra_type = 'P'`, the mirror of this and its own
plan), and the print template for the deposit slip.
