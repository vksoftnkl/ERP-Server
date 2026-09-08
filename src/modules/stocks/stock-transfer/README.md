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
| `POST /stock/transfer/despatch` | `fn_svh_post_transfer`, plus the lorry |
| `POST /stock/transfer/cancel` | **same-branch POSTED only** — reversal rows |
| `DELETE /stock/transfer` | soft delete, DRAFT only |
| `GET /stock/transfer/receive/inbound` | what is on its way to me, oldest first |
| `GET /stock/transfer/receive/prefill` | open a receipt **at the remainder** |
| `POST /stock/transfer/receive` | save a TRANSFER_IN draft |
| `POST /stock/transfer/receive/post` | `fn_svh_receive_transfer` |
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
