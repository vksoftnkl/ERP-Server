# Sale returns — `/api/v1/sale-returns`

HANDOVER 2026-09-20 §6. Body prefix `sr` / `sri`. The IRN here is a CREDIT NOTE.

| route | what it does |
|---|---|
| `POST /create` | DRAFT upsert. `srIsAgainstBill` + `srBillId` / `srBillAccYear`; `srSettleMode` CASH · ADJUST · ADVANCE; CASH carries CR `tenders[]`. |
| `POST /validate` | Dry run. Warnings `SALES_RETURN_WINDOW`, `GST_CREDIT_NOTE_CUTOFF` (REFUSE when the statutory row says so). |
| `POST /post` | Stock IN (`SALE_RETURN`, bucket by condition), the bill's mirror legs on an `SRt` voucher, a CREDIT_NOTE register row (sign −1), a CR balance row (`SALES_RETURN`), settlement — CASH refunds through the tenders, ADJUST sets off against the original bill, ADVANCE leaves the credit open — loyalty claw-back on the returned share, promotion benefit reported (`srPromoClawbackAmt`), `sb_returned_amt` / `sb_return_status` on the bill. |
| `POST /cancel` | Reversal. `SALES_CN_APPLIED` once the credit has been used by another document. |
| `POST /amend` | Unwind + re-apply + re-post, `srRevisionNo + 1`. Refused after the credit-note IRN or the e-way bill. |
| `POST /delete` | DRAFT only. |
| `GET /get` | Adds `posting.settlement { refunded, adjusted, credited, adjustedBills[] }`, `loyaltyReversed`, `promoClawback`. |
| `GET /bill-lines?sbId&sbAccYear` | The bill's lines with what is already back. |
| `PUT /transport` | The band, direction INWARD. |

Refusals: `SALES_RETURN_OVER_QTY`, `SALES_RETURN_BILL_NOT_POSTED`, `SALES_RETURN_ITEM_NOT_ALLOWED`
(`item_allow_sales_return`), `SALES_FREE_RETURN_OFF` (`sales.free_return_allowed`).
