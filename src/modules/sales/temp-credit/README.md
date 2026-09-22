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
