# StockVoucherModule — the type-agnostic half of every stock document

`stock.stock_voucher` is one table serving eleven document types. This module
owns everything about saving, loading, posting and cancelling one that does
**not** depend on which type it is; each type gets its own controller in its own
module, which supplies a `StockVoucherTypeRules` record and imports this service.

`OpeningStockVoucherModule` is the first caller. RECEIPT, ISSUE, ADJUSTMENT,
PHYSICAL and the rest are the same shape.

## The two things this module writes

`stock.stock_voucher` and `stock.stock_voucher_item`. Nothing else.

The lot, the ledger row, the balance, the moving average and every header total
are written by `stock.fn_svh_post()` and by triggers. There is no code here that
inserts into `stock_ledger`, touches `stock_balance`, or computes a total — and
`stock_ledger` deliberately has **no Prisma model at all**, which is the cheapest
possible guard against a future `create` finding its way in.

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

**3. Six columns must never appear in a write.** `svi_value`, `svi_value_wot` and
`svi_diff_qty` are `GENERATED ALWAYS ... STORED` and Postgres rejects any write.
The four header totals (`svh_line_count`, `svh_total_qty`, `svh_total_value`,
`svh_total_value_wot`) are *not* generated — they are trigger-maintained, which
means Prisma **can** write them, which is the danger. The spec asserts their
absence for exactly this reason. The screen never sums its own grid either.

## Numbering is self-contained

Not `SequenceService`, not `accounts.acc_voucher_seq`, and no
`acc_voucher_header` row. That sequence table is keyed by an FK into
`accounts.acc_voucher_type`, and a stock voucher type is not an accounting
voucher type — a stock voucher moves quantity and cost and posts no debit and no
credit.

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
