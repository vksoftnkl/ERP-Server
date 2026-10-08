# Ledger Statement — `reports/ledger-statement`

A read-only report over the `acc_vouchers` legs of ONE ledger for ONE period,
starting from that year's `acc_opening_balance`. It writes nothing. Built from
the plan of 2026-09-25 (Prathap/report); its decisions L1–L7 are taken as that
plan recommends, except where noted below.

## Routes — all `GET /api/v1/reports/ledger-statement/…`

| Route | Serves |
| --- | --- |
| `ledgers` | the picker: `companyId`, `search?`, `groupId?`, `limit?` (30, max 100) |
| `header` | LEDGER DETAIL + PERIOD SUMMARY (the three top panels) |
| `vouchers` | the grid — one row per voucher, running balance, paged (`page`, `pageSize` ≤ 1000) |
| `voucher-legs` | every leg of one voucher (Alt+F1 / ▾) |
| `daily` | one row per date with movement |
| `monthly` | every month of the fiscal year (the MONTH-WISE panel, and menu 144) |
| `export` | header + every row, unpaged, capped at 20,000 (422 `RANGE_TOO_LARGE`) |

Common keys: `companyId`, `accYear`, `branchId?` (absent = All), `ledgerId`,
`fromDate` / `toDate` (YYYY-MM-DD, inside the year). `/vouchers` and `/export`
also take `includeCancelled` (default true), `withBillRefs` (default true) and
`withLegs` (default false — L4's inline flag). Amounts are strings with two
decimals; sides are `DR` / `CR`, never a minus sign.

The module shares no URL, DTO or payload with any other module (plan §2), and
calls none of the `accounts.fn_*reconcile*` functions — the SQL is in
[ledger-statement.service.ts](ledger-statement.service.ts).

## The one definition of a balance (§4)

    balance(asOf) = opening set ('D' +, 'C' −)
                  + Σ av_signed_amount of live legs dated ≤ asOf
                    whose header is POSTED or CANCELLED

- **CANCELLED counts.** A cancel keeps the original's legs and posts a POSTED
  mirror with the opposite ones; the pair nets to zero. DRAFT / APPROVED never.
- **Company-scoped** always. A shared ledger (`led_company_id IS NULL`) shows only
  this company's movement.
- **Branch:** one branch = its own opening set and legs; All = every opening set
  (company-level + every branch's) and every leg (L2). A branch view of a ledger
  opened only at company level opens at 0 with `openingNote: COMPANY_LEVEL_ONLY`.
- Year begin = `fy_begin_date`, or `fy_books_begin_date` when later. A range
  never crosses a year end (L5, `RANGE_OUTSIDE_YEAR`).

## Rows (§6–§8)

- Ordered by date, `avh_voucher_slno`, voucher id. `debit` / `credit` are this
  ledger's GROSS DR / CR legs in the voucher (L3); the balance moves by the net.
- The running balance is a window over the whole filtered range, so
  `broughtForward` / `carriedForward` are exact on any page.
- `rowKind`: `CANCELLED` (the header is), `REVERSAL` (a POSTED header another
  header names in `avh_reversal_voucher_id` — index `ix_avh_reversal`, L7),
  `NORMAL`. `includeCancelled=false` hides a pair only when both halves are in the
  range; a lone half stays, flagged `pairOutsideRange`.
- Particulars: this ledger's legs all naming one `av_opp_ledger_id` → it; else
  exactly one ledger on the opposite side → it; else `asPerDetails: true`.
- Bill refs: bills the voucher settles for this party (net of retracted rows),
  and the bill it raises with its due date (`"bil00242 due 08-11"`).

## Access

View on menu **258 "Ledger Statement"** (under 137, seeded by
`prisma/seed/Menu_Master.sql`) **or 144 "Ledger Monthly Summary"** (L1: the same
screen on the Monthly tab). Anything else is 403 `NO_MENU_RIGHT` on all seven
routes, the picker included. Grant through the user-rights screen — remember a
`menus[]` save there is a FULL replace.

## Differences from the plan

- **L6 / `creditLimit`:** the plan found no credit-limit column. `sales.customers`
  has `cus_credit_amt_limit`, so a customer ledger returns it; any other ledger
  returns null.
- `groupId` is a uuid (`acc_group_master.acc_group_id`), not the integer in the
  plan's example.
- `/monthly` also returns `closing` (the year's closing) beside `opening`.
- Response models are TypeScript types only; Swagger describes each route in
  prose.

## Defects fixed alongside (§3)

- `accounts.fn_ledger_book_balance` read every `'D'` opening as a credit
  (`op_dr_cr` is one letter) — migration `20260925130000`. This was notes 47's D2.
- Opening-balance `closingByLedger` and carry-forward's P&L now count CANCELLED
  headers as well as POSTED, so the year-end closing and the carried opening
  agree with this report.
