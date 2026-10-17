# Account Day Summary — `reports/day-summary`

The day book. A read-only report over the `acc_vouchers` legs of ONE company,
one branch or all, one day or a range inside one fiscal year: by voucher type,
by money ledger and by ledger group. It writes nothing: no table, no column,
no DB function, no trigger. Built from the plan of 2026-10-12
(Prathap/report/plan-backend-account-day-summary.md). Decisions D1–D8 are taken
as the plan recommends; D9 (the tender master's ledgers) is a data fix for the
tender owner and is not done here.

## Routes — all `GET /api/v1/reports/day-summary/…`

| Route | Serves |
| --- | --- |
| `voucher-types` | the Type combo: active types that post legs (no query keys) |
| `summary` | the Summary tab: scope, business day, tiles, type grid, money grid, group grid, checks — one snapshot |
| `vouchers` | the Vouchers tab (day book detail), paged (`page`, `pageSize` ≤ 500), or `draftsOnly=true` |
| `daily` | the Day-wise tab, one row per calendar day (≤ 366) |
| `group-ledgers` | Enter on a group row: the ledgers rolled into `groupId` |
| `checks/detail` | the rows behind one check `code` (≤ 500, `truncated`) |
| `export` | `summary` + every voucher row with legs; > 20,000 vouchers → 422 `RANGE_TOO_LARGE` |

Common keys: `companyId`, `accYear`, `branchId?` (absent = All), `fromDate`,
`toDate?` (absent = `fromDate`), `voucherTypeId?`, `clearingAsBank` (true),
`groupLevel` (`REPORT` | `PRIMARY` | `LEDGER_GROUP`), `zeroRows` (false).
`vouchers` / `export` add `includeCancelledPairs` (true), `natureFilter`
(a `vchr_nature`), `moneyKind` (`CASH` | `BANK` | `CLEARING`) and `withLegs`.
Amounts are strings with two decimals; sides are `DR` / `CR`, never a minus
sign. Checks carry codes and facts, never sentences.

Every route runs in one read-only `REPEATABLE READ` transaction, so the panels
of a response are the same moment's numbers.

## Definitions

- **Counted legs** — live legs of POSTED **and** CANCELLED headers of the
  company, year, branch scope and range. The balance fragments
  (`countedLegsSql`, `openingSetSql`) live in
  [../common/voucher-books.sql.ts](../common/voucher-books.sql.ts) and the
  Ledger Statement reads the same ones (D1). The CTE chain is in
  [day-summary.sql.ts](day-summary.sql.ts).
- **The pair rule (D2)** — a cancel is the CANCELLED original (legs kept) plus
  a POSTED mirror with the opposite legs; the mirror is the header some other
  header names in `avh_reversal_voucher_id`. A pair whose both halves are in
  the range is left out of every figure and counted only as `cancelledPairs`
  (on the original's type). A lone half is counted on its own type row and
  flagged `loneHalves`. The `voucherTypeId` filter is applied after the pairing,
  so a `Rev` mirror still pairs with its `Jrl` when the filter is `Jrl`.
- **Amount** — Σ DR legs of a voucher; never `avh_doc_amount`, except for a
  draft (it has no legs).
- **Money ledgers** — walking up from the ledger's group, the first
  non-`General` `acc_ledger_profile` decides: `Cash` → CASH, `Bank` → BANK,
  anything else → not money. Else CLEARING when the ledger is the
  `tnd_ledger_id` of one of the company's live tenders that names a
  `tnd_settlement_ledger_id`. `clearingAsBank` folds CLEARING into the type
  grid's and the Day-wise tab's bank columns; the money grid always lists it
  apart.
- **Opening / closing** — the Ledger Statement's: opening set (one branch =
  its rows; All = every row) + counted legs before `from`; closing = opening +
  in − out. Every money closing equals the Ledger Statement's for the same
  ledger, range and branch (the e2e suite checks it).
- **Group level (D3)** — `REPORT` = the group on the chain whose parent is a
  root (the root itself for a ledger sitting in a root), so Cash-in-Hand, Bank
  Accounts and Sundry Debtors are separate rows. Computed from
  `acc_group_parent_id`, never `acc_group_primary_name`
  ([day-summary.groups.ts](day-summary.groups.ts)).

## Checks

`BALANCED`, `AMOUNT_TIES` (FAIL, and an error log, when broken), `LEGLESS`,
`DRAFTS`, `CANCELLED_PAIRS`, `CLEARING_PENDING`, `BUSINESS_DAY`,
`FUTURE_DATED`, `NUMBER_GAPS` — plan §8. `AMOUNT_TIES` cross-checks Σ type
amount = Σ group Dr = Σ group Cr, and per money ledger that in − out (pairs
left out) equals the net of every counted leg (pairs in): the proof that
leaving pairs out moves no balance. `NUMBER_GAPS` looks only between the
lowest and highest number issued in the range, per series, and splits
DELETED (a soft-deleted header holds it) from UNUSED.

## Access

View on menu **284 "Account Day Summary"** (under 137 at 0.60, verbs
VIEW · PRINT · EXPORT; migration `20261012120000_account_day_summary_menu`, and
`prisma/seed/Menu_Master.sql`) **or 181 "Day Book Detail"**, which opens the
same screen on the Vouchers tab (D8). Anything else is 403 `NO_MENU_RIGHT` on
all seven routes. Grant through the user-rights screen — a `menus[]` save there
is a FULL replace.

## Differences from the plan

- **A voucherTypeId filter has no balances.** Money `opening` / `closing`, the
  CASH_IN_HAND tile's and the Day-wise closings are `null` under a type filter
  (a balance has no voucher type); in / out are the type's. `CLEARING_PENDING`
  is then left out and `AMOUNT_TIES.facts.moneyChecked` is false.
- **The Day-wise tab is a day book per day.** Its pair rule is "both halves on
  that date", so each day's closing is the true balance at that day's end and
  the last one equals the `/summary` closing. A pair straddling two days shows
  as a lone half on each, so Σ daily `vouchers` can exceed the range's.
- **Checks that do not apply are left out** of `/summary`: `BUSINESS_DAY` for a
  range, `FUTURE_DATED` when `toDate` < today (IST), `CLEARING_PENDING` under a
  type filter.
- **Money kind** follows the plan's stated rule (first non-General profile);
  the plan's sample SQL looked only for Cash / Bank.
- **CLEARING on this box is UPI Clearing alone.** Card Settlement Clearing and
  Wallet Clearing are not the ledger of any tender with a settlement ledger (the
  §3.5 tender-master defect); they become CLEARING when the tender master is
  corrected. Tenders are read for the requested company only.
- **Business day, All branches** folds the branches that have a
  `till_business_day` row that date (none → `NONE`; differing → `MIXED`).
  Session totals leave out VOIDED sessions.
- `hasChildren` = the group has live child groups. Groups are listed in tree
  order (`acc_group_sort`, then name, root first) and only with movement;
  `zeroRows` adds types and money ledgers, not groups.
- A type with only a cancelled pair in range still gets a row (vouchers 0), so
  the pair is visible.
- `voucher-types` leaves out types with `vchr_affects_accounts = false` (D4:
  today Quo, SOr) and inactive ones.
- `/vouchers` is a union on `draftsOnly`; legs also carry `rowNo`.
  `natureFilter` is a `vchr_nature`: the PAYMENTS tile drills as
  `natureFilter=PAYMENT`, which includes ExpV — use `voucherTypeId` to split.
- `RANGE_OUTSIDE_YEAR` starts the year at `fy_books_begin_date` when that is
  later than `fy_begin_date` (the plan's §9); the Ledger Statement uses
  `fy_begin_date`.
- A series whose lowest and highest in-range numbers are more than 100,000
  apart is not expanded by `NUMBER_GAPS`.
- No new index (D6): driving from the legs, a day reads in ~0.1 s and the whole
  2026-2027 year of the dev company in ~0.2 s.

## Tests

- [day-summary.groups.spec.ts](day-summary.groups.spec.ts) — money kind,
  roll-up levels, tree order (unit).
- `test/day-summary-http.e2e-spec.ts` — HTTP against the dev database
  (read-only apart from the `user_menus` fixture): guards and refusals, a
  brute-force pair rule per type, Σ branches = All, the type filter, Day-wise
  chaining, money closings = Ledger Statement closings, paging, drill filters,
  export. Then the plan's §11 scenarios on synthetic `ZT-DS-` vouchers written
  inside a transaction that is always rolled back, with the service's pipeline
  run on that transaction.

      npm run test:e2e -- day-summary-http --runInBand
