-- ═══════════════════════════════════════════════════════════════════════════
--  Print Templates grid — column widths that fit                  2026-10-30
--
--  20261030150000_print_template_list_grid shipped visible widths adding to
--  119, so Used By and Active fell off the right edge of a 1400 px window.
--  The other main lists add to about 100. This brings them to 100.
--
--  Only a width still at its shipped value moves: one set in Grid Master (or
--  dragged on the list) is the user's and is left alone.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_columns c
   SET grid_column_width = v.new_width
  FROM fixed.grid_details g,
       (VALUES ('ptl_code',     14.00, 13.00),
               ('ptl_name',     20.00, 17.00),
               ('purpose_name', 15.00, 13.00),
               ('owner',        14.00, 12.00),
               ('published',    10.00,  8.00),
               ('engine',       10.00,  9.00),
               ('cloned_from',  14.00, 11.00),
               ('used_by',      16.00, 12.00),
               ('active',        6.00,  5.00)
       ) AS v(field, old_width, new_width)
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = v.field
   AND c.grid_column_width = v.old_width;
