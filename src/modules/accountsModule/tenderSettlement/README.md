# Tender settlement — `/api/v1/tender-settlement/*`

`till/plan-noncash-tender-control.md` (REV 1, 2026-10-07), on 49's schema (migration
`20261008130000_noncash_tender_control`) and the menu + grids of `20261008190000_tender_settlement`.
Card, UPI and wallet money is never in the drawer, so it is proven by machines, not counted:

| layer | where | what |
|---|---|---|
| 1 · at billing (§3) | `TenderDetailService.guardReference` — the one tender writer, so every document | see *The reference* below |
| 2 · at close (§4) | `src/modules/till` | one count line per terminal (`tender.close_by_terminal`: a card line names its tender when the session took card money on two); `GET/POST /till/sessions/slip-check`; `noRefCount` per tender on the session |
| 3 · the statement (§5) | **this module** | import with the tender's column map, match, post one TSet per payout, void |
| 4 · the exceptions (§6) | **this module** + grids | resolve an unexplained line, write off a row that never got its money |

## The reference (§3) — as the user set it on 2026-10-08

- A **money-in CARD** row on a tender that needs a reference carries the card's **last 4 digits**:
  `td_card_last4`, or a 4-digit `td_ref_no` (what today's client keys), which is copied into
  `td_card_last4`. Missing → 422 `TENDER_REF_REQUIRED`. An approval code, when sent, is 6 letters /
  digits.
- **UPI and wallet are not asked for a reference yet** ("on rush hours it is hard"). The plan's
  12-digit UTR rule waits; the session payload's `noRefCount` and the statement's AMOUNT_TIME
  suggestion are what cover them meanwhile.
- **Duplicate** (`tender.duplicate_ref`, BLOCK by default): a card row repeating another live row's
  approval code + last 4 + amount on the same tender → 409 `TENDER_REF_DUPLICATE`, journalled
  `DUPLICATE_REF_BLOCKED` on its own connection (the refusal rolls the save back). WARN lets it
  through; the DUPLICATE REFS grid lists it either way. Dormant until the tender dialog sends
  approval codes. UPI references are not checked (the user's "skip UPI").
- Money out (a refund, a payment, an expense) is never asked. A row re-saved unchanged is not
  judged again, so drafts keyed before the rule still save.
- `td_settle_status = PENDING` + `td_expected_settle_on` at save is REV 2 §2.4's
  (`defaultSettlement`): CARD / UPI / WALLET with SLIPS / STATEMENT close and a settlement ledger.

## Routes (menu 278 Settlement Reconciliation, hidden until the screen ships; no SUPER ADMIN bypass)

| route | right | does |
|---|---|---|
| `GET format` · `POST format` | VIEW · EDIT | a tender's `tnd_statement_format` (the Tender master does not carry it); validated in full, `SETTLEMENT_FORMAT_INVALID` lists every problem |
| `POST format/test` | VIEW | multipart sample file → what the map reads (200 lines), problems, payouts. Nothing written |
| `POST import` | CREATE | multipart `file` + `tenderId` (+ `payoutRef` / `payoutDate` when the file has no payout column). One import per payout; each line's tender from its TID (`tnd_terminal_id`) / VPA (`tnd_upi_vpa`), else the file's tender. Refused whole: unreadable rows (`SETTLEMENT_FILE_INVALID`, every row listed), another store's terminal (`SETTLEMENT_OTHER_STORE`), an unknown terminal (`SETTLEMENT_TERMINAL_UNKNOWN` — unless the shop's one tender has no terminal id yet), the same file again (`SETTLEMENT_FILE_DUPLICATE`, sha256), no settlement ledger (`SETTLEMENT_BANK_MISSING`). Matched at once; `SETTLEMENT_IMPORTED` |
| `GET get` | VIEW | the payout, its lines, the tender row each points at |
| `POST match` | EDIT | re-runs matching on the waiting lines (idempotent) |
| `POST confirm` | EDIT | a SUGGESTED line accepted, or (with `tdId`) linked by hand — MANUAL |
| `POST unlink` · `POST ignore` | EDIT | back to UNMATCHED · not part of this payout (out of its totals) |
| `POST post` | POST | one **TSet**; refused while a suggestion waits (`SETTLEMENT_SUGGESTIONS_OPEN`); `SETTLEMENT_POSTED` |
| `POST void` | CANCEL | unposted → VOIDED; posted → TSet reversed, rows PENDING again (a charged-back row SETTLED again), lines let go of their rows (the old link kept in `asl_notes`). Refused once a line was resolved or a row written off since (`SETTLEMENT_POSTED_LOCKED`). The file may be read again |
| `POST resolve` | **OVERRIDE** | an unmatched SALE line of a posted payout: LINKED (to the bill's row on this tender — re-tender the bill first if it was keyed as another), REFUNDED, INCOME (an Income ledger), SUSPENSE. LINKED / INCOME post a TSet journal Dr Tender suspense / Cr the row's ledger or the income ledger |
| `POST write-off` | **OVERRIDE** | a PENDING / PARTIAL row (the unpaid part) or a charged-back one: RECOVER (a named ledger), SUSPENSE, LOSS (role WRITE_OFF). A **TVar** Dr that ledger / Cr the row's ledger (Tender suspense for a charged-back or close-parked row); nothing posts when both are suspense. Row FAILED; `NONCASH_WRITTEN_OFF` on the row's own session. A SETTLED row → `SETTLEMENT_POSTED_LOCKED` |

**OVERRIDE stands in for the approvals** (`SETTLEMENT_RESOLVE`, `NONCASH_WRITE_OFF`, Store Manager) until
the till's phase-3 gate ships — user's call, 2026-10-08. Without it: 403
`SETTLEMENT_RESOLVE_NEEDS_APPROVAL` / `NONCASH_WRITE_OFF_NEEDS_APPROVAL` (with `event`,
`requiredRole`). The write-off's event payload records who stood in.

## Matching (§5.4, `settlement-match.ts`, pure)

REF (RRN / UTR = `td_ref_no`, amount within `tender.match_amount_tolerance`) → MATCHED; AUTH (card:
approval code + last 4 + amount, within a day) → MATCHED; AMOUNT_TIME (same tender and amount, within
`tender.match_window_minutes` of the row's creation, exactly one candidate each side) → SUGGESTED.
A SALE takes a money-in row PENDING / PARTIAL; a REFUND a money-out one; a CHARGEBACK a money-in row
already SETTLED. One row, one SALE line, across years and imports (the service, then
`ux_asl_td_matched`, 409 `SETTLEMENT_TD_ALREADY_MATCHED`). Candidates: the store's rows of the lines'
tenders, 60 days back from the earliest line.

## TSet (§5.5)

```
Dr  bank (asi_bank_ledger_id = tnd_settlement_ledger_id)   net      (Cr when negative)
Dr  BANK_CHARGES                                            fee
Dr  GST_ON_CHARGES_PENDING                                  tax on the fee
Dr  TENDER_SUSPENSE                                         chargebacks + refunds no row explains
    Cr  each matched SALE row's own ledger                  its gross   (a REFUND: Dr)
    Cr  TENDER_SUSPENSE                                     sales no row explains + adjustments
                                                            + rows a close variance parked (tvr_rows)
```
Legs are netted per ledger. **"The row's own ledger" is `COALESCE(td_settle_ledger_id,
td_tender_ledger_id)`** — the ledger its own posting debited. That matters: a sale bill debits the
tender's `tnd_ledger_id` (the clearing ledger the plan means), but the receipt and the voucher
register treat `tnd_settlement_ledger_id` as the clearing ledger and debit it directly. Either way the
TSet credits what was debited, so the bank ends at net. A matched row: SETTLED (PARTIAL when the
provider paid another amount), `td_settled_on` = payout date, `td_settle_amount` = gross,
`td_settle_ref_no` = payout UTR, `td_settle_voucher_id`. **`td_mdr_amt` is not written** (plan §5.5
says fee + tax): it is a receipt's own bank-charge split, rebuilt into its BANK_CHARGES leg on an
amend, so the acquirer's fee stays on the statement line.

## Statement format (`settlement-format.ts`)

`{ version: 1, source: CARD|UPI|WALLET|BANK, provider, columns: { gross (required), txnOn, kind,
terminalId, vpa, refNo, authCode, cardLast4, payer, fee, tax, net, payoutRef, payoutDate },
kindMap: { SALE: [...], REFUND: [...], CHARGEBACK: [...], FEE: [...], ADJUSTMENT: [...] },
dateFormat: 'DD/MM/YYYY HH:mm', negativeIsRefund: true }` — headers case-blind, times read as IST,
"1,234.50" / "(160.00)" / "160.00 DR" understood, a stated net must equal gross − fee − tax.
**CSV only** (plan §12.1: no real file yet — XLSX waits for one, and a library). BANK source = UPI
straight to the current account: no payout ref, no fee.

## Lists (grids, `20261008190000`, ids 138–143 on the dev box)

`MAIN LIST - TENDER SETTLEMENTS` (iasi_company_id, iasi_branch_id, iasi_acc_year, iasi_status,
ifrom_date, ito_date) · `TENDER SETTLEMENT - LINES` (iasi_id, iasi_acc_year) · `… - NOT RECEIVED`
(itd_company_id, itd_branch_id, igrace_days '' = 2, itender_id) · `… - UNEXPLAINED` (iasi_company_id,
iasi_branch_id) · `… - DUPLICATE REFS` (itd_company_id, ifrom_date, ito_date — company-wide: two
stores' rows meet there) · `… - SUSPENSE` (iavh_company_id, iavh_branch_id, ifrom_date, ito_date —
every Tender suspense leg and the document behind it).

## Not built

- The closed-session pairing of §6.2 (LINKED to a CLOSED session's variance, `asl_tvr_*`): a non-cash
  close variance cannot be decided until phase 3, so no case reaches it yet.
- Deciding a NONCASH_VARIANCE at close (SUSPENSE TVar, `tvr_rows`) — phase 3's approval. The TSet and
  the write-off already honour `tvr_rows` when it is filled.
- The HO chain-wide upload split (§5.1) — the cloud's side; the store API here is what it calls.
- XLSX, provider-specific formats, integrated payments (§3.4 — a plan per provider).
- The Qt screens (§8).

## Tests

`settlement-format.spec.ts`, `settlement-match.spec.ts` (unit) and `test/tender-settlement-http.e2e-spec.ts`
(`--runInBand`; owns two card terminals, their ledgers, a counter, a safe, a session and everything it
writes).
