-- ═══════════════════════════════════════════════════════════════════════════
--  Qty-wise Prices (menu 244): every slab line holds its own scope  2026-11-06
--  Plan: Shared/Prathap/inventory/plan-qty-price-card-rate-one-form.md, with
--  addendum-1, -2 and -3 (D26: the "Applies to" / "When" panels under the
--  slab grid go, the line holds Company · Branch · Customer · Level and From
--  date · To date · Active · Incl tax; D27: the line keeps Each and What moves
--  it, "With saved card" and the read-only Level go). Follows
--  20261106160000_qty_price_layout_fixes. Seed data only: no table, column,
--  CHECK, function or trigger, no new id, no sequence.
--
--  ui_table 19 "ITEM QTY WISE PRICE", the slab grid. The line, in order:
--  Company · Branch · Customer · Level · Uom · From · To · Mode · Value · From
--  date · To date · Active · Incl tax · Each · What moves it.
--
--  1 · Shown, with widths (%) that add up to 100.00: Company 9.00, Branch
--      8.00, Customer 9.00, Level 6.00 (column 4, retitled from "Price
--      Level"), Uom 6.00, From Qty 5.50, To Qty 5.50, Mode 6.50, Value 6.50,
--      From Date 7.00, To Date 7.00, Active 3.50, Incl Tax 3.50, Each 6.50,
--      What moves it 10.50.
--
--  2 · Hidden, focus off, widths kept (a hidden column takes no room): Id (0),
--      Disc % · Disc Rs · Price (9-11, written from Value by the screen), Notes
--      (16), the five ids (17-21), the read-only Level (23: the level is now
--      picked in the line) and With saved card (25, the user: drop it).
--
--  3 · Focus (Enter stops): on for every column typed or picked in the line:
--      Company, Branch, Customer, Level, Uom, From, To, Mode, Value, From Date,
--      To Date, Active, Incl Tax. Off for the two read-only figures, Each and
--      What moves it. Next / previous column stay NULL, as on every live
--      table: NexTable reads the focus flag alone and walks the stops in
--      header order. Item Master - Price (ui_table 17) flags its line pickers
--      (Company, Branch, Uom, Godown) the same way; Active and Incl Tax are
--      flagged here as well because no panel is left to set them from.
--
--  4 · Headers: only column 4 is retitled. From Qty / To Qty keep their names
--      (the screen titles them "From" / "To" itself), and so do From Date /
--      To Date, which tell the two pairs apart on one line. Positions stay as
--      shipped (column number = position); they are written back so the order
--      holds whatever was dragged. Value (22) is placed after Mode by the
--      screen, as since 20261106160000.
--
--  The rows' values are set whatever they hold now (some were changed by hand
--  through the layout editor at 19:21 on dev). A row is matched by id, table
--  19, column number and "not deleted", and the table by its name. All 27 rows
--  must match, or nothing changes, so the shown widths always add up to 100.
--  On a fresh database the table is still empty here and the seed carries the
--  same rows. Re-runnable: a row that already holds the target is skipped, so
--  a second run changes nothing. No setval, no sync calls; the table's own
--  sync triggers mark the changed rows. prisma/seed/Ui_Table_Columns.sql
--  carries the same values.
-- ═══════════════════════════════════════════════════════════════════════════

WITH v(id, no, name, width, visible, focus, pos) AS (
        VALUES
        (395::bigint, 0::bigint, 'Id'::text, NULL::numeric, false::boolean, false::boolean, 0::integer),
        (396, 1, 'Company', 9.00, true, true, 1),
        (397, 2, 'Branch', 8.00, true, true, 2),
        (398, 3, 'Customer', 9.00, true, true, 3),
        (399, 4, 'Level', 6.00, true, true, 4),
        (400, 5, 'Uom', 6.00, true, true, 5),
        (401, 6, 'From Qty', 5.50, true, true, 6),
        (402, 7, 'To Qty', 5.50, true, true, 7),
        (403, 8, 'Mode', 6.50, true, true, 8),
        (404, 9, 'Disc %', NULL, false, false, 9),
        (405, 10, 'Disc Rs', NULL, false, false, 10),
        (406, 11, 'Price', NULL, false, false, 11),
        (407, 12, 'From Date', 7.00, true, true, 12),
        (408, 13, 'To Date', 7.00, true, true, 13),
        (409, 14, 'Active', 3.50, true, true, 14),
        (410, 15, 'Incl Tax', 3.50, true, true, 15),
        (411, 16, 'Notes', NULL, false, false, 16),
        (412, 17, 'company_id', NULL, false, false, 17),
        (413, 18, 'branch_id', NULL, false, false, 18),
        (414, 19, 'party_id', NULL, false, false, 19),
        (415, 20, 'price_level_id', NULL, false, false, 20),
        (416, 21, 'item_unit_id', NULL, false, false, 21),
        (417, 22, 'Value', 6.50, true, true, 22),
        (2392, 23, 'Level', NULL, false, false, 23),
        (2393, 24, 'Each', 6.50, true, false, 24),
        (2394, 25, 'With saved card', NULL, false, false, 25),
        (2395, 26, 'What moves it', 10.50, true, false, 26)
     ),
     present AS (
        SELECT count(*) = 27 AS all_rows
          FROM fixed.ui_table_columns c
          JOIN v ON v.id = c.ui_tbl_clm_id
         WHERE c.ui_tbl_clm_table_id = 19
           AND c.ui_tbl_clm_no = v.no
           AND c.ui_tbl_clm_is_deleted = false
           AND EXISTS (SELECT 1 FROM fixed.ui_tables t
                        WHERE t.ui_tbl_id = 19 AND t.ui_tbl_name = 'ITEM QTY WISE PRICE')
     )
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_name              = v.name,
       ui_tbl_clm_column_width      = COALESCE(v.width, c.ui_tbl_clm_column_width),
       ui_tbl_clm_column_visibility = v.visible,
       ui_tbl_clm_column_focus      = v.focus,
       ui_tbl_clm_column_position   = v.pos,
       ui_tbl_clm_modified_on       = now(),
       ui_tbl_clm_modified_by       = 'system'
  FROM v, present
 WHERE present.all_rows
   AND c.ui_tbl_clm_id = v.id
   AND c.ui_tbl_clm_table_id = 19
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND (c.ui_tbl_clm_name, c.ui_tbl_clm_column_width, c.ui_tbl_clm_column_visibility,
        c.ui_tbl_clm_column_focus, c.ui_tbl_clm_column_position)
       IS DISTINCT FROM
       (v.name, COALESCE(v.width, c.ui_tbl_clm_column_width), v.visible, v.focus, v.pos);
