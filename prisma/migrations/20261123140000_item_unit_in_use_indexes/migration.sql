-- Item master (menu 29), 2026-11-23 (user: "do all recommended"): the item card's "unit in use"
-- check (src/modules/Inventory/utils/item-unit-in-use.helper.ts, unitRowsInUse) looks for an item's
-- unit rows in 16 document / stock tables by their unit column. 4 of those columns had an index;
-- these are the other 12, so the check stays an index lookup at production size.
-- Plain btree on the unit column (the check reads any row, deleted or not, so not partial).
-- Most tables are partitioned: an index on the parent builds on every partition and is
-- inherited by the partitions made later. DB-only, as the house keeps FK-covering indexes on
-- partitioned tables (each fragment says so). Builds once, at deploy; re-runnable.
CREATE INDEX IF NOT EXISTS ix_sml_uom        ON stock.stock_ledger                (sml_uom_id);
CREATE INDEX IF NOT EXISTS ix_svi_uom        ON stock.stock_voucher_item          (svi_uom_id);
CREATE INDEX IF NOT EXISTS ix_sbi_item_unit  ON sales.sale_bill_item              (sbi_item_unit_id);
CREATE INDEX IF NOT EXISTS ix_soi_item_unit  ON sales.sale_order_item             (soi_item_unit_id);
CREATE INDEX IF NOT EXISTS ix_sqi_item_unit  ON sales.sale_quotation_item         (sqi_item_unit_id);
CREATE INDEX IF NOT EXISTS ix_sdni_item_unit ON sales.sale_delivery_note_item     (sdni_item_unit_id);
CREATE INDEX IF NOT EXISTS ix_poi_uom        ON purchase.pur_order_item           (poi_uom_id);
CREATE INDEX IF NOT EXISTS ix_gri_uom        ON purchase.pur_grn_item             (gri_uom_id);
CREATE INDEX IF NOT EXISTS ix_pii_uom        ON purchase.pur_invoice_item         (pii_uom_id);
CREATE INDEX IF NOT EXISTS ix_psri_uom       ON purchase.pur_shortage_receipt_item (psri_uom_id);
CREATE INDEX IF NOT EXISTS ix_pri_uom        ON purchase.pur_return_item          (pri_uom_id);
CREATE INDEX IF NOT EXISTS ix_vtx_unit       ON accounts.acc_voucher_doc_detail   (vtx_unit_id);
