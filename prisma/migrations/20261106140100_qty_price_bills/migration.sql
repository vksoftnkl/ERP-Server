-- ═══════════════════════════════════════════════════════════════════════════
--  Qty-wise Prices: the bills apply the slabs, phase B1               2026-11-06
--  Plan: Shared/Prathap/inventory/plan-qty-price-card-rate-one-form.md §3 B1
--  items 5 and 6, with addendum-1 (Q2: the setting defaults to On; Q7 = A: the
--  line remembers its slab) and addendum-2 (no React; the DB part is
--  unchanged). Follows 20261106140000_qty_price_card_rate_form.
--
--  1 · public.app_setting_def sales.apply_qty_prices (SALES / Pricing, BOOL,
--      default true, COMPANY scope). Read by the price lookup
--      (GET /master-lookups/item-price): off, it returns no qty_slabs, so no
--      document applies a slab; the slabs themselves are kept. A setting is a
--      row, so this is an INSERT and nothing else.
--
--  2 · One nullable uuid per sale line table: the qty-wise price
--      (inventory.item_qty_price.iqp_id) that priced the line, so a reopened
--      document still shows which slab applied.
--        sales.sale_bill_item       sbi_qty_price_id
--        sales.sale_quotation_item  sqi_qty_price_id
--        sales.sale_order_item      soi_qty_price_id
--        sales.sale_dc_item         sdi_qty_price_id
--      Added to the PARTITIONED parents: the column cascades to every
--      _YYYY_YYYY partition, and ensure_acc_year_partitions creates later
--      years as PARTITION OF the parent, so they carry it too. Nullable, no
--      default: a catalogue-only change, no rewrite, no backfill (every
--      existing line was priced without a slab, and NULL says exactly that).
--      NO foreign key and NO index, on purpose: branches post offline, and a
--      bill can reach the cloud before the slab row it names. The column is
--      informational, read only with its own line.
--
--  No new table, so no db_table_master row and no partition-helper change.
--  Re-runnable: every statement is guarded. No sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the company switch ─────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES
('sales.apply_qty_prices', 'SALES', 'Pricing', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Apply qty-wise prices',
 'On, a sale bill, quotation, sale order or delivery challan line takes the item''s qty-wise price (menu 244) when its quantity reaches a slab. Off, slabs are kept but no document applies them.',
 60, false, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 2 · the line remembers its slab ────────────────────────────────────────
ALTER TABLE sales.sale_bill_item
    ADD COLUMN IF NOT EXISTS sbi_qty_price_id uuid NULL;
ALTER TABLE sales.sale_quotation_item
    ADD COLUMN IF NOT EXISTS sqi_qty_price_id uuid NULL;
ALTER TABLE sales.sale_order_item
    ADD COLUMN IF NOT EXISTS soi_qty_price_id uuid NULL;
ALTER TABLE sales.sale_dc_item
    ADD COLUMN IF NOT EXISTS sdi_qty_price_id uuid NULL;
