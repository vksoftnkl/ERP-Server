# Voucher Register

One register screen for every accountant voucher, and **one posting routine**
behind it. Journal, Contra, Debit Note, Credit Note, Purchase (Accounting),
Sales (Accounting), Receipt Voucher and Payment Voucher are the same form: a
header, n Dr/Cr legs, bill-wise allocation on the party leg, an optional GST
band. What differs is **rules**, and the rules are data on the voucher type
(`accounts.acc_voucher_types.vchr_*`, migration `20260925160000`).

Implements *Voucher Register: the whole design in one file* (2026-09-25),
§5 – §8, §10, §11.1. Section numbers below refer to it.

**The whole module in one line:** the client sends only the lines the operator
typed; the server works out every tax, TDS and party leg itself, and
`/validate` and `/post` run exactly the same derivation.

---

## Endpoints

All under `/api/v1/vouchers`. No path params. Every route that acts on an
existing voucher takes the house key `companyId · branchId · accYear · voucherId`.
There is **no `/list`**: the F8 list is grid 117 and the exceptions report grid 118.

| # | Method | Path | Right (on the TYPE's menu) | What |
|---|---|---|---|---|
| 6.1 | GET | `/types` | — | the register types the caller may VIEW, each with rules + rights. `menuId` = a type's own menu narrows to it |
| 6.2 | GET | `/ledger-pick` | view | ledgers legal on one side of one type, minus instrument-controlled ledgers |
| 6.3 | GET | `/ledger-balance` | — | opening + Σ `av_signed_amount` (POSTED and CANCELLED) ≤ asOn |
| 6.4 | GET | `/party-facts` | — | GSTIN, state, credit days, bill-by-bill, TDS section/rate, outstanding |
| 6.5 | GET | `/open-bills` | — | a party's open bills on one side, oldest first |
| 6.6 | GET | `/tax-rates` | — | the active `tax_rate_master` rows |
| 6.7 | POST | `/create` | create / edit | a DRAFT: the header, payload verbatim in `avh_draft_lines`, nothing else |
| 6.8 | POST | `/validate` | view | the same derivation, dry. Always 200; refusals[] + warnings[] together |
| 6.9 | POST | `/post` | post (+ create on a new voucher) | the routine, one transaction |
| 6.10 | POST | `/cancel` | cancel | a `Rev` reversal (decision C / C2) |
| 6.11 | POST | `/delete` | delete | DRAFT only; POSTED → 409 "cancel it" |
| 6.12 | GET | `/get` | view | header, legs (generated flagged), allocations, bills, GST doc, TDS, rights, locks, **instruments, pdcVouchers** |
| n54 | GET | `/instruments` | — | the tenders a Receipt Voucher line may come in by (no TEMP_CR / CREDIT / LOYALTY / RRN), each with type, ledger, `isCash / isCheque / needsRef` |
| n52 | GET | `/adjacent` | view (per type) | Prev / Next: the key of the voucher just older (`prev`) / newer (`next`). Only types the caller may view; `typeCode` narrows to one; `status`/`fromDate`/`toDate` = the list's filters. No `voucherId` → prev = newest, next = oldest. Order = grid 117's, a DRAFT at the OLD end of its date (slno coalesced to 0) |

Envelope `{success, message, data}` / `{success:false, message, errors:[{field, message, code, line?}]}`.
Status map: 400 malformed · 403 right missing · 404 not found (a voucher scoped to
another company is a 404, never a 403) · 409 state · 422 rule refusals, all in one body.

## Files

| File | Holds |
|---|---|
| `voucher-derive.ts` | **the derivation, pure** — §7.3 steps 3–7 and 10–12 as one function of preloaded facts. Unit-tested in `voucher-derive.spec.ts` |
| `voucher-facts.ts` | the reads the derivation is fed: ledger + group ancestry (one recursive CTE), instrument ledgers, tax rates, role ledgers, TDS rate, bills |
| `voucher-register.service.ts` | create / validate / post / delete / get |
| `voucher-cancel.service.ts` | §8.3 |
| `voucher-billwise.helper.ts` | the raised bill, the allocation rows, their reversal |
| `voucher-types.service.ts` | the type rules, and §6.1 with rights per menu |
| `voucher-lookups.service.ts` | the pickers and facts |
| `vouchers.errors.ts` | the `VCH_*` codes, the WARN/refuse context, the throw sites |

## The routine (§7.3), and where each piece lives

| Step | Piece | Where |
|---|---|---|
| rights | `loadRights` on `vchr_menu_id` | `common/posting/rights.ts` |
| calendar | year status, `fy_lock_date` ≥ date → `VCH_PERIOD_LOCKED`; partition | `prepare()`, `receipt.guards.assertVoucherPartitionExists` |
| typed lines, GST, TDS, party leg, balance | `derive()` | `voucher-derive.ts` |
| number + header + legs | `VoucherPostingService.postLegs` (new, or `draftVoucherId` into the draft) | `common/posting/voucher-posting.service.ts` |
| bills + allocations | `raiseBill`, `writeAllocations`, then `BillBalanceRecomputeService.recomputeBills` | `voucher-billwise.helper.ts`, `billBalance/` |
| GST document | `DocRegisterService.write` with `sourceModule 'ACCOUNTS'` | `common/posting/doc-register.service.ts` |
| TDS register | one `acc_tds_register` row (a BELOW_THRESHOLD row too — the annual threshold counts it) | `post()` |
| status log, books check | `appendTxnStatusLog`, `assertBooksReconcile` | shared |
| cancel | `VoucherPostingService.reverseLegs` (type `Rev`, dated the original) | shared |

## Decisions this code took where the plan left room

* **Bill-wise on RAISE types = full bill + pairs.** The party leg raises its
  bill for the WHOLE amount; an allocation against an existing bill is a pair
  of `acc_bill_adjustment` rows (raised ↔ existing: `ADVANCE_ADJUST` for an
  advance, `TRANSFER` on a Journal, else `NOTE_ADJUST`) — the sale bill's
  set-off shape, and the only one `ck_abj_against` admits for a two-sided
  settlement. Unallocated, the raised bill stays OPEN (§4.2). On DEMAND types
  (Receipt / Payment Voucher) the money comes from outside: one `ALLOCATION`
  row per bill, Σ must equal the party leg exactly.
* **`abl_alloc_amount` is re-derived**, never incremented: every write here
  ends in `recomputeBills` (the TypeScript `fn_abl_recompute`), the same code
  the receipt runs.
* **`gdr_doc_type`** has no PURCHASE / SALES member: an accounting purchase or
  sale is an `INVOICE` with `gdr_tran_nature PURCHASE` (INWARD, party VENDOR)
  or `SALE` (OUTWARD, party CUSTOMER). Notes are `CREDIT_NOTE` (sign −1) /
  `DEBIT_NOTE`.
* **Instrument-controlled ledgers** = `fn_is_cheques_in_hand_ledger()` plus a
  non-cash tender's `tnd_ledger_id` / `tnd_settlement_ledger_id` — **except a
  cash or bank ledger** a tender settles straight into, which a Contra must be
  free to move (on this box UPI / CARD / BANK all point at the bank account).
* **TDS on a payment-shaped type** (party DR, bills demanded): the bank line is
  the NET, so the base is grossed up (`net / (1 − r)`) and the deduction is the
  difference; the party leg is then the gross, which is what the bill demands.
  `acc_tds_register.atd_deductee_type` is COMPANY / NON_COMPANY, mapped from
  the ledger's six-value list.
* **Receipt and Payment Voucher take MANY parties** (notes 53, migration
  `20260926150000_receipt_payment_many_parties`): a salesman's collection run
  is one Receipt, a payment run one Payment. `vchr_party_side` (RcpV CR, PmtV
  DR) and `DEMAND` stay. Each party line is its own party leg; allocations
  carry `lineRowNo` = that line and must total it exactly, and
  `abj_party_id` is the line's party. **DEMAND stays strict**: an on-account
  remainder is refused (`VCH_BILLWISE_SHORT`), not raised as an ADVANCE bill —
  key the on-account part on its own voucher. (Raising an ADVANCE for the
  remainder is possible later; it is a new bill shape on a DEMAND type, so it
  was not slipped in.)
* **TDS on a MANY Payment is per party line.** Every typed line on the party
  side whose ledger is a TDS-applicable party (tick not cleared) is grouped by
  party; each party gets its own rate (`tds_rates` by its section × deductee ×
  date, 206AA without a PAN), its own threshold against ITS annual base, one
  `CR TDS Payable` leg and one `acc_tds_register` row (26Q is per deductee).
  The typed line is the NET paid; it is grossed up to the gross, so **the
  line's allocations must total the gross**, as the ONE-mode party leg's do.
  `/validate` answers `derived.tdsLines[]` (`{lineRowNo, partyId, partyName,
  section, rate, rateSource, base, tax, deducted, reason, fromRows}`), one per
  deductee on every type (ONE mode: the same entry as `derived.tds`, which is
  null on MANY). Cancel reverses every live `atd_` row. Other MANY types that
  deduct (none today) are refused — only a payment is grossed up.
* **A voucher posted under ONE keeps its header party** after its type turned
  MANY; `/get` finds its generated party leg from the stored `avh_party_id`.
* **A zero TDS base is silent** (nothing was ticked); a base under the
  section's threshold is the `VCH_TDS_BELOW_THRESHOLD` WARN.
* **The period lock is checked against the voucher DATE**, not today: a draft
  typed before a lock still posts into an open day (§7.3 step 2). The year's
  status must be OPEN.
* **`VCH_BACKDATED`** reads `accounts.backdate_mode` (OFF / WARN / REFUSE)
  through the settings resolver; the key is not seeded — absent = OFF.
* **`av_opp_ledger_id`** = the party on every non-party leg when the voucher
  has exactly one party (a `VoucherLeg.oppLedgerId` was added to the shared
  writer for it). `/get` marks a leg generated by its role, or, for the party
  leg, as the last leg on the party's ledger on the party side.
* Codes beyond the plan's list, for cases it describes without naming:
  `VCH_NO_LINES`, `VCH_LINE_AMOUNT`, `VCH_LEDGER_INACTIVE`, `VCH_LEDGER_NOT_FOUND`,
  `VCH_PARTY_NOT_FOUND`, `VCH_BILL_NOT_FOUND`, `VCH_BILL_WRONG_PARTY`,
  `VCH_BILL_WRONG_SIDE`, `VCH_ALLOCATION_LINE`, `VCH_DATE_OUTSIDE_YEAR`,
  `VCH_TYPE_INVENTORY`, `VCH_GST_NOT_ALLOWED`, `VCH_TDS_RATE_MISSING`,
  `VCH_IRN_LIVE`, `VCH_NOT_POSTED`, `VCH_CANCELLED`, `VCH_NOT_FOUND`,
  `VCH_DOC_REFNO_REQUIRED`, `VCH_INVALID`.

## notes (54) — the Receipt Voucher takes cheques (register instruments)

Migration `20260926120000_voucher_register_instruments`: `acc_voucher_types.vchr_instruments`
(true for RcpV; RcpV's Dr group list cleared), exposed as `instruments` on `/types`.

* **The line carries its instrument.** On a type with `instruments`, a typed
  line on the party's side (CR on a Receipt) may carry
  `instrument: {tenderId, refNo, instrumentDate, bankName, cheque{drawerName, bankBranch, ifsc, micr}}`
  — the Receipt's tender names. The server generates the **Dr leg** from the
  tender's ledger (its clearing ledger when the master names one) for the
  line's amount, `source INSTRUMENT`; the operator never types Cheques In Hand.
  A line without an instrument keeps the older shape (a typed Dr cash line
  beside it still works). `header.employeeIds` → `avh_employee_id`.
* **Refusals**: `VCH_INSTRUMENT_NOT_ALLOWED` (a type without instruments, or an
  instrument on the wrong side), `VCH_INSTRUMENT_TENDER` (unknown / inactive /
  another company's / a credit-shaped tender, or a reference-needing tender
  without one), `VCH_CHEQUE_DETAILS` (a cheque without date, number or bank;
  or a number already in the register for that party and year —
  `ux_apd_instrument`), `VCH_NO_LINES` when every line is post-dated.
* **A post-dated cheque** (dated after the voucher) marks its party line and
  Dr leg `postDated / postsOn`; `/validate` lists them in `derived.postDated[]`
  and `totals` is today's voucher only. `/post` gives each its **own voucher on
  its date** (same type, `avh_against_voucher_id` → today's, in the same
  transaction — the Receipt's way); its allocation rows are `abj_is_post_dated`
  and count from the cheque's date (`BillBalanceRecomputeService`).
* **`/post` also writes** one `acc_tender_detail` row per instrument through
  `TenderDetailService.syncDocumentTenders` (`td_src_doc_type RECEIPT`,
  `td_voucher_id` = the carrying voucher, `td_party_ledger_id` = the line's
  party) and one `acc_pdc_register` HELD row per cheque (`apd_party_id` = the
  line's party, `apd_tender_id` = its tender row, `apd_posting_mode ON_RECEIPT`);
  a cheque line's allocations carry `abj_cheque_id` / `abj_tender_id`, mode
  `CHEQUE`. Menu 51 then owns the instrument: deposit, clear, bounce.
* **`/cancel`** is refused with `VCH_CHEQUE_MOVED` unless every cheque of the
  voucher (found the Receipt's way — by tender row, not `apd_voucher_id`) is
  still HELD. Otherwise the HELD rows go CANCELLED (freeing the number), the
  tender rows are retired, and every post-dated voucher is reversed with it.
  A post-dated cheque's own voucher cannot be cancelled on its own.
* **The books check tolerates un-matured post-dated settlements**
  (`voucher-books.helper.ts`): `fn_ledger_book_balance` counts the post-dated
  voucher's legs today while its bill-wise row waits for the date, so a party
  is in balance when ledger − bills = Σ its signed un-matured post-dated rows.
  Cheques In Hand is checked strictly.
* **`/get`** returns `instruments[]` (each tender row with `pdcId / pdcStatus /
  pdcAccYear`, the carrying voucher's refno and date), pins each onto its party
  line and Dr leg (`legs[].instrument`), lists the post-dated cheques' own
  vouchers with their legs and allocations (`pdcVouchers[]`), and
  `locks.chequeMoved`. A draft keeps the instruments in its stored payload.

## notes (55) — the Payment Voucher issues cheques (register cheques #2)

Migration `20260926190000_payment_cheques`; module `../issuedCheques/` (menu 52).
`register_payment_cheques.md` and `payment/plan-backend-payment.md` were not
available when this was built, so the shapes below were DESIGNED here from
notes (55) and the received-cheques module. **Every name is listed at the end.**

* **A PmtV line pays by an instrument** (`vchr_instruments = true` on PmtV).
  `readIssuedInstrument` (voucher-derive.ts) takes over when the type's party
  side is DR: tender types CASH / UPI / CHEQUE / BANK only; cash posts to the
  CASH tender's ledger, everything else to `instrument.bankLedgerId` (a ledger
  under Bank Accounts / Bank OD — `VCH_BANK_REQUIRED`). A cheque names a BOOK
  (`VCH_BOOK_REQUIRED`) drawn on that bank (`VCH_BOOK_BANK`) with a leaf left
  (`VCH_BOOK_FINISHED`); `refNo` is ignored. `/validate` shows each cheque's
  `instrument.nextLeaf`, counting on across the voucher's lines in row order —
  shown, not promised.
* **/post takes the leaf** (`takeNextLeaf`, cheque-book.helper.ts): the book row
  `FOR UPDATE`, `acb_next_leaf` handed out and moved on, the book FINISHED as its
  last leaf goes. The leaf becomes `td_ref_no` and `apd_instrument_no`; the P row
  is HELD with `apd_bank_ledger_id`, `apd_cheque_book_id`, `apd_favouring`
  (default: the party's name; also `td_beneficiary_name`) and `apd_ac_payee`
  (default true, Q8). BANK / UPI / cash: a tender row only.
* **What a cheque carries is its money leg**, not the party line: with 53's TDS
  the line is grossed up (10,000) and the cheque is for the net (9,800) — the
  tender and register rows now take the INSTRUMENT leg's amount.
* **A post-dated payment line takes its TDS leg with it** into its own voucher,
  so both vouchers balance; a party with TDS across several lines, one of them
  post-dated, is refused (`VCH_INVALID`) — pay that cheque on its own voucher.
* **Issued ≠ in hand.** An issued cheque's tender row names the BANK with the
  cheque tender type, so `fn_is_cheques_in_hand_ledger` now counts DR (received)
  tender rows only, and `fn_cheques_in_hand_reconcile` counts `apd_tra_type 'R'`
  only. `ux_apd_instrument` is received-only; an issued leaf is unique per bank
  (`ux_apd_issued_leaf`). `ck_apd_cleared` (P11b): a P row clears with no
  voucher — it was posted when written.
* **/cancel** refuses unless every cheque is HELD (`VCH_CHEQUE_MOVED`, naming
  menu 52 for a P row); HELD rows go CANCELLED; the leaves stay consumed.
* **Issued-cheque actions** (`/issued-cheques/*`, rights on menu 52):
  `presented` HELD → CLEARED, no voucher (right: post); `returned` HELD →
  BOUNCED, `stop` / `void` HELD → CANCELLED (`STOPPED: …` / `VOIDED: …`) (right:
  cancel) — each reverses the cheque's ONE line through a `ChqBnc` voucher
  against the payment: DR bank (the cheque) + DR TDS Payable (the line's
  deduction = its allocations − the cheque) / CR supplier (the gross); the
  line's allocations by `abj_cheque_id`; a counter-row on the party's
  `acc_tds_register` row (refused if deposited, `VCH_TDS_DEPOSITED`);
  optional `charges` DR BANK_CHARGES / CR bank. `replace` (right: amend, + post
  on 261) stops a HELD cheque first, then raises a NEW PmtV
  (`VoucherRegisterService.postWithin`, same transaction) for the old amount,
  the old line's TDS treatment and the bills the old cheque settled, on the next
  leaf of the named book; the old row goes REPLACED → the new one.
* **Cheque books** (`/cheque-books/*`, menu **263** "Cheque Books" under Accounts since
  notes (58), migration `20260928190000`; Issued Cheques' button opens the same screen and
  the rights are 263's from either door — get VIEW, create CREATE, edit / close EDIT): `get` (with every leaf used and
  where it went), `create` (upsert; two live books on one bank may not share a
  leaf — `VCH_BOOK_OVERLAP`; once a leaf is out, the bank and first leaf are
  fixed), `close`. Lists: grid 120 (books), grid 121 (issued cheques).

**Names chosen here** (not in notes 55): table columns `acb_*`
(`acb_book_no, acb_leaf_from/to, acb_next_leaf, acb_leaf_width, acb_format,
acb_status ACTIVE|FINISHED|CLOSED, acb_closed_on, acb_close_reason`);
`td_beneficiary_name / _account_no / _ifsc`; `apd_cheque_book_id`,
`apd_favouring` (beside the asked-for `apd_ac_payee`, `apd_printed_on`,
`apd_print_count`); codes `VCH_BOOK_NOT_FOUND`, `VCH_BOOK_OVERLAP`,
`VCH_BOOK_INVALID`, `VCH_CHEQUE_NOT_FOUND`, `VCH_CHEQUE_STATE`,
`VCH_RIGHT_AMEND`; `/cheque-books/*` and `/issued-cheques/*` as their own
controllers (not under `/vouchers`); the issued-cheque key
`{apdId, apdAccYear, companyId, branchId}`; `GET /vouchers/instruments?typeCode=PmtV`
narrows to payable tenders; `derived…instrument` gained `issued, bankLedgerId,
chequeBookId, bookNo, nextLeaf, favouring, acPayee`; `/get`'s `instruments[]`
gained `issued, leaf, chequeBookId, bookNo, favouring, acPayee`.

## notes (56) — the cash/bank side of a Receipt / Payment

`sideVerdict()` in `voucher-derive.ts` is keyed on `vchr_nature`: on a RECEIPT the DR side
takes cash / bank ONLY and the CR side never; a PAYMENT is the mirror. Cash / bank is a ledger
whose group, or any ancestor, is Cash-in-Hand, Bank Accounts or Bank OD A/c (by reserved id,
then by name — `isMoneyLedger`). The nature rule speaks before the type's group list, so the
refusal reads *"…may not be debited on a Receipt Voucher — the DR side takes cash or bank
only"* / *"…may not be credited on a Receipt Voucher — cash to bank is a Contra"*.
`/ledger-pick` applies the same filter in SQL. Migration `20260928170000` set PmtV's CR list
and RcpV's DR list to the three groups. Con and Jrl are untouched.

## notes (57) — the unallocated remainder is kept as an ADVANCE

On a DEMAND type with a money side (RcpV, PmtV), a party leg may be allocated **less** than
its amount, never more (over-allocation stays `VCH_BILLWISE_SHORT`). The remainder raises
**one ADVANCE bill on the party** for `leg − Σ allocations`: `abl_bill_type = 'ADVANCE'`, the
leg's side (a CR on the customer who paid ahead, a DR on the supplier we paid ahead), dated
the voucher, no due date, `abl_doc_refno` = the voucher's refno, linked to the voucher like a
raised bill. It is the row `/receipts` R7 writes, so the sale bill's advances band, the
receipt's credits band and a Journal on `/vouchers` adjust it (`ADVANCE_ADJUST`) with no
change. On a Payment with TDS the leg is the GROSS, so the remainder is gross − allocated.
An advance left on a post-dated cheque line is raised on that cheque's own voucher, dated
the day it clears.

`derived.bills[]` says so before Post: the entry carries `billType: 'ADVANCE'`,
`isAdvance: true`, `dueDate: null` (no new field; the client never sends the remainder). The
cancel path retracts it the way it retracts a raised bill, on every voucher of the set, and
refuses while another voucher has settled against it (`VCH_ALLOCATED_ELSEWHERE`).

Setting `accounts.voucher_allow_advance` (BOOL, COMPANY, default **true**, migration
`20260928180000`): false keeps the strict rule, every rupee bill by bill. OPTIONAL (Journal)
and the RAISE types are unchanged.

## Grids and ui_tables (§10) — migration `20260926100000_voucher_register_grids`

| Id | Name | Params |
|---|---|---|
| grid 117 | `TXN MAIN LIST - VOUCHER REGISTER` | `icompany_id, ibranch_id, iacc_year, ifrom_date, ito_date, itype_code, iuser_id` — filtered to the types the user may VIEW. **Send every token**, `''` for none |
| grid 118 | `VOUCHER REGISTER - EXCEPTIONS` | same minus `itype_code`: Jrl / DrN / CrN allocations touching a SALES or PURCHASE bill |
| ui_table 39 | `VOUCHER REGISTER - LEGS` | #, Dr/Cr, Ledger, Group, GST, HSN/SAC, TDS, Debit, Credit, Role, Leg narration, hidden Generated |
| ui_table 40 | `VOUCHER REGISTER - BILLWISE` | Bill / Ref, Date, Type, Pending, This voucher, Due, hidden keys |

## Tests

* `voucher-derive.spec.ts` — §11.1 #1–#11 over the pure derivation (the PNG
  example, inter-state, RCM, typed tax ledger, the credit note, threshold,
  no PAN, the Contra side rule, the multi-party Journal, the short receipt),
  notes (56) the money side, notes (57) the remainder kept as an advance
  (and the strict setting).
* notes (54) in both: the three-customer run (a cheque today, cash, a
  post-dated cheque), a bounce reopening only its customer's bill, a cancel
  refused after a deposit, and a cancel with every cheque HELD.
* `test/vouchers-register-http.e2e-spec.ts` — the same over HTTP on the live
  database, plus #12 rights, #14 concurrency, #15/#16 cancel, #18 draft, #19
  validate = post, #21 balance = `fn_ledger_book_balance`, #22 the books check
  (every post runs it: `accounts.reconcile_on_post` is on). It grants tester1
  the register menus in `beforeAll` and revokes them in `afterAll`; run it
  `--runInBand`. Fixtures are permanent and labelled `E2E-VCH-<tag>`.

Not built here (§12 step 3, §13): the Receipt on the routine, Payment (menu
100), day-close, amend, print, e-invoice / e-way calls.
