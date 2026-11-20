-- Item master (menu 29), review 2026-11-20 "new finding": the Unit Conversion grid (ui_table 14) showed
-- raw ids in "#", "Unit#" and "Base#", the Barcodes grid (ui_table 15) in "ean_id" / "ean_unit_id".
-- Hide those id columns and spread the visible widths back to 100. Data only; the seed
-- (Ui_Table_Columns.sql) carries the same values. Re-runnable: only while an id column is still visible.
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_visibility = (v.vis),
       ui_tbl_clm_column_width      = v.w,
       ui_tbl_clm_modified_by       = 'system',
       ui_tbl_clm_modified_on       = now()
  FROM (VALUES (229, false, 4.14::numeric), (230, false, 10.62), (233, false, 9.98),
               (231, true, 10.04), (232, true, 11.46), (234, true, 15.13), (235, true, 14.85),
               (236, true, 9.34),  (237, true, 13.01), (238, true, 13.01), (239, true, 13.16),
               (240, false, 10),   (241, false, 9.98), (242, true, 42.02), (243, true, 57.98)) v(id, vis, w)
 WHERE c.ui_tbl_clm_id = v.id
   AND c.ui_tbl_clm_table_id IN (14, 15)
   AND EXISTS (SELECT 1 FROM fixed.ui_table_columns x
                WHERE x.ui_tbl_clm_id IN (229, 230, 233, 240, 241) AND x.ui_tbl_clm_column_visibility = true);
