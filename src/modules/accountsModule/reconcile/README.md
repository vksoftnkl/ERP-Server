# Books reconcile — the trial-mode check (notes 47)

While the system is in trial, every post that moves a bill-by-bill party or a
cheque is refused unless the books still agree with themselves. A mismatch
surfaces at the counter, on the document that caused it, instead of at year end.

| Check | Holds when | Refusal |
| --- | --- | --- |
| **C1 · party** (`led_is_bill_by_bill`) | opening (this FY) + live legs of POSTED **and CANCELLED** vouchers (this FY) = Σ `abl_pending_amount` of live bills, **all years**, DR + / CR − | 422 `ACC_PARTY_OUT_OF_BALANCE` `{ partyId, partyName, ledger, bills, diff }` |
| **C2 · Cheques In Hand** | the same ledger side = Σ `apd_amount` of ON_RECEIPT rows HELD or DEPOSITED | 422 `ACC_CHEQUES_OUT_OF_BALANCE` `{ ledgerId, ledgerName, ledger, register, diff }` |

Tolerance 0.005. Company-wide, not per branch. CANCELLED headers count because a
cancel keeps the original's legs live and posts a POSTED mirror. DEPOSITED
cheques count because a deposit posts no voucher. Dr = Cr per voucher is already
enforced by `ck_avh_balanced`, so it is not repeated here.

## One definition

The arithmetic lives in the database (migration
`20260925100000_books_reconcile_on_post`):

- `accounts.fn_party_bill_reconcile(company, ledger, acc_year)` → `(ledger_bal, bills_bal, diff)`
- `accounts.fn_cheques_in_hand_reconcile(company, ledger, acc_year)` → `(ledger_bal, register_bal, diff)`
- `accounts.fn_books_reconcile(company, acc_year)` — both, over every such ledger (the nightly pass)

[books-reconcile.guard.ts](books-reconcile.guard.ts) (`assertBooksReconcile`) calls
the first two. The caller passes what it touched (party ids, vouchers, register
rows); the guard works out which of those ledgers are bill-by-bill or Cheques In
Hand and checks only them. Reads only, no locks.

## Where it runs — last, inside the post's transaction

| Path | File |
| --- | --- |
| sale bill post, amend (re-post) | `sales/bill/bill-lifecycle.service.ts` `postCore` step 13 |
| sale bill cancel | `bill-lifecycle.service.ts` `cancel` |
| sale bill re-tender | `sales/bill/bill-retender.service.ts` |
| sale order advance (create / update / unpost / delete) | `sales/sale-order/order-advance-posting.helper.ts` |
| receipt post, amend | `receipt/receipt-posting.service.ts` `postInTransaction` step 16 |
| receipt cancel | `receipt/receipt-cancel.service.ts` |
| cheque deposit, clear, bounce, return, re-present, replace | `cheques/cheque-*.service.ts` |
| opening balance save (ledgers whose figure moved), delete; opening bills save | `openingBalance/opening-balance.service.ts`, `bill-wise.service.ts` |

Not covered per post: carry-forward and anything written outside these paths.
The nightly pass catches them:

    npx tsx scripts/reconcile-books.ts [YYYY-YYYY] [--all]   # exit 1 on any mismatch

## The switch

`accounts.reconcile_on_post` (BOOL, COMPANY scope, default `true`). Turn it OFF
at go-live: offline sync can make the two sides lag briefly in production, and a
post must not be refused for that. With no setting row at all (migration not
applied) the check is off.

A party that is already out of balance refuses **every** post that touches it
until the underlying defect is fixed. That is intended.
