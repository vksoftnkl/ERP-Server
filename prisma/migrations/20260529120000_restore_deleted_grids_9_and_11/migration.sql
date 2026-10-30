-- Restore soft-deleted grids that are referenced by the client with hardcoded IDs.
-- Grid 9 (godown master) was soft-deleted and had broken SQL (trailing comma before FROM).
-- Grid 11 (item category master) was soft-deleted but had valid SQL referencing inventory.item_category_master.

-- Restore grid 11 (item category master): SQL is valid, just needs un-deleting.
UPDATE fixed.grid_details
SET
  grid_is_deleted = false,
  grid_status     = true
WHERE grid_id = 11
  AND grid_is_deleted = true;

-- Restore grid 9 (godown master): Fix the broken SQL and un-delete.
UPDATE fixed.grid_details
SET
  grid_sql        = 'SELECT gdl_id, gdl_name, gdl_code, gdl_short, gdl_type, gdl_parent_id, gdl_sort, gdl_level, gdl_path_ids_cache, gdl_is_active FROM inventory.godown_locations WHERE gdl_is_deleted = false ORDER BY gdl_name, gdl_id',
  grid_is_deleted = false,
  grid_status     = true
WHERE grid_id = 9
  AND grid_is_deleted = true;
