-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase Entry (Purchase Invoice, menu 24): five line columns hidden by
--  default (user 2026-11-02, so the grid fits better)
--
--  ui_table 56 PURCHASE INVOICE - LINES, visibility only:
--       6 Recd     7 Dmg     8 Short     41 Cost incl.     47 HSN
--  Names, positions and widths stay as 20261102140000 left them; NexTable's
--  own layout can show them again. Re-runnable: a row already hidden is not
--  touched. prisma/seed/Ui_Table_Columns.sql carries the same rows.
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_visibility = false,
       ui_tbl_clm_modified_on = now()
 WHERE c.ui_tbl_clm_table_id = 56
   AND c.ui_tbl_clm_no IN (6, 7, 8, 41, 47)
   AND c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_column_visibility IS DISTINCT FROM false;
