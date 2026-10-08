# Loyalty Status — `reports/loyalty-status`

A read-only report over the customer loyalty wallets: who holds how many
points and what they are worth, who can collect a gift today, whose points
lapse soon, and how each scheme is doing. Built from the plan of 2026-10-05
(Prathap/report), menu **79** "Loyalty Status" under 75 "Loyalty Schemes".
It writes nothing; the screen's two actions are separate routes (below).

Agent loyalty (menus 205–207 / 212 under 202 "Agents", menu 206 included) is
a different thing and is not touched (D7).

## Routes — all `GET /api/v1/reports/loyalty-status/…`

| Route | Serves |
| --- | --- |
| `members` | tab 1 grid + tiles: one row per wallet, paged, `summary` over the whole set |
| `statement` | tab 1 bottom left: one member's ledger with a running balance |
| `member` | tab 1 bottom right: the card, the open lots, best gift, redeem rules, `unlotted` |
| `expiring` | tab 2 grid + tiles: one row per (member, expiry date), paged |
| `expiring/calendar` | tab 2 chart: points lapsing per week, Monday-based, zero weeks included |
| `schemes` | tab 3 grid: movement by scheme in [from, to], split by scheme / branch / month |
| `schemes/monthly` | tab 3 bottom left: one scheme month by month, zero months included |
| `schemes/gifts` | tab 3 bottom right: the scheme's gifts with eligible members, issued, stock |
| `export` | a tab's rows unpaged (≤ 20,000, else 422 `RANGE_TOO_LARGE`) with the `printedAs` line |

Common keys: `companyId` (required), `branchId?` (absent = all branches).
List routes take `page`, `limit` (≤ 200), `sort`, `order`, `search` (card no,
mobile, customer name — the house loose search). Points are numbers, money is
a two-decimal string or `null` where the screen shows "—", dates are
`YYYY-MM-DD` and leave the database as text.

**"Today"** is `CURRENT_DATE` of the database session, which runs in the
company's zone (Asia/Kolkata) — never the Node process's UTC date. Every
response carries it as `asOn`.

The module shares no URL, DTO or payload with any other module, calls no grid
or dropdown runner, and adds **no database function, trigger or view**: every
definition in the plan's §4 is SQL issued by
[loyalty-status.service.ts](loyalty-status.service.ts) or TypeScript.

## The one set of definitions (§4)

| name | definition |
| --- | --- |
| balance | `lmb_balance_points`, the generated column |
| open lot | a ledger row whose type is in `LOYALTY_LOT_TXN_TYPES` (EARN, OPENING, ADJUST, TRANSFER — see D2), not deleted, `lld_lot_balance > 0` |
| redeemable | Σ open lots with `active_from ≤ today ≤ expires_on` — exactly `LoyaltyLedgerService.redeemable()` |
| cooling | Σ open lots with `active_from > today` |
| lapsed | Σ open lots with `expires_on < today`: lapsed, not yet swept by the nightly run |
| value ₹ | each lot × ITS scheme's rate, the member's scheme when the lot names none (D4); a scheme with `lsc_allow_point_redeem = false` or rate 0 prices nothing; nothing priced → `null` |
| next expiry | the earliest `expires_on ≥ today` among open lots, and the points due that day |
| best gift | the member's scheme's dearest live gift (`lsg_is_active`, valid today, `lsc_allow_gift_redeem`) whose points ≤ **redeemable** — grid 570's rule on redeemable, not balance |
| gift qty | `floor(redeemable / points)` when the gift repeats, capped by `lsg_max_qty_per_bill` when set; else 1 |
| eligible | best gift exists **and** `lmb_status = 'ACTIVE'` |
| earned in period | Σ `lld_points` of EARN + OPENING rows dated in [from, to], reversals included |
| outstanding (scheme) | Σ `lld_points` of every live row with that `lld_lsc_id`, as on `to` |
| holders (scheme) | members whose outstanding on that scheme > 0, as on `to`; does not total |

**D1.** The single-member card calls `LoyaltyLedgerService.redeemable()` for
its headline number. The list routes copy that method's WHERE into set SQL —
the type list from the same exported constant, the date window written the
same way — in `lotsLateral()`. The e2e suite asserts parity per member.

**D3.** `branchId` on members / expiring is the member's home branch
(`lmb_branch_id`); on the scheme routes it is where the movement happened
(`lld_branch_id`).

## Filters worth knowing

- `members`: `status` absent = ACTIVE **and SUSPENDED**; `includeMergedClosed`
  adds CLOSED and MERGED; a named `status` means exactly that one.
  `balanceGtZero` defaults to true. `pointsMin` / `pointsMax` are on the
  balance. `earnedFrom` / `earnedTo` go together.
- `expiring`: `lscId` filters by the **lapsing lot's** scheme (`lld_lsc_id`),
  because a lot belongs to a scheme; `hasMobile` and `activeOnly` default to
  true. Buckets cut at ≤7 / 8–15 / 16–withinDays and shrink with `withinDays`.
- `schemes`: the rows come from the **ledger** — every `lld_lsc_id` that moved
  in the period or still holds points — plus, on the plain split, every live
  scheme (zeros). The scheme master is a LEFT JOIN that keeps **soft-deleted**
  schemes, because their points outlive them (notes 91 N1): such a row carries
  `status: DELETED`. A scheme is "ended" when deleted, not APPROVED, not
  active, or past `lsc_end_date`; it shows as `DELETED` / `ENDED` and only
  while outstanding > 0 (`includeClosedHolding`, default true).
  `pointsValidTill` is filled for ended schemes only. Rows whose ledger row
  names no scheme (`lld_lsc_id` NULL) belong to no scheme and are not on this
  tab — so Σ outstanding here equals Σ `lmb_balance_points` only when every
  row names a scheme.
- `members`: `summary.outstandingValue` is Σ of the rows' `value` (notes 91
  N2) — the priced redeemable lots, each at its own scheme's rate — so it
  never depends on the member's scheme being set.
- `export`: `format` is echoed, not rendered — like the ledger statement, the
  client prints. pdf needs **print** on menu 79, xlsx needs **export**.

## Access

**view** on menu 79 for every report route (403 `LST_RIGHT_VIEW`); print /
export for `/export`. Menu 79 was seeded hidden and is made visible by
migration `20261005100000`; grant it through the user-rights screen (a
`menus[]` save there is a FULL replace).

## The actions — `POST /api/v1/loyalty/members/…` (sales/loyalty/members)

| Route | Does |
| --- | --- |
| `status` | `{ companyId, memberId, status: ACTIVE / SUSPENDED / CLOSED, reason, force?, approvedBy?, branchId? }` — writes `lmb_status`, `lmb_block_reason` and one `txn_status_log` step (doc type OTHER + the member id); no ledger row. **edit** on 79. |
| `adjust` | `{ companyId, branchId, memberId, points ≠ 0, reason, approvedBy, txnDate?, expiresOn?, lscId? }` — one adjustment document through `LoyaltyLedgerService.adjust()`. **edit** on 79. |
| `history` (GET) | the status trail, oldest first — the screen's Ctrl+H. **view** on 79. |

- A **positive** adjust is one lot-less ADJUST row, which since D2 *is* a lot:
  spendable, sweepable, on the card. It never lapses unless `expiresOn`.
- A **negative** adjust draws FIFO through `consume()`, one ADJUST row per lot,
  refused beyond the redeemable balance (422 `SALES_LOYALTY_CAP`). That needed
  `ck_lld_lot_required` to admit a lot on ADJUST (migration `20261005100000`).
- **D6.** CLOSED with a balance ≠ 0 is refused (422
  `LOYALTY_MEMBER_HAS_BALANCE`). With `force` + `approvedBy` (+ **delete** on
  79) the wallet is zeroed first through `LoyaltyLedgerService.drain()` — one
  ADJUST per open lot, cooling and lapsed ones too, plus one lot-less row for
  any unlotted remainder — and the result's `drained` says what was written.
- MERGED is not settable; merge is not built. SMS is not built (§7.3): no
  `lastSmsOn`, no Send SMS.

## The member's scheme (`lmb_lsc_id`)

The Scheme column, the best gift and `eligible` all read `lmb_lsc_id`. Nothing
stamped it before notes 91 (N3): `LoyaltyLedgerService.earn()` now sets it on
a wallet's **first** EARN (a later earn on another scheme does not re-home the
wallet), and migration `20261005120000` backfilled the wallets written earlier
from their latest movement that named a scheme. A wallet that never earned
keeps NULL and has no lots to price or gifts to offer.

## Differences from the plan

- **D2 applied.** `lots()`, `redeemable()`, the member recompute's next-expiry
  and `expiryRun()` now read `LOYALTY_LOT_TXN_TYPES` (EARN, OPENING, ADJUST,
  TRANSFER) instead of EARN alone, so an opening or a goodwill credit is a real
  lot. `unlotted` on the member card therefore reads 0 except for overdrawn
  lots or a wallet written before this change.
- **One more database change** beside the index: `ck_lld_lot_required` admits a
  lot on ADJUST, without which §7.2's FIFO take-back cannot be written.
- `expiring` carries `lapsed` on the member row too, and the member card lists
  cooling and lapsed lots with a `state`, not only the redeemable ones.
- `/export` returns data plus `printedAs`; it does not render a PDF or XLSX.
- `schemes` is not paged (the set is schemes × branches / months); `sort` /
  `order` apply in memory. `holders` is NULL on the month split.
- Response models are TypeScript types; Swagger describes each route in prose.
