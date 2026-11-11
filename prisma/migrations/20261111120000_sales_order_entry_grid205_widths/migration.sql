-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order entry (Qt, menu 11): pending panel column widths   2026-11-11
--  Plan: Shared/Prathap/sales/plan-sales-order-entry-changes-2026-11-10.md
--  (item 10, grid 205); mockup sales_order_entry_changes_ui_mockup.png.
--  Follows 20261110200000_sales_order_entry_grids_widgets (applied; not
--  edited). Config rows only: no table, column, index, CHECK, function or
--  trigger, so db_table_master and ensure_acc_year_partitions are not touched.
--
--  grid 205 "SO ENTRY - CUSTOMER PENDING LINES": at 1680 px the pending panel
--  cut off Ord #, Date, the Pending heading and the Status chip. The six shown
--  columns move to the mockup's proportions, with Pending at 13 so its heading
--  fits (measured on screen) and Status, the last column, taking the rest
--  (still adding up to 95.00):
--      Ord # (so_order_refno)  15 -> 16
--      Date  (so_order_date)   15 -> 17
--      Item  (item_name)       31 -> 23
--      Pending (pending_qty)   11 -> 13
--      Unit  (unit_name)        8 ->  8
--      Status (order_state)    15 -> 18
--  Matched by field name, not position. Titles, order, visibility and the nine
--  hidden columns are unchanged.
--
--  Only a width still at its shipped value moves: one set in Grid Master is
--  the site's and is left alone. Nothing runs when grid 205 is absent or has
--  another name. Re-running the file changes nothing.
--  prisma/seed/Sale_Order_Entry_Grids_204_205.sql carries the same widths.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_columns c
   SET grid_column_width       = v.new_width,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g,
       (VALUES ('so_order_refno', 15.00, 16.00),
               ('so_order_date',  15.00, 17.00),
               ('item_name',      31.00, 23.00),
               ('pending_qty',    11.00, 13.00),
               ('order_state',    15.00, 18.00)
       ) AS v(field, old_width, new_width)
 WHERE g.grid_id = 205
   AND g.grid_name = 'SO ENTRY - CUSTOMER PENDING LINES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = v.field
   AND c.grid_column_is_deleted = false
   AND c.grid_column_width = v.old_width;
