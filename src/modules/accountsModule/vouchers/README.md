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
| 6.12 | GET | `/get` | view | header, legs (generated flagged), allocations, bills, GST doc, TDS, rights, locks |

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
  no PAN, the Contra side rule, the multi-party Journal, the short receipt).
* `test/vouchers-register-http.e2e-spec.ts` — the same over HTTP on the live
  database, plus #12 rights, #14 concurrency, #15/#16 cancel, #18 draft, #19
  validate = post, #21 balance = `fn_ledger_book_balance`, #22 the books check
  (every post runs it: `accounts.reconcile_on_post` is on). It grants tester1
  the register menus in `beforeAll` and revokes them in `afterAll`; run it
  `--runInBand`. Fixtures are permanent and labelled `E2E-VCH-<tag>`.

Not built here (§12 step 3, §13): the Receipt on the routine, Payment (menu
100), day-close, amend, print, e-invoice / e-way calls.
