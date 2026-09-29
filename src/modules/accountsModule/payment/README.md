# Payment (menu 100) — `/api/v1/payments/*`

`plan-backend-payment.md` REVISION 2 (2026-09-28). **This module is `../receipt/` mirrored,
route for route and DTO for DTO, with the money going OUT.** Where this file is silent, the
receipt's README applies.

## Routes

| # | route | receipt twin | the payment's difference |
|---|---|---|---|
| 1 | `GET /open-items?partyId&companyId&onDate` | same | bills = the party's **CR** bills pending (PURCHASE, OPENING, JOURNAL); credits = their **DR** items (ADVANCE paid, PURCHASE_RETURN / debit note, OPENING DR, JOURNAL DR). `party` adds `tdsSection, tdsRate, tdsRateSource, tdsThresholdSingle, tdsThresholdAnnual, tdsPaidThisYear, panPresent`, `bank {name, accountNo, ifsc}` (the default `acc_ledger_bank_accounts` row), `favouringName`, `isMoneyLedger`. `ppdSuggested` is the **supplier's** cash discount (`sup_cash_disc_perc` within `sup_credit_days`). No `mobile` (400 if sent) |
| 2 | `GET /party-context` | same | `lastPayments[10]`, `ourChequesOut[]` (`apd_tra_type 'P'`, HELD, with the book), summary totals |
| 2a | `GET /adjacent` | same | type `Pmt` |
| 2b | `GET /duplicate-check` | same | Σ tender amount paid to this party today |
| 3 | `POST /create` | `SaveDraftReceiptDto` | a cheque row carries `cheque.chequeBookId`, `cheque.favouring`, `cheque.acPayee` and **no `tdRefNo`** (400 if sent); a bank row may carry `beneficiary {name, accountNo, ifsc}`. Allocations and credits are REMEMBERED (notes 30). Every cheque row answers `cheque {chequeBookId, bookNo, favouring, acPayee, …}` |
| 4 | `POST /post` | `PostReceiptDto` | same keys. Answers like `/receipts/post`, plus `cheques[] {tdRowNo, apdId, apdAccYear, leaf, bookNo}` |
| 5 | `GET /get` | same | + `chequesIssued[]` (leaf, book, favouring, printed, status), `beneficiary` per tender row |
| 6 | `PUT /update-header` | same | same whitelist + `editRemark` |
| 7 | `POST /cancel` | same | + refused on a cheque past HELD ("unwind on Issued Cheques, menu 52") and on a tender row the bank has SETTLED; + `tdsReversed` |
| 8 | `POST /delete` | same | DRAFT only |
| 9 | `POST /amend` | same | R20, same setting, same refusals; the old leaves stay on the register, CANCELLED, and stay used |

There is no `/regularise-pdc`: `/receipts/regularise-pdc` is company-wide over
`acc_bill_adjustment` and `BillBalanceRecomputeService.recomputeBills` never looks at
`abj_dr_cr` — it sums by `abj_adj_type` — so a post-dated PAYMENT row (`abj_dr_cr = 'DR'`)
matures under the same sweep. Verified by reading the recompute, not assumed.

## Files

| receipt file | payment file |
|---|---|
| `receipt.controller.ts` | `payment.controller.ts` |
| `receipt.service.ts` | `payment.service.ts` (draft, get, update-header, delete; reuses the receipt's `STORED_HEADER_SELECT` / `StoredHeader` / `statusOf`) |
| `receipt-posting.service.ts` | `payment-posting.service.ts` |
| `receipt-cancel.service.ts` + `receipt-unwind.guards.ts` | `payment-cancel.service.ts` + `payment-unwind.guards.ts` |
| `receipt-amend.service.ts` | `payment-amend.service.ts` |
| `open-items.service.ts` | `payment-open-items.service.ts` |
| `receipt-lines.ts` | `payment-lines.ts` (+ TDS seeding) |
| `receipt-draft-lines.ts` | `payment-draft-lines.ts` (+ book / favouring / beneficiary) |
| `receipt-ledger-roles.ts`, `receipt.guards.ts`, `receipt.settings.ts`, `receipt-exception.filter.ts` | `payment-*` |
| `receipt-cheque-links.ts` | re-exported as `payment-cheque-links.ts` — nothing about the two answers depends on direction |
| `ppd-slab.ts` | **reused** |
| `allocation-engine.ts` | **reused, not copied**: `AllocationInput.direction: 'IN' \| 'OUT'` (default IN, so the receipt is untouched); OUT flips every side (see the engine's header note) and the result carries `partyLegSide` |
| — | `payment-tds.ts` — the rate lookup and the gross-up |

Shared and imported as they are: `vouchers/cheque-book.helper.ts` (`loadChequeBooks`,
`takeNextLeaf`, `leavesLeft`), `vouchers/voucher-facts.ts` (`loadLedgerFacts`, `isMoneyLedger`,
`loadTdsRate`, `loadTdsAnnualBase`), `common/posting`, `reconcile/books-reconcile.guard.ts`,
`cheques/cheques.utils.ts` (`logChequeStatus` — a step per leaf, filed as `CHEQUE_ISSUED`).

## Post — the receipt's transaction, direction OUT (§5)

1. **Party:** a cash / bank ledger (`isMoneyLedger`, notes 56) is refused: "use Contra".
2. **TDS:** seeded server-side when the party is TDS-applicable, from `accounts.tds_rates` —
   the lookup PmtV uses. Net = Σ `tdAmount` − Σ `tdMdrAmt` (the bank's charge never reaches the
   supplier); gross = net / (1 − rate); the TDS line is a CR deduction that settles its share
   of each bill. A client `TDS_PAYABLE` line that disagrees is a **409 naming both**; a missing
   rate is a 400. A below-threshold payment still writes its register row (the annual threshold
   counts it). On a party the master does not flag, a keyed TDS line stands as keyed.
3. **Leaves:** `takeNextLeaf(bookId)` per cheque row, in row order, INSIDE the transaction,
   under the book's row lock. The leaf goes onto `td_ref_no`, then one `acc_pdc_register` row
   with `apd_tra_type 'P'`, `apd_cheque_book_id`, `apd_favouring`, `apd_ac_payee`,
   `apd_bank_ledger_id` = the book's bank — the row Issued Cheques (52) works on. A finished /
   closed book is a **409** on `/create` and on `/post`; two concurrent posts on one book get
   consecutive leaves; a rolled-back post returns its leaf with everything else.
4. **Post-dated cheque:** its own `Pmt` voucher dated the cheque, `avh_against_voucher_id` =
   the payment — the receipt's PDC voucher.
5. **On account:** one **ADVANCE (DR)** bill per voucher with a remainder, `abl_src_doc_type
   'PAYMENT_ADVANCE'`. A later purchase bill's adjust panel and a later payment's `creditsApplied`
   spend it.
6. **Legs:** DR party (the gross, derived from the bill side by the engine); DR the extras
   (BANK_CHARGES, INTEREST_PAID, a free DR ledger); CR the deductions (TDS_PAYABLE,
   BALANCES_WRITTEN_BACK, a free CR ledger that settles); CR DISCOUNT_RECEIVED = Σ allocation
   discounts, CR BALANCES_WRITTEN_BACK = Σ write-offs, CR ROUND_OFF = Σ round-offs; CR each
   instrument for its full amount (the bank pays gross of its charge). Totals derived by trigger.
7. `txn_status_log`: POSTED on the payment; a HELD step per leaf under `CHEQUE_ISSUED`.

**Other-line roles accepted:** `TDS_PAYABLE` (CR, settles), `BANK_CHARGES` (DR, seeded from
`tdMdrAmt`), `INTEREST_PAID` (DR), `BALANCES_WRITTEN_BACK` (CR, settles; above
`accounts.writeoff_approval_above` needs `approvedBy`), or a free `ledgerId`. **Never**
`DISCOUNT_RECEIVED` / `WRITE_OFF` / `ROUND_OFF` as lines: they ride on
`allocations[].discount / .writeoff / .roundoff` (400 if sent).

## Data — migration `20260929090000_payment_voucher`

1. Voucher type **`Pmt`** — the mirror of `Rct`: nature PAYMENT, prefix `pmt`, AUTO, yearly,
   `vchr_in_register = false`, `vchr_menu_id = 100`. The rule columns (party / bill-wise / TDS
   modes) stay at their defaults exactly as `Rct`'s do — nothing reads them for a type the
   register never offers. `PmtV` stays the register's. On a fresh database the migration runs
   before the menu tree exists, so `prisma/seed/Acc_Voucher_Types_Register.sql` links the type
   to menu 100 afterwards.
2. Roles `ADVANCE_PAID` (Assets → "Advances to Suppliers" under Loans & Advances (Asset)),
   `DISCOUNT_RECEIVED` and `BALANCES_WRITTEN_BACK` (Income → "Discount Received" / "Balances
   Written Back" under Indirect Incomes), group `PAYMENT` (`ck_alr_group` widened), added to
   `fn_ledger_map_catalogue()` (42 roles) and mapped through `fn_seed_ledger_map`.
3. Menu 100 "Bill-wise Payment" visible — migration and `Menu_Master.sql` both; 49 hidden (D5).
4. Grid **123 'MAIN LIST - PAYMENTS'** — the receipts grid (108) as it stands on the box, with
   `Pmt`, labelled "Payment No" / "Payee" / "Paid". Same tokens: `iavh_company_id`,
   `iavh_branch_id`, `iavh_acc_year`, `iavh_status`, `ifrom_date`, `ito_date` ('' = no bound).
   Pinned at 123 because 120 / 121 are the cheque grids and 122 is the stock adjustment list.
5. Setting `accounts.payment_salesman_mandatory` (BOOL, BRANCH, default false) — the "paid by"
   rule; the client treats it like `receipt_salesman_mandatory`. Everything else is the receipt's.

## Decisions (§6), and one deviation

- D1 no payee KIND — any party ledger; a cash / bank ledger is refused. D2 `Pmt`, not `PmtV`.
  D3 no UPI column on the beneficiary. D4 no print. D5 menu 49 hidden.
- **`ADVANCE_PAID` is created but nothing posts to it.** The plan's §5.5 says "leg DR
  ADVANCE_PAID" for the on-account remainder. That would take the remainder off the PARTY's
  ledger while the ADVANCE bill sits on the party — the party's bills would no longer equal its
  ledger and the books-reconcile trial check (notes 47) would refuse every such post. The
  remainder therefore stays in the party DR leg, exactly as the receipt keeps its remainder in the
  party CR leg with `ADVANCE_RECEIVED` unused. The role exists for a balance-sheet regrouping
  later.

## A bank charge is INSIDE `tdAmount`

`tdAmount` is what leaves our bank; the party receives `tdAmount − tdMdrAmt`, and the bank leg is
credited the full `tdAmount` ("the bank gross of its charge", §5 step 6) with a DR `BANK_CHARGES`
for the difference — the mirror of a receipt, where the customer pays `tdAmount` and the acquirer
keeps `tdMdrAmt`. TDS is worked out on what the party receives. A NEFT of 5,000 with a 12.50
charge is sent as `tdAmount: 5012.50, tdMdrAmt: 12.50`.

## Fixed while testing (2026-09-29)

- **A post-dated cheque was refused by the books check.** The post called the shared
  `assertBooksReconcile`, which has no allowance for a post-dated voucher: it is POSTED today so
  the ledger counts it, while the bill's post-dated row counts only on maturity. Every payment
  carrying a post-dated cheque was a 422 `ACC_PARTY_OUT_OF_BALANCE`. The post now calls the
  Voucher Register's `assertVoucherBooksReconcile` (notes 54), which allows exactly the un-matured
  difference. `/receipts/post` had the same gap; notes (61) ported this fix to it.
- **The cancel used the shared guard too** (notes 61). It reads the PARTY, so cancelling any
  payment of a party that still holds an un-matured post-dated cheque from ANOTHER payment was a
  422 for a difference the cancel did not make. The cancel of the post-dated payment itself nets
  to zero and was not affected. Payment and receipt cancel now call `assertVoucherBooksReconcile`
  as well.
- **`/adjacent` compared a DATE column with a timestamp.** `avh_voucher_date` is a `date` and the
  box runs in Asia/Kolkata, so `date >= <midnight UTC>::timestamptz` read 29 September as 28
  September 18:30Z: a one-day window matched nothing and same-day rows sorted below the voucher
  being walked from. The payment walk now binds and compares dates as dates. The receipt's walk
  was the same query; notes (61) fixed it the same way.
- **The TDS reversal wrote a negative base.** `ck_atd_base` refuses it; a reversal negates the tax
  only (as `voucher-cancel.service.ts` does). Cancel and amend of a payment with TDS were 500s.
- **`/amend` answered with the old revision.** The response header was read inside the post,
  before the revision moved, so a client sending it back as `baseRevision` got a 409. The
  response now carries the header as it stands after the bump. `/receipts/amend` answered the
  same stale header; notes (61) fixed it the same way.

## notes (62) — the review against plan rev 2 (2026-09-29)

- **A1 · TDS on an advance.** The engine placed a settling deduction only on bill capacity, so TDS
  with no bill (an advance) or more tax than the bills could hold was always refused. Now an
  UNPINNED deduction fills the bills' room and the part no bill can hold is held on account with
  the money (`reserveDeductions` → `collectOnAccount`). Nothing that fitted before is placed
  differently, so the receipt is unchanged for every input it accepted. A pinned line is still
  exact. The client's port of the engine needs the same rule.
- **A2 · Only a `Pmt`.** `loadHeaderOrThrow` filters on `vchr_type_code`, and so does
  `/adjacent`'s starting row. `/create` with an existing id also checks type, company and branch,
  because the save rewrites all three. A wrong type is a 404. `/receipts` has the same fix.
- **A3 · A reopened draft keeps its book.** Every cheque row on `/create` and `/get` answers
  `cheque {chequeBookId, bookNo, favouring, acPayee, bankBranch, ifsc, micr, drawerName}`. A draft
  reads it from `avh_draft_lines`, a posted payment from its register row.
- **A4 · The supplier's discount, not ours.** `ppdSuggested` comes from `sup_cash_disc_perc`
  within `sup_credit_days` (`sup_id` is the ledger id). `accounts.ppd_slabs` is no longer read
  here. A party with no supplier row is offered nothing.
- **B1 · The TDS base excludes every DR line.** That covers interest (194A), free DR lines and a
  rounding-up, not just the bank charge.
- **B2 · A keyed TDS line on a party that is not TDS-flagged is refused (400).** No register row
  could be written for it (`atd_section` is NOT NULL and the master names no section), so the
  deduction would reach the books but not 26Q.
- **C1 · Amend CANCELS the old leaves** ("Amended into revision N"), as `/cancel` does. It no
  longer soft-deletes them, so menu 52 shows no gap and `ux_apd_issued_leaf` keeps guarding the
  number.
- **D1 · The receipt's names:** `summary.creditsHeld` on `/open-items`, `summary.totalCredits` on
  `/party-context`.
- **D2 · Rights.** Every route is judged on the caller's `user_menus` row for menu 100 (view for
  reads, create / edit for `/create`, edit for `/update-header`, and post / cancel / delete /
  amend for their own routes). A refusal is a 403 with code `PMT_RIGHT_<RIGHT>` that names the
  column. `/receipts` does the same on menu 99 (`RCT_RIGHT_<RIGHT>`).
- **D3 · `/open-items` refuses `mobile`.** It has its own query DTO.
- **E1 · The write-off approver is kept** on the bill rows the BALANCES_WRITTEN_BACK line settles
  (`abj_approved_by`).
- **E2 · Rounding up** (paying 5,000 on 4,999.60) is a **DR `ROUND_OFF` other-line**, an extra
  expensed to Round Off, instead of a 0.40 advance. Rounding down still rides on
  `allocations[].roundoff`, and a CR `ROUND_OFF` line is still refused. The receipt has no mirror
  of this yet.
- **E3 / E4.** The post passes the tender Decimals through. The stale comments are corrected.

## notes (63) — an amended payment could not be cancelled or amended again (2026-09-29)

C1 left the old leaf live and CANCELLED, and `assertIssuedChequesStillHeld` refuses any live
leaf past HELD. So it read the amend's own leaf as a cheque someone had acted on, and refused
every later `/cancel` and `/amend` of the payment. It pointed the user to menu 52, where a
CANCELLED leaf has nothing to unwind. pmt00398 (cheque → cash) was stuck POSTED this way.

- **`acc_pdc_register.apd_amended_into_revision`** (migration
  `20260929120000_pdc_amended_into_revision`). The amend sets it to the revision it moves to,
  on each leaf it cancels, and the guard skips those rows. The guard reads the column, not
  the reason text. `ck_apd_amended` allows the column only on a CANCELLED row. The migration
  backfilled the leaves an amend had already cancelled, taking N from their reason.
- **A Stop or Void on menu 52 still refuses.** Those also leave the leaf CANCELLED, but with
  the column NULL and with their own reversal voucher.

## notes (64) — a cheque paid on account could not be stopped or returned (2026-09-29)

A payment's remainder is an ADVANCE (DR) bill, not an adjustment row, so the cheque that paid
it has no `abj_cheque_id` row for that part. `IssuedChequesService.unwind()` (stop, returned,
void, and replace of a HELD cheque) reversed only the rows. Its ChqBnc voucher put the ledger
back but the ADVANCE stayed open, and the books check refused (pmt00494, pmt00497). A cheque
paid partly to a bill and partly on account failed earlier still: its ChqBnc did not balance
(DR bank the cheque, CR party only the bill part).

- **The on-account share comes off the ADVANCE** (`onAccountShare`). The share is the cheque
  less its standing allocations, capped at what the payment's ADVANCE bills for that party on
  the cheque's voucher were raised for. The ChqBnc voucher credits the party with bills + share,
  and a CR `ALLOCATION` row on it settles the share off the ADVANCE. The advance is settled,
  not deleted: the payment is still POSTED, its leg still raised the advance, and part of the
  advance may belong to another tender of the payment.
- **Spent advance → refused** (`VCH_ADVANCE_SPENT`, 409) when less than the share is still open.
  The message names each document that used the advance and the bill it went against. Refused,
  not cascaded (the note left that call to us): reversing the use first is the operator's
  decision. Only a shortfall refuses, so an advance funded by several tenders stays usable when
  what was spent is no more than the other tenders put in.
- **Not covered: a cheque that also paid an extra line** (a bank charge in `tdAmount`) with no
  pooled money to take it. The allocation engine charges extras to the cheque, and no row
  records that, so its ChqBnc still does not balance (`The voucher does not balance`), as
  before. Stopping it needs the extra line reversed too. (Read from the engine; no test.)
- **TDS held on account stays.** A deduction the bills could not hold (A1) sits in the ADVANCE
  beside the money. The share is the money only, so after a stop that part of the advance stays
  open, matching the TDS register row, which the stop does not reverse for a `/payments` cheque.
  (Read from the engine; no test.)

## Tests

- `receipt/allocation-engine.out.spec.ts` — the OUT twin of every engine case (30) plus notes
  (62)'s four (TDS on an advance, a bill smaller than the tax, a pinned line still refused, the
  approver carried), beside the receipt's 24, which are unchanged and pass.
- `test/payment-*.e2e-spec.ts` (58 tests, five suites) over `test/helpers/payment-e2e.ts`, live
  dev database, `--runInBand`. Each suite creates its own Sundry Creditors party, OPENING bills
  **with the matching `acc_opening_balance` row** (one per ledger — the net of its bills) so
  `accounts.reconcile_on_post` stays satisfied, and its own cheque books; `afterAll` removes all
  of it. Each suite grants tester1 the menu-100 rights in `beforeAll` and puts back what was
  there (`test/helpers/menu-rights.ts`).
  - `payment-draft-lifecycle` — draft (R10), money-ledger payee refused, remembered settlement,
    duplicate-check, adjacent, update-header whitelist, delete; a reopened cheque draft saves
    again with its book (A3), `mobile` refused (D3), 403 without post / view (D2).
  - `payment-post-flows` — one bill by NEFT, the bank charge, identity to the paisa, 409 on a
    moved bill, the supplier's own discount (and none without terms or past the window), a held
    debit applied, on account → ADVANCE (DR) spent later and the cancel it guards, a SETTLED
    transfer refusing cancel, the approver kept (E1), rounding up (E2), and the worked example
    — NEFT + post-dated cheque + TDS + discount + a debit note in one post.
  - `payment-cheques` — leaf at post, number / book refusals, finished book 409, two concurrent
    posts get consecutive leaves, a rolled-back post returns its leaf, post-dated cheque voucher,
    cancel CANCELS the register row, refused once presented; a post-dated payment cancels
    cleanly, and so does another payment of a party still holding one (notes 61); refused once
    the cheque came back unpaid (BOUNCED).
  - `payment-tds` — seeded and grossed up, a disagreeing figure 409, no-PAN 20%, below threshold,
    no rate in force; the TDS register row and its reversal; TDS on an advance and on a bill
    smaller than the tax (A1); interest left out of the base (B1); a keyed line on an unflagged
    party refused (B2).
  - `payment-amend` — the setting switched ON in `beforeAll` and put back after (F8); restated
    in place (id, number, refno kept; revision +1), stale `baseRevision` 409, party change 409,
    setting off 409; with a cheque (old leaf CANCELLED, new leaf taken); with TDS
    (`tdsReversed` 1); refused once a cheque is presented, the advance spent, or the transfer
    SETTLED. notes (63): cheque → cash, then `/cancel` passes and the leaf keeps its amend
    reason; cheque → cash → cheque passes and takes a fresh leaf; a leaf STOPPED through the
    real `/issued-cheques/stop` still refuses both `/cancel` and `/amend`. The suite also grants
    menu 52 for the Stop.
- `test/issued-cheques-on-account.e2e-spec.ts` (notes 64, 6 tests), run for `/stop` and for
  `/returned`, through the real routes (tester1 is granted menus 100 and 52): a cheque wholly on
  account (the ADVANCE settled by the ChqBnc, the party reconciles to 0); the ADVANCE first
  spent by another payment (409 `VCH_ADVANCE_SPENT` naming it, the leaf still HELD); 10 to a
  bill + 5 on account (the bill reopens by 10, the ADVANCE by 5, the ChqBnc balances at 15).
