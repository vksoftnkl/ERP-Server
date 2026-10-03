# Opening Stock — completion checklist

Status of `plan/plan-nestjs-opening-stock.md`. Last worked 2026-09-07.

Everything the plan asks for that can be built without the database engine is
**built, typechecked and tested**. What remains is blocked on one external
artefact and two decisions that are not this repo's to make. This file separates
the three.

---

## Done

### The module — §§1–13

- [x] **§0.2 Retire the legacy module.** Done before this work:
  `20260907070000_drop_opening_and_physical_stock_tables` drops
  `stock.opening_stock_header` / `_detail` and the physical-stock trio, and
  neither `OpeningStockModule` nor `PhysicalStockModule` is in `app.module.ts`.
- [x] **§1 Prisma models.** Present in `prisma/stocks/`. All six of the plan's
  "each one is a bug if missed" points hold.
  *Two deliberate deviations, both pre-existing:* the models carry relation
  fields to Prisma-owned masters (the plan asked for none), and `stockLedger`
  has a model (the plan asked for none). The service writes neither.
- [x] **§2 Module shape.** `stock-voucher/` (shared) + `opening-stock-voucher/`.
- [x] **§3 Numbering.** Self-contained, per-device, advisory-locked; client
  slno/refno honoured verbatim.
- [x] **§4 Save.** Full line replace, per-line 422s, factor read not trusted,
  generated columns and header totals never written.
- [x] **§5 List and load.** Raw, scoped, ordered for `ix_svh_list`.
- [x] **§6 Preflight.** Policy resolved most-specific-first against the
  document's date; lot matched on the generated key columns without creating
  anything.
- [x] **§7 Post / §8 Cancel / §9 Soft delete.**
- [x] **§10 Both go-live reports**, paged.
- [x] **§11 Import from file.** `POST /stock/opening/import` — multipart CSV,
  item code and unit name resolved server-side, ambiguity refused rather than
  guessed, every bad row reported at once, routed through `save()` so no rule is
  bypassed. Never posts, never creates the document.
  *(The plan marked this deferrable. It is done.)*
- [x] **§12 Errors.** Filter switches on `error.meta.code`, not `error.code`.
- [x] **§13 Wiring.** Both modules registered, `Opening Stock` Swagger group,
  no `@CacheTTL`.

### Tests

- [x] **§14 unit half** — 80 tests across three specs.
- [x] **§14 integration half — written and wired**, in
  `test/opening-stock.e2e-spec.ts`: the `19_opening_stock_flow.md` figures, the
  `fn_sbl_rebuild` check *including the value columns it does not itself
  verify*, all five negative assertions and the parallel-post race.
  It **auto-skips** while the engine is absent, and `STOCK_ENGINE_REQUIRED=1`
  turns that skip into a failure so CI can demand it actually runs once the
  share is deployed. **Its assertions have never executed** — see Blocked.

Nine routes confirmed registered:

```
POST   /api/v1/stock/opening
GET    /api/v1/stock/opening
GET    /api/v1/stock/opening/validate
POST   /api/v1/stock/opening/post
POST   /api/v1/stock/opening/cancel
DELETE /api/v1/stock/opening
POST   /api/v1/stock/opening/import
GET    /api/v1/stock/opening/pending-items
GET    /api/v1/stock/opening/reconcile
```

### One defect fixed along the way

- [x] **`MANUAL` no longer excuses a zero cost rate.** The plan words the check
  as "inward with no cost rate and **no rate source**", which reads as though any
  of the five sources excuses a zero. Four of them derive a rate; MANUAL means
  the storekeeper types it, so a MANUAL document at cost 0 is an inward valued at
  nothing — with the check reporting itself satisfied. `DERIVABLE_RATE_SOURCES`
  now names the four, in both the save check and the preflight SQL.
  **This is a deliberate strengthening of the plan's wording** — confirm it reads
  the same way to the DB owner.

---

## Blocked — one missing artefact

**Nothing under `schema/stock/` exists in this repo or anywhere on this machine.**
Re-checked 2026-09-07: a filesystem search for `16_stock.sql`,
`19_stock_posting.sql` and `19q_opening_stock_queries.sql` still returns nothing,
and `localhost:5432/ERP` still has no `stock_voucher`, no `stock_lot`, no
`stock_ledger` and no `stock.*` functions. Only `stock_track_policy` and
`stock_track_preset` are there, from ordinary Prisma migrations.

This is the single dependency the remaining work hangs off. It cannot be
recovered from inside this repo — the DDL, the posting functions and the triggers
have to come from the DB owner.

- [ ] **Obtain `schema/stock/` and deploy it**, whole chain in one go:
  `00_init … 15 → stock/16_stock.sql → 16t → 16s → 17 → 18 →
  stock/19_stock_posting.sql → stock/20_stock_transfer.sql`.
- [ ] **`SELECT stock.fn_create_stock_partitions('2026-2027');`** before the
  first insert. The `00_init.sql` function of the same name scans only
  public/sales/accounts and will not make the `stock.*` partitions.
- [ ] **Run the acceptance test**: `STOCK_ENGINE_REQUIRED=1 npm run test:e2e -- opening-stock`.
- [ ] **`19m_migrate_opening.sql`** — brings existing balances over, in psql.

### Four assumptions the deploy will confirm or refute

The five queries were written from the Prisma models' documentation of the
constraints, indexes and generated columns, because `19q_opening_stock_queries.sql`
was not available to copy. They are faithful to that documentation; they are not
the same text. Each of these is cheap to check once the engine is up and
expensive to discover later:

- [ ] **The preflight problem strings.** The plan says the engine's own wording
  should not be paraphrased in TypeScript. Ours is a paraphrase by necessity —
  diff it against `19q` and adopt that file's wording.
- [ ] **The lot-identity sentinels.** The preflight assumes
  `('~', -1, -1, 0001-01-01, '~', nil-uuid)` per the `StockLot` model comment. If
  `fn_slt_resolve` collapses any dimension differently, the "already opened"
  check silently answers a different question than the one asked.
- [ ] **`sml_txn_type = 'OPENING'`.** Both reports scan the ledger on
  `StockVoucherTypeRules.ledgerTxnType`. The ledger vocabulary is finer than the
  document's elsewhere (ADJUST_PLUS/MINUS, PHYSICAL_PLUS/MINUS, PURCHASE), so
  OPENING coinciding with its own name is an assumption.
- [ ] **The negative-stock refusal wording.** The filter answers 409 rather than
  422 for a `23514` whose message contains `would go negative`
  (`NEGATIVE_STOCK_MESSAGE_FRAGMENT`). Different wording in `fn_sml_apply` turns
  a correct refusal into a "malformed document".

---

## Needs a decision that is not this repo's

### The Qt grid — §0.4, and it is worse than "missing"

The original checklist said `menu_master` 44 and the grid rows "do not exist
yet". Both statements turned out to be wrong, in opposite directions:

- **`fixed.menu_master` 44 "Opening Stock" already exists** —
  `prisma/seed/Menu_Master.sql:156`. Nothing to do.
- **There is no `ui_table_master` table.** It is `fixed.ui_tables`;
  `ui-table-master` is only the NestJS module name.
- **`fixed.ui_tables` 5 "opening stock" already exists with 45 seeded columns**
  (`Ui_Table_Columns.sql:153-198`) — and **they describe the retired screen**.
  Ten are hidden `osl_*` id columns (`osl item id`, `osl unit id`,
  `osl tracking type`, `osl cess perc`, …) from the dropped
  `opening_stock_detail`. Twelve more are price levels — `Price A/B/C/D` with
  their wot and markup columns, MRP, MSP, profit type, round off — which the
  `svi_` line **deliberately does not have**.

So the new screen must not be pointed at table 5: it would bind a grid to fields
this API never returns, and save NULL into the ones it does.

- [ ] **Agree the new column set with whoever owns the Qt client**, then seed it
  — either as new columns on a new pinned `ui_tables` id (template:
  `prisma/seed/Quotation_Charges_Grid_Web.sql`) or as additions to an existing
  one (template: `prisma/seed/Quotation_Item_Grid_ItemSize_Column.sql`).
  Note `Ui_Table_Columns.sql` guards per table — a table that already has any
  column is left completely alone, so editing that file is a no-op on any
  existing database.
- [ ] **Retire or repoint `ui_tables` 5.** Left as it is, it describes a screen
  that no longer exists.

A seeded row is only half the change: the client needs a *meaning* for each
column too, or it renders nowhere and saves NULL. That half lives in the Qt repo.

### The local database still has the legacy tables

`prisma migrate status` reports two migrations unapplied:
`20260905070000_quotation_refno_prefix_q` and
`20260907070000_drop_opening_and_physical_stock_tables`.

**Applying the second destroys data on this machine** — 64 rows:
`opening_stock_header` 10, `opening_stock_detail` 13, `physical_stock_header` 13,
`physical_stock_detail` 19, `physical_stock_batch_detail` 9.

- [ ] **Decide whether that data matters, then `npx prisma migrate deploy`.**
  Not applied unilaterally: the drop is irreversible and the rows may be a
  deliberate reference for the migration that brings openings over.

---

## Still open with the DB owner / client

1. **Sale prices on the opening line.** The legacy `osl_` line carried four
   price levels — and `ui_tables` 5 still has all twelve of their columns, which
   is evidence the screen used to capture them. `svi_` deliberately does not. If
   go-live must capture them, that is a second call to the pricing endpoints.
2. **`svh_rate_source` default.** `MANUAL` is the honest default on a go-live
   day, and is now the one source that does not excuse a zero cost rate (see the
   defect above). Confirm the screen defaults to it.
3. **Reason master.** `svh_reason_id` is unused by OPENING but required by
   ADJUSTMENT — the fix path when an opening is wrong. Not planned yet.
4. **REVALUE / REPACK** remain gaps in the engine: an opening entered at the
   wrong cost cannot be revalued, and cancel is refused once stock has been sold
   from it.
