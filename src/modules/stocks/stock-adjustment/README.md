# Stock adjustments — ADJUSTMENT, ISSUE, DAMAGE, EXPIRY_WRITEOFF, re-lot, Move stock

Phase 2 of the stock engine plan (`plan-nestjs-stock-adjustments`). **One module, one
screen with a Type selector, four `svh_voucher_type`s.** A re-lot is an ADJUSTMENT carrying a
`RELOT_OUT` / `RELOT_IN` pair. **Move stock** (`voucherType: BUCKET_MOVE`, notes 60 / D-A3) is
an ADJUSTMENT whose lines name a `toBucket`.

Menu **264** "Stock Adjustment" (under &4 Stock) covers every kind; per-kind rights can come
later. The list is grid **122** `TXN MAIN LIST - STOCK ADJUSTMENT`, the line grid ui_table **41**
`STOCK ADJUSTMENT - ITEM` (migration `20260928210000_stock_bucket_move`).

| route | does |
|---|---|
| `POST /stock/adjustment` | save a DRAFT (`header.voucherType` picks the kind) |
| `GET /stock/adjustment?svhId&accYear&companyId&branchId` | load one, with names, plus `kind` (ADJUSTMENT / RELOT / BUCKET_MOVE / ISSUE / DAMAGE / EXPIRY_WRITEOFF) |
| `GET /stock/adjustment/validate` | preflight, one message per line |
| `POST /stock/adjustment/post` | engine + Stock Journal voucher + trail, one transaction |
| `POST /stock/adjustment/cancel` | DRAFT → CANCELLED; POSTED → mirror rows + `Rev` voucher |
| `DELETE /stock/adjustment` | soft delete a DRAFT |
| `GET /stock/adjustment/pick-stock?companyId&branchId&godownId&itemId?&bucket?&search?` | the holdings an outward line is chosen from (available > 0), with the lot's `supplierId` / `supplierName` — with `bucket=DAMAGED` it is the "what goes back to which supplier" list |
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
   unit; the header is forced to AVG_COST so the IN carries the OUT's value;
6. a move: every line names its lot, `bucket ≠ toBucket`, a positive quantity, a move reason
   (one whose allowed types name `BUCKET_OUT` / `BUCKET_IN`), and the from-holding covers it
   (BLOCK); a document is all moves or none, both ways round; a move reason on any other kind is
   refused.

## Move stock (D-A3)

The shop has to SEE which damaged items go back to which supplier. A DAMAGE write-off loses
that; a move keeps the stock, still the company's, in the DAMAGED bucket until a purchase return
sends it back or a DAMAGE write-off clears it.

- **One line per move**: `bucket` = from, `toBucket` = to, same lot and quantity on both sides.
  Stored in `svi_to_bucket` (`ck_svi_to_bucket`: one of the five, never `svi_bucket`), the line's
  own direction `svi_direction = −1`.
- **The engine** (`postShape: 'BUCKET_MOVE'`) writes `BUCKET_OUT` −1 from (lot, bucket) and
  `BUCKET_IN` +1 into (the same lot, toBucket), same godown, both at the OUT's stamped cost — the
  branch average. Nothing is picked or resolved: a lotless line is refused.
- **The average does not move**: `applyItemCost` leaves the bucket pair out (it nets to nothing,
  and its IN half would otherwise stamp the average as the last purchase rate); the destination
  holding is still valued by the balance stamp.
- **Accounts: none** — `varianceLegs` skips the two txn types, as it skips a re-lot.
- **Header totals**: the BUCKET_OUT rows as a magnitude (moved 5, not 0), like a same-branch
  transfer.
- **Reasons** (shared seed): `MOVE_DAMAGED` "Damaged — hold for return" and `MOVE_SALEABLE`
  "Back to saleable", BOTH, allowed `{BUCKET_OUT,BUCKET_IN}`. The screen defaults the to-bucket
  from the reason (`MOVE_REASON_DEFAULT_BUCKET`) and lets the operator change it.
  `GET /stock/reasons?voucherType=BUCKET_MOVE` lists move reasons only.
- **Cancel** mirrors both rows, like every other document.

## Accounts (PERPETUAL)

One `StkAdj` (Stock Journal, `SADJ00001`) voucher per document, from the ledger rows: stock out
= DR reason ledger (`srm_gl_ledger_id`, else role `STOCK_SHORTAGE`) / CR INVENTORY; stock in
the other way (role `STOCK_EXCESS`); netted per ledger. A re-lot pair and a move post nothing.

## Tests

`test/stock-adjustment.e2e-spec.ts` — fourteen cases in one rolled-back transaction, including
the §5.1 balance assertion after each. Cases 10–14 are Move stock: the pair at one cost with the
average and the purchase stamps untouched and no voucher, an over-move, a lotless move and the
other refusals, the cancel, the move picker and a move back to SALEABLE.

## The list grid (D-A5)

Grid 122 over `stock.stock_voucher` with `svh_voucher_type IN` the four stored types. Its
`kind_code` column is ADJUSTMENT, RELOT, BUCKET_MOVE, ISSUE, DAMAGE or EXPIRY_WRITEOFF — the same
test `kindOf` makes. Params (bare tokens, send every one, `''` = no bound): `icompany_id`,
`ibranch_id`, `iacc_year`, `ifrom_date`, `ito_date`, `ikind`, `istatus`.

## Sales and the DAMAGED bucket

The sale bill's lot pick (`pickIssueLots`), the reservation and the "stock goes negative"
warning all filter on the LINE's bucket, which defaults to SALEABLE, so moved stock is not
billed by default. Two sales-side gaps remain (not fixed here): the sales line DTOs accept any of
the five buckets, so a client that sends `DAMAGED` bills damaged stock; and the item price
lookup's stock figure sums every bucket, so the counter still shows moved stock as in stock.

## Not built

- The client mockup (PNG) the plan puts first.
- Per-kind rights on menu 264.
