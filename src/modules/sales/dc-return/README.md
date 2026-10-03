# DC returns — `/api/v1/dc-returns`

HANDOVER 2026-09-20 §5. Body prefix `sdr` / `sdri`. Goods back against a POSTED challan.

| route | what it does |
|---|---|
| `POST /create` | DRAFT upsert. `sdrDcId` + `sdrDcAccYear`; lines carry `sdriDcItemId`. The challan's refno, date and party are copied on. |
| `POST /post` | Stock IN (`DC_RETURN`, bucket by `sdriCondition`), COGS reversed on a `DCR` voucher under PERPETUAL, inward CHALLAN register row. `SALES_DCR_OVER_OPEN`, `SALES_DCR_DC_NOT_POSTED`. |
| `POST /cancel` | Reversal. |
| `POST /delete` | DRAFT only. |
| `GET /get` | `locks.editable.document` is false the moment it is POSTED — **there is no `/amend`**. |
| `GET /open-lines?sdcId&sdcAccYear` | What is still open on the challan. |
| `PUT /transport` | The band, direction INWARD, until the e-way bill. |
