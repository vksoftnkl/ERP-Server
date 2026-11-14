# Sale returns — `/api/v1/sale-returns`

HANDOVER 2026-09-20 §6, reworked for the Qt screen by plan v5 (`Shared/Prathap/sales/plan-sale-return-qt-2026-11-13-v5.md`)
phase **P2a** (2026-11-13). Body prefix `sr` / `sri`. The IRN here is a CREDIT NOTE. Every route checks menu 13.

| route | right | what it does |
|---|---|---|
| `POST /create` | CREATE (new) / EDIT (draft) | DRAFT upsert. **Money keys are ignored** (D45): the server works every line out from its bill line and writes the charge rows itself. Lines send qty, unit, condition, godown, notes, `sriBillItemId` (and on a no-bill line `sriRateSrcItemId`). `charges[]` = `{ cdSrcCdId, cdSrcAccYear, giveBack, cdAmount (manual only) }`. Numbered per device at the first save: `SRT/<year>/<device code>/00001` (D16). A re-save without `items` / `charges` keeps the stored ones. |
| `POST /validate` | CREATE | Dry run: `ok`, `refusals[]`, `warnings[]` (WARN + INFO), `rights`, `preview` (lines, totals, charges, emptiesBill, onOtherDrafts, stockByBucket; the P2b blocks are null / []). A `srReturnAmt` the server no longer agrees with → `SALES_AMOUNT_MISMATCH`. |
| `POST /post` | POST | Locks every line + charge row of the bill (id order, D51), works the money out again, refuses a stale draft (`SALES_AMOUNT_MISMATCH`), writes it back, then: stock IN at the bill line's own COGS per base unit (D54; today's average when none, D69), the `SRt` voucher (charges signed, with their own GST — gap 36; the refno is the return's, the serial the company's), the CREDIT_NOTE register row (gap 50 rule), the CR balance row, the settlement (Decimal, `ck_sr_settle_sum` exact). |
| `POST /cancel` | CANCEL | Reversal. `SALES_CN_APPLIED` once the credit has been used by another document. |
| `POST /amend` | AMEND | Unwind (the register row is RETIRED so the re-post can file the note again) + re-save with the money worked out again + re-post, `srRevisionNo + 1`. |
| `POST /delete` | DELETE | DRAFT only. |
| `GET /get` | VIEW | The return; `charges[]` carry `cdSrcCdId`, `cdSrcAccYear`, `cdCarryBasis` (PRORATA · MANUAL · NONE = unticked) and `giveBack`. |
| `GET /bill-lines?sbId&sbAccYear&companyId&branchId[&allBranches][&srId]` | VIEW | `{ bill, lines[], charges[] }`: every line with its full money set, base qty billed / returned / left, what other drafts hold. |
| `PUT /transport` | EDIT | The band, direction INWARD. |

Files: `sale-return-money.ts` (the pure Decimal mirror), `sale-return-bill-reader.ts` (every read), `sale-return-preview.ts`
(assembly + the shapes the screen reads), `sale-return-register.ts`, `sale-return-numbering.ts`.

Refusals: `SALES_RETURN_OVER_QTY` (base units), `SALES_RETURN_NOT_ON_BILL`, `SALES_RETURN_UNIT`, `SALES_RETURN_NO_LINES`,
`SALES_RETURN_NO_BILL_OFF`, `SALES_RETURN_SETTLE_MODE`, `SALES_RETURN_BILL_NOT_POSTED`, `SALES_RETURN_ITEM_NOT_ALLOWED`,
`SALES_CHARGE_OVER_CARRY`, `SALES_AMOUNT_MISMATCH`, `SALES_CUSTOMER_REQUIRED`. Warnings: `SALES_RETURN_WINDOW`,
`GST_CREDIT_NOTE_CUTOFF`, `SALES_RETURN_LOT_EXPIRED`; INFO: `SALES_RETURN_ON_DRAFTS`, `SALES_RETURN_NEVER_SOLD`.
A scheme's free item always comes back (D6): `SALES_FREE_RETURN_OFF` is no longer thrown.

Review round 2026-11-14: a 0.00 return posts stock + COGS only (no register row, no balance row, no settlement; no
voucher at all when no leg is left); a negative one is refused `SALES_RETURN_NEGATIVE`. A saved return keeps its
customer (`SALES_RETURN_CUSTOMER_LOCKED`). Adjust never sets off a bill of a closed year (`SALES_YEAR_LOCKED`,
field `adjustments`; and /cancel / /amend refuse with it, field `adjustedBills`, when the note set off such a bill). /amend checks `srReturnAmt` (`SALES_AMOUNT_MISMATCH`), withdraws a POSTED return's pending
review (D77 freezes drafts only), and drops refund rows when the mode is not CASH, as /post does.
