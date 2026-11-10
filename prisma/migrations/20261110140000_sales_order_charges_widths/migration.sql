-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order (Qt): charges grid widths  2026-11-10
--  Follows 20261110100000_sales_order_charges_layout (applied; not edited).
--  Seed data only: no table, column, CHECK, function or trigger.
--
--  ui_table 69 "SALES ORDER - CHARGES": the seven shown columns added up to
--  100.00, which left no room for the "#" row gutter, so the grid scrolled
--  sideways and Net was cut off. Table 21 adds up to 95.29 for the same
--  reason. New widths, adding up to 95.00:
--      Charge (1) 20 · Basis (3) 15 · Before/After tax (27) 14 · Rate (9) 10 ·
--      Amount (10) 13 · GST (13) 10 · Net (22) 13
--  Titles, visibility, order, Enter stops and the 26 hidden columns are
--  unchanged.
--
--  prisma/seed/Ui_Table_Columns.sql carries the same widths. Re-runnable: a
--  row already at its width is not touched, and nothing runs when table 69 is
--  absent. No sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = v.width,
       ui_tbl_clm_modified_on  = now()
  FROM (VALUES
        (1::bigint, 20::numeric),
        (3, 15),
        (27, 14),
        (9, 10),
        (10, 13),
        (13, 10),
        (22, 13)
       ) v(no, width)
 WHERE c.ui_tbl_clm_table_id = 69
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_column_width IS DISTINCT FROM v.width
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t
                WHERE t.ui_tbl_id = 69 AND t.ui_tbl_name = 'SALES ORDER - CHARGES');
