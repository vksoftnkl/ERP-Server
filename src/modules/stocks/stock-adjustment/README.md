# Stock adjustments — ADJUSTMENT, ISSUE, DAMAGE, EXPIRY_WRITEOFF, re-lot

Phase 2 of the stock engine plan (`plan-nestjs-stock-adjustments`). **One module, one
screen with a Type selector, four `svh_voucher_type`s.** A re-lot is an ADJUSTMENT carrying a
`RELOT_OUT` / `RELOT_IN` pair.

| route | does |
|---|---|
| `POST /stock/adjustment` | save a DRAFT (`header.voucherType` picks the kind) |
| `GET /stock/adjustment?svhId&accYear&companyId&branchId` | load one, with names |
| `GET /stock/adjustment/validate` | preflight, one message per line |
| `POST /stock/adjustment/post` | engine + Stock Journal voucher + trail, one transaction |
| `POST /stock/adjustment/cancel` | DRAFT → CANCELLED; POSTED → mirror rows + `Rev` voucher |
| `DELETE /stock/adjustment` | soft delete a DRAFT |
| `GET /stock/adjustment/pick-stock?companyId&branchId&godownId&itemId?&bucket?&search?` | the holdings an outward line is chosen from (available > 0) |
| `GET /stock/reasons?companyId&voucherType&direction?` | the reason picker (shared + company rows merged) |
| `GET /stock/reasons/list`, `/get`, `/usage`, `POST /stock/reasons`, `POST /stock/reasons/deactivate` | reason master maintenance |

## What the engine does differently for this family

The rule records (`stock-adjustment.rules.ts`) set `postShape: 'SIMPLE'` with
`lineDirection: 'REASON'`: **each line's direction and ledger txn type come from its reason**
(line reason, then header reason). An IN reason posts `+1`, an OUT reason `−1`, a BOTH reason
takes the sign the screen keyed — stored as `svi_direction`, the quantities stay magnitudes
(`ck_svi_qty_sign`). An ADJUSTMENT posts `ADJUST_PLUS` / `ADJUST_MINUS` per line; an ISSUE posts
the reason's own type only when the reason lists exactly one issue type (`SAMPLE_ISSUE`,
`GIFT_ISSUE`, `ADJUST_MINUS`); DAMAGE and EXPIRY_WRITEOFF post their own.

An **outward line is always valued at the branch average** whatever the header's rate source
or a keyed cost. A lotless outward line is picked by the item's issue strategy (FEFO / FIFO /
LIFO) and split by `svi_split_no`; MANUAL refuses. The negative-stock policy is **BLOCK**
whatever the item says (D-A1). Header totals are the NET of the lines.

## The checks (`StockAdjustmentService.check`, at save and again at validate / post)

1. every line moves under a reason; inactive or invisible reasons refused; `srm_require_remarks`
   is API-enforced;
2. the direction agrees with the reason — an IN reason with a negative quantity, or an IN reason
   on a write-off, is refused; a BOTH reason on an ADJUSTMENT needs a signed quantity;
3. one godown per document, every line in it; no free quantity;
4. an outward line that names its lot must be covered by `sbl_available_qty` (document total per
   holding); an EXPIRY_WRITEOFF must name its lot, and the lot must have expired by the document
   date plus `stock.expiry_writeoff_grace_days` (D-A2, default 0) — otherwise it is DAMAGE;
5. a re-lot pair balances per item, the OUT names its lot, the IN is a different lot, one base
   unit; the header is forced to AVG_COST so the IN carries the OUT's value.

## Accounts (PERPETUAL)

One `StkAdj` (Stock Journal, `SADJ00001`) voucher per document, from the ledger rows: stock out
= DR reason ledger (`srm_gl_ledger_id`, else role `STOCK_SHORTAGE`) / CR INVENTORY; stock in
the other way (role `STOCK_EXCESS`); netted per ledger. A re-lot pair posts nothing.

## Tests

`test/stock-adjustment.e2e-spec.ts` — nine cases in one rolled-back transaction, including the
§5.1 balance assertion after each.

## Not built (the plan's open decisions)

- D-A3 "Move to damaged" (a `BUCKET_OUT` / `BUCKET_IN` pair, no accounts leg) — confirm before building.
- D-A5 the list grid (`ui_table` + grid registration over `stock_voucher`) — ids assigned by the box at registration.
- The client mockup (PNG) the plan puts first.
