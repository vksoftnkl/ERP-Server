# Opening Stock API Plan (Voucher Header Id Based)

## Summary
- Add a new `opening-stock` NestJS module using `inventory.opening_stock_header` and `inventory.opening_stock_detail`.
- Public document identity is `accounts.acc_voucher_header.avh_voucher_id`.
- `osh_id` is internal linkage only and may be returned in responses.

## API Contract
- `POST /api/v1/opening-stocks`
  - Create when `header.avh_voucher_id` is absent.
  - Update when `header.avh_voucher_id` is present.
- `GET /api/v1/opening-stocks`
  - List documents.
  - Fetch one document when `avh_voucher_id` query param is present.
- `GET /api/v1/opening-stocks/get?avh_voucher_id=...`
- `GET /api/v1/opening-stocks/list`
- `DELETE /api/v1/opening-stocks?avh_voucher_id=...`
- `DELETE /api/v1/opening-stocks/delete?avh_voucher_id=...`

## Request Shape
- Top-level `header`
- Top-level `details`

### Header fields
- Required:
  - `osh_acc_year`
  - `osh_company_id`
  - `osh_branch_id`
  - `avh_voucher_type_id`
  - `avh_voucher_date`
  - `avh_bill_refno`
  - `avh_party_id`
  - `avh_device_type`
  - `avh_counter_id`
- Optional:
  - `avh_voucher_id`
  - `osh_status`
  - `osh_ref_no`
  - `osh_narration`
  - `avh_user_refno`
  - `avh_bill_date`
  - `avh_opposite_ledger_id`
  - `avh_employee_id`
  - `avh_session_id`
  - `avh_device_id`
  - `avh_pay_notes`
  - `avh_remarks`
  - `avh_user_id`
  - `osh_user_id`

### Detail fields
- Persisted fields:
  - `osl_barcode`
  - `osl_item_id`
  - `osl_unit_id`
  - `osl_base_uom_id`
  - `osl_godown_id`
  - `osl_tracking_type`
  - `osl_tax_id`
  - `osl_tax_perc`
  - `osl_cess_type`
  - `osl_cess_perc`
  - `osl_cess_per_unit`
  - `osl_qty`
  - `osl_free_qty`
  - `osl_base_qty`
  - `osl_conv_factor`
  - `osl_batch_no`
  - `osl_serial_no`
  - `osl_batch_date`
  - `osl_mfg_date`
  - `osl_expiry_date`
  - `osl_cost_rate`
  - `osl_cost_rate_wot`
  - `osl_sale_rate_a_wot`
  - `osl_markup_perc_a`
  - `osl_sale_rate_a`
  - `osl_sale_rate_b_wot`
  - `osl_markup_perc_b`
  - `osl_sale_rate_b`
  - `osl_sale_rate_c_wot`
  - `osl_markup_perc_c`
  - `osl_sale_rate_c`
  - `osl_sale_rate_d_wot`
  - `osl_markup_perc_d`
  - `osl_sale_rate_d`
  - `osl_mrp_rate`
  - `osl_min_rate`
  - `osl_remarks`
- Frontend compatibility fields accepted but not persisted:
  - `item_code`
  - `item_name`
  - `godown_name`
  - `uom_name`
  - `tax_name`
  - `profit_type`
  - `round_off`

## Transaction Flow
- Create:
  - validate payload
  - create voucher header through `account-voucher-header.helper.ts`
  - insert `opening_stock_header` from returned voucher metadata
  - insert `opening_stock_detail` rows using `osh_id` and `avh_voucher_id`
  - calculate `osh_total_lines`, `osh_total_qty`, `osh_total_value`
- Update:
  - require `avh_voucher_id`
  - load active opening stock document by `osh_voucher_id`
  - update voucher header through helper
  - update `opening_stock_header`
  - replace existing detail rows for that voucher id
  - recreate detail rows under the same `osh_id`
- Delete:
  - require `avh_voucher_id`
  - soft delete voucher header through helper
  - soft delete `opening_stock_header`
  - soft delete `opening_stock_detail` rows by `osl_voucher_id`
- Get by id:
  - fetch header by `osh_voucher_id`
  - fetch active detail rows by `osl_voucher_id`
  - enrich response with item code/name, unit name, godown name, and tax name

## Notes
- Update, delete, and get-by-id never accept `osh_id`.
- Detail replacement on update is full replace, not row merge.
- Stock ledger posting and stock balance posting are out of scope for this API version.
