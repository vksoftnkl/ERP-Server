# Party-wise Outstanding — `reports/party-outstanding`

A read-only report over `acc_bill_balance` + `acc_bill_adjustment`: what each
party owed (or was owed) on date D, and how old it is. Receivables and
payables through one Side filter. It writes nothing: no table, column, DB
function, trigger or index. Built from the plan of 2026-10-09
(`Prathap/report/plan-backend-party-outstanding.md`); its decisions O1–O7 are
taken as that plan recommends, except where noted below.

## Routes — all `GET /api/v1/reports/party-outstanding/…`

| Route | Serves |
| --- | --- |
| `options` | filter sources: groups (tree, `isDefault`), areas (+ collection days), salesmen, branches |
| `parties` | the party grid, paged (`sort`, `dir`, `page`, `pageSize` ≤ 500), its totals and the six tiles |
| `party` | the party card: facts, ageing, on-account items, PDC in hand / effective-uncleared, last settlement |
| `bills` | one party's open items on D (both sides), totals and `ledgerClosing` |
| `bill-wise` | open items across parties, paged; `dueOn` for the calendar's day click |
| `bill-history` | every adjustment row on one bill (3.0's grid 580), `tenderAtBill` |
| `summary` | `groupBy` AREA / GROUP / SALESMAN / BRANCH |
| `due-calendar` | owed bills by `dueEff` in `[from, to]` (≤ 92 days), `overdueBefore` |
| `export` | `shape` PARTIES / BILLS / PARTY_STATEMENT, unpaged, capped at 20,000, with `printedAs` |

Common keys: `companyId`, `asOn` (decides the year — there is **no `accYear`**),
`side` (`RECEIVABLE` / `PAYABLE`), `branchId?` (absent = all branches combined),
`groupId?`, `areaId?`, `collectionDay?` (`MON`…`SUN`), `salesmanId?`, `partyId?`,
`ageBy?` (`BILL_DATE` / `DUE_DATE`), `buckets?` (`30,60,90,180`), `onlyOverdue?`,
`includeOnAccount?` (true), `deductPdc?` (false), `hideZero?` (true),
`minDueDays?`, `maxDueDays?`. Amounts are strings with two decimals; a balance
is `{amount, side}` with side `null` only on 0.00. Every payload carries `asOn`,
`side`, `isFuture`, `accYear` and `bucketLabels` — the client never builds labels.

The module calls no other module's service, route or DTO (§2): not
`getCreditSummary`, not the receipt / payment open-items routes, not the grid
runner. The SQL is in [party-outstanding.sql.ts](party-outstanding.sql.ts).

## The one definition of "pending as on D" (§4)

    bills in scope:  company; not deleted; doc_date ≤ D; acc_year ≤ year(D); branch;
                     the party in scope; NOT superseded by an OPENING carry-forward
                     copy in a year ≤ year(D)                        (chain rule, §4.2)

    set_d(b)       = Σ abj_amount of live rows dated ≤ D             (every adj type)
    set_cache(b)   = Σ abj_amount of the rows the cached totals count: all but a
                     post-dated row dated after today (the recompute's own rule)
    tendered(b)    = max(0, alloc + disc + writeoff − set_cache)     (§3.1 counter tender)
    pending(b, D)  = bill − set_d − tendered

- A reversal row carries the ORIGINAL date (§3.3), so a retracted pair cancels in
  the sum and a later cancel changes an earlier D: **"as on D, as the books stand
  today"** (O4 — no "as reported on D" view).
- A post-dated row carries the cheque date, so a cheque maturing after D drops out.
- Candidate set (performance only): pending now, or a row dated after D.
- Owed side: Receivable → `DR` bills, Payable → `CR`. The other side is
  on-account: listed and netted, never aged, never overdue.
  `net = owed − on-account (− PDC in hand with deductPdc)`.
- `dueEff = COALESCE(due_date, doc_date + credit_days)` (O2); overdue ⇔
  `D > dueEff + grace`. Age by bill date (`D − doc_date`) or due date
  (`D − dueEff`, negative = "Not due", the first bucket).
- PDC in hand on D (§4.5): `HELD`/`DEPOSITED`, received ≤ D, dated after D — not
  yet counted, so `deductPdc` may subtract it. Dated ≤ D and not cleared =
  `pdcEffectiveUncleared`: ALREADY counted; the card shows it, nothing subtracts it.

The unit spec covers the ageing rules
([party-outstanding.ageing.spec.ts](party-outstanding.ageing.spec.ts)); the HTTP
suite `test/party-outstanding-http.e2e-spec.ts` reconciles the report with
itself (§9.1, §9.4, paging), with the cached columns at D = today (§9.3) and
with a brute-force SQL of the formula over every bill at past dates.

## Access

View on menu **279 "Party Outstanding"**, straight under 6 Reports at 7.50, after
Financial Statements (migration `20261009100000_party_outstanding_menu` made it
under 137; `20261009150000_party_outstanding_menu_reports` moved it; the seed in
`prisma/seed/Menu_Master.sql` has it under 6; verbs VIEW · PRINT · EXPORT). Anything else is
403 `NO_MENU_RIGHT` on all nine routes. One menu for both sides (O5). Grant
through the user-rights screen — a `menus[]` save there is a FULL replace.

## Refusals — 422 unless noted

`AS_ON_OUTSIDE_YEARS` (also a non-calendar date), `BAD_BUCKETS`,
`NOT_FOR_PAYABLE` (area / salesman / collection day, and `summary` AREA /
SALESMAN, on Payable), `BRANCH_NOT_IN_COMPANY`, `PARTY_NOT_IN_COMPANY`,
`RANGE_TOO_LARGE` (export > 20,000 rows; calendar > 92 days). Added beyond the
plan: `BAD_SORT` (a bucket column the buckets do not have; a bill sort on a
PARTIES export), `RANGE_REVERSED` (calendar `from > to`; `minDueDays >
maxDueDays`), `PARTY_REQUIRED` (PARTY_STATEMENT without `partyId`), and 404 for
an unknown bill on `bill-history`. 403 `NO_MENU_RIGHT`.

## Differences from the plan

- **Default group and dual role (O3).** `groupId` absent — or equal to the
  side's default group — means the Sundry Debtors (Creditors) subtree **plus
  every customer (supplier) row of the company**, wherever its ledger sits.
  That is how a dual-role party shows on both sides. Any other `groupId` is its
  subtree only, and any group may be passed (a staff ledger's group too).
- **`tendered`** subtracts the rows the cache counts (the recompute's rule:
  everything but a post-dated row dated after today), not "rows dated ≤ today".
  They differ only for a non-cheque row dated in the future, which the cache
  does count. Identical on the dev box (35 bills either way).
- **Collection days** are read as ISO weekdays, Monday = 1 … Sunday = 7. The
  stored `arm_collection_days` run 1–7 (a `{7}` exists, no 0), and the Qt area
  entry is free text. The Qt customer-group / supplier widget numbers Monday =
  0, but that is a different column. **Confirm with the area master.**
- **Due-days window and onlyOverdue.** On `/parties` and `/summary` they pick
  parties (any owed bill in the window / overdue > 0) and the party's figures
  stay whole. On `/bills`, `/bill-wise`, the calendar and the bill exports they
  pick bills (owed bills in the window only). The card ignores them.
- **The card** (`/party`, PARTY_STATEMENT) ignores the party-level filters
  (group / area / salesman / collection day / hideZero): one party's figures do
  not depend on how the grid was filtered.
- **`hideZero=false`** also lists the scope's live ledgers with nothing open,
  all zeros (3.0's "only nil balance").
- **Sort** takes `bucket0` … `bucket7` (six edges + "> last" + "Not due").
- **Salesmen** in `/options`: active employees of the company plus any employee
  named as a customer's default salesman. No salesman flag exists on
  `employee_master`.
- **Due calendar** `days` lists only days with something due.
- **PDC status is today's** (the plan's rule). A cheque cleared or cancelled
  since a past D is not "in hand" on that D.
- `lastSettlement` also returns `voucherId` / `voucherAccYear` for the drill.

## Not done here — the plan's other decisions

- **O1** — the sale-bill / sale-return paths still write no ALLOCATION row for
  a counter tender; the report derives it (`tenderDerived: true`,
  `tenderAtBill`). The **recompute suspicion** in §3.1 (a recompute touching a
  part-tendered bill drops the tender and re-opens it) is not verified here.
- **O7** — `BillBalanceService.getCreditSummary`, the party-credit DTO, the
  recompute and receipts' `loadBills` still read across years without the chain
  rule; they will count every carried bill twice after the first carry-forward.
- **O6** — no `custGroupId` filter in phase 1.
- `ledgerClosing` on the dev box: 218 of 219 parties agree with their ledger.
  The exception is the e2e party "new customer" (bills 13,155 Cr, ledger
  16,295 Cr), whose sale-bill re-tender / reversal vouchers moved the ledger
  with no bill row.
