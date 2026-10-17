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
| 273 | Till Sessions | VIEW another cashier's session · OVERRIDE the expected figures, and count / close someone else's drawer (cash office, absent cashier); a user holding OVERRIDE can **sign** a pickup / top-up at the counter by name + PIN (notes 110) — it no longer lets anyone enter one |
| 274 | Business Day | VIEW `days/get` `days/close-check` · CREATE `days/open` · EDIT `days/close` `days/reopen` (notes 117; whoever held CREATE got EDIT) |
| 286 | Cash Office | **retired by notes 114** (`menu_is_active` false, its grants soft-deleted — `/user-administration` refuses an inactive menu id). Notes 113 gave it VIEW `movements/awaiting-receipt` · CREATE `movements/receive`; both routes are judged on 273 now |
| 287 | Cash Office | **notes 118**, the safe (a new id; 286 stays retired): VIEW `safes/balance` (273 VIEW opens it too) · CREATE `safes/count` `movements/remit` `movements/remit-confirm` · OVERRIDE `safes/decide-variance`, a `treatment` on count / confirm, and a REMIT's `movements/void`. Migration `20261015100000` gave 273 OVERRIDE holders VIEW + CREATE + OVERRIDE |
| 283 | Till Masters | the group of the four below (notes 102), VIEW only — granted to whoever views one of them |
| 275 | Till Counters | counters (was "Till Masters", all four, until notes 101) |
| 280 | Till Safes | safes |
| 281 | Till Reasons | reasons |
| 282 | Denominations | denominations; `denominations/list` also opens with Open Till (272) VIEW |
| 276 | Till Approval Rules | approval rules (`approval-rules/*`) — "Till Approval Setup", with authority as a tab, until notes 111 |
| 285 | Till Approval Authority | approval authority (`approval-authorities/*`), notes 111 — who may hand out approval powers, controlled apart from the rules |

Each master is judged on its own menu since the client split Till Masters into four screens
(notes 101, migration `20261009190000`, which copied 275's grants onto 280–282); notes 102
(`20261009200000`) put the four under the group 283. The seed ships
them hidden; rights work on a hidden menu. Ids are pinned in the migrations and in
`prisma/seed/Menu_Master.sql`. `counters/get` carries `deviceName` / `safeName`, `reasons/get`
`ledgerName`, `safes/get` `ledgerName`. A safe's `tsfIsDropSafe` (notes 110 §3, migration
`20261013100000`, which also adds `s.tsf_is_drop_safe` to the SELECT of the designer-made grid
`MAIN LIST - TILL SAFES`, matched by name) makes it a drop box: a counter takes a DROP only into its
own safe, and only when that is set. Notes 111 (`20261013120000`) split
Till Approval Setup the same way: 276 is renamed Till Approval Rules, and the new 285 Till Approval
Authority (5.10 under 271, VIEW · CREATE · EDIT · DELETE · EXPORT) took 276's grants and judges
`approval-authorities/*` (`TILL_MENU.APPROVAL_AUTHORITY`).

## Routes

| route | does |
|---|---|
| `POST days/open` · `GET days/get` | Day Open (the only way in under `till.day_auto_open = false`); a day and its sessions by status. `safe` (notes 118): `opening · expected · counted · remitted`, and since notes 124 §3 `belowZero` (the book under zero — a closed day's opening, or the expected) with `awaitingOpening` / `awaiting`: the branch's Till cash awaiting receipt ledger at the end of the day before / of the day, read as the safe book is (vouchers by date) — cash handed over and not yet received into a safe, which a safe that gave out floats first is short by |
| `GET sessions/open-check` | everything S1 needs in one read: `requireSession`, the business day, the linked counter or the free / busy counters (each free one with its `carriedFrom`), the session this device holds, this user's session elsewhere. Advice only |
| `POST sessions/open` | counter by the claim rule above; opens the day; ISSUED float → **TFlt** Dr till cash / Cr safe; CARRIED inherits the last close's `tss_float_left`; the opening count is cash only, counted ≠ issued → an OPEN-stage `till_variance` **posted at once** with the default treatment (notes 98): **TVar** Dr / Cr Cash Short & Excess against till cash, `EXPENSE`, the `reasonId` named (category FLOAT_MISMATCH, else 422 `TILL_REASON_INVALID`) or the shipped UNKNOWN, which needs `notes`; logged `VARIANCE_DECIDED` (`byDefault: true`). The phase-3 approver re-treats it |
| `GET sessions/current` | the live session of this device, else of this user — superseded by `open-check`, kept for now |
| `GET sessions/get` | header, per-tender expectation, the vouchers it posted, its variances. **Blind**: the cashier gets every expected / variance figure `null` (`expectedVisible: false`) until CLOSED. `dropSafeName` (notes 110 §3): the counter's own safe when it is a drop safe, else null — the screen disables Drop |
| `GET sessions/expected` | 273 OVERRIDE; refused to the session's own cashier before close (`TILL_BLIND_CLOSE`) |
| `POST sessions/suspend` · `resume` | break / idle; the operator, on the session's device |
| `POST sessions/end-billing` | → COUNTING; held bills go to the branch pool (`till.close_with_holds` RELEASE) or refuse (BLOCK → `TILL_HOLDS_OPEN`). **REV 2 §2.6:** the device sends `outboxCount` / `lastClientSeq`; anything unsent (or a journal the server has not received up to) → 409 `TILL_DEVICE_UNSYNCED`, logged `SYNC_PENDING_AT_CLOSE` outside the refused transaction. A client that sends neither is not checked |
| `POST sessions/count` | one attempt, every attempt kept. **ACCEPTED** (all counted drawer tenders within tolerance: variances written WITHIN_TOLERANCE, the count final) · **RECOUNT_REQUIRED** · **SENT_FOR_APPROVAL** (out on the last attempt: PENDING_APPROVAL). **Only the drawer decides** (notes 99 §1): a SLIPS line (card / UPI batch total) out of tolerance never asks for a recount — the count is final with `slipCheckRequired: true`, that variance PENDING, `tss_variance_status` PENDING and an `APPROVAL_REQUESTED` NONCASH_VARIANCE event (`enforced: false`). The cashier of a blind count never gets the figure, even holding 273 OVERRIDE |
| `POST sessions/close` | posts the variances (**TVar**: WITHIN_TOLERANCE / EXPENSE Dr / Cr Cash Short & Excess, RECOVER the cashier's staff advance ledger, SUSPENSE Tender suspense; a PENDING slip variance stays OPEN and posts nothing), the hand-over (**TDrp** Dr safe / Cr till cash) of counted − `floatLeft`, freezes the totals, issues the counter's Z. PENDING_APPROVAL → **428** `TILL_APPROVAL_REQUIRED` (event, amount, the rule's level and channel) until `decide-variance`. No final count, or a drawer (non-SLIPS) variance still PENDING → **409** `TILL_NOT_COUNTED` (notes 112: a session no longer closes over an undecided drawer gap; the two that did before it are decided after close — notes 124 §1, decide-variance) |
| `POST sessions/decide-variance` | **notes 105 A.** On a PENDING_APPROVAL session only (else 409). **Who** (A2, `TillApprovalService.assertApprover`): not the session's cashier (403 `TILL_APPROVER_SELF`); a Till Approval Authority (285) grant active today for this company (and branch, or every branch), this event (CASH_VARIANCE when the cash gap is among the pending ones, else NONCASH_VARIANCE) or every event, at the rule's level or above — SUPERVISOR < CASH_OFFICE < STORE_MANAGER < AREA_MANAGER < HO_FINANCE (403 `TILL_APPROVER_NO_GRANT`); with `taa_max_amount` covering Σ\|counted − expected\| (403 `TILL_APPROVER_LIMIT`); the rule's channel — COUNTER verifies `approverPin` against `usr_pin_hash` (notes 95), REMOTE wants `taa_can_remote`, EITHER takes a typed PIN else remote authority (403 `TILL_APPROVER_PIN`, a wrong PIN journalled `PIN_FAIL`; an approver with no till PIN set → 422 `TILL_APPROVER_NO_PIN`, notes 122 §8). A **SUPER ADMIN** (`usr_type`) is an implicit HO_FINANCE grant on every event and branch with no ceiling; the self and channel rules still apply; an ADMIN needs a real grant. **APPROVE** (`treatment` EXPENSE / RECOVER — the cashier's `usr_employee_id` → `emp_loan_ledger_id`, none → 422 on `treatment` — / SUSPENSE; a VARIANCE or NONCASH `reasonId`; a `note`): every PENDING variance takes them with `tvr_approval_id`, the session returns to COUNTING with `tss_close_approval_id` and `tss_variance_status` ACCEPTED / RECOVER / INVESTIGATE, and `/close` posts as above. **RECOUNT**: back to COUNTING with one more attempt (`tss_recounts_granted`), uncounted (notes 112: `tss_close_count_id`, `tss_counted_on/_by`, `tss_witness_by` cleared, `tss_cash_counted` / `tss_noncash_counted` 0, so `/close` answers `TILL_NOT_COUNTED` and a movement may be voided again); the next final count replaces the variances. One `till_approval` row per decision (A3: APPROVED, or REJECTED for a recount, the rule snapshotted) and a `VARIANCE_DECIDED` event. **Notes 124 §1 — a CLOSED session** whose drawer (non-SLIPS) CLOSE gap is still PENDING (closed before notes 112: VIJI PC-261012-02, ZT1-261012-01): the same rule, approver, reason and record, but **APPROVE only** (RECOUNT → 400 on `decision`: the cash was handed over), and the TVar posts **at once** as `/close` would have (against till cash, dated the session's business date); the session stays CLOSED, `tss_variance_status` takes the treatment, `tss_close_approval_id` is set if empty; payload and event carry `afterClose: true`. A slip gap is left to the slip check; nothing pending → 409 as before. Till Sessions (273) OVERRIDE |
| `POST sessions/approve-cash` | **notes 114.** `{ companyId, branchId, accYear, tssId, approverPin, receivedAmount?, treatment?, reasonId?, notes? }` — a supervisor approves a **CLOSED** session's cash (else 409 `TILL_SESSION_NOT_OPEN`): every CLOSE_HANDOVER / DROP of it still AWAITING, one total (`receivedAmount` left out = exactly what was handed over). Never the session's cashier (403 `TILL_RECEIVER_SELF`, "Session X is yours (you were its cashier)…") unless `till.single_operator`; notes 116: the supervisor who closed it for the cashier (so the hand-over's `tcm_done_by`) or made a drop may approve it; the caller's till PIN with the receive's codes (`TILL_RECEIVER_NO_PIN` / `_PIN_REQUIRED` / `_PIN`, a wrong one journalled `PIN_FAIL`), which the owner approving their own session under single_operator may leave out. Per movement a TRcv as `movements/receive`, **no count** (`tcm_receive_count_id` NULL). A gap sits on the hand-over first, then the drops newest first (a shortage takes none below 0), and is **one** RECEIVE-stage variance naming the hand-over, else the latest drop: within tolerance posted at once (`WITHIN_TOLERANCE`); beyond it with `treatment` + `reasonId` decided in the step when `assertApprover` passes with the **cashier** as requester (`DECIDED`: a `till_approval` row, the TVar, `VARIANCE_DECIDED`) — its 403 otherwise, nothing written; beyond it without `treatment` PENDING (`SENT_FOR_APPROVAL`, `APPROVAL_REQUESTED`) for `decide-variance` with the answer's `tcmId`, where the approving supervisor is the requester and so not the decider. Nothing awaiting: 409 `TILL_CASH_ALREADY_APPROVED` (all received) or `TILL_RECEIPT_NOT_AWAITING` (nothing ever waited). Answers `handedOver / received / difference / outcome / tvrId / tcmId / treatment / tapId / varianceVoucherId+No / movements[] (each with receiveVoucherId+No) / session`. Till Sessions (273) OVERRIDE |
| `POST sessions/force-close` | **notes 117 §4.** `{ key, reasonId, approverPin, lines[], floatLeft?, notes? }` — the cashier has gone (OPEN / SUSPENDED / COUNTING; PENDING_APPROVAL → 409, decide it). FORCE_CLOSE rule (STORE_MANAGER) via `assertApprover`, the caller the approver and the **cashier the requester** (never the cashier); a FORCE_CLOSE reason (`trs_needs_note` → `notes`). One transaction: `endBillingIn` (holds per `till.close_with_holds`), the caller's count (`countIn` **forced**: final at once, no recount, `tss_count_place` CASH_OFFICE, `tct_counted_by` the caller), then ACCEPTED → `closeIn` (the hand-over's `tcm_done_by` the caller — notes 116 lets them approve it) or out of tolerance → PENDING_APPROVAL for decide-variance + /close. `tss_force_closed` + `tss_force_reason_id`, a FORCE_CLOSE `till_approval` row, `SESSION_FORCE_CLOSE`. Answers `outcome (CLOSED · SENT_FOR_APPROVAL) / tapId / tctId / session`. 273 OVERRIDE |
| `POST sessions/reopen` | **notes 117 §5.** `{ key, reasonId, approverPin, notes? }` — a CLOSED session back to COUNTING under SESSION_REOPEN (STORE_MANAGER; requester = the cashier), a REOPEN reason. Refused: its day CLOSED (409 `TILL_DAY_CLOSED`), its hand-over RECEIVED (409 `TILL_CASH_ALREADY_APPROVED` — undoing a receipt is a safe matter), a later session opened on its float or its counter busy (409 `TILL_REOPEN_BLOCKED`). The hand-over voided (`voidMovement`: TDrp reversed, reason = the REOPEN one, `tcm_void_approval_id`), every POSTED CLOSE-stage TVar REVERSED (`reverseVariance`); close count / counted / handed-over / float-left / closed cleared, `tss_reopen_count` + 1, `tss_recounts_granted` + 1, the **Z kept** (`closeIn` reuses `tss_z_no` and leaves the counter's series alone). `SESSION_REOPEN`. 273 OVERRIDE |
| `POST sessions/x-report` | **notes 117 §6.** `{ key }` — the `sessions/expected` payload + `xNo` (the session's server X reads — `X_REPORT` events carrying `xNo`; a device's own X_REPORT via events/batch is not numbered) + `xReadOn`, `X_REPORT` journalled. Live sessions (CLOSED → 409: print its Z). 273 OVERRIDE, refused to the cashier before close (`TILL_BLIND_CLOSE`) |
| `GET days/close-check` | **notes 117 §1.** `?companyId&branchId&accYear&tbdId` — every code `{ code, tone, count, detail, sessionIds }`, GREEN when clear: RED `SESSIONS_LIVE` · `SESSIONS_PENDING_APPROVAL` · `CASH_TO_APPROVE` (a hand-over / drop of the day AWAITING) · `VARIANCE_UNDECIDED` (a CLOSED session's drawer gap still PENDING — one approve-cash sent on) · `MOVEMENTS_UNPOSTED` (a movement but EXCHANGE without its voucher, a CLOSED session's decided variance not POSTED — a guard); AMBER `SLIP_GAPS` (a slip-mode variance still PENDING, and — notes 122 §7 — what the latest slip check per terminal left unexplained: rows with no slip or a differing amount still live, slips with no row) · `HELD_BILLS` (the branch's parked `txn_hold`) · `SAFE_OVER_INSURED` (the safe ledger's balance, reports/common, over `tsf_insured_limit` > 0). `canClose`, `canCloseWithException` (every RED in `CLOSE_EXCEPTION_CODES` = SESSIONS_LIVE; SAFE_NOT_COUNTED joins with notes 118). 274 VIEW |
| `POST days/close` | **notes 117 §2.** `{ companyId, branchId, accYear, tbdId, notes?, exception?: { reasonId, approverId?, approverPin?, counts?: [{ tssId, lines[], floatLeft? }] } }` — the check again; RED → 409 `TILL_DAY_CLOSE_BLOCKED` (`items`) unless the exception covers every RED. **Exception:** a DAY_CLOSE reason, DAY_CLOSE_EXCEPTION (STORE_MANAGER) with the **caller the requester** and `approverId` (default the caller → `TILL_APPROVER_SELF` unless `tar_allow_self`) typing their PIN here (channel forced COUNTER when the approver is not the caller); one count per live session (missing → 422 `TILL_FORCE_COUNT_REQUIRED`; a live session with drops AWAITING → 409, Cockpit first), each `forceCloseIn` with the FORCE_CLOSE reason `DAY_CLOSE` and its hand-over **received on that count** (`receiveHandOver`); a forced count out of tolerance rolls the whole close back (409). Then frozen totals over the CLOSED sessions, CLOSED (`tbd_closing_on` = `tbd_closed_on`, CLOSING never written), the store Z (`max(tbd_z_no)+1` of the branch under an advisory lock, or the reopened day's own), `tbd_exception_count` (Σ counts closed over), `tbd_close_approval_id`, `DAY_CLOSE`. A closed day takes no session (`TILL_DAY_NOT_OPEN`) and no sales document (`SALES_DAY_CLOSED`, `loadDayClosed`). 274 EDIT |
| `POST days/reopen` | **notes 117 §3.** `{ companyId, branchId, accYear, tbdId, reasonId, approverPin?, notes? }` — DAY_REOPEN (AREA_MANAGER), the caller the approver, the day's **closer the requester**; a DAY_REOPEN reason. Refused when not CLOSED (409 `TILL_DAY_NOT_CLOSED`) or a later day of the branch is CLOSED (409 `TILL_DAY_LATER_CLOSED`). OPEN, `tbd_reopen_count` + 1, totals / exception / approval cleared, the Z kept. `DAY_REOPEN`. 274 EDIT |
| `POST movements/create` | **phase 2, roles per notes 110.** Every kind is entered **at the counter by the session's cashier on its device**, Open Till (272) EDIT. DROP (sealed bag, declared amount, bag / seal no) goes **only into the counter's own safe, which must be a drop safe** (`tsf_is_drop_safe`; no fallback to the branch default) — else 422 `TILL_NO_DROP_SAFE` on `kind` (hand the bag to a supervisor as a PICKUP, or tick a drop safe). PAID_IN (a PAID_IN reason; the ledger named or the reason's; **TPIn** Dr till cash / Cr ledger) · EXCHANGE (notes for notes, both sides counted and equal, no voucher, numbered `<session no>/X<n>`). PICKUP (a PICKUP reason; **TDrp**; the cashier gives, the supervisor receives) · TOP_UP (**TFlt**; the supervisor gives, the cashier receives) are **two signatures**: anyone but the session's cashier calling → 422 `TILL_MOVEMENT_AT_COUNTER` on `kind` (no entry from the office); the supervisor standing there is `supervisorId` (missing or not an active user 422 `TILL_MOVEMENT_INVALID`; the session's cashier 422 `TILL_SUPERVISOR_SELF`; without Till Sessions (273) OVERRIDE **of their own** 403 `TILL_SUPERVISOR_RIGHT`, all on `supervisorId`) and signs with `supervisorPin`, checked against `usr_pin_hash` before anything is written: none set 422 `TILL_SUPERVISOR_NO_PIN` (User Administration, menu 58), none typed 403 `TILL_SUPERVISOR_PIN_REQUIRED`, wrong 403 `TILL_SUPERVISOR_PIN` journalled `PIN_FAIL` (`tev_user_id` = the cashier, payload `{action:'movement', kind, supervisorId}`; no lockout), all on `supervisorPin`. Recorded with no new column: `tcm_done_by` = the cashier, `tcm_witness_by` = the supervisor, `tcm_witness_verified_on` = when the PIN was checked. `witnessPin` (notes 108) is accepted and ignored; `witnessBy` is read on the cashier kinds only. **Old rows:** pickups / top-ups posted before notes 110 have the roles the other way round (`done_by` = the supervisor, `witness_by` = the cashier); on the dev box on 2026-10-13 they were 4 test rows (counters ZT1 and VIJI PC, 2026-10-09 / 12), so nothing was migrated — check before trusting the roles on real data. Denomination lines make the amount; each movement's count names it (`tct_movement_id`). Only while the session takes money (OPEN / SUSPENDED) |
| `GET movements/supervisors` | **notes 110 §2** — who can sign a pickup / top-up on the session: active, not deleted, 273 OVERRIDE, never its cashier — not narrowed to the session's company / branch (`user_menus` is not scoped and a home `usr_company_id` does not bind where a user works); `{ userId, loginName, fullName, hasPin }` (`hasPin` false → the screen asks for a PIN before the count). The session's cashier 272 VIEW, anyone else 273 VIEW |
| `GET movements/get` | one movement with its counts — the slip (§9 TILL_MOVEMENT). Own session 272 VIEW, others 273 VIEW |
| `POST movements/change` | **REV 2 §2.14** "Change from C02": a PICKUP on the giving session (its cashier witnesses, never the supervisor; a PICKUP reason) and a TOP_UP on the receiving one, in one call, each through its counter's safe — no till-to-till movement. 273 OVERRIDE. **Notes 108:** the giving cashier types `fromWitnessPin`, the receiving one `toWitnessPin` (not when the caller is the receiving cashier) — the same check and refusals as `movements/create`, on those fields, before anything is written; both rows stamp `tcm_witness_verified_on` |
| `GET movements/awaiting-receipt` | **notes 113.** The branch's CLOSE_HANDOVERs and DROPs with `tcm_receipt_status` AWAITING, oldest first; `dayId` + `accYear` narrow to one business day. **No amount** (the receive is blind). `canReceive` false on the caller's own bags. Till Sessions (273) VIEW (286 VIEW until notes 114); the Qt client no longer calls it |
| `POST movements/receive` | **notes 113.** `{ companyId, branchId, receiverPin, bags: [{ tcmId, accYear, lines, notes }] }` — one blind DROP_VERIFY count per bag, all or none. The caller is the receiver: anyone but the bag's session's cashier (403 `TILL_RECEIVER_SELF`; notes 116 dropped "nor whoever handed it over") unless `till.single_operator`; own till PIN, none set 422 `TILL_RECEIVER_NO_PIN`, none typed 403 `TILL_RECEIVER_PIN_REQUIRED`, wrong 403 `TILL_RECEIVER_PIN` (journalled `PIN_FAIL`). Per bag **TRcv** Dr the bag's safe / Cr Till cash awaiting receipt for what was counted (none for an empty bag), the row RECEIVED, `CASH_RECEIVED` journalled. A difference is the session's **RECEIVE-stage variance**: within `till.cash_tolerance` posted at once (WITHIN_TOLERANCE, TVar against awaiting); beyond it PENDING, `tss_variance_status` PENDING, an `APPROVAL_REQUESTED` event, decided on `sessions/decide-variance` with `tcmId`. Not awaiting → 409 `TILL_RECEIPT_NOT_AWAITING`. Answers `handedOver / received / difference / outcome (RECEIVED · WITHIN_TOLERANCE · SENT_FOR_APPROVAL) / tvrId / receiveVoucherId`. Till Sessions (273) OVERRIDE (286 CREATE until notes 114); the Qt client calls `sessions/approve-cash` instead |
| `POST movements/void` | a hand-posted movement of a session still live — OPEN, SUSPENDED or **COUNTING until its count is final** (REV 2 §2.8; else 409 `TILL_MOVEMENT_SESSION_CLOSED`): **reverseLegs** (the original CANCELLED, a Rev mirror carrying the session), the row VOIDED with a MOVEMENT_VOID reason. 273 OVERRIDE. The open's FLOAT_ISSUE and the close's CLOSE_HANDOVER are never voided; a received DROP neither (409 `TILL_MOVEMENT_NOT_VOIDABLE`, notes 113) |
| `POST events/batch` | a device's own facts (drawer kick, no-sale, X read, idle lock …); device time kept; `(device, clientSeq)` makes a re-send a no-op; a server event code is refused |
| `POST <master>/create` · `GET <master>/get` · `DELETE <master>/delete` | `counters`, `safes`, `reasons`, `denominations`, `approval-rules`, `approval-authorities`; create-or-update by id. `GET denominations/list` — the one list route, for the count screen |

## Cash awaiting receipt (notes 113)

`till.handover_receipt` (BRANCH max scope, default **NONE**, migration `20261014100000`): with
**REQUIRED** the cash a cashier parts with alone — the close's CLOSE_HANDOVER and a DROP — no
longer posts into the safe. Its **TDrp** is Dr *Till cash awaiting receipt* (role
`TILL_CASH_AWAITING`, a CASH ledger under Cash-in-Hand; not `CASH_IN_TRANSIT`, which is the
bank / CIT remittance leg) / Cr till cash, the row `tcm_receipt_status` AWAITING and `tcm_safe_id`
the safe it is bound for. A supervisor receives it — since notes 114 by one Approve on the closed
session (`sessions/approve-cash`, below), before that on Cash Office (286): **TRcv** (voucher type
"Till Cash Received", Contra) Dr that safe / Cr awaiting, the row RECEIVED with `tcm_received_by /
_on / _amount`, `tcm_receive_count_id` (a blind DROP_VERIFY count, `tct_expected` = handed over)
and `tcm_receive_voucher_id`. The TRcv carries the bag's session and is dated the receiving
business day; its source is `TILL_RECEIVE` (`ux_avh_src` keeps one live voucher per source).

- The till side is unchanged: close still credits till cash and `expected()` counts a drop out
  whether it is received or not. Only the safe moves later, so the safe ledger holds received
  cash only. PICKUP is two signatures already (notes 110) and goes straight to the safe.
- **A difference** is a `till_variance` row of the bag's session, stage `RECEIVE`
  (`tvr_stage` widened to 8), naming the bag in `tvr_movement_id` (`ck_tvr_receive`;
  `ux_tvr_live` now includes it). It has the OPEN row's shape: cash, `tvr_open_amount` =
  `tvr_expected` = handed over, `tvr_counted` = received. The session's status never changes;
  its `tss_variance_status` goes PENDING while the difference waits (a later final count and a
  close-variance APPROVE keep it PENDING too), and takes the treatment's value once decided.
- **Deciding it:** `sessions/decide-variance` with `tcmId`, on a session in any status. APPROVE
  only (RECOUNT → 400: the bag is in the safe and its count stands; SUSPENSE parks a gap to look
  into). The CASH_VARIANCE rule, `assertApprover` with the **receiver** as the requester (so not
  them), and never the bag's cashier (403 `TILL_APPROVER_SELF`). The TVar posts at once against
  the awaiting ledger, dated the decision's business day; a `till_approval` row APPROVED with
  `tap_src_doc_type 'TILL_MOVEMENT'` and the bag's id. Nothing pending on the bag → 409
  `TILL_VARIANCE_NOT_PENDING`.
- **Notes 114 — approve on the session.** The user judged Cash Office (bags, a blind
  denomination count, a receiver PIN, a third person for any gap) too much for a shop: one
  Approve on the closed session, from Till Sessions (273) / the Session Cockpit, showing the
  amount. `ck_tcm_received` (migration `20261014160000`) no longer asks for a count id. One
  variance per approval (`ux_tvr_live` is per movement, and it names the hand-over), so a
  shortage larger than the hand-over leaves the hand-over received 0 (no TRcv) and the rest on
  the drops. The caller's own grant decides a gap beyond tolerance in the same step; a gap sent
  on is decided by another approver (requester = the approving supervisor, as for a receive).
- **Reads:** `days/get` adds `handoverReceipt` and `awaitingReceipt { thisDay, earlierDays,
  oldestOn }` (no amount); the day close (phase 4) must refuse while `thisDay > 0`. A session's
  payload adds `receiptState` (NONE · AWAITING · APPROVED · DIFFERENCE — notes 114 renamed
  null → NONE and RECEIVED → APPROVED), `cashAwaiting`, `receivedBy / receivedByName /
  receivedOn` (the latest receipt) and, per movement,
  `tcmReceiptStatus / tcmReceivedAmount / tcmReceivedOn`; `movements/get` also
  `tcmReceivedBy / tcmReceiveVoucherId`. **Blind only on the receive screen:** the awaiting list
  hides the amount, but a closed session's own figures (`sessions/get`, `movements/get`, the
  grids) still show what was handed over to anyone with Till Sessions (273) VIEW.
- **Before notes 113** every hand-over and drop has `tcm_receipt_status` NULL = straight into the
  safe; nothing was back-filled. With the setting NONE nothing changes.
- The designer-made grids `MAIN LIST - TILL SESSIONS` (144) and `TILL DAY SESSIONS` (150) take a
  live session's cash figures from its latest `tvr_stage <> 'OPEN'` row; with a drop received for
  a difference that row can be the RECEIVE one. `tvr_stage = 'CLOSE'` there is the fix (not made:
  the grids are the user's, on the dev box only).

## The safe (notes 118)

`TillSafeService` / `TillSafeController`, Cash Office (287), migration `20261015100000`
(`tct_day_id`; till_count kind REMIT; `till_variance` stages SAFE / REMIT with **no session** —
`tvr_session_id` nullable, `tvr_safe_id`, `tvr_count_id`, `ck_tvr_owner` replacing `ck_tvr_receive`,
`ux_tvr_live` keyed on the safe and the count too; the remittance columns on `till_cash_movement`;
events SAFE_COUNT / REMIT_CONFIRMED; `ix_td_cash_tender_ledger`; menu 287).

| route | does |
|---|---|
| `GET safes/balance` | `?companyId&branchId[&safeId]` — per safe: `opening` (the last SAFE count; before any, **what the safe's ledger holds** less the movements, so cash held before the till went live is no gap — `openingFrom` BOOK; a ledger another active safe of the branch shares (every safe defaults to the SAFE_CASH role's) can't be split, so 0 — `ZERO`, `ledgerShared`), `in` (hand-overs and drops straight in, or once RECEIVED for what was received; pickups; transfers in; **back-office cash receipts** on its ledger, 48 §2.3), `out` (float issues, top-ups, remittances, transfers out, back-office cash payments / expenses), `exchanges` (a count), `expected`, `bookBalance` (Ledger Statement), `drift` (book − expected: a journal, an undecided gap), insured limit / `overInsured`, `lastCount`, `countedToday`, `inTransit`, `pendingGaps`; plus the branch's CIT remittances `inTransit` (the list the grid would show). **Blind** under `till.blind_close`: money null (`figuresVisible` false) unless 287 or 273 OVERRIDE |
| `POST safes/count` | `{ safeId, lines[], witnessId?, witnessPin?, treatment?, reasonId?, approverPin?, notes? }` — a SAFE count of today's business day (opened if `day_auto_open`; CLOSED → 409 `TILL_DAY_CLOSED`), `tct_expected` = expected, `tct_is_blind` = what the caller could see; SAFE_COUNT; the day's `tbd_safe_*` refreshed. Gap: EXACT · within `till.cash_tolerance` **TVar at once** (WITHIN_TOLERANCE against the safe) · beyond it **DECIDED** in the step with `treatment` (EXPENSE / SUSPENSE — no RECOVER) under SAFE_VARIANCE · else SENT_FOR_APPROVAL. The judgement runs before the transaction; a safe that moved meanwhile → 409 `TILL_SAFE_CHANGED`. 287 CREATE (+ OVERRIDE for `treatment`) |
| `POST safes/decide-variance` | `{ accYear, tvrId, treatment, reasonId, approverPin?, secondId?, secondPin?, notes? }` — a PENDING stage SAFE / REMIT gap; the TVar dated today. 287 OVERRIDE |
| `POST movements/remit` | `{ safeId, amount, bankLedgerId, mode, bagNo?, sealNo?, citAgency?, slipNo?, slipDate?, lines[]?, approverId?, approverPin?, notes? }` — REMIT with no session, today's business day, numbered by its **CRem**: BANK_DEPOSIT Dr bank / Cr safe (`tcm_remit_status` DEPOSITED) · CIT Dr Cash in transit / Cr safe (IN_TRANSIT). `tcm_ledger_id` is the bank either way (Bank Accounts / Bank OD only, else 422 on `bankLedgerId`); slip no / date → `tcm_ref_no / _date`. Above expected → 422 `TILL_REMIT_OVER_BALANCE` (no figure for a blind caller). `lines` = a REMIT count that must make `amount`. REMITTANCE as set (shipped NEVER: nothing asked); when it asks, `approverId` (default the caller → self refused unless allowed) types the PIN here, COUNTER. `tbd_remitted` refreshed; SAFE_OVER_INSURED reads the ledger, which the CRem lowers. 287 CREATE |
| `POST movements/remit-confirm` | `{ accYear, tcmId, bankDate, bankRef, bankAmount?, treatment?, reasonId?, approverPin?, witnessId?, witnessPin?, notes? }` — a CIT REMIT IN_TRANSIT (else 409 `TILL_REMIT_NOT_IN_TRANSIT`); `bankDate` from its doc date to today. CRem (src `TILL_REMIT_CONFIRM`) Dr bank / Cr Cash in transit for what was credited (left out = sent), dated the bank date; CONFIRMED + `tcm_bank_*`, `tcm_confirmed_*`; REMIT_CONFIRMED. A difference = a **REMIT-stage gap** against Cash in transit, judged as a count's. 287 CREATE (+ OVERRIDE for `treatment`) |
| `POST movements/void` on a REMIT | judged on 287 OVERRIDE: CRem mirrored, VOIDED, MOVEMENT_VOID reason, `tbd_remitted` refreshed. Refused once CONFIRMED, once its day is CLOSED, and once the safe was **counted since** (the count holds what it left behind) |

**Who signs a gap beyond tolerance** (the user's call, 2026-10-15): SAFE_VARIANCE with the **caller
as the approver** (grant + PIN by the rule's channel). A safe gap judges nobody else's cash, so the
rule's no-self flag does not bind (`assertApprover({ selfExempt })`, `tap_self_allowed` true). The
shipped rule is **two-person**: in the step the **witness** who typed their PIN on the count (or
the confirm) is the second signature (`tap_second_by`); no witness → 403 `TILL_APPROVER_SECOND`
(leave `treatment` out to send it on). Decided later: `secondId` + `secondPin`, neither the caller
nor whoever raised the gap (`ck_tap_second`). `assertApprover` takes `second` only from callers
that can carry one; every other caller still refuses a two-person rule as "Part B".

**Timing.** Each flow is timed — a movement at its creation and back at its void, a received bag
at its receipt, a money document at its posting and back at its cancel — and only flows after the
last count count, so a void or cancel after a count lands after it, as in the books.

**The day.** `tbd_safe_counted` / `_expected` = over the safes counted that day, each by its last
count (`counted` NULL and `expected` the active safes' book at the end of the day when none was);
`tbd_remitted` = the day's live REMITs; `tbd_safe_opening` = the active safes' book at the end of
the day before. Notes 122 §6: the book is the safe ledgers' balance AS OF the business date
(vouchers by their date, each ledger once) — it used to be walked back from now by timed flows, so
a day closed late, or a hand-over of the day before posted after this day opened, printed an
opening no safe held (13-10 closed on 15-10: −8,326; as of the date: −1,426, the ZTS ledger has no
opening balance). A negative book is printed as it is, not clamped: it is what the books say.
Refreshed by every count / remittance / remit void, frozen by `days/close`. `days/get` carries them
as `safe { opening, expected, counted, remitted }`.

**Close-check.** `SAFE_NOT_COUNTED`: an active safe holding cash (expected ≠ 0) or that moved cash
on the day, with no count of the day — **RED** under `till.day_close_safe_count` (shipped true; in
`CLOSE_EXCEPTION_CODES`, reason "Safe counted next morning"), AMBER when off. A safe gap of the day
still PENDING counts under `VARIANCE_UNDECIDED`.

**Not built:** SAFE_TRANSFER (balance reads it; no route), the remittances grid (user's), a safe
count print.

## Head office reviews (notes 134)

`TillReviewController` / `TillReviewService`, judged on **Cash Position (289)**: `reviews/create`
(CREATE) and `reviews/list` (VIEW). The Qt S11 screen reads its own grids 170-174; these routes only
write and read `accounts.till_session_review` (47 §9, no table change).

- **Append-only.** A review is never edited. A later review of the same day / session supersedes it:
  `create` answers `supersedes` (the review it replaced) and every row carries `current` (the newest
  of its day / session). A session review stores only `tsr_session_id`, a day review only
  `tsr_day_id`; `list` by `dayId` therefore shows the day's own reviews, not its sessions'.
- **Refusals.** Exactly one of `dayId` / `sessionId` (400 TILL_REVIEW_TARGET); a note unless OK
  (400 TILL_NOTE_REQUIRED); the day / session must be this company's and branch's in `accYear` (404
  TILL_DAY_NOT_FOUND / TILL_SESSION_NOT_FOUND). `refVoucherId` + `refVoucherAccYear` go together
  (TILL_REVIEW_REF_PAIR), only on WRITTEN_OFF / SUSPENSE_CLEARED (TILL_REVIEW_REF_NOT_ALLOWED), and
  name a voucher of the company (404 TILL_REVIEW_REF_NOT_FOUND) that is POSTED (409
  TILL_REVIEW_REF_NOT_POSTED).
- **Journal.** `HO_REVIEW` (ck_tev_code since 20261017120000): src doc `TILL_REVIEW` = the tsr_id,
  the day (a session review: the session's day, counter and number), the reviewer as `tev_user_id`,
  payload `outcome`, `note`, `refVoucherId`, `supersedes`.

## Day close and the session exceptions (notes 117)

`TillDayCloseService` (close-check / close / reopen) and, in `TillSessionService`, `forceClose`,
`reopen`, `xReport`. `endBilling` / `count` / `close` are each a lock plus a body
(`endBillingIn` / `countIn` / `closeIn`) so a force close runs all three in one transaction;
the routes behave as before. Migration `20261014180000`: reason category **DAY_CLOSE**
(CASHIER_GONE, SAFE_LATER, OTHER), FORCE_CLOSE gains SHIFT_OVER and DAY_CLOSE, menu 274 gains EDIT.

- **Who decides what** (all `assertApprover`, a wrong PIN journalled `PIN_FAIL`): force close and
  session reopen — the caller approves, the session's cashier is the requester; day reopen — the
  caller approves, the day's closer is the requester (a remote AREA_MANAGER from HO needs no PIN);
  the day-close exception — the caller requests, `approverId` approves at this desk with a PIN.
- **The day close's force close receives its hand-over at once.** Under REQUIRED the forced
  hand-over would wait for approve-cash, and CASH_TO_APPROVE would then block the very close that
  made it. The supervisor counted the drawer and holds the cash; the TRcv carries their count
  (`tcm_receive_count_id`). The Cockpit's force close does NOT: its hand-over waits for approve-cash
  (notes 116 lets the same supervisor approve it). Drops of a live session cannot be approved
  before it closes, so a day-close exception over one is refused: force-close it, approve its cash,
  then close the day.
- **CLOSING** stays in `ck_tbd_status` for a later two-step close; nothing writes it.
- **Safe figures** (`tbd_safe_*`, SAFE_NOT_COUNTED) are notes 118 (above).

## Printing (notes 117 §7, notes 135)

Purposes (migration `20261014181000`, `ppo_src_module` ACCOUNTS — `ck_ppo_src_module` has no TILL):
`TILL_SESSION_Z`, `TILL_SESSION_X`, `TILL_DAY_Z` (the day X while open, the store Z once closed).
`docId` = `tss_id` / `tbd_id`, `accYear` = the document's own year. Their data are print
**providers** (`print-render/data/providers/till.providers.ts` → `TillPrintService`), built on the
`sessions/get` / `days/get` payloads, so a live blind session printed by its own cashier shows no
expected figure. Dates are IST text: `DD-MM-YYYY`, and times `DD-MM-YYYY hh:mm AM` (notes 121:
12-hour wherever a person reads a time, as the grids' `HH12:MI AM`; was 24-hour `HH:mm`). A provider
dataset has no field list in the designer, so the fields are here:

- `till.session.header` (one): session_no, business_date, counter_code, counter_name, cashier,
  status, is_closed, opened_on, billing_ended_on, counted_on, closed_on, closed_by, z_no, x_no
  (the latest server X read; null before one), reopen_count, force_closed, force_reason,
  count_mode, count_place, count_attempts, float_mode, float_issued, float_counted, float_variance,
  bill_count, return_count, receipt_count, payment_count, expense_count, net_sales, cash_expected,
  cash_counted, cash_variance, noncash_expected, noncash_counted, noncash_variance, handed_over,
  float_left, variance_status, variance_treatment (notes 121: the live CLOSE-stage cash gap's
  EXPENSE · RECOVER · SUSPENSE · WITHIN_TOLERANCE · PENDING; null with no gap or for a blind
  cashier's own live session), receipt_state, cash_awaiting, received_by, received_on,
  expected_visible, print_count, printed_on.
- `till.session.tenders` / `till.day.tenders` (many): tender_type_id, tender_type, tender_name,
  close_mode, open_amount, sales, refunds, receipts, payments, expenses, moved_in, moved_out,
  paid_from_bank, txn_count, expected, counted, variance (the day's summed per tender).
- `till.session.movements` (many): kind, doc_no, doc_date, amount, status, receipt_status,
  received_amount, created_on.
- `till.day.header` (one): business_date, status, is_closed, z_no, reopen_count, opened_on,
  opened_by, closed_on, closed_by, session_count, live_session_count, bill_count, net_sales,
  cash_expected, cash_expected_counted (notes 121: the counted sessions' expected only — what
  cash_counted / cash_variance compare against; an open day's live till is in cash_expected, not
  here), cash_counted, cash_variance, noncash_variance (frozen once closed, the sessions' as they
  stand while open), exception_count, cash_awaiting, notes, print_count, printed_on; the safe
  (notes 118 / 121): safe_opening (null until the day closes), safe_expected, safe_counted (null
  when not counted that day), safe_difference (counted − expected, when counted), safe_remitted,
  safe_in_transit (the branch's CIT remittances still IN_TRANSIT at print time); notes 124 §3 —
  the books print as they are, flagged: safe_below_zero, safe_awaiting_opening (null until the day
  closes, beside safe_opening) and safe_awaiting (beside safe_expected), the cash handed over and
  not yet received as of the day before / the day. A layout prints e.g. "Safe below zero: 3,000.00
  handed over, awaiting approval" when the flag is set.
- `till.day.sessions` (many): session_no, counter_code, counter_name, cashier, status, opened_on,
  closed_on, z_no, bill_count, net_sales, cash_expected, cash_counted, cash_variance, handed_over,
  float_left, receipt_state, force_closed, reopen_count.

**Notes 135 — the movement slip and the remittance memo** (migration `20261017130000`, ACCOUNTS):
`TILL_MOVEMENT` (one copy) and `TILL_REMIT` (two copies, labelled "Bank / Agency Copy" and "Store
Copy"). `docId` = `tcm_id`, `accYear` = `tcm_acc_year`. Their providers read the `movements/get`
payload under its rights — your own session's movement Open Till (272) VIEW, another's Till
Sessions (273) VIEW, one with no session (a REMIT, a SAFE_TRANSFER) Cash Office (287) VIEW or 273
VIEW — plus the names and numbers a slip prints. A REMIT prints only as `TILL_REMIT` and every
other kind only as `TILL_MOVEMENT`: the other purpose is 400 `TILL_PRINT_WRONG_PURPOSE` on `docId`.
The company / branch heading and the amount in words are the layout's (`company.profile`,
`branch.profile`, `numToWords`).

- `till.movement.header` (one): doc_no, doc_date, kind, kind_text (the slip's title: Float issue ·
  Top-up · Pickup · Cash drop · Hand-over · Paid in · Change · Safe transfer), status (POSTED /
  VOIDED — a voided slip prints VOID across it), voided_on, voided_by, void_reason, amount,
  session_no, business_date, counter_code, counter_name, cashier (the session's; all null for a
  SAFE_TRANSFER), safe_code, safe_name, to_safe_code, to_safe_name (SAFE_TRANSFER), reason,
  ledger_name (PAID_IN), party_name, ref_no, ref_date, notes, bag_no, seal_no (DROP), gives,
  receives (the two signature lines, by name — below), witness_verified_on (null = the second
  person's PIN was not checked), receipt_status, received_by, received_on, received_amount (a
  DROP / CLOSE_HANDOVER once received, notes 113 / 114), voucher_no (TFlt / TDrp / TPIn; null for
  an EXCHANGE), created_on, print_count (the renders before this one: > 0 prints REPRINT),
  printed_on.
- `till.movement.lines` (many): face_value, denomination (`tdn_label`, "₹500"), qty, amount, side
  (EXCHANGE only: IN = taken into the drawer, OUT = given out; null otherwise) — the cash lines of
  the movement's count (`tcm_count_id`; a FLOAT_ISSUE's is the session's OPEN count, a
  CLOSE_HANDOVER's its CLOSE count), face value high to low; a line keyed as an amount has no
  face value / qty. Empty for a movement entered as an amount with no count (a DROP always). An
  **EXCHANGE** stores two `till_count` rows, both `tct_movement_id` = the movement: `tcm_count_id`
  names the IN count and the other row is the OUT count — that is how the sides are told apart.
- `till.remit.header` (one): doc_no, doc_date, voucher_no (the CRem), mode, mode_text ("Deposited
  at the bank" / "Handed to the cash collection agency"), status (DEPOSITED · IN_TRANSIT ·
  CONFIRMED, or VOIDED once voided), voided_on, voided_by, void_reason, safe_code, safe_name,
  bank_name (`tcm_ledger_id`'s name), bank_account_no, bank_ifsc, bank_branch (**null for now** —
  notes 135 §2 option (b): no ledger column holds them, the memo leaves a line to write by hand;
  (a) Bank Accounts ledger fields later, which the cheque deposit slip would share), amount,
  bag_no, seal_no, cit_agency, slip_no, slip_date (`tcm_ref_no / _date`), done_by, approved_by
  (the approver when REMITTANCE asked for one, else null), handed_to (always null: the agency
  signs on the layout's line), bank_date, bank_ref, bank_amount, difference (bank_amount −
  amount), confirmed_by, confirmed_on, confirm_voucher_no (the `remit-confirm`'s CRem) — these
  seven null before `remit-confirm` — notes, created_on, print_count, printed_on.
- `till.remit.lines` (many): face_value, denomination, qty, amount — the REMIT count sent as
  `lines` on `movements/remit`, high to low; empty when none was.

**Who gives and who receives** (`gives` / `receives`) is worked out from the session's cashier
(`tss_operator_id`), not from which column holds whom: "the other person" is whichever of
`tcm_done_by` / `tcm_witness_by` is not the cashier. A pickup / top-up keyed at the counter (notes
110: done_by = the cashier, witness_by = the supervisor), one moved by `movements/change` (done_by
= the supervisor) and the 4 pre-notes-110 test rows with the roles the other way round therefore
all print the same, with nothing swapped by date. PICKUP: the cashier gives, the other receives.
TOP_UP / FLOAT_ISSUE: the other gives, the cashier receives — a float the cashier issued at their
own open (done_by = the cashier, no witness) leaves `gives` null, a supervisor-opened till names
the supervisor. DROP / CLOSE_HANDOVER: the cashier gives, `received_by` receives (null until
received: a blank line for a hand signature). PAID_IN: `party_name` gives, the cashier receives.
EXCHANGE: the cashier gives, `receives` null. SAFE_TRANSFER (no session): `tcm_done_by` gives,
`tcm_witness_by` receives (null when none).

**Print counts:** `PrintLogService` bumps `tss_print_count` / `tbd_print_count` once per PRINT /
REPRINT render (copy 1, SUCCESS) of a `TILL_SESSION_Z` / `TILL_DAY_Z`, and since notes 135
`tcm_print_count` of a `TILL_MOVEMENT` / `TILL_REMIT` (`PRINT_COUNTERS`, keyed by
`plg_src_doc_type`) — the first such writers; every other `*_print_count` is still untouched. An X
is numbered by its X_REPORT events, not a counter.

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

Notes 122 §1: a device still holds its session while it is counted and waiting for an approver
(`HOLDING_SESSION_STATUSES`: PENDING_APPROVAL too), so an unlinked (picked) till whose drawer is
being decided is refused (`TILL_SESSION_NOT_OPEN`) instead of taking cash with no session; a
document that moves no drawer money (a receipt / payment with no CASH) on such a device still needs
none. And a document that names a **real** till session is judged on any device — a back-office
device included — so cash never lands in a drawer that is no longer taking money (a late arrival is
still accepted, §2.6). An id that names no till session (the React web client's LOGIN session
id, the old Qt client's random uuid) is not kept: bill and sale order saves store NULL for it
(`till-session-id.ts`, notes 122 §3 — the user's call over a refusal, so React keeps working).

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
| §3.3 / §4.3 CASH_PAYMENT (cash part) and EXPENSE (total) rules — **the gate** (notes 124 §5, "The approval gate" below): under `till.approval_gate` WARN (as shipped) an INFO `TILL_APPROVAL_REQUIRED` warning, a PENDING request in the inbox (`approval.approvalId`), `approval` on `/expenses/validate` · `/post` and `/payments/post` and in the `*_POSTED` event's payload; under REFUSE 428 until `approvalId` names an approved request for the voucher (`/expenses/validate` lists it as a refusal) | `TillApprovalService.assessGate` / `settleGate` |

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

**Cash out (notes 122 §5).** Under `till.cash_out_over_expected = REFUSE` (up to DEVICE, shipped REFUSE)
a document never pays out more CASH than the drawer is expected to hold: `/payments/post`,
`/expenses/validate`·`/post`, the register's payment types and a CASH-settled `/sale-returns/post`
pass their cash out (`cashOut`) and get 409 `TILL_CASH_SHORT_IN_DRAWER`. The expectation counts
POSTED documents only, so the document itself is not in it yet. The refusal names the amount paid
out, never the drawer's figure (a blind cashier never sees it). `ALLOW` lets the drawer run
negative. Pickups and drops are not judged: they are counted cash, and an over may hold more.

## Ledgers

Till cash = the branch's CASH tender ledger (`acc_tender_master.tnd_ledger_id`, branch row
before company row) — D9, no ledger per counter. Safe = `till_safe.tsf_ledger_id` (default: the
`SAFE_CASH` role's). Variance = role `CASH_SHORT_EXCESS`; unmapped → 422 `TILL_LEDGER_UNMAPPED`.
Every till voucher: `avh_src_module 'TILL'`, `avh_src_doc_type 'TILL_MOVEMENT' | 'TILL_VARIANCE'`
(`'TILL_RECEIVE'` for a TRcv, notes 113), `avh_session_id` = the session, dated the business date
(a TRcv and a RECEIVE-stage TVar: the day it is received / decided). Cash awaiting receipt = role
`TILL_CASH_AWAITING` (notes 113, above). The movement's `tcm_doc_no` is its
voucher's number.

**§5.7 invariant** — after a session closes, the till-cash legs carrying its id (POSTED and
CANCELLED vouchers, as every balance in the house reads them — a voided movement's original and
its mirror net out) net to
`tss_float_left − (CARRIED ? tss_float_issued : 0)` — the open's TVar takes the till ledger to what
was counted, so a float mismatch no longer leaves its difference behind (notes 98 §1). The session's
`tss_variance_status` describes the close count; an opening difference shows as `tss_float_variance`.

## Single writers

`TillEventService` is the only writer of `till_event` (INSERT only; `test/till-event-single-writer.e2e-spec.ts`).
`TillSessionService` writes `till_session`, `till_count(_line)` (a safe's counts too:
`writeSafeCount`); `TillPostingService` writes `till_cash_movement` and posts / marks
`till_variance`.

## Every cash line carries a tender (notes 126 §2, §3)

- **§3 — the till's own transfers are labelled.** TFlt, TDrp, TRcv, TVar, TPIn and CRem post
  through `postLegs` with `money: { bankTender: 'BANK' }`, so `coverMoneyLines`
  (common/posting/money-lines.ts) writes one CASH tender row per cash leg — till cash, safe, Till
  cash awaiting receipt, Cash in transit — with the session, `td_src_doc_type 'VOUCHER'`,
  `td_src_module 'TILL'`; CRem's bank leg (and a bank tender's variance) takes that bank's BANK
  tender. The tender Day Book (reports/tender-day-book) then shows the whole path drawer → safe →
  bank.
- **Those rows are labels, not cash the drawer took:** the drawer's expected
  (`TillLedgerService.expected`), the safe's flows (`TillSafeService`), the slip check and grid
  158 TILL SAFE BOOK (migration `20261016130000`) skip `td_src_doc_type = 'VOUCHER'` — the
  movement already counts that cash.
- **§2 — no device is the back office.** `routeMoneyDoc`: a call with no device id is a
  back-office call (cash from the branch's safe, or `TILL_SESSION_REQUIRED` under
  `till.backoffice_cash_from = REFUSE`), never a pass. `assertNoTillCashLeg`: in a branch that runs
  a till, a Journal / Contra with a leg on the till cash ledger, a safe's, Till cash awaiting
  receipt or Cash in transit is 409 `TILL_CASH_LEDGER_DIRECT` from any device or none (it was:
  only a device in a session, only the till cash ledger). A real correction goes through a till
  movement or the Cash Office.

## The approval gate (notes 124 §5 — notes 105 Part B)

A request is a `till_approval` row: PENDING until an approver decides it, APPROVED / REJECTED,
CANCELLED by whoever asked, EXPIRED past `tap_expires_on` (`tar_expire_minutes` > 0; swept to
EXPIRED, `APPROVAL_EXPIRED` journalled, whenever the inbox or a decision reads it). The rule as it
stood is kept in `tap_rule_snapshot`, so a decision is judged by the bar that stood when it was asked.
`TillApprovalGateService` + `TillApprovalController`:

| Route | |
|---|---|
| `POST approvals/request` | `{ companyId, branchId, event, amount, sessionId?, accYear?, srcDocType?, srcDocId?, srcRefno?, reasonId?, note?, approverId?, approverPin?, secondId?, secondPin? }` — under the event's rule (none = the built-in SUPERVISOR / EITHER one); a rule that asks nothing for the amount → 422 `TILL_APPROVAL_INVALID` with `needed: false`. `srcDocType` / `srcDocId` name what it unlocks (what a 428 named); the same caller asking again for the same document gets the PENDING one back. **At the counter:** `approverId` + `approverPin` decides it in this call (COUNTER channel; a wrong PIN 403 + `PIN_FAIL`, nothing written). `APPROVAL_REQUESTED`. Open Till (272) VIEW or 273 VIEW |
| `POST approvals/decide` | `{ …key, tapId, decision APPROVE · REJECT, note, approverPin?, secondId?, secondPin? }` — the caller is the approver: `assertApprover` (self → `TILL_APPROVER_SELF` unless `tap_self_allowed`; grant level / ceiling; the channel's PIN). APPROVE on a two-person rule takes the second person by PIN (`TILL_APPROVER_SECOND`, `TILL_WITNESS_*`). Not PENDING → 409 `TILL_APPROVAL_NOT_PENDING`; expired → 409 `TILL_APPROVAL_EXPIRED`. An approved FLOAT_MISMATCH filed at an open names itself on that OPEN variance (`tvr_approval_id`). `APPROVAL_DECIDED`. 273 OVERRIDE |
| `POST approvals/cancel` | whoever asked, else 273 OVERRIDE (403 `TILL_APPROVAL_NOT_YOURS`); CANCELLED, `APPROVAL_DECIDED` with `status: CANCELLED` |
| `GET approvals/get` | one request: status, names, `usedOn` (a document has taken it) |
| `GET approvals/pending` | **the inbox** — every decision waiting in the branch with the route that makes it: `REQUEST` (approvals/decide), `SESSION_VARIANCE` (sessions/decide-variance: PENDING_APPROVAL, and `afterClose` for a CLOSED session's undecided drawer gap), `RECEIVE_VARIANCE` (decide-variance with `tcmId`), `SAFE_VARIANCE` (safes/decide-variance); `canDecide` / `cannotBecause` for the caller's own grants (self, level, ceiling — the PIN is asked at the decision); a variance's amount null without 273 OVERRIDE. 273 VIEW |

**Enforcement — `till.approval_gate`** (WARN · REFUSE, shipped WARN, DEVICE max scope; migration
`20261016100000`). The user's rule (2026-10-15): the counter is never blocked while a customer waits;
a rule warns first and refuses only where a company turns that on. `TillApprovalService.assessGate`
(read-only) / `settleGate` (in the document's transaction):

- **WARN:** the document goes through; one PENDING request per event and document is filed for the
  inbox, after the fact (`tap_rule_snapshot.after`).
- **REFUSE** on a rule with `tar_blocks_till`: **428 `TILL_APPROVAL_REQUIRED`** `{ event, amount,
  requiredRole, channel, twoPerson, srcDocType, srcDocId }` until the call brings `approvalId` — an
  APPROVED request of this branch for this event and document, for at least this amount, not used
  (else 422 `TILL_APPROVAL_INVALID`). The document takes it: `usedOn` / `usedDocId` in the snapshot,
  `tap_session_id` filled.

| Event | Where | The document an approval names |
|---|---|---|
| EXPENSE | `/expenses/post` (in a session; `/validate` lists the REFUSE as a refusal) | `EXPENSE` · the voucher |
| CASH_PAYMENT | `/payments/post` (cash out of a drawer) | `PAYMENT` · the voucher |
| FLOAT_MISMATCH | `sessions/open` (counted ≠ issued) | `TILL_COUNTER` · the counter (no session yet); a WARN request is filed on the new session with the variance's `tvrId` |
| VOID_BILL · VOID_LINE | rules shipped (ALWAYS, SUPERVISOR, COUNTER) for the client to ask before a void; the server does not see a line void and does not enforce them | as the client names it |

FORCE_CLOSE, SESSION_REOPEN, DAY_CLOSE_EXCEPTION, DAY_REOPEN, REMITTANCE and SAFE_VARIANCE were
already decided in their own call (the approver's PIN at the desk, notes 117 / 118) and are unchanged.
`selfRefusalOf` (till-approval.service.ts) words TILL_APPROVER_SELF by event (notes 124 §8): a cashier
force-closing their own session reads "cannot force-close their own session"; the code stays
TILL_APPROVER_SELF and the error carries `event`, so the wording catalogue keys a row
`event=FORCE_CLOSE`.

## Not in phase 1 (§13)

- **Approvals:** the gate is built (notes 124 §5, "The approval gate" above). Still open: a
  slip gap's NONCASH_VARIANCE decision after the slip check on a CLOSED session (it needs the
  check's `tvr_rows` for SUSPENSE; the inbox does not list it yet), re-treating an approved
  FLOAT_MISMATCH (the approval is recorded on the posted EXPENSE variance, nothing reposts), the
  server enforcing VOID_BILL on `/bills/cancel` (rules shipped for the client to ask), and
  `sessions/decide-variance` folded into `approvals/decide` (they stay two routes; the inbox names
  the right one).
- **REV 2 items on modules not built yet:** §2.1–§2.3 and §2.5 (the settlement import / match /
  TSet of 49) are built in `accountsModule/tenderSettlement`, except the closed-session pairing
  (`asl_tvr_*`), which waits for the phase-3 variance decision; §2.10–§2.11 (day reopen, day close's suspense row), §2.12 (snapshotting
  `tap_self_allowed` under `till.single_operator` — the approval gate), §2.17's 269ST sum on
  receipts (ExpV and 40A(3) are built — above). §2.18's law facts are data: the TCS 206C(1H) rows still active in
  `statutory_limits` need raising with Prathap.
- The slip print templates (§9) are print-engine data, not built (the expense voucher's
  `EXPENSE_VOUCHER` purpose is seeded; its template is designed in the template designer). All
  five till purposes and their data are built — the Z / X / store Z (notes 117) and the movement
  slip / remittance memo (notes 135), "Printing" below; their layouts are the user's.
- **Cockpit + day** (phase 4): built by notes 117 (below) except the session void.
- **Safe** (phase 5): built by notes 118 (above) except SAFE_TRANSFER. **HO review** (phase 6).
  Drop verification came forward as the notes 113 receive (above).
  Non-cash settlement (49) is built in `accountsModule/tenderSettlement`.
- The session **grid** (S6): a configured grid, not registered yet (the master grids 133–136 were
  made on the dev box in the grid designer).
- `/bills/amend`, the order advance (ARc) and the delivery challan are not yet session-stamped.

## Tests

`test/till-review-http.e2e-spec.ts` (notes 134: every review refusal writing nothing, a session
reviewed twice — the second supersedes the first, both journalled HO_REVIEW — and a day written off
against a posted journal; reads an existing CLOSED session and deletes only its own reviews),
`test/till-safe-http.e2e-spec.ts` (notes 118, on a TEMPORARY branch with a 10,000 opening
balance on the safe ledger: the book before a count, the blind viewer, a float out and a hand-over
in only once approved, a count within tolerance, decided in the step with the witness as second
(and refused alone / with a wrong witness PIN), sent on and decided later with a second PIN, a bank
deposit refused over the balance / to a non-bank ledger, voided, a CIT remittance confirmed 5 short,
the refusals once confirmed / counted since, the day close freezing the safe figures; notes 135: the
float's and the hand-over's slips and the two remittance memos as the providers hand them to a
layout, each purpose refusing the other's document),
`test/till-day-close-http.e2e-spec.ts` (notes 117, on a TEMPORARY branch (`till.day_close_safe_count`
off there since notes 118) of the e2e company so no
live day is ever closed: the X read, force close, session reopen, the close-check, a blocked /
clean / exception close, the day reopen, the print providers),
`test/till-handover-receipt-http.e2e-spec.ts` (notes 113: REQUIRED on the branch for the run — the
hand-over and a drop to awaiting, the blind list, the receiver refusals, a full / short / within-
tolerance receive, the short one decided by a third user, a received drop not voided; notes 114:
approve-cash refused open / to the cashier / without or with a wrong PIN, exact and never twice,
within tolerance, a shortage spilling from the hand-over onto a drop sent on and decided by
another approver, decided in the step by the caller's grant and refused over it, the
single-operator owner without a PIN),
`test/till-session-http.e2e-spec.ts` (masters, the blind lifecycle, carried float, tolerance,
PENDING_APPROVAL / 428, the journal), `test/till-variance-decide-http.e2e-spec.ts` (notes 105 A: the
four approver refusals, a recount granted by PIN and the close refused until it is counted (notes 112), EXPENSE / SUSPENSE approved remotely and posted at
close, RECOVER refused without a staff ledger; notes 124: a CLOSED session's undecided gap approved after close, the
force-close self wording, the day's awaiting figures), `test/till-approval-gate-http.e2e-spec.ts` (notes 124 §5:
request / decide / cancel / inbox / expiry, decided at the counter by PIN, FLOAT_MISMATCH under WARN and
under a DEVICE REFUSE row), `test/till-money-paths-http.e2e-spec.ts` (a cash bill on a
till device: refused without a session, stamped with it, a re-tender journalled RETENDER, expected
by the count, not cancellable once counted), `test/till-event-single-writer.e2e-spec.ts`, `test/till-settle-pending.e2e-spec.ts` (REV 2 §2.4), `test/till-movements-http.e2e-spec.ts` (phase 2: a
cashier and a supervisor — two users, two app instances — every kind; notes 110: a pickup refused from
the office, the supervisor list, every supervisor refusal (stranger, self, no right, no PIN, none typed,
wrong + PIN_FAIL), the signed pickup / top-up, a drop refused until the counter's safe is a drop safe;
the notes 108 witness PINs on a change between counters, the gauge NORMAL → ALERT →
BLOCKED → NORMAL, a void and its mirror, the close netting to the float left; notes 135: the
exchange's slip lines telling IN from OUT). The money-path
suite also refuses a bill on a BLOCKED drawer until a drop. Each suite registers its own
device, so no other suite's device is ever governed. `test/expense-voucher-http.e2e-spec.ts` covers
the receipt / payment / expense plan: the expense voucher end to end, paid-from-bank, the journal
refusal, the safe, 40A(3) across a payment and an expense, the reported approvals, the list grid. `test/till-counter-claim-http.e2e-spec.ts`
plays a linked PC, three unlinked tablets, a back-office PC and an unknown device as three users
in one app (the stubbed token reads `<user>@<device>`): the plan's tests 1–7, 9 (open-check) and
10, and a picked counter's cash bill landing in its session. Run with `--runInBand`.
