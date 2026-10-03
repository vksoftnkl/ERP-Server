# Opening Balances

What a company's ledgers were worth on the day its books begin, and — for a
bill-by-bill party — which invoices made up that figure.

**The whole module in one line:** one row per balance-sheet ledger per
company-year, always positive with the side in a flag, never posted to the
voucher tables; a bill-by-bill party opens with its BILLS, not a figure; and
the set must balance.

Implements `plan-backend-opening-balance.md`. Section numbers below refer to it.

## Where it lives

The plan puts this at `src/modules/opening-balance/`. It is here instead,
under `accountsModule/`, because that is where every other accounts module
lives and §8.6 already reasons that the module "sits beside the accounts
modules". Nothing else about the layout changed.

## Endpoints

All under `/api/v1/opening-balances`.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/list` | Every balance-sheet ledger for a company-year, with its opening if it has one |
| `POST` | `/create` | Saves the whole set for one company-year. **Also the edit endpoint** |
| `GET` | `/trial-balance` | Debit/credit totals, the difference, and the plug ledger |
| `DELETE` | `/delete` | Soft deletes one opening row |
| `POST` | `/carry-forward` | Derives one year's openings from the previous year's closings |
| `GET` `POST` | `/bills` | One bill-by-bill party's opening bills |

`DELETE` takes `opId` **and** `accYear`: the table is partitioned on the year,
so the primary key is `(op_id, op_acc_year)` and an id alone does not name a
row.

## Files

| File | Holds |
|---|---|
| `opening-balance.service.ts` | §5.1 — list, save, trial balance, delete |
| `carry-forward.service.ts` | §5.2 — its own service because it is a batch job |
| `bill-wise.service.ts` | §5.3 — the breakup, and the party figure it owns |
| `opening-balance.guards.ts` | The checks shared by all three (§7.4, visibility, staleness) |
| `opening-balance.utils.ts` | The sign arithmetic, in one place because it is what gets written wrong |
| `ledger-roles.ts` | `OPENING_DIFFERENCE` / `RETAINED_EARNINGS`, resolved through `acc_ledger_map` |

## Six things that are easy to get wrong

### 1. An amount is positive; the side is a flag

`ck_op_amount` and `ck_abl_amount` both refuse a negative. A signed figure is
only ever an intermediate — produced to add balances together, split again
before anything is stored. `splitSigned()` is that split, and it is the step
§5.2 warns about.

**`op_dr_cr` is ONE character (`D`/`C`). `abl_dr_cr` is TWO (`DR`/`CR`).**
Different columns on different tables, both already constrained. They are not
unified in any DTO and must not be.

### 2. Absence is the zero

An amount of `0` writes **no row**, and soft-deletes one that is already there.
A zero row would make `ux_op_scope` meaningless and show the screen a figure
where there is none. Zero-amount rows are also exempt from the balance-sheet
nature check — they write nothing, so which side of the balance sheet their
ledger sits on cannot matter, and checking it would refuse a save whose only
sin is echoing back the ledgers the operator left empty.

### 3. The bills own a bill-wise party's figure

`POST /bills` recomputes `op_amount / op_dr_cr` from the bills in the **same
transaction**, so the §7.2 tie is true by construction rather than by a check
that can fail. `POST /create` refuses a hand-typed figure on such a ledger and
accepts only an exact echo of the current bill total.

That is DECISION 4 answered in the service rather than in a trigger: the write
and the recompute are one statement sequence and belong in one place.

### 4. An edited CARRY_FORWARD row becomes MANUAL

The client echoes `opSource` back as it received it. Storing it as sent would
leave an accountant's correction marked `CARRY_FORWARD`, and the next
regenerate — which spares only `MANUAL` and `MIGRATION` — would undo it without
a word. So when a stored `CARRY_FORWARD` row's amount or side changes, the
source is rewritten to `MANUAL` **regardless of what was sent**.

`op_generated_at / _by` are deliberately left alone: they record what the
figure was derived from before it was overridden.

### 5. Carry-forward carries the BILLS, not just the figures

Every still-open bill of a bill-wise party becomes a new `OPENING` bill in the
target year, carrying what is left of it (`abl_pending_amount` becomes the new
`abl_bill_amount`, allocations start at zero). Three links matter:

- `abl_parent_bill_id / _acc_year` — chains the bill to the one it continues,
  so a receipt history survives the year-end;
- `abl_src_doc_id` — names the party's new opening row, which is what makes the
  tie a keyed lookup rather than a join that also catches SALES bills;
- the source bill's own **branch**, because `abl_branch_id` is NOT NULL.

**Without this step a carry-forward silently destroys the ageing of every
debtor.** The carry is idempotent on the parent link, so a regenerate updates
rather than duplicates.

### 6. Nothing is posted to `acc_vouchers`

Not a policy — the schema says so. `ck_abl_voucher` **forces** an `OPENING`
bill's `abl_voucher_id` and `abl_voucher_type_id` to be NULL. And settlement
does not need a voucher line: `acc_bill_adjustment.abj_bill_id` is NOT NULL and
FKs to the bill, while `abj_voucher_id` is nullable. An allocation is against
the BILL.

The cost is that a balance is `opening + movement`, never `movement` alone.

## Three things a client will otherwise get wrong

Found by the Qt client (menu 55) when it was wired up on 2026-09-15, and fixed
or documented here so the React port does not rediscover them.

### `includeZero` defaults to TRUE, and `false` now means false

The plan's parameter table says "default false". That contradicts the
paragraph above it — "a review surface over a full set, not a list of rows that
happen to exist" — and the prose is right: on a company nobody has opened yet,
EVERY ledger has no opening and no prior closing, so a default of false hands
the operator an empty screen at the one moment the screen exists for. And an
empty chart is the dangerous answer, not merely an unhelpful one: 0 = 0
balances, so it reads as a company whose books are in order.

Separately, `?includeZero=false` used to arrive as **`true`**. The global
ValidationPipe runs with `enableImplicitConversion: true`, which coerced the
query string to the declared type before `@OptionalQueryBoolean`'s transform
ran — and `Boolean('false')` is `true`. Fixed in `OptionalQueryBoolean` itself
by reading the raw source value; that revived the string handling
`toOptionalBoolean` already contained as dead code, and it applied to all 74
query booleans in this API, not just this one.

### `opRemarks` round-trips

It is accepted by `/create` and returned by `/list`. It was previously
write-only, which is the worst shape a field can have — not lost, not shown,
and the note the operator most needs six months later.

### `replace: true` on `/bills` is not "sort it out"

A bill row WITHOUT an `ablId` is an insert, so re-sending a bill the screen
loaded without carrying its `ablId` through is refused by `ux_abl_doc_refno` as
a duplicate reference. That refusal is correct — the alternative is silently
duplicating an invoice — but it means a client must keep the `ablId` from `GET`
on every existing row. Only genuinely new bills omit it.

## A design consequence, not a bug

`ux_op_scope` is `(company, COALESCE(branch, 0-uuid), year, ledger)`, so the
company-level set and a branch's set are **two different sets of rows** and
neither trial balance sees the other.

Combined with `abl_branch_id` being NOT NULL, a bill-wise party's opening can
only ever live in a branch set. So a company-level trial balance is
structurally incomplete the moment one debtor opens with bills. The Qt client
handles it the honest way: "This branch" / "All branches" are two sets rather
than a filter, the breakup panel is closed under "All branches", and a banner
names how many parties are outside those totals. If anyone asks why the
company-level opening "does not add up", this is the answer.

## The two system ledgers

Found by ROLE through `accounts.acc_ledger_map`, exactly as the sale bill finds
`ROUND_OFF` — never by name, which is spelt differently in every chart.

- `OPENING_DIFFERENCE` — the plug. Returned by `/trial-balance` as
  `differenceLedgerId`; **null means the company has not mapped it** and the
  screen cannot offer the plug.
- `RETAINED_EARNINGS` — where the previous year's P&L result lands on
  carry-forward.

Both roles are seeded by migration `20260915090000`. The per-company
`acc_ledger_map` row is configuration, not migration.

## Decisions this code takes

| # | Taken as | Where |
|---|---|---|
| 1 | `acc_opening_balance` is authoritative; `led_ob_*` and `led_total_*` are never read | everywhere |
| 2 | Tally model — the P&L result lands on `RETAINED_EARNINGS` | `carry-forward.service.ts` |
| 3 | An unbalanced set is **reported, not refused** | `opening-balance.service.ts` |
| 4 | The tie is enforced in the service, inside the transaction | `bill-wise.service.ts` |
| 6 | camelCase payloads | the DTOs |
| 9 | (a) bills are branch-scoped; `branchId` is required on `/bills` | `save-opening-bill.dto.ts` |
| 10 | Global ledgers **plus** this company's own | `opening-balance.guards.ts` |
| 11 | The run log is kept | `carry-forward.service.ts` step 7 |

On **decision 2**, carry-forward refuses only when there is a non-zero result
AND the role is unmapped. A company whose P&L nets to zero needs no mapping and
is not blocked by one.

## Not built

- **§7.5 general staleness** — a voucher posted into an already-carried year.
  That is DECISION 5 (trigger or nightly job) and the write happens in another
  module. **§5.5 rule 4 IS built**: editing year N's openings or opening bills
  stales N+1's `CARRY_FORWARD` rows, with `op_stale_reason =
  SOURCE_OPENING_EDITED`.
- **Optimistic concurrency** (§5.5, "two operators on one year"). The plan
  marks it optional and asks whether it is wanted in the DTO. `replace: true`
  is currently last-write-wins.
- **An `audit.audit_screen` id**, so the screen's History button works. Noted in
  §5.5; nothing in this module.

## Testing

`test/opening-balance-http.e2e-spec.ts` runs the §9 checklist at HTTP level
against the live dev database, under two throwaway companies that are hard
deleted afterwards. It needs `public.ensure_acc_year_partitions()` for its
target year — which is also true of production: **a new fiscal year needs its
partitions or every save 500s.**
