# StockTransferModule — `/api/v1/stock/transfer`

**There is no transfer table.** Both forms are `stock.stock_voucher` rows —
`svh_voucher_type = 'TRANSFER_OUT'` and `'TRANSFER_IN'` — with their
`stock_voucher_item` lines, plus `stock.stock_transit` for the inter-branch leg.
This module writes **two tables, updates a third, and calls one function** (twice
in the inter-branch case).

## Forms 3 and 4 are one endpoint set, two screens

The engine chooses the shape itself:

```
v_same := svh_to_branch_id IS NULL OR svh_to_branch_id = svh_branch_id
```

Same branch → the OUT and IN ledger rows are written as a **pair in one
transaction** and the voucher ends `POSTED`, with no transit row. Another branch
→ the OUT row plus one `stock_transit` row per line, and the voucher is
`IN_TRANSIT` until somebody receives it.

There is deliberately no `godown-transfer` module beside a `branch-transfer`
module. The document, the lines, the validation and the despatch call are
identical and only `toBranchId` differs; two modules means the second one drifts,
and the drift lands in the ledger.

## Routes

| Route | What it is |
|---|---|
| `POST /stock/transfer` | save a TRANSFER_OUT draft. Update is a **full replace of the lines**. |
| `GET /stock/transfer` | `svhId` loads one **with its transit rows**; absent lists |
| `GET /stock/transfer/validate` | the preflight, line by line |
| `POST /stock/transfer/despatch` | the engine (shape `TRANSFER_OUT`), plus the lorry |
| `POST /stock/transfer/cancel` | **same-branch POSTED only** — reversal rows |
| `DELETE /stock/transfer` | soft delete, DRAFT only |
| `GET /stock/transfer/receive` | load one receipt (notes 154 #1): header + lines + the **despatch's** transit rows; the header adds `linkSrcRefno`, `fromBranchId`, `fromBranchName` |
| `GET /stock/transfer/receive/inbound` | what is on its way to me, oldest first; each row names its despatch (`outVoucherId`, `outAccYear` — what prefill takes) and sender (`fromBranchName`, `fromGodownName`) |
| `GET /stock/transfer/receive/prefill` | open a receipt **at the remainder** |
| `POST /stock/transfer/receive` | save a TRANSFER_IN draft |
| `POST /stock/transfer/receive/post` | the engine (shape `TRANSFER_IN`) |
| `POST /stock/transfer/receive/settle-short` | close a despatch whose remainder will never arrive; the short stays on the loss report and, under PERPETUAL, DR reason / CR Stock-in-Hand |
| `DELETE /stock/transfer/receive` | soft delete a draft receipt |

Every response is `{ success, message, data }`. No `@CacheTTL` anywhere: every
read is a live balance, a live transit row or a live document status, and a
cached inbound worklist tells a branch stock is coming that it already has.

## Nine things that bite

1. **The lot is mandatory on both documents.** A transfer moves *existing*
   stock, so `fn_slt_resolve` is never called and the destination receives the
   **same `slt_id`** — ageing does not reset. That is the point of the rule, not
   a side effect. Note this **inverts** the shared service's default, which
   refuses a client-chosen lot.
2. **`svi_godown_id` means SOURCE on the OUT and DESTINATION on the IN.** Same
   column, two meanings, one screen apart. The receipt's comes from the prefill's
   `stt_to_godown_id`, never from a picker, and the two screens must not share a
   field label.
3. **Nobody enters a cost.** `svi_cost_rate` is *stripped* to 0 —
   `fn_sml_cost_default` stamps the policy cost on the OUT row and it travels to
   the IN row and the transit row. A typed rate makes that trigger bail *and*
   `20`'s OUT insert omits the value columns, so the row lands at that rate with
   **value 0** (`REVIEW_2026-09-05.md`, MUST-FIX 5).
4. **An inter-branch OUT is never POSTED.** DRAFT → IN_TRANSIT → RECEIVED. A
   status filter offering only POSTED loses every transfer in flight.
5. **The API never writes `svh_status`.** `fn_svh_post_lock` exempts IN_TRANSIT
   and RECEIVED (MUST-FIX 2), so a plain UPDATE would regress an OUT to DRAFT and
   a second despatch would move the stock twice. Only the two engine functions
   may write it, and there is no reopen action.
6. **Drafts are deleted, never cancelled.** The cancel guard over-reaches and
   refuses cancelling *any* linked TRANSFER_IN, a draft one included — and the
   link is mandatory on all of them.
7. **The transit key and the receive matcher disagree.** `ux_stt_out_line` is
   `(out voucher, item, lot, to-godown, bucket)`; the matcher looks up the same
   thing **without bucket**, finds two rows and refuses with `0A000`. So a
   two-bucket shipment saves and despatches and only the *receipt* fails, at the
   other branch. Both that and the two-source-godown collision (MUST-FIX 3, a
   bare `23505`) are refused at save instead.
8. **A short is not keyed — it is what remains unkeyed.** No zero-quantity line,
   no "short" field. It keeps the transfer open on purpose: that is the loss
   report, and the write-off is a separate decision the engine will not automate.
9. **`stt_lr_no`, `stt_vehicle_no` and `stt_expected_on` are written by this
   module**, inside the post's own transaction via the `afterPost` hook. Nothing
   in the engine writes them.

## Loading and unloading (notes 153, 2026-10-26)

3.0's Loading and Unloading boxes, on the **document** (migration
`20261026100000_transfer_loading_charges_notes_153`):

- **Header** — `loadEnabled`, `loadDatetime`, `loadmanIds[]`, `driverId`,
  `supervisorId`, `vehicleId`, `vehicleNo`, `unloadEnabled`, `unloadDatetime`,
  `unloadmanIds[]`, `unloadSupervisorId` → `svh_load_*` / `svh_unload_*`. The GET
  adds `loadmanNames[]`, `driverName`, `supervisorName`, `unloadmanNames[]`,
  `unloadSupervisorName`, `loadingCharge`, `unloadingCharge`.
- **Line** — `loadRate`, `unloadRate` (per unit of the LINE's unit, numeric(18,4)),
  stored so a later change to the unit's rate cannot move an old charge. The
  amount ((qty + freeQty) × rate) is not stored.
- **The charges are the server's**: `svh_loading_charge = round2(Σ (svi_qty +
  svi_free_qty) × svi_load_rate)` — the labour is paid on what was carried —
  while `loadEnabled`, else 0 (same for unloading), on every save. A body total
  is a 400 (no such DTO field).
- **Refused (422, per field)** — a negative rate (`STOCK_LOADING_RATE_NEGATIVE`),
  an employee that is missing, deleted, another company's or named twice
  (`STOCK_LOADING_EMPLOYEE_INVALID`), another company's vehicle
  (`STOCK_LOADING_VEHICLE_INVALID`), a load / unload instant before the doc date
  on the IST clock (`STOCK_LOADING_BEFORE_DOC_DATE`). Every other stock voucher
  type refuses all of it (`allowsLoading`; opening / physical / adjustment are a
  400 at the DTO, the shared service a 422 `STOCK_LOADING_NOT_ALLOWED`).
- **Which half carries which box** — a godown transfer both. A branch despatch
  the loading box, its receipt the unloading box (`STOCK_LOADING_WRONG_HALF`);
  driver and vehicle are the lorry's and stand on either.
- **Posting** — ONE voucher per document that carries labour, type `TRF` "Stock
  Transfer" (menu 41, not a register type): DR `LOADING_CHARGES` / CR
  `LOADING_PAYABLE`, linked (STOCK, svh_voucher_type, svh_id), at the document's
  own branch (roles resolve as mapped for it). **Whatever `accounts.cogs_mode`
  says.**
  - godown transfer: on despatch (ends POSTED), loading + unloading; a cancel
    reverses it (`reverseForVoucher`);
  - branch despatch (notes 156): on despatch (ends IN_TRANSIT), its loading, at
    the SENDING branch — never reversed, a despatch is never cancelled;
  - branch receipt (notes 156): when the TRANSFER_IN posts, its unloading of what
    it received (a DAMAGED line too), at the RECEIVING branch.

  An unmapped role is a 422 `STOCK_LOADING_ROLE_UNMAPPED` naming it and Ledger
  Map, and nothing moves (the receipt stays DRAFT). A short-settle leaves the
  despatch's voucher alone and files its own write-off as (STOCK,
  **TRANSFER_SHORT**, out id) — ux_avh_src allows one live voucher per link. The
  crew is paid by a Payment (menu 100) against the payable.
- **Default rates** — `/stock/opening/item-lookup` (the keyed unit) and
  `/stock/adjustment/pick-stock` (the holding's unit) answer `loadRate` /
  `unloadRate` = `unit_loading` / `unit_unloading` when `item_allow_loading`, else 0.
- **Rights (E3)** — every `/stock/transfer` route (not `/receive`) is judged on
  menu 41: 403 `TRF_RIGHT_<RIGHT>`; save+post needs post too.
- **A cancelled transfer keeps its figures (E1)** — the cancel's re-total leaves
  the reversal rows out on this shape; every other type still re-totals to 0.
- **Reasons (E4, migration `20261026110000`)** — three shared BOTH reasons for
  `{TRANSFER_OUT, TRANSFER_IN}`: REPLENISH, REARRANGE, RETURN_STORE.
  `/stock/reasons?voucherType=TRANSFER_OUT` (or `TRANSFER_IN`) lists only BOTH
  reasons naming the type, so TRANSIT_LOSS (OUT, the short-settlement's) is not
  offered; a save citing a one-way reason is a 422 `STOCK_REASON_WRONG_DIRECTION`.
- **Lot identity on the GET (E5)** — a transfer line names its lot and keys no
  identity, so `GET /stock/transfer?svhId=` reads batchNo / mfgDate / expiryDate /
  mrp / salePrice / serialNo (and the batch's size / colour / model) from
  `stock_lot`. Nothing is written; other voucher types still read the line's own.

## Branch Outward / Inward reads (notes 154, 2026-10-26)

- `GET /stock/transfer?svhId=` of a TRANSFER_IN stays a 404 — it reads under
  the despatch rules. A receipt is read through `GET /stock/transfer/receive`.
- The prefill's `outVoucher` names `fromBranchName`, `fromGodownName`,
  `toGodownName`; every voucher header names `toBranchName` beside `toBranchId`.
- Not gated by menu rights yet: the `/receive` routes (Branch Inward 193), and
  the branch form of `/stock/transfer` is judged on menu 41, not Branch Outward 192.

## Two known engine gaps this module lives with

- **`cost_rate_wot` at receipt** comes from the lot as it stands *now* while
  `cost_rate` comes from the transit row, so the two rates on one ledger row
  describe different moments. Do not reconcile `cost_value_wot` across a
  transit until `stt_cost_rate_wot` lands.
- **Nothing closes a short.** There is no `fn_stt_settle_short`, so a partially
  received transit row stays PARTIAL for ever and keeps its remainder in the
  destination's `sbl_transit_in_qty`. Either a settle endpoint is added here or
  the inbound worklist accumulates ghosts — a decision for the DB owner.

## Tests

- `stock-transfer.service.spec.ts` — 41 unit tests: the rule records, the seven
  save refusals, the five receive refusals, the prefill remainder, the despatch
  shape and the `afterPost` transaction.
- `test/stock-transfer.e2e-spec.ts` — the `20_stock_transfer_flow.md` cycle
  figure for figure. **Auto-skips while the engine is absent**;
  `STOCK_ENGINE_REQUIRED=1` turns the skip into a failure so CI can demand it.
