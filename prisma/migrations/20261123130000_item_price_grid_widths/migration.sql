-- Item master (menu 29), 2026-11-23 (user "do 5", parked since the 11-21 Margin column): the
-- price grid (ui_table 17) sizes its columns as a percentage of the grid's width, and Uom through
-- the second level's Price came to about 116 %, so the RET (second level) band always started
-- off the right edge. Narrower widths: Uom .. the second level's Price = 92 %, inside the ~95 %
-- the grid has beside its row numbers; MRP and the rest still scroll. Tried on the card at
-- 1268 px: every figure reads in full (Margin "90.182 %", Wot "101.8519").
-- Layout data only; Ui_Table_Columns.sql carries the same widths. Re-runnable.
UPDATE fixed.ui_table_columns AS c
   SET ui_tbl_clm_column_width = v.width,
       ui_tbl_clm_modified_by  = 'system',
       ui_tbl_clm_modified_on  = now()
  FROM (VALUES (7, 8.5), (9, 8.0), (10, 5.5), (11, 7.5), (12, 8.0),
               (13, 7.5), (36, 7.5), (14, 8.0), (15, 7.5),
               (16, 7.5), (37, 7.5), (17, 8.0), (18, 7.5),
               (19, 7.5), (38, 7.5), (20, 8.0), (21, 7.5),
               (22, 7.5), (39, 7.5), (23, 8.0), (24, 7.5)) AS v(no, width)
 WHERE c.ui_tbl_clm_table_id = 17
   AND c.ui_tbl_clm_no = v.no
   AND NOT c.ui_tbl_clm_is_deleted;
