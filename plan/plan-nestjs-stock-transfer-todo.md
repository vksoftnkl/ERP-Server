# Stock Transfers — build checklist

Work list for `plan/plan-nestjs-stock-transfer.md`, against
`plan/20_stock_transfer_flow.md` for the figures. Written 2026-09-07.

Two screens, **one module**. Forms 3 (godown → godown) and 4 (branch → branch)
share every route; the engine picks the shape from `svh_to_branch_id`. Do not
split them — plan §1.

**Built 2026-09-07 — §§1-9 and the unit tests are done, typechecked and green.**
11 routes register, 41 transfer unit tests and 13 shared-service tests pass, and
the 304-test stocks suite is unchanged. What is left is the engine share itself
and the decisions that are not this repo's; both are at the bottom of this file.

    POST   /api/v1/stock/transfer                  GET    /api/v1/stock/transfer
    GET    /api/v1/stock/transfer/validate         POST   /api/v1/stock/transfer/despatch
    POST   /api/v1/stock/transfer/cancel           DELETE /api/v1/stock/transfer
    GET    /api/v1/stock/transfer/receive/inbound  GET    /api/v1/stock/transfer/receive/prefill
    POST   /api/v1/stock/transfer/receive          POST   /api/v1/stock/transfer/receive/post
    DELETE /api/v1/stock/transfer/receive

### Four things the build found that the plan had wrong

1. **`postFunction` was not parameterised.** Plan §1 says the post function
   "goes in the per-type rule record the shared service already takes". It did
   not — `post()` hardcoded `stock.fn_svh_post`. It is a rule field now, with an
   allowlist (`STOCK_POST_FUNCTIONS`) because the name reaches SQL through
   `Prisma.raw`, which does not escape.
2. **The lot rule is an INVERSION, not an addition.** The shared service
   actively *refused* a `lotId` on every non-COUNT type — "the engine resolves
   it at post". `requiresLot` flips that per type; the OPENING's refusal is
   still tested and still fires.
3. **`isInward` would have refused every receipt line.** A TRANSFER_IN is
   inward and its cost is stripped to 0 by design, so the existing "inward at
   cost 0 with no derivable rate source" check refused the whole document. It is
   now gated on `zeroesLineCost` — the rate comes from `stt_cost_rate`.
4. **§4.2's "same transaction" was not achievable as written.** `post()` opens
   its own transaction, so a transit update after it returns is a *second* one —
   a despatch could commit with the lorry missing. `post()` now takes an
   `afterPost` hook that runs inside its transaction, and a test asserts the
   post rolls back when the hook throws.

---

## What the shared service already gives you

Checked in `src/modules/stocks/stock-voucher/`. None of this needs rebuilding:

- **`StockTransit` Prisma model** — `prisma/stocks/stockTransit.prisma`, in
  `schema.prisma` and in the generated client (`tx.stockTransit`). Plan §0.2 is
  **done**: single-column PK, not partitioned, `sttShortQty` mapped
  `@default(dbgenerated())` and documented read-only.
- **`StockVoucherTypeRules`** already carries `allowsToBranch`, `refuseTypes`,
  `quantityMode`, `ledgerTxnTypes`, `requiresFromGodown` / `requiresToGodown`,
  `allowsCount`, `defaultRateSource`, `allowsRepeatHolding` — and the service
  already enforces them (`assertPayloadRules`,
  [stock-voucher.service.ts:330](src/modules/stocks/stock-voucher/stock-voucher.service.ts#L330)).
  `allowsToBranch: false` is set on both existing rule records, so a
  `toBranchId` is refused everywhere today and must simply be allowed here.
- **The header DTO already has** `toBranchId`, `fromGodownId`, `toGodownId`,
  `linkSrcModule` / `linkSrcDocType` / `linkSrcDocId` / `linkSrcAccYear`.
  The line DTO already has `godownId`, `lotId` (optional) and `bucket`.
- **Numbering** — `stock-voucher-numbering.helper.ts`, advisory-locked, per
  device, `{typeCode}/{accYear}/{deviceCode}/{slno}`. Two new `typeCode`s is the
  whole change.
- **The SQLSTATE map is already complete for transfers.**
  `STOCK_ENGINE_SQLSTATE_STATUS` maps `P0002`→404, `23001`→409, `0A000`→409,
  `23505`→409, `23514`→422, `23502`→422, `23503`→422, and the filter switches on
  `error.meta.code`, not `error.code`. Plan §10 needs **no new entries** — only
  tests that the engine's own sentences reach the client.
- **Audit, list, getById, softDelete, cancel** are all type-parameterised
  already.

---

## 1. Shared-service changes — do these first

Everything here is in `stock-voucher/`, and each one is a thing the plan assumes
is already parameterised and is not.

- [x] **1.1 `postFunction` on the rules record.** `post()` hardcodes
  `SELECT stock.fn_svh_post(...)` at
  [stock-voucher.service.ts:1774](src/modules/stocks/stock-voucher/stock-voucher.service.ts#L1774).
  A transfer must call `fn_svh_post_transfer`, and a receipt
  `fn_svh_receive_transfer`. Add the function name to `StockVoucherTypeRules`
  and pin it to `stock.fn_svh_post` on the two existing records — 19 refuses to
  post a transfer by name, so a mis-wired record fails loudly, which is the
  point.
- [x] **1.2 `requiresLot` on the rules record.** `lotId` is optional on
  `SaveStockVoucherItemDto` because opening resolves one and physical reads one.
  A transfer **moves** one, and a line without it must be refused at the DTO
  boundary, not at the engine (plan §3.1). Per-type, not a DTO-wide `@IsUUID()`.
- [x] **1.3 Force `costRate` / `costRateWot` to 0 on TRANSFER_OUT lines.** Not
  "omit from the docs" — **strip whatever arrives**, the same way the physical
  count already zeroes them (§3.3 of that plan). This is the code-around for
  MUST-FIX 5: a nonzero rate makes `fn_sml_cost_default` bail *and* 20's OUT
  insert omits the value columns, so the ledger row lands at that rate with
  **value 0**. Reproduced in `REVIEW_2026-09-05.md`.
- [x] **1.4 Never write `svh_status` from the API.** *Audited: already safe by
  construction.* The only `svhStatus` write in the service is `'DRAFT'` in
  `createDraft`; `updateDraft` never writes it and is gated by `assertDraft`, so
  no route can regress an IN_TRANSIT voucher. No reopen action exists. MUST-FIX
  2: `fn_svh_post_lock` exempts IN_TRANSIT and RECEIVED, so a plain UPDATE
  regresses an OUT to DRAFT and a second despatch moves the stock twice. Only
  the two functions may write it. **Do not offer a reopen action.**
- [x] **1.5 A non-DRAFT precondition hook.** `assertDraft`
  ([:2508](src/modules/stocks/stock-voucher/stock-voucher.service.ts#L2508)) is
  right for save and delete, but the receive path's precondition is *the linked
  OUT is IN_TRANSIT*, which is a different question about a different document.
- [x] **1.6 Header fields for the lorry** — `lrNo`, `vehicleNo`, `expectedOn` on
  the save DTO. Not on the voucher: they go to `stock_transit` after the post
  (§0.3(a), and see 4.2).

---

## 2. Module shape — §1

- [x] **2.1** `src/modules/stocks/stock-transfer/` with `stock-transfer.module.ts`,
  `stock-transfer.controller.ts` (TRANSFER_OUT) and
  `stock-transfer-receive.controller.ts` (TRANSFER_IN). `StockVoucherService`
  **imported, not copied**.
- [x] **2.2 Two rule records**, each owned by its controller so no payload can
  reach them — copy the shape of `PHYSICAL_RULES`
  ([physical-stock-voucher.controller.ts:81](src/modules/stocks/physical-stock-voucher/physical-stock-voucher.controller.ts#L81)):

  | | TRANSFER_OUT | TRANSFER_IN |
  |---|---|---|
  | `typeCode` | `TRF` | `TRI` |
  | `requiresFromGodown` / `requiresToGodown` | both **true** (`ck_svh_transfer_godowns`) | both **true** — it applies to the IN as well |
  | `allowsToBranch` | **true** | false |
  | `isInward` | false | true |
  | `ledgerTxnTypes` | `['TRANSFER_OUT']` | `['TRANSFER_IN']` |
  | `quantityMode` | `QTY` | `QTY` |
  | `allowsCount` | false | false |
  | `requiresLot` (1.2) | **true** | **true** |
  | `postFunction` (1.1) | `stock.fn_svh_post_transfer` | `stock.fn_svh_receive_transfer` |
  | `refuseTypes` | everything but its own | everything but its own |

- [x] **2.3 Register in `app.module.ts`** beside the existing three
  ([app.module.ts:73-75](src/app.module.ts#L73-L75) and
  [:202-204](src/app.module.ts#L202-L204)), plus a `Stock Transfer` Swagger group
  in `src/utils/swaggerDocs.ts`. No `@CacheTTL`.

---

## 3. `POST /api/v1/stock/transfer` — save a TRANSFER_OUT draft — §3

- [x] **3.1 DTO** pinning `TRANSFER_OUT` via `@IsIn`, with `lotId` required per
  1.2 and `costRate` stripped per 1.3.
- [x] **3.2 The seven refusals, all as one 422 with a per-line list** — the
  service's existing per-line 422 shape, not one error at a time:
  - [x] `fromGodownId == toGodownId` on a same-branch transfer;
  - [x] any `line.godownId == toGodownId`;
  - [x] `lotId` missing;
  - [x] `qty + freeQty == 0`;
  - [x] **quantity exceeds on-hand** for that (godown, item, lot, bucket) —
        the engine does *not* check this, `stp_allow_negative` decides, and
        under `ALLOW` a transfer sends stock the branch does not have. The grid
        was loaded from the balance, so the screen knows;
  - [x] duplicate `(lineNo, splitNo)`;
  - [x] **two buckets of the same (item, lot) to one destination godown** on an
        inter-branch voucher — it despatches fine and the *receipt* then dies
        `0A000`, "shipped in more than one bucket". One query at save;
  - [x] **the same (item, lot, bucket) from two source godowns** on an
        inter-branch voucher — the destination godown is header-level, so both
        lines make the same `ux_stt_out_line` key and the despatch dies with a
        bare `23505` (MUST-FIX 3). Two source godowns = two vouchers.
- [x] **3.3** `svi_lot_id` comes from the payload — check it belongs to the same
  company and item (`slt_company_id`, `slt_item_id`) before writing.
- [x] **3.4** Otherwise exactly the opening's §4.3: factor from
  `item_unit_conversion` (read, never trusted), base quantities computed, header
  identity copied down, status always DRAFT, totals never written.

---

## 4. `POST /api/v1/stock/transfer/despatch` — §4

- [x] **4.1** `SELECT stock.fn_svh_post_transfer($1::uuid, $2::bpchar, $3::uuid)`
  through the 1.1 hook, one transaction.
- [x] **4.2** Immediately after it returns, in the **same transaction**, update
  the transit rows with `stt_lr_no` / `stt_vehicle_no` / `stt_expected_on`, keyed
  by `(stt_out_voucher_id, stt_out_acc_year)`. §0.3(a) — the function never sets
  those three columns and nothing else does either. Inter-branch only.
- [x] **4.3 The response says which shape happened** — `sameBranch`,
  `ledgerRows`, `transitRows`, and `status` **read back from the row**, never
  from the request. `POSTED` for a same-branch pair, `IN_TRANSIT` for a despatch.

---

## 5. Lists and loads — §5

- [x] **5.1 Outbound list** — the shared `list()` with `TRANSFER_OUT`. **The
  status filter must offer DRAFT, POSTED, IN_TRANSIT, RECEIVED and CANCELLED.**
  An inter-branch OUT is never POSTED; a list hard-coded to POSTED silently
  loses every transfer in flight.
- [x] **5.2 Inbound worklist** — Q14 from `16q_stock_grid_queries.sql` for the
  screen (days in flight, short quantity, loss value), `ix_svh_inbound`
  (`svh_to_branch_id = :me AND svh_status = 'IN_TRANSIT'`) for the badge count.
  `PARTIAL` is a `stt_status`, never a voucher status.
- [x] **5.3 One voucher** — header + lines, **plus its transit rows** on an
  inter-branch OUT, so the sender sees what has been received against each line.

---

## 6. `GET /api/v1/stock/transfer/receive/prefill` — §6

- [x] **6.1** Prefill from **`stock_transit`, not from the OUT's lines** —
  `remaining_qty = sent − received − damage`, `> 0` only. A second partial
  receipt must open with the remainder; prefilling from the lines is the bug
  that lets a clerk receive 30 twice.
- [x] **6.2** Return `stt_id`, `stt_to_godown_id`, `stt_bucket`, `stt_cost_rate`
  and `stt_base_uom_id` with each row — the receive DTO needs all five.

---

## 7. `POST /api/v1/stock/transfer/receive` — save a TRANSFER_IN draft — §7

- [x] **7.1 DTO** pinning `TRANSFER_IN`, with four rules the OUT does not have:
  - [x] `linkSrcDocId` + `linkSrcAccYear` **required**, with
        `linkSrcModule='STOCK'` and `linkSrcDocType='STOCK_VOUCHER'` — the
        function checks all three, `ck_svh_transfer_in_link` checks the id;
  - [x] `branchId` must equal the OUT's `svh_to_branch_id`;
  - [x] `line.godownId` is the **destination** — the opposite meaning to the OUT
        line. Take it from the prefill's `stt_to_godown_id`, never from a picker.
        Do not let the two screens share a field label;
  - [x] `fromGodownId` / `toGodownId` still required on the header — copy them
        from the OUT.
- [x] **7.2 Refusals before the engine:**
  - [x] `qty` exceeds the transit row's `remaining_qty`;
  - [x] (item, lot, godown) matches no open transit row of that OUT;
  - [x] **`line.bucket <> stt_bucket` unless the line is DAMAGED** — otherwise a
        damaged consignment received as SALEABLE is laundered clean
        (SHOULD-FIX; the engine only checks the other direction);
  - [x] the OUT is not `IN_TRANSIT`;
  - [x] empty line set.
- [x] **7.3 What never arrived gets no line.** No zero-quantity line for a short,
  no "short" field on the screen. A short is what remains unkeyed.

---

## 8. `POST /api/v1/stock/transfer/receive/post` — §8

- [x] **8.1** `SELECT stock.fn_svh_receive_transfer(...)`.
- [x] **8.2 The response carries BOTH documents' new state plus the transit
  rows** — the receipt closing does not mean the transfer closed. The OUT flips
  to RECEIVED only when no transit row of it has anything left; a short keeps it
  open **on purpose**, and that is the loss report.
- [x] **8.3 No "auto write-off short" option.** The write-off is a separate
  DAMAGE / ADJUSTMENT voucher at whichever branch the business blames, and the
  engine deliberately will not decide who pays.

---

## 9. Cancel and delete — §9

- [x] **9.1 DRAFT of either type → `DELETE /stock/transfer`**, soft delete with
  `svi_is_deleted` on the lines in the same transaction. **Delete, never
  cancel** — the cancel guard over-reaches and refuses cancelling *any* linked
  TRANSFER_IN, draft included (SHOULD-FIX, 20:598), and the link is mandatory on
  all of them. **Do not expose Cancel on a draft receipt.**
- [x] **9.2 Same-branch POSTED → `POST /stock/transfer/cancel`** → the generic
  `fn_svh_cancel`, which reverses both halves symmetrically.
- [x] **9.3 IN_TRANSIT / RECEIVED OUT and POSTED TRANSFER_IN are refused by the
  engine (`23001`)** — surface as **409 with the engine's own sentence**. They
  read as instructions ("receive them, or transfer them back"), which is exactly
  what the clerk needs. Do not paraphrase them in TypeScript.

---

## 10. Tests — §11

Both existing e2e specs (`test/opening-stock.e2e-spec.ts`,
`test/physical-stock.e2e-spec.ts`) auto-skip while the engine is absent and turn
that skip into a failure under `STOCK_ENGINE_REQUIRED=1`. Copy that.

- [x] **10.1 Unit** — the rules records, the seven save refusals (3.2), the five
  receive refusals (7.2), the cost stripping (1.3), the prefill remainder maths.
- [x] **10.2 `test/stock-transfer.e2e-spec.ts`**, the 2026-09-04 smoke cycle
  figure for figure against `20_stock_transfer_flow.md`:
  - [x] same-branch pair: 2 ledger rows, POSTED, balance moved between godown
        rows, **`stock_item_cost` unchanged** (an internal move is not a
        revaluation), `stock_transit` still empty;
  - [x] same-branch cancel: both halves reversed, balances back;
  - [x] inter-branch despatch: 1 ledger row, 1 transit row, IN_TRANSIT,
        destination `sbl_transit_in_qty` = sent — **including a destination
        godown that has never held the item**, where `fn_sbl_ensure_row` must
        have created the row;
  - [x] partial receive with damage: 2 ledger rows, transit PARTIAL,
        `stt_short_qty` = 2, OUT **still IN_TRANSIT**, 3 in DAMAGED at the
        despatch cost;
  - [x] second receive closes it: transit RECEIVED, OUT RECEIVED;
  - [x] refusals: receive more than remains; receive at the wrong branch; cancel
        in flight; un-receive; a line with no lot; a godown to itself;
  - [x] **cost travels** — the IN row's `sml_cost_rate` equals the OUT row's,
        not the destination branch's average. Assert the number;
  - [x] **the wot asymmetry** (flow B6a) — pin the *current* behaviour so a
        later engine fix is a deliberate change and not a surprise;
  - [x] `fn_sbl_rebuild` returns 0 differing holdings after each.

---

## Blocked — the same missing artefact as the other two modules

**Nothing under `schema/stock/` exists in this repo or on this machine**, so
`fn_svh_post_transfer`, `fn_svh_receive_transfer` and
`fn_svh_transfer_cancel_guard` are not on the database and cannot be called.
Re-checked 2026-09-07: the local database has none of the six functions the e2e
needs — `fn_svh_post`, `fn_svh_post_transfer`, `fn_svh_receive_transfer`,
`fn_svh_cancel`, `fn_slt_resolve`, `fn_sbl_rebuild`.

Everything in §§1–9 is built and unit-tested against mocks. **`test/stock-transfer.e2e-spec.ts`
is written and wired but its assertions have never executed** — it auto-skips
while the engine is absent and fails under `STOCK_ENGINE_REQUIRED=1`, both
verified. That file is the acceptance test, and its figures are the flow doc's.

> **One caveat the flow doc raises about itself:** its numbers were *worked from
> the function bodies*, not captured off a cluster, unlike the opening flow's.
> So the first green run is also the moment they stop being a reconstruction. If
> an assertion disagrees, the flow doc is as likely to be wrong as the code —
> resolve it with the DB owner rather than by editing the expectation.

- [ ] **Obtain and deploy `schema/stock/`**, in order, `20_stock_transfer.sql`
  **after** `19_stock_posting.sql`. Then verify:

```sql
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'stock' AND proname IN
       ('fn_svh_post_transfer','fn_svh_receive_transfer','fn_svh_transfer_cancel_guard');
-- expect 3 rows
```

- [ ] **`SELECT stock.fn_create_stock_partitions('2026-2027');`** before the
  first insert.
- [ ] **Run it**: `STOCK_ENGINE_REQUIRED=1 npm run test:e2e -- stock-transfer`.

---

## The Qt grid

The same half-a-change as the opening screen: a seeded `fixed.ui_table_columns`
row renders nothing without a *meaning* for the column in the Qt client.

- [ ] **Agree the transfer grid column set with the client owner and seed it**
  on a new pinned `fixed.ui_tables` id — template
  `prisma/seed/Quotation_Charges_Grid_Web.sql`. Note the seed guards per table:
  a table that already has any column is left completely alone.
  The despatch grid and the receipt grid are **different column sets** —
  `svi_godown_id` means source on one and destination on the other, and the
  receipt grid needs `remaining_qty` from the transit row, which the OUT's grid
  has no column for.
- [ ] **Do not point either screen at `ui_tables` 5** — it describes the retired
  `osl_` opening screen.

---

## Open items — decide before or during, not after

1. **Refno prefixes `TRF` / `TRI`** — nothing in the schema fixes them. Agree
   with the client. `svh_slno` is unique per
   `(company, branch, acc_year, voucher_type, device)`, so OUT and IN number
   independently and the receiving branch's tablet numbers its own receipts
   offline.
2. **LR / vehicle / expected date** — §0.3. Recommendation is (a), the API
   updating the transit rows after the call (4.2), which needs no schema change.
   Whichever is chosen, **say so in the DTO** — a despatch note without a
   vehicle number is not a despatch note.
3. **`cost_rate_wot` at receipt** — engine asymmetry (flow B6a): `sml_cost_rate`
   comes from the transit row, `sml_cost_rate_wot` from the lot as it stands
   now, so the two rates on one ledger row describe different moments. The
   review's fix is a `stt_cost_rate_wot` column. **Until it lands, do not
   reconcile `cost_value_wot` across a transit** — and do not build a report
   that does.
4. **Over-issue on despatch.** Under `stp_allow_negative = 'ALLOW'` the engine
   will send stock a branch does not have; the 3.2 check is the only guard.
   Decide whether a transfer should be BLOCK regardless of the item's policy.
5. **Nothing closes a short.** There is no `fn_stt_settle_short`, so a partial
   transit row stays PARTIAL for ever, the OUT stays IN_TRANSIT for ever, and
   `fn_stt_refresh` keeps the remainder in the destination's
   `sbl_transit_in_qty` — stock the branch is told is coming and never will.
   **Decide with the DB owner:** either add a settle endpoint here (UPDATE the
   row to RECEIVED, keeping `stt_short_qty`, which Q14 still reports), or accept
   that the inbound worklist accumulates ghosts. Separately: **who** writes off
   a short and **against which reason code** — `stock_reason_master` exists, the
   transfer-loss reason list does not.
6. **Multi-destination despatch.** One OUT voucher carries one
   `svh_to_godown_id`. One lorry serving three shops is three vouchers — confirm
   the screen is built that way before somebody asks for a destination column in
   the grid.
7. **`stt_in_voucher_id` keeps only the LAST receipt's id.** After two partial
   receipts the first is discoverable only through the ledger. Do not build
   "which receipt closed this" on that column.
