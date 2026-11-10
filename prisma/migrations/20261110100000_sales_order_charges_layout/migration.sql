-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order (Qt): the charges grid like Purchase's  2026-11-10
--  Plan: Shared/Prathap/sales/plan-sales-order-qt-2026-11-10.md, row 9
--  (answers 2026-11-10: "new ui_table 69 for SO only"). Seed data only: no
--  table, column, CHECK, function or trigger.
--
--  ui_table 69 "SALES ORDER - CHARGES" (editable, Desktop): the Sales Order's
--  tblCharges layout. ui_table 21 "CHARGES" stays as it is: the Sale Bill and
--  the Quotation read it and show Charge · Rate · Amount only.
--
--  The Sales Order keeps the shared ChargeGridController, so the column
--  NUMBERS are its ChargeCols enum, 0-32, exactly as in table 21 (NexTable
--  reads ui_tbl_clm_no as the logical column; a count other than 33 logs
--  "layout has N columns but the entity declares 33"). Only the titles,
--  widths, visibility and order differ. Seven columns are shown, in this
--  order (position 0-6):
--      1 Charge · 3 Basis (the Method code) · 27 Before/After tax ·
--      9 Rate · 10 Amount · 13 GST (the charge's own GST amount) · 22 Net
--  The other 26 are hidden, width 0, ranked after them by number (7-32), with
--  table 21's titles. Enter stops (column focus) on Charge, Rate and Amount,
--  as in tables 21 and 62.
--
--  Widths copy ui_table 62 "PURCHASE INVOICE - CHARGES" where the meaning is
--  the same: Charge 17.02, Basis 18.09, Rate 7.45, Amount 9.57, GST 7.45. Net
--  and Before/After tax take Amount's 9.57 (62's Net slot is "Into cost", and
--  its 7.45 two-value column would cut the longer heading). The seven are
--  scaled to add up to 100.00, ui_table 67's style, so no column is left to
--  take the spare width.
--
--  Ids are PINNED (table 69, columns 2396-2428) and the same rows are in
--  prisma/seed (Ui_Tables.sql, Ui_Table_Columns.sql). An id already taken by
--  something else stops the migration. Re-runnable: every statement is
--  guarded. No sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, ', ') INTO v_clash FROM (
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name) AS x
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 69
           AND t.ui_tbl_name IS DISTINCT FROM 'SALES ORDER - CHARGES'
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id BETWEEN 2396 AND 2428
           AND (c.ui_tbl_clm_table_id IS DISTINCT FROM 69
                OR c.ui_tbl_clm_no IS DISTINCT FROM c.ui_tbl_clm_id - 2396)) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Sales Order charges layout: ids already taken: %. Pick free ids here, in the seed files and in the Qt screen.', v_clash;
    END IF;
END $$;


-- ── 1 · ui_table 69 and its 33 columns ─────────────────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (69, 'SALES ORDER - CHARGES', true, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2396::bigint, 69::bigint, 0::bigint, '#'::text, 0::numeric, false::boolean, false::boolean, 7::integer),
        (2397, 69, 1, 'Charge', 21.62, true, true, 0),
        (2398, 69, 2, 'Ledger Name', 0, false, false, 8),
        (2399, 69, 3, 'Basis', 22.98, true, false, 1),
        (2400, 69, 4, 'Type', 0, false, false, 9),
        (2401, 69, 5, 'Apply On', 0, false, false, 10),
        (2402, 69, 6, 'Unit', 0, false, false, 11),
        (2403, 69, 7, 'QtyVal', 0, false, false, 12),
        (2404, 69, 8, 'Weight', 0, false, false, 13),
        (2405, 69, 9, 'Rate', 9.46, true, true, 3),
        (2406, 69, 10, 'Amount', 12.16, true, true, 4),
        (2407, 69, 11, 'Hsn', 0, false, false, 14),
        (2408, 69, 12, 'TaxPerc', 0, false, false, 15),
        (2409, 69, 13, 'GST', 9.46, true, false, 5),
        (2410, 69, 14, 'SgstPerc', 0, false, false, 16),
        (2411, 69, 15, 'SgstAmt', 0, false, false, 17),
        (2412, 69, 16, 'CgstPerc', 0, false, false, 18),
        (2413, 69, 17, 'CgstAmt', 0, false, false, 19),
        (2414, 69, 18, 'IgstPerc', 0, false, false, 20),
        (2415, 69, 19, 'IgstAmt', 0, false, false, 21),
        (2416, 69, 20, 'CessPerc', 0, false, false, 22),
        (2417, 69, 21, 'CessAmt', 0, false, false, 23),
        (2418, 69, 22, 'Net', 12.16, true, false, 6),
        (2419, 69, 23, 'Remarks', 0, false, false, 24),
        (2420, 69, 24, 'Role', 0, false, false, 25),
        (2421, 69, 25, 'LandingCost', 0, false, false, 26),
        (2422, 69, 26, 'CostAlloc', 0, false, false, 27),
        (2423, 69, 27, 'Before/After tax', 12.16, true, false, 2),
        (2424, 69, 28, 'SepPost', 0, false, false, 28),
        (2425, 69, 29, 'ChargeId', 0, false, false, 29),
        (2426, 69, 30, 'LedgerCode', 0, false, false, 30),
        (2427, 69, 31, 'TaxCode', 0, false, false, 31),
        (2428, 69, 32, 'TaxApl', 0, false, false, 32)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'SALES ORDER - CHARGES')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);
