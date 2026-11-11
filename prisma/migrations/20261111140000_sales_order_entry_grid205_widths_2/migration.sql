-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order entry (Qt, menu 11): pending panel column widths, pass 2
--  2026-11-11
--  Plan: Shared/Prathap/sales/plan-sales-order-entry-changes-2026-11-10.md
--  (item 10, grid 205). Follows 20261111120000_sales_order_entry_grid205_widths
--  (applied; not edited). Config rows only: no table, column, index, CHECK,
--  function or trigger, so db_table_master and ensure_acc_year_partitions are
--  not touched.
--
--  grid 205 "SO ENTRY - CUSTOMER PENDING LINES": measured at 1680 px after the
--  first pass, the DELIVERY HOLD chip in Status needs about 136 px and got 119,
--  and the Unit heading was 2 px short. The user re-balanced the six shown
--  columns (still adding up to 95.00; a first try of Date 16 / Item 20 cut the
--  Date by 1 px, so Date keeps 17):
--      Ord # (so_order_refno)  16 -> 15
--      Date  (so_order_date)   17 -> 17   (unchanged, not listed below)
--      Item  (item_name)       23 -> 19
--      Pending (pending_qty)   13 -> 13   (unchanged, not listed below)
--      Unit  (unit_name)        8 ->  9
--      Status (order_state)    18 -> 22
--  Matched by field name, not position. Titles, order, visibility and the nine
--  hidden columns are unchanged.
--
--  Only a width still at the value 20261111120000 shipped (16 / 23 / 8 / 18)
--  moves: one set in Grid Master is the site's and is left alone. Nothing
--  runs when grid 205 is absent or has another name. Re-running the file
--  changes nothing.
--  prisma/seed/Sale_Order_Entry_Grids_204_205.sql carries the same widths.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_columns c
   SET grid_column_width       = v.new_width,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g,
       (VALUES ('so_order_refno', 16.00, 15.00),
               ('item_name',      23.00, 19.00),
               ('unit_name',       8.00,  9.00),
               ('order_state',    18.00, 22.00)
       ) AS v(field, old_width, new_width)
 WHERE g.grid_id = 205
   AND g.grid_name = 'SO ENTRY - CUSTOMER PENDING LINES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = v.field
   AND c.grid_column_is_deleted = false
   AND c.grid_column_width = v.old_width;
