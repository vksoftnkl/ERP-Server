# Opening Stock — completion checklist

Status of `plan/plan-nestjs-opening-stock.md` as of 2026-09-07.

The NestJS module is **built, typechecked and unit-tested**. It cannot be *run*
yet: the database half it is written against does not exist on this machine or
on the local database. Everything below separates the two.

---

## Done

- [x] **§0.2 Retire the legacy module.** Already done ahead of this work —
  `20260907070000_drop_opening_and_physical_stock_tables` drops
  `stock.opening_stock_header` / `_detail` and the physical-stock trio, and
  neither `OpeningStockModule` nor `PhysicalStockModule` is in `app.module.ts`.
  Nothing new imports from them.
- [x] **§1 Prisma models.** Already present in `prisma/stocks/` —
  `stockVoucher`, `stockVoucherItem`, `stockLot`, `stockBalance`,
  `stockItemCost`, `stockTrackPolicy`, and `stockLedger`. All six of the plan's
  "each one is a bug if missed" points hold: composite `@@id`, `@db.Char(9)`,
  generated columns mapped read-only, no Prisma enums, `uuidv7()` defaults, and
  totals left to the triggers.
  *Deviation from the plan, deliberate and pre-existing:* these models **do**
  carry relation fields to Prisma-owned masters (`ItemMaster`,
  `GodownLocation`, `DeviceMaster`). The plan asked for none. The repo went the
  other way before this work started; the module does not write those masters
  either way, so it was left alone.
  *Deviation from the plan:* `stockLedger` **has** a model, where the plan asked
  for none. The service never writes it; the two reports that read it are raw.
- [x] **§2 Module shape.** `src/modules/stocks/stock-voucher/` (shared) +
  `src/modules/stocks/opening-stock-voucher/` (OPENING only).
- [x] **§3 Numbering.** `stock-voucher-numbering.helper.ts` — advisory
  `pg_advisory_xact_lock`, `MAX(svh_slno) + 1` in the `ux_svh_slno` scope,
  `OPN/{accYear}/{deviceCode}/{slno}`, client-supplied slno/refno honoured.
  Neither `SequenceService` nor `acc_voucher_header` is touched.
- [x] **§4 Save.** Create/update, full line replace, every pre-engine refusal as
  a 422 with a per-line list, factor read from `item_unit_conversion`, generated
  columns and header totals never written.
- [x] **§5 List and load.** Raw, scoped, ordered for `ix_svh_list`; not a
  configured grid.
- [x] **§6 Preflight.** Resolves the effective track policy most-specific-first
  against the *document's* date, blanks untracked dimensions, matches
  `stock_lot`'s generated key columns, and detects all nine problems.
- [x] **§7 Post / §8 Cancel / §9 Soft delete.**
- [x] **§10 Both go-live reports**, paged.
- [x] **§12 Errors.** `StockVoucherExceptionFilter` switches on
  `error.meta.code`, not `error.code`, and passes the engine's wording through.
- [x] **§13 Wiring.** Both modules in `app.module.ts`, an `Opening Stock`
  Swagger group in `src/utils/swaggerDocs.ts`, no `@CacheTTL`.
- [x] **§14 unit tests.** 47 across two specs; the full suite is at the same 14
  pre-existing failures in 12 suites it was before.

Routes confirmed registered:

```
POST   /api/v1/stock/opening
GET    /api/v1/stock/opening
GET    /api/v1/stock/opening/validate
POST   /api/v1/stock/opening/post
POST   /api/v1/stock/opening/cancel
DELETE /api/v1/stock/opening
GET    /api/v1/stock/opening/pending-items
GET    /api/v1/stock/opening/reconcile
```

---

## Blocked — the database half does not exist here

**Nothing under `schema/stock/` is present in this repo or anywhere on this
machine**, and none of it is on the local database. A filesystem search for
`16_stock.sql`, `19_stock_posting.sql`, `19q_opening_stock_queries.sql` and
`19_opening_stock_flow.md` returns nothing.

Confirmed missing from `localhost:5432/ERP`:

| Missing | Consequence |
|---|---|
| `stock.stock_voucher`, `stock.stock_voucher_item`, `stock.stock_lot`, `stock.stock_balance`, `stock.stock_ledger`, `stock.stock_item_cost` | every route 500s |
| `fn_svh_post`, `fn_svh_cancel`, `fn_slt_resolve`, `fn_sml_apply`, `fn_svh_recompute`, `fn_sbl_rebuild` | post and cancel cannot run |
| `fn_create_stock_partitions` (the **`stock`-schema** one) | the year's partitions cannot be made |
| the triggers `tr_svi_refresh_header`, `tr_sml_apply`, `tr_svh_post_lock`, `tr_svi_post_lock`, `tr_sml_immutable` | totals stay 0, posted documents stay editable |

`stock.stock_track_policy` and `stock.stock_track_preset` *are* on the database;
they came from ordinary Prisma migrations, and nothing else from the stock engine
did.

- [ ] **Obtain `schema/stock/` and deploy it.** Run order, whole chain, in one
  go: `00_init … 15 → stock/16_stock.sql → 16t → 16s → 17 → 18 →
  stock/19_stock_posting.sql → stock/20_stock_transfer.sql`.
- [ ] **Call the stock-schema partition function for the current year before the
  first insert** — `SELECT stock.fn_create_stock_partitions('2026-2027');`. The
  `00_init.sql` one scans only public/sales/accounts and will not make the
  `stock.*` partitions; without this every write fails with "no partition of
  relation".
- [ ] **Apply the three pending Prisma migrations locally.** `migrate status`
  reports `20260905070000_quotation_refno_prefix_q`,
  `20260907060000_add_track_preset_to_masters` and
  `20260907070000_drop_opening_and_physical_stock_tables` as not yet applied — so
  the legacy opening/physical tables are still on this database.

---

## Needs reconciling once the DDL arrives

The plan said Q1–Q5 were to be `19q_opening_stock_queries.sql` **verbatim**. That
file does not exist here, so the five queries were written from the Prisma models'
documentation of the constraints, indexes and generated columns. They are
faithful to that documentation, but they are not the same text.

- [ ] **Diff the five queries against `19q_opening_stock_queries.sql`** and adopt
  its wording where it differs — particularly the nine preflight problem strings,
  which the plan is explicit should not be paraphrased in TypeScript.
- [ ] **Confirm the lot-identity sentinels.** The preflight assumes
  `('~', -1, -1, 0001-01-01, '~', nil-uuid)` for batch / MRP / sale price /
  expiry / serial / supplier, per the `StockLot` model comment. If
  `fn_slt_resolve` collapses any dimension differently, the "already opened"
  check silently answers the wrong question.
- [ ] **Confirm `sml_txn_type` for an opening is `'OPENING'`.** Both reports scan
  the ledger on `StockVoucherTypeRules.ledgerTxnType`, which the OPENING
  controller sets to `'OPENING'`. The ledger vocabulary is finer than the
  document's elsewhere (ADJUST_PLUS/MINUS, PHYSICAL_PLUS/MINUS, PURCHASE), so
  this is an assumption, not a derivation.
- [ ] **Confirm the negative-stock refusal wording.** The filter answers 409
  rather than 422 for a `23514` whose message contains `would go negative`
  (`NEGATIVE_STOCK_MESSAGE_FRAGMENT`). If `fn_sml_apply` words it differently, a
  correct refusal is reported as a malformed document.

---

## Integration tests — §14, second half

All of these need a live engine on a throwaway PG 18 cluster.

- [ ] **Run `19_opening_stock_flow.md` end to end** and assert its captured
  figures: after save `svh_line_count` 2, `svh_total_qty` **175.000000**,
  `svh_total_value` **3940.00**, status DRAFT, and `stock_lot` / `stock_ledger` /
  `stock_balance` / `stock_item_cost` all **0 rows**; after post returns **2**,
  SALT's lot at the sentinels, `sml_cost_rate_wot` **19.047619** on line 1,
  `stock_balance` MILK 55 / SALT 120, `stock_item_cost` MILK avg 28.000000 and
  `sic_total_value_wot` 1466.67, `svi_lot_id` set on both lines.
- [ ] `SELECT stock.fn_sbl_rebuild(...)` → **0 holdings differed**, after the post
  and again after a cancel. **Assert the value columns explicitly as well** —
  `fn_sbl_rebuild` re-derives quantities only, so it can return 0 while a
  valuation is wrong.
- [ ] Negative assertions, each refusing cleanly: post twice → 409 "is POSTED";
  a second OPENING for the same holding → 409; edit a line after post → 409 from
  `tr_svi_post_lock`; inward at cost 0 with no rate source → 422; cancel then
  post → 409.
- [ ] Concurrency: two parallel posts of the same voucher — one returns 2, one
  409. (No application lock is taken on purpose; `fn_svh_post` holds
  `FOR UPDATE` on the header.)
- [ ] Re-check the `422` vs `400` split end to end. The repo had no 422 anywhere
  before this module; `throwUnprocessable` was added to
  `src/common/utils/module-shared.utils.ts` for it.

---

## Deferred by the plan

- [ ] **§11 Import from file** — `POST /stock/opening/import`, multipart CSV
  resolved by item code and unit name. Explicitly deferrable: a silent
  code-resolution mismatch in an importer is 400 wrong lines.
- [ ] **§0.4 Client-side rows** — `menu_master` 44 (Opening Stock) and the
  `ui_table_master` / grid rows the Qt grid reads. Not this module's work, but
  the screen cannot open without them.
- [ ] **`19m_migrate_opening.sql`** — brings existing balances over. Runs in
  psql, not through the API.

---

## Still open with the DB owner / client

1. **Sale prices on the opening line.** The legacy `osl_` line carried four sale
   price levels; `svi_` deliberately does not. If go-live is to capture them,
   that is a second call to the pricing endpoints, not a column here — confirm
   whether the client wants it in the same save.
2. **`svh_rate_source` default.** The mockup has the control; `AVG_COST` and
   `LAST_PURCHASE` read `stock_item_cost`, which is empty on a go-live day. The
   preflight reports it, but `MANUAL` is probably the right default.
3. **Reason master.** `svh_reason_id` is unused by OPENING but required by
   ADJUSTMENT, which is the fix path when an opening is wrong. Not planned yet.
4. **REVALUE / REPACK** remain gaps in the engine: an opening entered at the
   wrong cost cannot be revalued — it is cancel and re-enter, and cancel is
   refused once stock has been sold from it.
