# Expense voucher (ExpV) — `/api/v1/expenses/*`

`till/plan-till-receipt-payment-expense.md` §4 (REV 1, 2026-10-07) and REV 2 §2.16: an expense
paid by one or more **tenders** — expense lines on one side, how it was paid on the other, equal
to the paisa. At a till it is the cashier's petty-cash form (it replaces PAID_OUT, which 48
removed); in the back office it is the quick expense entry. A supplier's bill or a COD delivery is
a bill-wise **Payment** (menu 100), a staff advance a Payment to the staff ledger.

## Storage — no table of its own

| part | where |
|---|---|
| header | `acc_voucher_header`, type `ExpV` (48; `vchr_menu_id` 277): business date, `avh_session_id`, `avh_party_id` (optional supplier), `avh_doc_refno` / `avh_doc_date` (the supplier's invoice), `avh_remarks` (paid to / notes), `avh_draft_lines` (the lines as typed — kept after post, the list grid reads it) |
| lines | `acc_vouchers` DR, one per line (`av_cost_centre_id`, `av_remarks`); input-tax legs DR on the `INPUT_CGST / SGST / IGST / CESS` roles when a GST bill is claimed |
| tenders | `acc_tender_detail`, `td_src_doc_type 'EXPENSE'`, `td_dr_cr 'CR'`, `td_session_id`; `td_party_ledger_id` = the supplier, else the first line's ledger (NOT NULL) |
| GST bill | the GSTR-2 register rows a purchase writes (`DocRegisterService`, INWARD, `docNo` = the supplier's invoice) |
| quick picks | `till_reason` category `EXPENSE` (its ledger fills the line) |

## Routes (menu 277, every verb judged on `user_menus`, no SUPER ADMIN bypass)

| route | does |
|---|---|
| `POST create` | a DRAFT (create, or edit with `voucherId`); nothing numbered — CREATE / EDIT |
| `POST validate` | always 200: `derived` (lines, tax, tenders and where each one's money comes from — `DRAWER`, `SAFE`, `LEDGER` — and the legs), `refusals`, `warnings`, `approval` — VIEW |
| `POST post` | numbers it, writes legs, tender rows, cost centres and (with a GST bill) the GSTR-2 row; answers the voucher with `warnings` and `approval` — POST |
| `GET get` | header, lines, tenders, legs as written — VIEW |
| `POST cancel` | a mirror in the Rev series; tender rows soft-deleted; the GSTR-2 row cancelled — CANCEL |
| `GET quick-reasons` · `GET ledger-pick` | the EXPENSE reasons with their ledgers · live ledgers under an `Expenses` group (company + shared, 500 at most) — VIEW |

Lifecycle DRAFT → POSTED → CANCELLED (no amend: cancel and re-enter). The number is issued at post.

The list is the configured grid **`MAIN LIST - EXPENSE VOUCHERS`** (137 on the dev box; the client
finds it by name) through `/configured-grid-sql/run`, tokens as the payments grid: `iavh_company_id`,
`iavh_branch_id`, `iavh_acc_year`, `iavh_status`, `ifrom_date`, `ito_date` ('' = no bound). Print
is the `EXPENSE_VOUCHER` purpose (ACCOUNTS / ACC_VOUCHER); like the receipt and payment purposes
it has no template until one is designed. Both: migration `20261008170000`.

## Rules

- **Lines = tenders** to the paisa, Decimal end to end — `EXPENSE_TOTAL_MISMATCH`. A line must sit
  under an `Expenses` group — `EXPENSE_LEDGER_NOT_EXPENSE` (no party, cash, bank or tax ledger).
- **GST bill** optional: supplier (a party ledger, `EXPENSE_PARTY_INVALID`), GSTIN, invoice no and
  date, each line a taxable value and a `tax_rate_master` rate — `EXPENSE_GST_INCOMPLETE` /
  `EXPENSE_GST_RATE_MISSING`; unmapped input-tax roles → `EXPENSE_GST_LEDGER_UNMAPPED`. A line
  with `itc: false` carries its tax in its cost. Place of supply defaults to the GSTIN's state.
  RCM, TDS and import of services are not here (PurA / Payment).
  `accounts.expense_gst_bill_above` WARNs (`EXPENSE_GST_BILL_MISSING`) when a large expense has
  no bill.
- **Tenders:** no cheque or post-dated instrument and no bank charge inside a tender —
  `EXPENSE_TENDER_NOT_ALLOWED`. *(Plan §4.2 sends cheque rows to the issued-cheque register; this
  build refuses them and points to a bill-wise Payment, which owns that register.)*
- **Where the cash comes from** (`TillSessionService.routeMoneyDoc`): a device in a till session →
  the drawer, the voucher stamped with the session; a back-office device in a branch that runs a
  till → the default safe (`till.backoffice_cash_from = SAFE`: the tender row and the CR leg name
  the safe's ledger) or refused (`REFUSE` → `TILL_SESSION_REQUIRED`); no till in the branch → the
  tender's own ledger. Non-cash rows are always the tender's (or clearing) ledger, and at the
  till's close they are "paid from bank" — shown, never counted.
- **Cancel** only while the session the cash moved in still takes money; after → 409
  `TILL_SESSION_CLOSED` (correct it with a new document or a journal).
- **40A(3)** (`payment/cash-payment-limit.ts`): the CASH rows, summed with the supplier's other
  cash payments (menu 100 and the register) and expenses of the day; no supplier → this voucher
  alone. Above `CASH_PAYMENT_LIMIT_40A3` (10,000 shipped) → WARN `STATUTORY_40A3`, never a
  refusal; a company REFUSE row refuses.
- **Approval** (EXPENSE rule, 500 shipped, on the TOTAL, in a till session): reported only —
  `approval` + an INFO `TILL_APPROVAL_REQUIRED` warning + the `EXPENSE_POSTED` event's payload.
  Phase 3's gate will enforce it.

## Till journal

`EXPENSE_POSTED` (payload: drawer cash, the approval need, the 40A(3) figures) and
`MONEY_DOC_CANCELLED`, through `TillSessionService.logMoneyDoc`. Status trail: `txn_status_log`
`EXPENSE` (CREATED, POSTED, CANCELLED).

## Tests

`test/expense-voucher-http.e2e-spec.ts` (`--runInBand`; owns its devices, counter, safe, session,
ledgers and every voucher it writes).
