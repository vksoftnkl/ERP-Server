# Till management — `/api/v1/till/*`

TILL_DESIGN.md REV 1 (the share's `till/`), **build phases 1 (the core session) and 2 (movements,
voids, cash limits)** (§13), on the
schema of share files 47 / 48 / 49 (migrations `20261008100000` / `110000` / `120000` / `130000`)
and the menus of `20261008140000`, with **REV 2's review** (`till/plan-till-review-rev2.md`,
which wins where it disagrees with REV 1). Where REV 1 and the later files disagree, the files win:
there is **no `till_operator`** table (47 §1.3 — the till reads `user_master` and
`employee_master`), and **PAID_OUT is gone** (48 — an expense is an ExpV, a supplier is a
bill-wise Payment). How a session gets its counter is `till/plan-till-counter-claim.md` (below).

## The counter claim (`plan-till-counter-claim.md`)

`device_master` is the machine talking; `till_counter` is the drawer. `tcn_device_id` is an
optional link ("this PC sits at this counter"), set only in the counter master — never by an open.

| the login's device is… | then |
|---|---|
| missing / deleted · blocked or switched off | 409 `TILL_DEVICE_UNKNOWN` · 403 `TILL_DEVICE_BLOCKED` |
| `till.require_session = false` (or linked to a counter that needs no session) | open-check says `requireSession: false`: no S1 |
| **linked** to a counter of this branch | that counter; another `counterId` → `TILL_COUNTER_NOT_YOURS`; inactive → `TILL_COUNTER_INACTIVE` |
| **unlinked** | `counterId` from the **free list** — this branch, active, needs a session, linked to no device, no session holding it — `tcn_sort_order`, `tcn_code`. None free → `TILL_NO_FREE_COUNTER`; one off the list → `TILL_COUNTER_NOT_YOURS`; one a session holds → `TILL_COUNTER_BUSY` |

The session is stamped with the device (`tss_device_id`) and the claim (`SESSION_OPEN`
payload `claim: LINKED | PICKED`); nothing is written to the counter, and the claim ends with the
session. One session holds a counter, a device and a cashier at a time (`TILL_COUNTER_BUSY` for the
first two, `TILL_OPERATOR_BUSY`). Web devices may claim, never be linked: the counter master
refuses type Web and the `web:` / `WEB-` uids. **Not built:** re-linking a dead PC from S1 and
moving a session to another device (§3.3 / §3.4) — both need the `COUNTER_RELINK` approval, phase 3.

## Menus and rights (no SUPER ADMIN bypass)

| menu | name | verbs and what they open |
|---|---|---|
| 271 | Till | the group |
| 272 | Open Till | VIEW `current` / `get` my session · CREATE `open` · EDIT `suspend` `resume` `end-billing` `count` `close` · PRINT (X read, later) |
| 273 | Till Sessions | VIEW another cashier's session · OVERRIDE the expected figures, and count / close someone else's drawer (cash office, absent cashier) |
| 274 | Business Day | VIEW `days/get` · CREATE `days/open` |
| 283 | Till Masters | the group of the four below (notes 102), VIEW only — granted to whoever views one of them |
| 275 | Till Counters | counters (was "Till Masters", all four, until notes 101) |
| 280 | Till Safes | safes |
| 281 | Till Reasons | reasons |
| 282 | Denominations | denominations; `denominations/list` also opens with Open Till (272) VIEW |
| 276 | Till Approval Setup | approval rules · approval authority |

Each master is judged on its own menu since the client split Till Masters into four screens
(notes 101, migration `20261009190000`, which copied 275's grants onto 280–282); notes 102
(`20261009200000`) put the four under the group 283. The seed ships
them hidden; rights work on a hidden menu. Ids are pinned in the migrations and in
`prisma/seed/Menu_Master.sql`. `counters/get` carries `deviceName` / `safeName`, `reasons/get`
`ledgerName`, `safes/get` `ledgerName`.

## Routes

| route | does |
|---|---|
| `POST days/open` · `GET days/get` | Day Open (the only way in under `till.day_auto_open = false`); a day and its sessions by status |
| `GET sessions/open-check` | everything S1 needs in one read: `requireSession`, the business day, the linked counter or the free / busy counters (each free one with its `carriedFrom`), the session this device holds, this user's session elsewhere. Advice only |
| `POST sessions/open` | counter by the claim rule above; opens the day; ISSUED float → **TFlt** Dr till cash / Cr safe; CARRIED inherits the last close's `tss_float_left`; the opening count is cash only, counted ≠ issued → an OPEN-stage `till_variance` **posted at once** with the default treatment (notes 98): **TVar** Dr / Cr Cash Short & Excess against till cash, `EXPENSE`, the `reasonId` named (category FLOAT_MISMATCH, else 422 `TILL_REASON_INVALID`) or the shipped UNKNOWN, which needs `notes`; logged `VARIANCE_DECIDED` (`byDefault: true`). The phase-3 approver re-treats it |
| `GET sessions/current` | the live session of this device, else of this user — superseded by `open-check`, kept for now |
| `GET sessions/get` | header, per-tender expectation, the vouchers it posted, its variances. **Blind**: the cashier gets every expected / variance figure `null` (`expectedVisible: false`) until CLOSED |
| `GET sessions/expected` | 273 OVERRIDE; refused to the session's own cashier before close (`TILL_BLIND_CLOSE`) |
| `POST sessions/suspend` · `resume` | break / idle; the operator, on the session's device |
| `POST sessions/end-billing` | → COUNTING; held bills go to the branch pool (`till.close_with_holds` RELEASE) or refuse (BLOCK → `TILL_HOLDS_OPEN`). **REV 2 §2.6:** the device sends `outboxCount` / `lastClientSeq`; anything unsent (or a journal the server has not received up to) → 409 `TILL_DEVICE_UNSYNCED`, logged `SYNC_PENDING_AT_CLOSE` outside the refused transaction. A client that sends neither is not checked |
| `POST sessions/count` | one attempt, every attempt kept. **ACCEPTED** (all counted drawer tenders within tolerance: variances written WITHIN_TOLERANCE, the count final) · **RECOUNT_REQUIRED** · **SENT_FOR_APPROVAL** (out on the last attempt: PENDING_APPROVAL). **Only the drawer decides** (notes 99 §1): a SLIPS line (card / UPI batch total) out of tolerance never asks for a recount — the count is final with `slipCheckRequired: true`, that variance PENDING, `tss_variance_status` PENDING and an `APPROVAL_REQUESTED` NONCASH_VARIANCE event (`enforced: false`). The cashier of a blind count never gets the figure, even holding 273 OVERRIDE |
| `POST sessions/close` | posts the variances (**TVar** Dr / Cr Cash Short & Excess; a PENDING slip variance stays OPEN and posts nothing), the hand-over (**TDrp** Dr safe / Cr till cash) of counted − `floatLeft`, freezes the totals, issues the counter's Z. PENDING_APPROVAL → **428** `TILL_APPROVAL_REQUIRED` (event, amount, level) until phase 3 |
| `POST movements/create` | **phase 2.** DROP (sealed bag, declared amount, bag / seal no) · PAID_IN (a PAID_IN reason; the ledger named or the reason's; **TPIn** Dr till cash / Cr ledger) · EXCHANGE (notes for notes, both sides counted and equal, no voucher, numbered `<session no>/X<n>`) — the session's cashier on its device, 272 EDIT. PICKUP (a PICKUP reason; witness = the cashier, never the supervisor; **TDrp**) · TOP_UP (**TFlt**) — a supervisor, 273 OVERRIDE, from any device. Denomination lines make the amount; each movement's count names it (`tct_movement_id`). Only while the session takes money (OPEN / SUSPENDED) |
| `GET movements/get` | one movement with its counts — the slip (§9 TILL_MOVEMENT). Own session 272 VIEW, others 273 VIEW |
| `POST movements/change` | **REV 2 §2.14** "Change from C02": a PICKUP on the giving session (its cashier witnesses, never the supervisor; a PICKUP reason) and a TOP_UP on the receiving one, in one call, each through its counter's safe — no till-to-till movement. 273 OVERRIDE |
| `POST movements/void` | a hand-posted movement of a session still live — OPEN, SUSPENDED or **COUNTING until its count is final** (REV 2 §2.8; else 409 `TILL_MOVEMENT_SESSION_CLOSED`): **reverseLegs** (the original CANCELLED, a Rev mirror carrying the session), the row VOIDED with a MOVEMENT_VOID reason. 273 OVERRIDE. The open's FLOAT_ISSUE and the close's CLOSE_HANDOVER are never voided |
| `POST events/batch` | a device's own facts (drawer kick, no-sale, X read, idle lock …); device time kept; `(device, clientSeq)` makes a re-send a no-op; a server event code is refused |
| `POST <master>/create` · `GET <master>/get` · `DELETE <master>/delete` | `counters`, `safes`, `reasons`, `denominations`, `approval-rules`, `approval-authorities`; create-or-update by id. `GET denominations/list` — the one list route, for the count screen |

## The expected cash (§5.4, server only)

`TillLedgerService.expected()`: open (`tss_float_counted`, cash) + sales − refunds + receipts
− payments − expenses (48) + TOP_UP/PAID_IN − PICKUP/DROP, per tender (all cash in one drawer;
non-cash per tender master). A tender row counts only when its document is live — a POSTED
bill / return (bill tender rows carry no voucher id, and a draft or cancelled bill keeps its
rows) or a POSTED voucher for the rest — and never when voided / deleted. Amount =
`td_total_amt`. STATEMENT tenders (UPI, wallet, bank) and NONE tenders are shown, never counted.
Each tender also carries `noRefCount` — its money-in rows with no reference (non-cash plan §4.3: the
UPI chase list, shown to a blind cashier too, since it is a count, not money).

## Non-cash at close (`plan-noncash-tender-control.md` §4)

- **One line per terminal (§4.1):** each card terminal / UPI QR is its own tender master
  (`tnd_terminal_id`); the count already takes one line per tender (`tcl_tender_id`, `tcl_qty` = slips,
  `tcl_entered_amount` = the batch total, `tcl_batch_ref`). Under `tender.close_by_terminal` (default
  true) a slip line that names no tender is refused (`TILL_COUNT_INVALID`, `lines.N.tenderId`) when the
  session took that kind of money on more than one terminal.
- **Slip check (§4.2):** `GET sessions/slip-check?…&tenderId` — expected, the latest count's batch
  total / slips / batch no and the difference, and every live row of that terminal in the session
  (time, bill, amount, approval code, last 4, reference). `POST sessions/slip-check` — the approver's
  verdict as counts and exceptions (rows with no slip, slips with no row, amounts that differ) in a
  `SLIP_CHECK` event; the ticks are not stored. Both 273 OVERRIDE, refused to the session's own
  cashier before close (`TILL_BLIND_CLOSE`), only once billing has ended.
- **A slip gap never goes back to the cashier (notes 99 §1):** recounting the cash cannot find it. The
  count answers on the drawer alone; the slip gap is written PENDING with the final count
  (`slipCheckRequired`) and waits for the slip check, a re-tender, then the NONCASH_VARIANCE decision.
- What re-tender cannot explain is the NONCASH_VARIANCE the approver decides — phase 3, default
  treatment SUSPENSE (`till.noncash_variance_default`). Until that gate it is **reported, not
  enforced**: the session closes, nothing posts for it (SUSPENSE needs the rows the slip check names,
  `tvr_rows`, or a later TSet would credit the card ledger twice), and the card money's truth arrives
  with the statement — a row never paid lands in NOT RECEIVED and is written off there. The statement
  side (import, match, TSet, the not-received and unexplained lists) is
  `accountsModule/tenderSettlement` (its README).

## The money paths (§7.4) — and the rollout rule

`TillSessionService.resolveForMoney()` is called by `/bills/post`, `/bills/retender`,
`/sale-returns/post`, `/receipts/post` and `/payments/post` (and so by their `/amend`s through
`postInTransaction`). It answers **null — nothing changes — unless the caller's device holds a
live session (a counter it picked), or is linked to an active counter that requires a session
while `till.require_session` holds for it.** Today's client sends a random session uuid per app
run (§4); until a till is set up, every bill posts exactly as before. A session posts only from
its own device (`TILL_SESSION_WRONG_DEVICE`). On a governed device the document, its live tender rows and its
voucher are re-stamped with the live session (and the counter), so the expectation sees them;
no live session → 409 `TILL_SESSION_REQUIRED`. A re-tender's new rows and TndC, and a return's
refund, book in the session the money moves in **now** (D7), whatever session the bill was in.

`/bills/cancel` refuses a bill that took CASH in a session whose drawer is counted (COUNTING,
PENDING_APPROVAL, CLOSED): 409 `TILL_SESSION_CLOSED_USE_RETURN`. `loadDayClosed` (the
`SALES_DAY_CLOSED` check) also reads a CLOSED `till_business_day`.

## Receipts, payments and expenses in the session (`plan-till-receipt-payment-expense.md`)

Every rupee that crosses the drawer is a row in `acc_tender_detail` carrying the session; the
till never asks which module wrote it. Built on 48 (`ExpV`, `td_src_doc_type 'EXPENSE'`, the
`tvr_payment_amount` / `tvr_expense_amount` and `tss_*_count` columns):

| plan | where |
|---|---|
| §2 expected rev 2 — receipts +, payments −, expenses −; for payments / expenses only CASH rows touch the drawer, a card / bank / UPI one is `paidFromBank` (shown, never counted) | `TillLedgerService.expected()` |
| §2.2 a Jrl / Con with a leg on the till cash ledger from a device in session → 409 `TILL_CASH_LEDGER_DIRECT` | `TillSessionService.assertNoTillCashLeg`, called by the voucher register |
| §2.3 / §3 receipt (99), payment (100), the register's receipt / payment types and the expense voucher: on a device in session the CASH is that drawer (stamped); on a back-office device in a branch that runs a till it comes from the default safe (`till.backoffice_cash_from = SAFE`, the tender row and the CR leg name the safe's ledger) or is refused (`REFUSE` → `TILL_SESSION_REQUIRED`); a branch with no till posts as before | `routeMoneyDoc` → `stampVoucher` / `routeCashToLedger` |
| §2.3 cancel only while the session takes money (OPEN, SUSPENDED); after → 409 `TILL_SESSION_CLOSED` | `assertMoneyDocCancellable` (receipt, payment, register, expense cancels) |
| §3.6 `RECEIPT_POSTED` / `PAYMENT_POSTED` / `EXPENSE_POSTED` / `MONEY_DOC_CANCELLED`; counts frozen at close | `logMoneyDoc`; close |
| §4 the expense voucher | `accountsModule/expense` (its README) — menu 277, grid `MAIN LIST - EXPENSE VOUCHERS`, print purpose `EXPENSE_VOUCHER` |
| §3.4 40A(3) — cash to one payee in a day, summed over payments (both kinds) and expenses; WARN as shipped, a company REFUSE row refuses | `accountsModule/payment/cash-payment-limit.ts`; index `ix_td_cash_party_day` (20261008180000) |
| §3.3 / §4.3 CASH_PAYMENT (cash part) and EXPENSE (total) rules — **reported, never enforced** until phase 3: an INFO `TILL_APPROVAL_REQUIRED` warning, `approval` on `/expenses/validate` · `/post` and `/payments/post`, and in the `*_POSTED` event's payload | `TillApprovalService.assess` (read-only; phase 3 grows it into the gate) |

**Not built:** 269ST on `/receipts/post` (§3.5) — held back, at the user's call (2026-10-08), until
the bill's own 269ST check (commented out 2026-10-06) is switched back on, so the two agree; it
will read `ix_td_cash_party_day`. The 35,000 goods-carriage figure of 40A(3) needs a flag on the
payment to pick that statutory row. The Qt screens (F11 rev 2, the till strip, the Expense form).

## REV 2 on the money paths

- **Cut-off (§2.7):** past `till.day_cutoff` a session's business date is over: a money document
  into it → 409 `TILL_SESSION_DAY_ENDED` (logged `SESSION_DAY_ENDED`); end and count it, open a
  session for today. Judged on the document's own time when it has one (a bill's
  `sb_bill_datetime`), so an offline bill made before the cut-off still lands.
- **Re-tender:** `/bills/retender` logs **RETENDER** (in ck_tev_code since 47) in the session the money
  moved in — the device's live session, else the bill's own when that is a till session — with the
  voided and added rows, the TndC and the bill's session (notes 99 §7; the cockpit's RE-TENDERS tile).
  Every row it adds carries that same session, whatever the line sends (notes 100: today's client
  sends `tdSessionId: null`, which beat the scope), so the drawer expects the cash taken at a
  re-tender and the slip check sees its card rows.
- **Late arrival (§2.6):** a bill naming a session that has stopped billing (COUNTING,
  PENDING_APPROVAL, CLOSED), MADE before billing stopped (`sb_bill_datetime`) and REACHING the
  server after it (`sb_created_on`), is accepted, stamped and logged `LATE_ARRIVAL` — the sale
  happened. A draft that sat on the server while billing was live is not late. Anything else into
  a CLOSED session → 409 `TILL_SESSION_CLOSED`. Re-deciding the excess it causes is the cockpit's
  (phase 4).
- **Frozen figures (§2.9):** `expected()` of a closed session counts a tender row voided AFTER
  `tss_closed_on` (a later re-tender) as live, so a recompute does not drift.
- **Statement rows (§2.4):** the one tender writer (`TenderDetailService.insertTenderLine`) sets
  `td_settle_status = PENDING` and `td_expected_settle_on = doc date + tnd_settlement_days` only
  for a CARD / UPI / WALLET row whose close mode is SLIPS / STATEMENT and whose tender master has a
  settlement ledger; everything else stays NA. A status the client sends is kept.
- **Wording (§2.13):** `till.blind_close` is labelled "Hidden-expected count" (migration
  `20261008150000`); the key stays.

## Cash limits (phase 2, §8 S2)

`till_counter.tcn_cash_alert_limit` / `tcn_cash_block_limit` against the expectation's cash row.
The session payload's `cashLimit` is `{ state: NORMAL | ALERT | BLOCKED, gauge: 0–4 }` — quarters
of the alert limit, **never the figure**, shown to a blind cashier too, null once billing ends.
BLOCKED refuses `/bills/post` and `/receipts/post` on that counter (`cashIn`) with 409
`TILL_CASH_BLOCKED` until a pickup or a drop brings it down; refunds and payments (cash out) are
never blocked. CASH_LIMIT_OVERRIDE (billing past the limit) is phase 3's approval.

## Ledgers

Till cash = the branch's CASH tender ledger (`acc_tender_master.tnd_ledger_id`, branch row
before company row) — D9, no ledger per counter. Safe = `till_safe.tsf_ledger_id` (default: the
`SAFE_CASH` role's). Variance = role `CASH_SHORT_EXCESS`; unmapped → 422 `TILL_LEDGER_UNMAPPED`.
Every till voucher: `avh_src_module 'TILL'`, `avh_src_doc_type 'TILL_MOVEMENT' | 'TILL_VARIANCE'`,
`avh_session_id` = the session, dated the business date. The movement's `tcm_doc_no` is its
voucher's number.

**§5.7 invariant** — after a session closes, the till-cash legs carrying its id (POSTED and
CANCELLED vouchers, as every balance in the house reads them — a voided movement's original and
its mirror net out) net to
`tss_float_left − (CARRIED ? tss_float_issued : 0)` — the open's TVar takes the till ledger to what
was counted, so a float mismatch no longer leaves its difference behind (notes 98 §1). The session's
`tss_variance_status` describes the close count; an opening difference shows as `tss_float_variance`.

## Single writers

`TillEventService` is the only writer of `till_event` (INSERT only; `test/till-event-single-writer.e2e-spec.ts`).
`TillSessionService` writes `till_session`, `till_count(_line)`; `TillPostingService` writes
`till_cash_movement` and posts / marks `till_variance`.

## Not in phase 1 (§13)

- **Approvals** (phase 3): rule × authority × PIN gate, the inbox, the expiry sweep. Until then a
  PENDING_APPROVAL session stays there; a FLOAT_MISMATCH variance is posted at open with the default
  treatment (EXPENSE) for the approver to re-treat; CASH_PAYMENT and
  EXPENSE are only reported (above).
- **REV 2 items on modules not built yet:** §2.1–§2.3 and §2.5 (the settlement import / match /
  TSet of 49) are built in `accountsModule/tenderSettlement`, except the closed-session pairing
  (`asl_tvr_*`), which waits for the phase-3 variance decision; §2.10–§2.11 (day reopen, day close's suspense row), §2.12 (snapshotting
  `tap_self_allowed` under `till.single_operator` — the approval gate), §2.17's 269ST sum on
  receipts (ExpV and 40A(3) are built — above). §2.18's law facts are data: the TCS 206C(1H) rows still active in
  `statutory_limits` need raising with Prathap.
- The slip print templates (§9) are print-engine data, not built (the expense voucher's
  `EXPENSE_VOUCHER` purpose is seeded; its template is designed in the template designer).
- **Cockpit + day** (phase 4): force close, reopen, void session, day close-check / close /
  reopen, store Z, X read.
- **Safe** (phase 5: safe count, drop verification, REMIT / SAFE_TRANSFER), **HO review** (phase 6).
  Non-cash settlement (49) is built in `accountsModule/tenderSettlement`.
- The session **grid** (S6): a configured grid, not registered yet (the master grids 133–136 were
  made on the dev box in the grid designer).
- `/bills/amend`, the order advance (ARc) and the delivery challan are not yet session-stamped.

## Tests

`test/till-session-http.e2e-spec.ts` (masters, the blind lifecycle, carried float, tolerance,
PENDING_APPROVAL / 428, the journal), `test/till-money-paths-http.e2e-spec.ts` (a cash bill on a
till device: refused without a session, stamped with it, a re-tender journalled RETENDER, expected
by the count, not cancellable once counted), `test/till-event-single-writer.e2e-spec.ts`, `test/till-settle-pending.e2e-spec.ts` (REV 2 §2.4), `test/till-movements-http.e2e-spec.ts` (phase 2: a
cashier and a supervisor — two users, two app instances — every kind, the gauge NORMAL → ALERT →
BLOCKED → NORMAL, a void and its mirror, the close netting to the float left). The money-path
suite also refuses a bill on a BLOCKED drawer until a drop. Each suite registers its own
device, so no other suite's device is ever governed. `test/expense-voucher-http.e2e-spec.ts` covers
the receipt / payment / expense plan: the expense voucher end to end, paid-from-bank, the journal
refusal, the safe, 40A(3) across a payment and an expense, the reported approvals, the list grid. `test/till-counter-claim-http.e2e-spec.ts`
plays a linked PC, three unlinked tablets, a back-office PC and an unknown device as three users
in one app (the stubbed token reads `<user>@<device>`): the plan's tests 1–7, 9 (open-check) and
10, and a picked counter's cash bill landing in its session. Run with `--runInBand`.
