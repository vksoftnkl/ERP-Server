# StockVoucherModule — the type-agnostic half of every stock document

`stock.stock_voucher` is one table serving eleven document types. This module
owns everything about saving, loading, posting and cancelling one that does
**not** depend on which type it is; each type gets its own controller in its own
module, which supplies a `StockVoucherTypeRules` record and imports this service.

`OpeningStockVoucherModule` is the first caller. RECEIPT, ISSUE, ADJUSTMENT,
PHYSICAL and the rest are the same shape.

## The two things this module writes

`stock.stock_voucher` and `stock.stock_voucher_item`. Nothing else.

The lot, the ledger row, the balance, each lot's cost and the item average are
written by **`stock-voucher-posting.helper.ts`**, the posting engine — in the
application, not in the database. No `fn_svh_post` / `fn_sml_apply` / ledger
trigger exists on any deployment (the 2026-09-22 rule: the database keeps only
what is declarative). It picks and resolves lots, writes `stock_ledger`, then
RE-DERIVES every derived figure from the ledger: `stock_balance`, each tracked
lot's own cost onto its balance rows, `stock_item_cost` (and the item average
stamped onto every holding of a PLAIN item), the negative-stock policy,
`slt_total_on_hand` — eight set-based statements in the caller's transaction.

## How stock is costed (notes 92, 2026-10-06)

The effective tracking policy's `stp_valuation_method` decides, and it follows the track
flags (the policy service derives it; `ck_stp_valuation_tracks` holds it):

| Policy | Method | Cost of one unit of a holding |
|---|---|---|
| tracks nothing (`N`) | `WAVG` | the item's branch moving average (`stock_item_cost`), stamped onto every holding |
| tracks anything | `LOT_ACTUAL` | that **lot's** own moving average **in this branch**, kept on the lot's `stock_balance` rows (`sbl_avg_cost_rate`, the same on every godown and bucket) |

Every outward line — sale, challan, adjustment OUT, write-off, transfer OUT, count shortage —
is relieved at that cost; a count overage or an adjustment IN onto a lot the branch holds comes
in at it; a re-lot IN inherits its OUT half's cost; a transfer carries it on `stt_cost_rate`.
`slt_cost_rate` is only the cost on the lot's first receipt. The item row of a tracked item is
the item's summary (Σ of its lots) and the fallback for a lot the branch has never held.

**Every derived figure is a REBUILD from the ledger, never an increment** (§7, offline sync):
the balance accumulators, a lot's cost, the item total and average, the lot total. Σ over the
rows that exist, forward and reversal alike, so a re-sent batch or a reversal landing before its
original gives the same figures. `POST /stock/admin/rebuild-costs` (`dryRun=true` to report and
roll back) runs the same rebuilds over a scope — the one-off backfill and the only correct repair.
New lots take a deterministic id: uuid v5 over the eight identity columns (`lotIdentityUuid`), so
two offline branches mint one id for one carton.

**An outward line never opens a lot for a tracked item** (notes 93): a sale, DC or any fixed-OUT
shape whose stated identity matches no lot is treated as lotless — picked by the issue strategy,
narrowed by what it did state, and refused when nothing matches — instead of resolving into a
phantom lot sold negative. MRP 0 and selling price 0 on an outward line read as "not stated", like a
blank batch. A plain (`N`) item may still open its one lot from an outward: that is the
negative-stock case the policy rules on. The preflight (`validate()`) narrows its stock check the
same way (`issueNarrowing`), so it and the post agree about "nothing to pick". Nothing outside that file inserts into `stock_ledger`: the model
exists (`StockLedger`) but `test/stock-ledger-single-writer.e2e-spec.ts` fails the
build on any second INSERT site, any UPDATE or DELETE, and any Prisma write.

The database keeps the rules that must hold whatever writes the ledger, from
migration `20260908110000`: the ledger is append-only (`tr_sml_forbid_delete`,
`tr_sml_immutable`), a godown under a DRAFT physical count's freeze refuses every
movement but the count's own (`tr_sml_freeze_guard`, answered as 409), and the
lot identity keys fold batch/serial case and whitespace.

## Lines keep their id; every save is one audit revision (notes 89)

A save is still a create (no `svhId`) or an update of a DRAFT, but the lines are matched **by
`sviId`**, never by line number: a line that sends its `sviId` updates that row (and only when a
column actually changed, so an untouched line keeps its stamps), a line without one is inserted,
and a stored line the payload no longer names is hard-deleted (a draft has no ledger rows). A line
id on a create, a repeated one, or one that is not a live line of this document is a 422 on
`lines.<n>.sviId`. `ux_svi_line` is not deferrable, so renumbered lines are parked at
`1_000_000 + n` first and then given their final number.

`save()` reads the document (the `getById` shape) before touching anything and again at the end of
its transaction — after the post, on a save-and-post — and writes ONE
`AuditLogService.logDocumentRevision` row with both. The old header `insert`/`update` rows and the
"lines replaced" row are gone. `getById` takes an optional client for that in-transaction read.

## Where the rules live

| Rule | Enforced in |
|---|---|
| shape, types, lengths, enum membership | the DTOs, as 400 |
| document-level rules the engine would raise on | `assertPayloadRules`, as 422 with a per-line list |
| unit belongs to the item, factor is real | `assertUnitsBelongToItems`, as 422 |
| the holding is not already opened; the item's policy is satisfied | `validate()` (§6 preflight), as advisory rows and then 422 at post |
| everything else | the engine, translated by `StockVoucherExceptionFilter` |

The preflight is deliberately advisory: another till can post the same holding
between the check and the post, so `post()` still has to survive the engine
raising.

## Three traps worth reading before editing

**1. A raise from inside a function is `P2010`.** Not `23505`, not `P0002` —
Prisma reports every RAISE from PL/pgSQL as `PrismaClientKnownRequestError` with
code `P2010`, and hides the real SQLSTATE in `error.meta.code` and the message in
`error.meta.message`. A filter switching on `error.code` answers one useless 500
to all eight failure modes. See `stock-voucher-exception.filter.ts`.

**2. Both written tables are partitioned, so every id is a pair.**
`@@id([svhId, svhAccYear])`. `findUnique({ where: { svhId_svhAccYear: {...} } })`
— an id alone will not compile, which is exactly the protection wanted. And
`svh_acc_year` is `character(9)`: bpchar pads anything shorter, and
`ck_svh_acc_year` then rejects the padding, so always send the full `YYYY-YYYY`.

**3. Three columns must never appear in a write.** `svi_value`, `svi_value_wot`
and `svi_diff_qty` are `GENERATED ALWAYS ... STORED` and Postgres rejects any
write — including a write of the value it would itself compute.

The four header totals (`svh_line_count`, `svh_total_qty`, `svh_total_value`,
`svh_total_value_wot`) are *not* generated, and are no longer off limits: they
are taken from the header payload and written verbatim. The screen sums its own
grid; this service counts nothing.

They are written as **their own `UPDATE`, after the lines** — see
`writeHeaderTotals`. A DRAFT's figures are provisional. The engine's
`recomputeHeaderTotals` re-derives all four **at post and at cancel** from the
ledger rows it wrote, so a posted document carries the engine's figures and a
cancelled one re-totals to 0. A `PHYSICAL` count refuses all four outright — its header carries the
net variance read off the ledger, which nothing on the count sheet adds up to.

## Numbering is self-contained

`svh_slno` never touches `SequenceService` / `accounts.acc_voucher_seq`, and no
`acc_voucher_header` row is ever created — a stock voucher moves quantity and
cost and posts no debit and no credit.

`svh_refno` depends on the type's rules. With no `refnoVchrTypeId` it is the
self-contained `{typeCode}/{accYear}/{deviceCode}/{slno}`. With one — OPENING
names `accounts.acc_voucher_types` row 1, "Opening Stock" — the printed number
comes from `accounts.acc_voucher_seq` under that row's prefix / suffix / width
/ reset frequency (`OPN0001`), on the branch-wide `MAIN` counter
because `ux_svh_refno` has no device in it.

`svh_slno` is per **device** (`ux_svh_slno`) because a warehouse tablet must
number its own document offline. A client-supplied `slno`/`refno` is therefore
honoured verbatim; a collision is a 409 naming the refno, never a silent
renumber — the device's copy is already printed.

## Prerequisites

The `stock` schema tables and the posting functions come from the DDL share, not
from a Prisma migration. Before the first save in a new fiscal year:

```sql
SELECT stock.fn_create_stock_partitions('2027-2028');
```

The `fn_create_stock_partitions` in `00_init.sql` scans only public/sales/
accounts and will **not** create the `stock.*` partitions — call the one in the
`stock` schema, or every write fails with "no partition of relation".
