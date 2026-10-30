# Physical Stock Count — completion checklist

Status of `plan/plan-nestjs-physical-stock.md`. Last worked 2026-09-07.

Same shape as `plan-nestjs-opening-stock-todo.md`: everything buildable without
the deployed stock engine is built. What is left is the engine share itself and
the open items the plan hands to the DB owner.

---

## Done

### The six shared-service changes — §3

- [x] **§3.1 The rules record.** `quantityMode`, `defaultRateSource`,
  `allowsRepeatHolding` (and `allowsCount`, `ledgerTxnTypes`) on
  `StockVoucherTypeRules`; `quantityMode: 'QTY'` on `OPENING_RULES`.
- [x] **§3.2 The zero-quantity refusal**, inverted under COUNT — `qty`/`freeQty`
  must be absent or 0, `countedQty` present and >= 0, `bookQty` refused.
- [x] **§3.3 The cost rule.** `sviCostRate` forced to 0 in both directions;
  the document-wide inward check gated to QTY and moved to the preflight, where
  the generated difference exists. `defaultRateSource` applied in
  `createDraft` / `updateDraft` (`resolveRateSource`), so the stored document
  says out loud what it was valued at.
- [x] **§3.4 `replaceLines`** — quantities 0, `bookQty` / uom / batch / expiry /
  MRP / sale price / serial / supplier all server-read from `stock_balance` +
  `stock_lot` in one query (`loadCountHoldings`), `lotId` written and guarded,
  factor 1.
- [x] **§3.5 The preflight** — the zero-quantity and already-opened branches
  parameterised (the `opened` EXISTS is wrapped in a CASE so a count never
  evaluates it), the document-wide AVG_COST branch gated to QTY, and the four
  PHYSICAL branches added including the `bal` drift check.
- [x] **§3.6 Post** — 0 rows is a success, and the controller's message says
  which lines varied rather than how many ledger rows were written.

### The module — §§2, 4–14

- [x] **§2 Module shape** — `physical-stock-voucher/`, `PHYSICAL_RULES`.
- [x] **§4 `GET …/count-sheet`** — generated from `stock_balance`, paged,
  `lineNo` continuing across pages, zero-quantity holdings included by default.
- [x] **§5 `POST …`** — narrow line DTO (eighteen properties absent and refused
  by `forbidNonWhitelisted`), server-read holding facts, reasons validated.
- [x] **§6 `GET …`** — list and load, with the count columns.
- [x] **§7 `GET …/validate`**.
- [x] **§8 post / §9 cancel / §10 delete**.
- [x] **§11 The freeze** — window required whenever `freezeStock` is true,
  compared as instants, refused as a 422 before `ck_svh_freeze` fires.
- [x] **§12 `GET …/variance`** — the ledger's own account of the count.
- [x] **§13 Errors** — the lot-not-in-balance 422; the rest of the map was
  already shared and needed no change.
- [x] **§14 Wiring** — `app.module.ts`, `@ApiTags('Physical Stock')`, no cache.

### Tests — §15

- [x] Unit: the OPENING path unchanged (its own suite still green, plus an
  explicit assertion that a zero-quantity opening line is still refused), and
  the PHYSICAL assertions — service, DTO boundary and controller message.
- [x] Integration: `test/physical-stock.e2e-spec.ts` writes §15 end to end,
  figure for figure, and **skips with a named reason** while the engine is
  absent. `STOCK_ENGINE_REQUIRED=1` turns that skip into a failure. It detects
  both 2026-09-04 fixes and asserts the pre- or post-fix figures accordingly,
  printing which build it found.

### Found on the way

- [x] **`assertReasons` matched the wrong vocabulary.** `srm_allowed_txn_types`
  holds `sml_txn_type` values — the seed scopes count reasons to
  `PHYSICAL_PLUS` / `PHYSICAL_MINUS` and adjustment reasons to `ADJUST_*` — and
  the check compared them against `rules.voucherType`. Every seeded reason would
  have been refused for the document type it was written for; it went unnoticed
  because OPENING, the one type whose document and ledger names coincide, cites
  no reasons at all. Now matched against `rules.ledgerTxnTypes`.
- [x] **`srm_require_remarks` is now honoured** per citation (§5.3), with a line
  falling back to the document's remark.

---

## Blocked

1. **§0.1 The engine.** `20260907090000_add_stock_engine_tables` created the
   `stock` tables in this repo, but deliberately not the posting machinery:
   `fn_svh_post`, `fn_svh_cancel`, `fn_svh_txn_map`, `fn_slt_resolve`,
   `fn_sml_apply`, `fn_sbl_rebuild`, `tr_sml_freeze_guard` and
   `fn_svh_recompute`'s PHYSICAL branch are still deployed out of band from
   `schema/stock/`, which is not in this repo. Until the share is deployed the
   e2e half of §15 skips.
2. **§0.4 Client-side rows.** `menu_master` and the grid rows for the count
   screen do not exist. Not this module's work; the screen cannot open without
   them.

## Open items for the DB owner (plan's own list)

1. Which godown column `fn_svh_post` reads for a PHYSICAL. Assumed
   `svh_to_godown_id`; the service enforces every line's godown equals it, so
   whichever side the function reads, the two agree.
2. The freeze guard's SQLSTATE and message — needed by *other* modules'
   filters, not this one.
3. Which §0.1 build is deployed. The e2e prints what it found.
4. ADJUSTMENT is the missing neighbour (stock found for an item with no
   balance row).
5. Re-count workflow: second count vs cancel; whether a sheet should be
   regenerable in place.
6. Revaluation remains a gap.
