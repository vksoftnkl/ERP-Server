# Temporary credits — `/api/v1/temp-credits`

HANDOVER 2026-09-20 §7 (31). The rows are written by `/bills/post` — one per TEMP_CR (tender type 8)
row, with the WHO the tender carried (`tempCredit { name, mobile, place, addr, idRef, days, notes }`,
kept on the tender row while the bill is a DRAFT because `atc_abl_id` is NOT NULL).

| route | what it does |
|---|---|
| `GET /open?companyId&branchId&status=OPEN,PARTIAL&search=&overdueOnly=` | Grid rows with `daysOverdue`. |
| `PUT /follow-up { atcId, atcAccYear, promiseDate?, remarks }` | Records the follow-up. |

Hooks elsewhere: `/receipts/open-items` carries `tempCredit { name, mobile, dueDate, balance }` per
bill and accepts `?mobile=`; `/receipts/post` stamps `atc_last_receipt_id`;
`BillBalanceRecomputeService` refreshes `atc_balance_amount` / `atc_status` whenever it recomputes the
bill row; `/bills/retender` voiding a TEMP_CR row cancels its `atc` row.

## The credit's own history — notes 90 (2026-10-05)

Ctrl+H on Temp Credits reads `public.txn_status_log` by `atc_id`, and nothing wrote there: the
bill's steps file under the bill id, the follow-ups go to `audit_log`, the money to
`acc_bill_adjustment`. Every writer of `atc_status` now appends a **TEMP_CREDIT** step keyed by
`atc_id` through `src/common/txn-status-log/temp-credit-status.ts`:

| event | written by | from → to |
|---|---|---|
| `CREATED` | `/bills/post` (`BillLifecycleService.postCore` step 7) | — → OPEN, remark "credit 500.00 to Ravi (98…), 10 days, due 2026-10-15" |
| `PARTIAL` / `SETTLED` / `WRITTEN_OFF` | `BillBalanceRecomputeService.recomputeBills` — only when the status REALLY moved (before-read, `UPDATE … RETURNING`) | remark "received 10.00 by RCT/0012, balance 200.00"; the voucher is the bill's last movement |
| `REOPENED` | the same recompute, when a reversal gives the balance back | SETTLED / WRITTEN_OFF / PARTIAL → PARTIAL / OPEN, remark "reversed 10.00 by …" |
| `CANCELLED` | `/bills/cancel`, `/bills/amend` (the old row) and `/bills/retender` voiding the TEMP_CR row | any → CANCELLED |

`WRITTEN_OFF` is **derived** (notes 90 C): a bill with nothing left whose LAST movement — by
date, then by when it was written — was a `WRITEOFF` adjustment reads WRITTEN_OFF instead of
SETTLED, and a cancelled write-off reopens it. Nothing stamps it once and keeps it.

The post also writes an `insert` row to `audit_log` (screen "Temporary Credit") carrying the WHO as
given, with `log_entity_id = atc_id`; the follow-up's `update` row names the entity too (notes 90 B).

