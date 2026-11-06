# ItemQtyRatesModule — Qty-wise Prices + Cost + Card Rate, one form (menu 244)

Plan: `Shared/Prathap/inventory/plan-qty-price-card-rate-one-form.md` (§4.1–§4.3), with
addendum 1 (the user's answers Q1–Q12, D8–D19) and addendum 2 (no React; D21: every server
change is additive). DB step: migrations `20261106140000_qty_price_card_rate_form` (ui_table 68,
table 19 columns 23–26, the wording rows) and `20261106140100_qty_price_bills`
(`sales.apply_qty_prices`, the four `*_qty_price_id` line columns).

**What it is for.** 3.0's MultiLevelPricing: the item's cost, Rule, MRP and card prices AND its
qty slabs on one form, saved by one request in ONE transaction — all or nothing.

| Route | Rights | What it is |
|---|---|---|
| `GET /api/v1/item-qty-prices/get-with-rates?itemId&companyId&branchId` | menu 244 VIEW | the item, the rights, the active levels, the card rows and every live slab |
| `POST /api/v1/item-qty-prices/save-with-rates` | see the matrix | card rows + slabs + slab deletes, one transaction |

Neither is cached (live prices, per user's rights and per company). The controller shares the
`item-qty-prices` prefix with the slab master (`ItemsQtyPriceMasterController`: create / get /
delete / restore), which is a different module.

## It owns no write and copies no rule

| Part | Whose |
|---|---|
| card rows: checks, S1 → S2/S3, Price Change Log, audit | `SellingPriceBulkService.prepareBulk` / `writeBulkInTx` (menu 30), `PriceMasterWriter` |
| the row's cost basis (stock average) | `PriceBucketGateway.loadRowCosts` |
| which price row answers, scheduled rows | `price-resolver.ts` (`resolveEffectivePrice`) over the item's rows |
| Plain stock, tracked as, left-out reason, unit chain | menu 298: `CostPriceBulkGateway.findItem`, `leftOutReasonOf`, `trackedAsOf`, `unitLink` |
| slabs: save, delete, overlap, log, audit | `ItemsQtyPriceMasterService.save(rows, tx)` / `softDelete(ids, tx)` |
| menu 244 rights, the level rule (C6), the all-branches rule (Q9) | `ItemsQtyPriceMasterService.assertRight` / `assertSellingLevels` / `assertChainSlabsAllowed` (the slab master's `/create` runs the same) |
| what one slab makes of a price, the judgement | `items-qty-price-master/qty-slab.rules.ts` (shared with the price lookup and the Qt port) |

`item-qty-rates.rules.ts` holds only what is this form's: the card after the save, the two new
card checks, the set of slabs judged (C7) and the problem list.

## get-with-rates

`data = { item, rights, belowCostPolicy, today, levels, units, slabs }`.

- `item`: `plainStock` = no preset tracking batch / MRP / sale price / serial and no old batch
  tick (menu 298's rule); `leftOutReason` null | INACTIVE | NOT_PLAIN_STOCK | OLD_BATCH_TICK.
- `rights`: 244 view / createSlab / editSlab / deleteSlab, `editCard` = menu 30 EDIT,
  `allBranchSlab` = `isHqUserType`.
- `levels`: the ACTIVE levels 1–4 of `fixed.price_levels` (name, short).
- `units`: the `/stock/price-bulk` grid rows of the item (one per ACTIVE unit × live bucket at
  this branch; the headline when the item tracks none), each with the unit chain
  (`parentUomId`, `unitsPerParent`, `factorsAgree`), `stockAvg` (costRate when it is a stock
  figure), `rowCost` / `rowCostWot` (the answering row's own), `cardCost` (rowCost on a
  Plain-stock headline row, else costRate — the Cost column, and what slabs are judged by),
  `profitType`, `levels` (price, w/o tax, markup against cardCost), `costEditable` /
  `mrpEditable` (Plain-stock headline row and menu 30 EDIT) and `scheduledFrom` (a later row
  takes over that day).
- `slabs`: every live slab of the item, all scopes, as `/item-qty-prices/get` answers them.

## save-with-rates, in this order

1. **Rights** (403), before anything is read: 244 VIEW → CREATE (a slab without `iqp_id`) →
   EDIT (a slab with one) → DELETE (`deleteSlabIds`) → menu 30 EDIT (`rates.rows`,
   `STOCK_PRICE_RIGHT_EDIT`).
2. **Shape**: nothing sent → 400 `ITEM_QTY_PRICE_NOTHING_TO_SAVE`; a slab of another item → 400
   `_ITEM_MISMATCH`; one id twice (or saved and deleted) → 400 `VALIDATION_ARRAY_UNIQUE`. In the
   transaction, after the per-item lock: a named slab not there → 404 `_NOT_FOUND`, another item's
   → 400 `_ITEM_MISMATCH`; a level not blank / active 1–4 → 422 `_LEVEL_NOT_SELLING`; a slab for
   all branches from a non-HQ user type → 403 `_CHAIN_HQ_ONLY`; a non-HQ user type saving or
   deleting a slab of another branch than its logged-in one → 403 `_OTHER_BRANCH` (D16).
3. **Checks, nothing written**: `costPrice` / `maxPrice` on an item that is not Plain stock → 422
   `_COST_NOT_PLAIN_STOCK` / `_MRP_NOT_PLAIN_STOCK`; `prepareBulk` (this branch, from today,
   `originMenuId` 244: its own 422 `STOCK_PRICE_*`, below cost thrown under `restrict`); a
   headline's prices above its MRP after the save (typed `maxPrice`, else stored; 0 = none) → 422
   `ITEM_QTY_PRICE_ABOVE_MRP`; a By User unit whose cost changed and prices did not → ask
   `_BY_USER_PRICES_KEPT`; then every live, active slab in force today or later at this company /
   branch (stored, with the sent changes over it, plus the new ones, minus the deleted ones) at its
   level — or every active level in use — against the unit's card AFTER the save (the headline;
   the dearest bucket when there is no headline): zero or less, above MRP, below Min refuse;
   below cost by `inventory.below_cost_price` (restrict 422, warning ask, allow report).
4. **Verdict**: any REFUSE → 422 `{ errors[], problems[], belowCostPolicy }`; any ASK and not
   `confirmed` → 200 `needsConfirm: true` with `problems[]` (one `confirmed: true` answers all, C8).
5. **Write**, same transaction: slab deletes, the card (`writeBulkInTx`, logged
   CHANGE_SELLING_PRICE "via Qty-wise Prices (menu 244)", "Confirmed below cost: …" when
   confirmed), then the slabs. A slab overlap (409 `ITEM_QTY_PRICE_OVERLAP`) rolls back the card
   and the deletes too.

Review fixes (2026-11-06, contract with the Qt screen):
- **C-a** the card rows are judged by price-bulk only at ACTIVE levels priced above 0
  (`prepareBulk` option `activeLevels`); all four levels are still written as sent. Menu 30 /
  Quick Rate pass no option and judge every level, as before.
- **C-b** a slab on a level that is not an active selling level is not judged.
- **C-c** a `costPrice` equal to the stored cost at 2 decimals (half-up) is unchanged: no By User
  question, and the stored cost and its w/o-tax half are written back as they are
  (`prepareBulk` option `keepCost`).
- **C-e** every slab refusal names `slabs.<i>.<field>`: the writer's (`slabs.<i>.iqp_to_qty`,
  `.iqp_item_id`, `.iqp_from_qty`), a judged slab's (`slabs.<i>.iqp_price` / `.iqp_flat_off` /
  `.iqp_disc_pct` by its mode; a stored slab not sent stays `iqp_id`), and a validation sentence
  in Nest's old `{ message: [...] }` shape (the filter). Card refusals keep price-bulk's `rows.<lineNo>`.
- **C-f** `item.groupName` / `item.brandName` (null when none).
- Ids are matched lower-cased; bucket keys compared as exact Decimals.

`data = { needsConfirm, rates, slabs, deletedSlabIds, problems, belowCostPolicy }` in every 200
(asking: `rates` null, the lists empty). `rates` is what `POST /stock/price-bulk` answers.
Each problem: `{ source CARD|SLAB, code, severity REFUSE|ASK|INFO, lineNo, slabIndex, iqpId, uomId,
unitName, level, price, cost, field, message }`.

**Concurrency.** The save takes the slab writer's per-item advisory lock first
(`hashtext('inventory.item_qty_price'), hashtext(item)`), so two saves of one item queue; there
is no row token (C5): the Price Change Log shows both if two people collide.

**Offline.** Card rows are BRANCH scope (each branch its own row, `ex_ipm_overlap` keyed by
branch). A slab for all branches needs head office (Q9), so two branches cannot both create one
offline. No numbering.

## Open

- The card band's write proof (T5/T6) is the api-tester's; only slab create + delete were proven
  live when this was built (2026-11-06).
- `VALIDATION_ARRAY_UNIQUE`, `STOCK_PRICE_OVERLAP` and `VALUE_TOO_LARGE` have no wording row.
