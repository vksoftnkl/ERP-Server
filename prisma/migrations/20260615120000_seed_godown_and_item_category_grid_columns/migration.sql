-- Seed configured grid columns for godown master (grid 9) and item category master (grid 11).
--
-- 20260529120000_restore_deleted_grids_9_and_11 un-deleted the grid_details rows for these
-- two grids, but every fixed.grid_columns row for them stayed soft-deleted. As a result
-- GET /configured-grid-sql/columns?grid_id=9|11 returns [] (loadGridColumns filters
-- grid_column_is_deleted = false), so the godown master and item category master pages render
-- only fallback columns and — because the client gates its right-click grid-settings menu
-- (grid filter setting / column visible setting / save column width / admin settings) on having
-- configured columns — those two pages were the only master pages missing that context menu.
--
-- This seeds a clean, well-defined column set whose grid_column_sql_field_name values bind to
-- each grid's base SQL. Idempotent: only seeds when the grid has no live (non-deleted) columns,
-- and clears the leftover soft-deleted rows first so the grid starts from a clean slate.
--
-- Guarded on the parent fixed.grid_details row existing: grids 9 and 11 are seeded outside of
-- migrations (the master grids were created in grid.grid_details by 20260228113000 and dropped by
-- the 20260318132503 schema move, so they never exist on a freshly replayed database). Without the
-- guard the grid_columns insert would violate grid_columns_grid_id_fkey on the shadow database. When
-- the grid is absent this migration is simply a no-op.

DO $$
BEGIN
  -- Godown master (grid 9): SELECT gdl_id, gdl_name, gdl_code, gdl_short, ... gdl_is_active.
  IF EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 9)
     AND NOT EXISTS (
       SELECT 1 FROM fixed.grid_columns
       WHERE grid_id = 9 AND grid_column_is_deleted = false
     ) THEN
    DELETE FROM fixed.grid_columns WHERE grid_id = 9;
    INSERT INTO fixed.grid_columns
      (grid_id, grid_column_number, grid_column_name, grid_column_width, grid_column_alignment,
       grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
       grid_column_data_type, grid_column_is_deleted, grid_column_sql_field_name, grid_column_id)
    VALUES
      (9, 1, 'Location Name', 32.00, 'Left',   true, true,  false, false, 'Text',    false, 'gdl_name',      uuidv7()),
      (9, 2, 'Location Code', 20.00, 'Left',   true, true,  false, false, 'Text',    false, 'gdl_code',      uuidv7()),
      (9, 3, 'Short Name',    20.00, 'Left',   true, true,  false, false, 'Text',    false, 'gdl_short',     uuidv7()),
      (9, 4, 'Status',        14.00, 'Center', true, false, false, false, 'Boolean', false, 'gdl_is_active', uuidv7());
  END IF;

  -- Item category master (grid 11): SELECT category_id, category_name, category_alias,
  -- category_short, ... category_is_active.
  IF EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 11)
     AND NOT EXISTS (
       SELECT 1 FROM fixed.grid_columns
       WHERE grid_id = 11 AND grid_column_is_deleted = false
     ) THEN
    DELETE FROM fixed.grid_columns WHERE grid_id = 11;
    INSERT INTO fixed.grid_columns
      (grid_id, grid_column_number, grid_column_name, grid_column_width, grid_column_alignment,
       grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
       grid_column_data_type, grid_column_is_deleted, grid_column_sql_field_name, grid_column_id)
    VALUES
      (11, 1, 'Category Name', 32.00, 'Left',   true, true,  false, false, 'Text',    false, 'category_name',      uuidv7()),
      (11, 2, 'Alias',         20.00, 'Left',   true, true,  false, false, 'Text',    false, 'category_alias',     uuidv7()),
      (11, 3, 'Short Name',    20.00, 'Left',   true, true,  false, false, 'Text',    false, 'category_short',     uuidv7()),
      (11, 4, 'Status',        14.00, 'Center', true, false, false, false, 'Boolean', false, 'category_is_active', uuidv7());
  END IF;
END $$;
