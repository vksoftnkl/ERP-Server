# Change Selling Price (Bulk) — completion checklist

Status of `plan/plan-nestjs-change-selling-price.md`. Written 2026-09-07;
the buildable half **built 2026-09-07** in
`src/modules/stocks/selling-price-bulk/` (see its `README.md`).

Same shape as `plan-nestjs-physical-stock-todo.md`. The difference is where the
blocker sits: the two voucher screens are blocked on an engine they only *call*,
this one is blocked on a table it has to *model*, so almost nothing here is
buildable ahead of the deploy. What is buildable is listed first, and it is worth
doing first — it is all the parts the legacy form got wrong.

---

## Built

- [x] **§0.3 The below-cost setting.** `below-cost-policy.helper.ts` —
  `resolveBelowCostPolicy` picks the key out of
  `AppSettingValueService.resolveEffective` (never `app_setting_value` directly,
  never a re-merged precedence), `resolveBelowCostAction` maps `restrict` /
  `warning` / `allow` → ABORT / CONFIRM / PROCEED. An absent, blank or
  off-catalog value falls back to the seeded `warning` rather than to either
  extreme; `restrict` would lock the screen over a data error nobody can see,
  `allow` would silently disable the rule.
- [x] **§5.3 The confirm round trip**, with all three rules: `CONFIRMABLE_VERDICTS`
  is `['BELOW_COST']` and nothing else, so `confirmed: true` still aborts
  above-MRP and below-min; Q26 re-runs on the confirmed post; the audit row
  records the confirmation with the rows, inside the transaction.
  `restrict` + `confirmed: true` still aborts — otherwise `restrict` and
  `warning` would be one setting with two names.
- [x] **§5.5 The scope resolution** — `resolveTargetScope` in
  `selling-price-scope.helper.ts`, a pure function over (switch, row
  `priceScope`) returning target scope, target branch, the expected statement,
  and two flags the response needs (`createsBranchOverride`, `switchIgnored`).
  No database, no clock, no request. Row 4 follows the plan's recommendation:
  *All branches* updates an existing override and does **not** promote it.
  - **The DTO gained `priceScope`.** §5.1's payload sketch omits it and §5.5
    cannot work without it — the resolution is indexed on the row's loaded
    scope, and re-deriving it server-side would read the table again at a moment
    the operator has already left behind.
- [x] **§5.5 The HQ check.** `assertScopeAllowed` — `scope: 'CHAIN'` from a
  caller whose `RequestContextService.getUserType()` is not in `HQ_USER_TYPES`
  is a 403 before the transaction opens, before the setting is even read.
  Deny by default: a wrongly refused chain save is a 403 the user can escalate,
  a wrongly allowed one is discovered at the till. **§13.3 is still open** and
  `HQ_USER_TYPES` is the one place the answer goes.
- [x] **§6 The fan-out.** `isHeadlineRow` — has this row a dimension? — plus
  `applyLevelColumns`, the ordinal→A–D mapping, written out as a switch so a
  renamed column is a compile error rather than a price landing nowhere.
  `ItemsPriceMasterModule` already exported its service; no change was needed.
  `save(rows, tx)` is called with this module's transaction and the spec asserts
  the mock received it.
  - `loadMasterPriceRows` resolves `ipm_id` before the fan-out. Without it every
    save would CREATE, and a second save of the same screen would leave the item
    with two headline rows and the till reading whichever sorted first.
- [x] **§9 `23P01` exclusion_violation** added to `STOCK_ENGINE_SQLSTATE_STATUS`
  in `stock-voucher/types/stock-voucher.types.ts` → 409, shared rather than
  local so the transfer screens inherit it. `SellingPriceBulkExceptionFilter`
  gives `ex_smp_overlap`, `ck_smp_not_above_mrp`, `ck_smp_prices_nonneg` and
  `ck_smp_identity` a sentence each, and still carries the engine's own text in
  the error detail so the log stays searchable.
- [x] **§2 Module skeleton** — controller, service, filter, gateway, DTOs, three
  helpers, no `@CacheTTL`, `@ApiTags('Change Selling Price')`, wired into
  `app.module.ts` and into `swaggerDocs.ts` as `change-selling-price`. All three
  routes are mapped and live: `/api/v1/stock/price-bulk` (GET, POST) and
  `/api/v1/stock/price-buckets/{itemId}`.
- [x] **§11 Unit specs** — 72 tests, all passing, across
  `selling-price-scope.helper.spec.ts` and `selling-price-bulk.service.spec.ts`.
  Every §11 bullet is covered, including the SQLSTATE map one case per §9 row.
  The S1 mock is a *faithful* fake — it returns a row only when the search scope
  matches the row's loaded scope — so the S2-vs-S3 assertions exercise the real
  predicate rather than a stub that agrees with them.

### Built beyond the list, because it turned out not to be blocked

- [x] **§4.3 `taxPerc` resolved server-side, as of today, through
  `item_tax_history`.** `resolveItemTaxRates` — `item_tax_history` and
  `item_tax_master` are Prisma-owned and present, so the date-effective
  resolution is buildable now and the §5.1 recompute needs it anyway. Also
  returns `inclTax` and `hasCess` (§13.5) per item.
- [x] **§5.1 The server recompute.** `selling-price-math.helper.ts` — `price`
  wins, `priceWot` and `markupPerc` are recomputed and what the client sent in
  them is discarded. Markup on the tax-inclusive pair, margin on the
  tax-exclusive pair. **Both ratios are gated on the cost, not on the price**:
  margin's formula divides by `priceWot`, so a cost of 0 computes cleanly and
  reports 100% — an item whose cost is merely unknown would show the best margin
  on the screen.
  - `roundOff` is stored and echoed, **never applied**. Its unit (decimal places,
    or a nearest multiple) is not settled in this repo, and §5.1 puts the
    rounding at the client's price-with-tax step anyway.
- [x] **Headline rows are validated too.** Q26 reads `stock_mrp_price` and cannot
  see a headline row, so `validateHeadlineRows` checks the two verdicts that
  apply to one against `ipm_min_price` and `ipm_cost_price`. ABOVE_MRP is absent
  on purpose — a headline row has no MRP dimension, which is what made it a
  headline row. Without this the below-cost setting would silently not apply to
  master rows: the same shape of hole as legacy fault #2.
- [x] **A headline-only save works end to end today.** It never touches the
  gateway, so the whole §6 path is usable on a database without the stock share.
  The spec asserts the gateway is not called.

## Blocked on the `schema/stock/` deploy

Everything below now has a named home in `StockMrpPriceGateway`, which answers
**503** with the sentence saying why rather than a Prisma stack trace. When the
share lands, one file changes: fill each method with its statement from `16q`
**verbatim**, and flip `isDeployed`.

- [ ] **§1 `prisma/stocks/stockMrpPrice.prisma`** — write it from `16_stock.sql`
  §20, not from the plan. No indexes, no constraints, no relations to
  Prisma-owned masters; `ex_smp_overlap` is inexpressible and must not be
  declared. Then `node scripts/build-prisma-schema.js && npx prisma generate`.
- [ ] **§3 `GET /stock/price-bulk`** — Q25 into `gateway.listPrices`. Route,
  paging (200/1000) and the four filters are built; the statement is not.
- [ ] **§4 `GET /stock/price-buckets/:itemId`** — Q24 into `gateway.listBuckets`.
- [ ] **§5 `POST /stock/price-bulk`** — Q26 into `validateRows`, S1–S3 into
  `findBucketRowForUpdate` / `updateBucketPrice` / `insertBucketPrice`, Q27 into
  `listNoStock`. The transaction, the ordering, the fan-out and the error
  translation around them are built.
- [ ] **§5.4 The response and its message** — the shape and `buildSaveMessage`
  are built and specced (it can never be a plain "Saved" while `noStock` is
  non-empty); `noStock` itself is Q27's, so it is empty until the deploy.
- [ ] **§12 `applyBucketPrice(tx, row, scope)`** — extracted from the outset, as
  the plan asks, so form 6 (menu 31) imports S1–S3 rather than copying them. It
  takes no DTO, no request context and no scope switch: the resolution is made
  before it is called, which is the part the two screens must agree on.
- [ ] **§11 Integration** — the four resolution scenarios, especially the
  branch-override-does-not-touch-the-chain-row pair.

---

## Blocked

1. **§0.1 The table does not exist in this repo, in any form.** Re-verified
   2026-09-07 after the build: no model, no migration, no reference to
   `stock_mrp_price`, `smp_`, `fn_smp_effective` or Q23–Q27 anywhere in `src/`
   or `prisma/` outside this module's own comments. It is deployed out of band
   from `schema/stock/`, which is not in this repo, exactly as
   `stock.stock_voucher` is. Nothing in the second list above can be
   smoke-tested until 192.168.0.106 has it.
2. **§0.2 The column list is unverified.** No `stockMrpPrice.prisma` was written
   and no DTO was frozen on the plan's inferred shape. `BucketPriceCandidate` in
   the gateway is the module's own vocabulary, not a claim about columns.
3. **§0.4 The Qt grid rows.** `menu_master` 30 exists (`Menu_Master.sql:130`,
   `CTRL+G`); the `ui_table_master` / grid rows do not. Same gap the opening and
   count screens hit. Not this module's work; the screen cannot open without them.

## Open items for the DB owner / client (the plan's own list)

1. The `stock_mrp_price` column list — partitioned or not; levels as columns or
   rows; the real name and values of the scope discriminator.
2. **All branches + a BRANCH-sourced row** — implemented as the plan recommends
   (update the branch row, do not promote it), and flagged in the resolution as
   `switchIgnored` so the response can say the switch did nothing. Confirm.
3. **Which `usrType` values count as HQ** — `HQ_USER_TYPES` is a deny-by-default
   placeholder holding `['HQ','ADMIN','SUPERADMIN']`. `usr_type` is a free
   varchar defaulting to `'USER'` and the repo seeds no vocabulary for it, so
   this is a guess in one named constant. Better still: an app setting in the
   same catalog as `below_cost_price`, resolved the same way.
4. Confirm `block`/`ask` in the screen plan were shorthand for the seeded
   `restrict`/`warning`, and not a fourth behaviour needing a migration.
   Implemented as a translation: `block` is *not* accepted as `restrict` — it
   falls back to the default — so a real fourth behaviour cannot hide as one.
5. Cess items — disable the four-number panel, or warn. The row carries
   `hasCess`; the screen decides.
6. **Q23 is referenced and unused** by all three endpoints. Find out what it was
   for before the SQL is wired in verbatim.
7. **New: `smp_round_off`'s unit** — decimal places, or a nearest multiple? It is
   stored and echoed but never applied server-side until this is settled.
