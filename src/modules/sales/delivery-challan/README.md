# Delivery challans — `/api/v1/delivery-challans`

HANDOVER 2026-09-20 §4. Body prefix `sdc` (header) / `sdi` (lines).

| route | what it does |
|---|---|
| `POST /create` | DRAFT upsert by `sdcId` presence. A POSTED id → 409 `SALES_DOC_POSTED`. Ship/transport goes through `transport` (the band). |
| `POST /validate` | Dry run: every refusal and warning, writes nothing. |
| `POST /post` | Stock OUT (`DC_ISSUE`) through the shadow stock voucher, COGS pair on a `DCh` voucher under PERPETUAL (none under PERIODIC), an e-way register row (never an IRN — Q8). Status last. |
| `POST /cancel` | Reversal, never a delete. Refused with `SALES_DC_BILLED` / `SALES_DC_RETURNED` once a line is billed or returned; past `EWAY_CANCEL_HOURS` with a live e-way bill. |
| `POST /amend` | Unwind + re-apply + re-post, `sdcRevisionNo + 1`. Refused after the e-way bill (`SALES_EWB_LIVE`). |
| `POST /delete` | DRAFT only. |
| `GET /get` | Header, items, charges, `transport`, `posting`, `locks` (with `editable.purpose`), `rights`. |
| `GET /open-for-bill` | `/bills/open-sources?kind=DC`. |
| `POST /convert-purpose` | POSTED only; refused after the e-way bill (`GST_DECLARED_LOCKED`) or once billed / returned. |
| `PUT /transport` | The band between POST and declaration. |

Refusals specific to a challan: `SALES_DC_PURPOSE_NOT_ALLOWED` (`comp_dc_purposes`),
`SALES_DC_REQUIRES_ORDER` (`sales.dc_requires_order`), `SALES_DC_LINE_OVER_ORDER`.

Fulfilment (`sdi_billed_qty`, `sdi_returned_qty`, `sdi_line_status`, `sdc_fulfil_status`) is
RE-DERIVED by `DcFulfilmentService` whenever a bill or a DC return posts or cancels.
