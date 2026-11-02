-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase Entry (Purchase Invoice, menu 24) line columns (2026-11-02)
--
--  1. purchase.pur_invoice_item.pii_min_price numeric(15,2), nullable: the
--     MSP typed on a line (a draft keeps it until Post, which writes it to
--     inventory.item_price_master.ipm_min_price under the same price policy
--     as Sell A-D). Same type as pii_sell_a..d / pii_mrp. Physically last
--     (Postgres appends), so the fragment declares it last too.
--  2. pii_hsn_code varchar(8) -> varchar(10), as inventory.item_master.
--     item_hsn_code (the service copies it). A length increase is binary
--     coercible: no rewrite, no index on it, no view depends on it.
--     pur_invoice_item is LIST-partitioned by pii_acc_year: ADD COLUMN and
--     ALTER COLUMN TYPE on the parent reach every partition (2024-2025 ..
--     2027-2028); a partition created later (PARTITION OF) inherits both.
--  3. ui_table 56 PURCHASE INVOICE - LINES: + 45..53 at the Qt enum numbers
--     (PurchaseInvoiceCols, appended after Itc = 44; nothing renumbered):
--        45 DiscAmt "Disc"            49 MarkupB "Markup B"
--        46 SchAmt "Sch"              50 MarkupC "Markup C"
--        47 Hsn "HSN"                 51 MarkupD "Markup D"
--        48 Msp "MSP"                 52 ChrgBeforeTax "Chrg before tax"
--                                     53 ChrgAfterTax "Chrg after tax"
--     11 is retitled "Disc %" (45 is now "Disc"); 39 stays "Sch %".
--     The per-user "More columns" chooser goes away (user 2026-11-02): the
--     layout alone shows a column, so the chooser's Sch % (39), Extra disc
--     (40), Cost incl. (41) and Sell B-D (34-36) turn visible. Sell B-D and
--     Markup B-D are switched by the price policy, so they are visible here
--     and the screen hides them (the rule of 20261029140000). PO / GRN ref
--     (24) stays hidden ("the rest"); the technical columns stay hidden.
--     Positions re-ranked to the user's order:
--       Barcode Item HSN Unit [Model Size Colour] Batch Expiry Billed Recd
--       Dmg Short Free Rate | Disc % Disc Sch % Sch Extra disc | Chrg before
--       tax | Taxable GST% ITC Tax | Chrg after tax | Total | Cost w/o Cost
--       incl. | MRP MSP | Markup A Sell A Markup B Sell B Markup C Sell C
--       Markup D Sell D | Check | PO / GRN ref, then the hidden ones.
--     Widths: existing rows keep theirs (a width someone saved stays); new
--     rows on the same scale (the screen's ColumnWeights over 132 units).
--  4. ui_table 57 PURCHASE ORDER - LINES: + 23..27 ChrgBeforeTax,
--     ChrgAfterTax, LandedCost, LandedCostIncl, LineTotal (hidden), as
--     PurchaseOrderCols. 17..22 are already registered (20261029140000).
--     Positions re-ranked to PurchaseOrderEntry::applyColumns: ... MRP, Chrg
--     before tax, Tax, Chrg after tax, Amount, Landing cost, Landing cost
--     incl. GST, Received ... Status, then the hidden ones. New widths on the
--     table's existing scale (1190 units).
--
--  No per-user layout rows exist: fixed.ui_table_columns is one shared layout
--  per table (NexTable "Save Width" and the layout dialog write these rows).
--  Updates touch only name / visibility / position, and only rows that
--  differ; inserts skip a number that is already live; ids are pinned
--  (2297-2310) and prisma/seed/Ui_Table_Columns.sql carries the same rows.
--  Tables 56 / 57 were registered through the API, so on a fresh database
--  every row here no-ops (guarded on its parent) and the seed lays them out.
--  Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no), ', ')
      INTO v_clash
      FROM fixed.ui_table_columns c
      JOIN (VALUES
            (2297::bigint, 56::bigint, 45::bigint),
            (2298, 56, 46),
            (2299, 56, 47),
            (2300, 56, 48),
            (2301, 56, 49),
            (2302, 56, 50),
            (2303, 56, 51),
            (2304, 56, 52),
            (2305, 56, 53),
            (2306, 57, 23),
            (2307, 57, 24),
            (2308, 57, 25),
            (2309, 57, 26),
            (2310, 57, 27)
           ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
     WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no);
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Purchase entry columns: ids already taken: %. Pick free ids here and in the seed file.', v_clash;
    END IF;
END $$;


-- ── 1 · pur_invoice_item: the line's MSP ──────────────────────────────────
ALTER TABLE purchase.pur_invoice_item ADD COLUMN IF NOT EXISTS pii_min_price numeric(15,2);


-- ── 2 · pur_invoice_item: HSN as wide as the item master's ────────────────
ALTER TABLE purchase.pur_invoice_item ALTER COLUMN pii_hsn_code TYPE character varying(10);


-- ── 3 · registered columns: titles, visibility, positions ─────────────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_name              = v.name,
       ui_tbl_clm_column_visibility = v.visible,
       ui_tbl_clm_column_position   = v.pos,
       ui_tbl_clm_modified_on       = now()
  FROM (VALUES
        (56::bigint, 0::bigint, 'Barcode'::text, true::boolean, 0::integer),
        (56, 1, 'Item', true, 1),
        (56, 2, 'Unit', true, 3),
        (56, 3, 'Batch / Serial', true, 7),
        (56, 4, 'Expiry', true, 8),
        (56, 5, 'Billed', true, 9),
        (56, 6, 'Recd', true, 10),
        (56, 7, 'Dmg', true, 11),
        (56, 8, 'Short', true, 12),
        (56, 9, 'Free', true, 13),
        (56, 10, 'Rate', true, 14),
        (56, 11, 'Disc %', true, 15),
        (56, 12, 'Taxable', true, 21),
        (56, 13, 'GST%', true, 22),
        (56, 14, 'Tax', true, 24),
        (56, 15, 'Total', true, 26),
        (56, 16, 'Cost w/o', true, 27),
        (56, 17, 'MRP', true, 29),
        (56, 18, 'Check', true, 39),
        (56, 19, 'ItemId', false, 41),
        (56, 20, 'UomId', false, 42),
        (56, 21, 'Factor', false, 43),
        (56, 22, 'Signature', false, 44),
        (56, 23, 'LineId', false, 45),
        (56, 24, 'PO / GRN ref', false, 40),
        (56, 25, 'GrnItemId', false, 46),
        (56, 26, 'GrnYear', false, 47),
        (56, 27, 'Allocs', false, 48),
        (56, 28, 'Size', true, 5),
        (56, 29, 'SizeId', false, 49),
        (56, 30, 'Colour', true, 6),
        (56, 31, 'ColourId', false, 50),
        (56, 32, 'Model / design', true, 4),
        (56, 33, 'Sell A', true, 32),
        (56, 34, 'Sell B', true, 34),
        (56, 35, 'Sell C', true, 36),
        (56, 36, 'Sell D', true, 38),
        (56, 37, 'PoItemId', false, 51),
        (56, 38, 'PoYear', false, 52),
        (56, 39, 'Sch %', true, 17),
        (56, 40, 'Extra disc', true, 19),
        (56, 41, 'Cost incl.', true, 28),
        (56, 42, 'CostTyped', false, 53),
        (56, 43, 'Markup A', true, 31),
        (56, 44, 'ITC', true, 23),
        (57, 0, 'Barcode', true, 0),
        (57, 1, 'Item', true, 1),
        (57, 2, 'Unit', true, 2),
        (57, 3, 'Ordered', true, 3),
        (57, 4, 'Free', true, 4),
        (57, 5, 'Rate', true, 5),
        (57, 6, 'Disc%', true, 6),
        (57, 7, 'Taxable', false, 23),
        (57, 8, 'GST%', true, 8),
        (57, 9, 'Tax', true, 11),
        (57, 10, 'Amount', true, 13),
        (57, 11, 'Received', true, 16),
        (57, 12, 'Pending', true, 18),
        (57, 13, 'MRP', true, 9),
        (57, 14, 'ItemId', false, 24),
        (57, 15, 'UomId', false, 25),
        (57, 16, 'LineId', false, 26),
        (57, 17, 'Sch%', true, 7),
        (57, 18, 'Short-closed', true, 17),
        (57, 19, 'Last rate', true, 19),
        (57, 20, 'Stock', true, 20),
        (57, 21, 'Reorder', true, 21),
        (57, 22, 'Status', true, 22)
       ) v(tbl, no, name, visible, pos)
 WHERE c.ui_tbl_clm_table_id = v.tbl
   AND c.ui_tbl_clm_no       = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND (c.ui_tbl_clm_name, c.ui_tbl_clm_column_visibility, c.ui_tbl_clm_column_position)
       IS DISTINCT FROM (v.name, v.visible, v.pos);


-- ── 4 · new columns, appended at their enum numbers ───────────────────────
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, false, v.pos, false, true, false,
       COALESCE((SELECT e.ui_tbl_clm_created_by FROM fixed.ui_table_columns e
                  WHERE e.ui_tbl_clm_table_id = v.tbl ORDER BY e.ui_tbl_clm_no, e.ui_tbl_clm_id LIMIT 1), 'system')
  FROM (VALUES
        (2297::bigint, 56::bigint, 45::bigint, 'Disc'::text, 3.79::numeric, true::boolean, 16::integer),
        (2298, 56, 46, 'Sch', 3.79, true, 18),
        (2299, 56, 47, 'HSN', 4.55, true, 2),
        (2300, 56, 48, 'MSP', 3.79, true, 30),
        (2301, 56, 49, 'Markup B', 3.79, true, 33),
        (2302, 56, 50, 'Markup C', 3.79, true, 35),
        (2303, 56, 51, 'Markup D', 3.79, true, 37),
        (2304, 56, 52, 'Chrg before tax', 4.55, true, 20),
        (2305, 56, 53, 'Chrg after tax', 4.55, true, 25),
        (2306, 57, 23, 'Chrg before tax', 6.39, true, 10),
        (2307, 57, 24, 'Chrg after tax', 5.88, true, 12),
        (2308, 57, 25, 'Landing cost', 5.55, true, 14),
        (2309, 57, 26, 'Landing cost incl. GST', 7.56, true, 15),
        (2310, 57, 27, 'LineTotal', 0, false, 27)
       ) v(id, tbl, no, name, width, visible, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl)
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;


-- ── 5 · keep the sequence ahead of the pinned ids ─────────────────────────
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);
