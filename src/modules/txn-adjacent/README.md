# txn-adjacent — `GET /api/v1/txn/adjacent` (notes 142)

Previous / Next (Ctrl+PgUp / Ctrl+PgDn) for every transaction screen, from one
route. It returns the neighbouring document's KEY, and the screen loads it with
its own `/get`.

## Request

| param | required | meaning |
|---|---|---|
| `docType` | yes | a key of the registry below |
| `companyId`, `branchId`, `accYear` | yes | the scope; `accYear` is the partition |
| `docId` | no | the document on screen; omit on an empty screen (prev → newest, next → oldest) |
| `direction` | yes | `prev` (older) / `next` (newer) |
| `typeCode` | no | walk one type: see the Type column |
| `status`, `fromDate`, `toDate` | no | the list's own filters; `status` must be one of the docType's statuses |

`data = { docType, direction, fromDocId, doc }`, and
`doc = { docId, companyId, branchId, accYear, typeCode, refno, date, status }`,
or `null` at either end. `refno` is null on a draft that has no number yet.

## Registry (`txn-adjacent.registry.ts`)

| docType | table | rows walked | Type (`typeCode`) | menu (VIEW) | serial in the key (notes 152) |
|---|---|---|---|---|---|
| `OPENING_STOCK` | stock.stock_voucher | `svh_voucher_type` OPENING | svh_voucher_type | 44 | none: `svh_slno` is per device |
| `STOCK_ADJUSTMENT` | stock.stock_voucher | ADJUSTMENT, ISSUE, DAMAGE, EXPIRY_WRITEOFF; never a sale bill's stock movement (`svh_link_src_module` STOCK or null, as grid 122) | svh_voucher_type, one of the four | 264 | none: per device |
| `PHYSICAL_STOCK` | stock.stock_voucher | PHYSICAL | svh_voucher_type | 45 | none: per device |
| `STOCK_TRANSFER` | stock.stock_voucher | TRANSFER_OUT | svh_voucher_type | 41 | none: per device |
| `STOCK_TRANSFER_RECEIPT` | stock.stock_voucher | TRANSFER_IN | svh_voucher_type | 41 | none: per device |
| `SALE_BILL` | sales.sale_bill | all | sb_doc_type | 12 | none: a POS bill numbers on the device's series (`posSeriesPerDevice`), a wholesale bill on the branch's |
| `QUOTATION` | sales.sale_quotation | all | sq_doc_type | 14 | `sq_quote_slno` (branch MAIN series) |
| `SALE_ORDER` | sales.sale_order | all | so_doc_type | 11 | `so_order_slno` (branch MAIN series) |
| `DELIVERY_CHALLAN` | sales.sale_dc | all | sdc_doc_type | 182 | `sdc_dc_slno` (branch MAIN series) |
| `DC_RETURN` | sales.sale_dc_return | all | sdr_doc_type | 182 | `sdr_return_slno` (branch MAIN series) |
| `SALE_RETURN` | sales.sale_return | all | sr_doc_type | 13 | `sr_return_slno` (branch MAIN series) |
| `RECEIPT` | accounts.acc_voucher_header | type `Rct`, no PDC child / reversal | vchr_type_code | 99 | `avh_voucher_slno` (company-wide); a draft at the new end (as /receipts/adjacent) |
| `PAYMENT` | accounts.acc_voucher_header | type `Pmt`, no PDC child / reversal | vchr_type_code | 100 | `avh_voucher_slno`; a draft at the new end (as /payments/adjacent) |
| `VOUCHER` | accounts.acc_voucher_header | `vchr_in_register` types | vchr_type_code (Jrl, Con, RcpV …) | each type's own menu, row by row | `avh_voucher_slno`; a draft at the old end (as /vouchers/adjacent) |

## Rules

- Walk order `(date, serial, created_on, id)`, or `(date, created_on, id)` where
  the registry keeps no serial: `<` + DESC for prev, `>` + ASC for next.
- **Which serial goes in (notes 152).** Only one counted branch-wide (or
  company-wide), as its list draws it. A serial counted **per device** — every
  stock voucher's `svh_slno` (`ux_svh_slno` scopes it by `svh_device_id`), a
  POS bill's `sb_bill_slno` — cannot order a date's documents: two PCs on one
  branch each count 1, 2, 3 …, so their documents interleave by each PC's own
  counter and Ctrl+PgDn from the user's newest entry (OPN0023, slno 5 on their
  PC) landed on another PC's OPN0015 (slno 15). `created_on` follows the
  branch refno, since both are given at the first save: live, OPN0023 → next
  OPN0024, OPN0022 → prev OPN0021. Adding the device to the key would not
  help; a per-device serial has no cross-device order at all.
- The doc on screen is looked up under all four keys and must be one of the
  docType's own rows; a miss is a 404 `TXN_DOC_NOT_FOUND`.
- Not deleted; cancelled documents are stops.
- No `um_can_view` on the menu → 403 `TXN_RIGHT_VIEW`. VOUCHER without
  `typeCode` filters rows by their type's menu instead, exactly as
  `/vouchers/adjacent` does.
- A `typeCode` / `status` the docType does not have → 400
  `TXN_TYPE_NOT_IN_DOC` / `TXN_STATUS_NOT_IN_DOC`.
- No identifier ever comes from the request: the registry is the whole list of
  tables and columns the SQL can name (`txn-adjacent.registry.spec.ts` checks it).
- Not cached (`@CacheTTL(0)`): the HTTP cache key does not carry the user.

`/vouchers/adjacent`, `/receipts/adjacent` and `/payments/adjacent` are unchanged.
