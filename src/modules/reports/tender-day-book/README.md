# Day Book by tender (notes 126 §4)

`/api/v1/reports/tender-day-book` — the cash and bank ledgers' legs, each **labelled with the
tender it moved by**, so the Day Book reads by tender (cash, UPI, card, cheque, bank — or by
tender master: "CARD – HDFC machine 1" apart from "CARD – ICICI machine 2") and a money line with
no tender — a missing transaction — can be found.

The legs are the books: what the Trial Balance and every ledger balance read. The tender rows
(`acc_tender_detail`) only **label** them, so the report always adds up to the ledgers.

| Route | |
|---|---|
| `GET /reports/tender-day-book` | `companyId, accYear, fromDate, toDate?, branchId?, sessionId?, groupBy (TENDER · TYPE), tenderIds?, tenderTypeIds?, withRows?, limit?` → `groups` (ledger × tender or type: opening, debit, credit, closing; tender null = **no tender**), `ledgers` (the books: opening set + lines, so Σ groups + `openingSet` = the ledger), `rows` (the range line by line) |
| `GET /reports/tender-day-book/no-tender` | `companyId, accYear, fromDate? (year start), toDate? (today), branchId?, sessionId?, limit?` → `count`, `amount`, `byVoucherType`, `rows`. **Should always be empty.** |

Rights: menu 284 (Account Day Summary) or 181 (Day Book Detail) VIEW — the same readers; 403
`NO_MENU_RIGHT`. One read-only REPEATABLE READ snapshot per call, custom plans.

## The labelling (`tender-day-book.sql.ts`)

A money line is a leg on a ledger whose `led_ledger_type` is CASH or BANK, of a POSTED or
CANCELLED voucher. Per (voucher, ledger, side), the tender rows that label it are the **covering
voucher's** — the voucher itself, or for a reversal mirror (a cancel's Rev, found by the original's
`avh_reversal_voucher_id`) the original, sides flipped:

- rows naming the voucher: `td_voucher_id`, or `td_src_doc_id` (the register, receipts,
  payments, ExpV, and the server's own `VOUCHER` rows);
- the document's own rows not claimed by another voucher (a bill's, a return's:
  `td_src_doc_id` = the voucher's source, `td_voucher_id` NULL);
- a re-tender's contra (sourced on the tender row it voided): the rows that replaced it
  (`td_replaces_id`) on their side, and the voided row on the opposite side;
- a row labels the ledger it names **or its settlement ledger** (`td_settle_ledger_id`: a card /
  UPI payment out leaves the bank while the row names the clearing ledger).

Several rows on one line split it in proportion; rows short of the line leave the rest with no
tender. A cancelled voucher's rows count even if the cancel deleted them (its legs and its mirror's
still stand). The same rule as `coverMoneyLines` (common/posting/money-lines.ts), which writes the
labels.

**First run (2026-10-16, data since 2026-10-08, every branch):** 403 lines with no tender — the
till's transfers TDrp 120, TFlt 106, TRcv 44, TVar 23, TPIn 6, CRem 4; Rev 36; ChqBnc 30; PmtV 18
(cancelled ones whose tender rows a test deleted); RcpV 13 (typed cash lines, e.g. rcv00140 /
rcv00146); Bil 1, TSet 1, Rct 1. All posted before the rule: since notes 126 every new one is
refused, or at the counter labelled.

**Performance:** the no-tender list over a week of the dev box takes ~4 s (the cover join is an OR
of four keys). `ix_td_voucher` and `ix_td_src_doc` (20261016120000) serve it; a date range keeps it
small.

The "money lines with no tender" SQL is grid-registrable: wrap `labelledMoneyLinesSql` and keep
`tender_id IS NULL`.
