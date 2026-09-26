-- Provision a configured-grid-sql grid for the loyalty scheme list (loyalty_sch_list).
-- The client (promotion-loyalty-points page) lists schemes via
-- `configured-grid-sql/run?grid_id=40`, passing company/branch/status/type as
-- grid_param placeholders. Idempotent: only seeds if grid 40 is absent.

DO $$
DECLARE
  v_grid_id   BIGINT := 40;
  v_grid_sql  TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = v_grid_id) THEN
    RETURN;
  END IF;

  v_grid_sql :=
    'SELECT ls.ls_id, ls.ls_code, ls.ls_name, ls.ls_type, ls.ls_status, ls.ls_branch_id, '
    || 'ls.ls_start_date, ls.ls_end_date, ls.ls_is_active, '
    || '(SELECT COUNT(*) FROM sales.loyalty_sch_points lspt WHERE lspt.lspt_ls_id = ls.ls_id AND lspt.lspt_is_deleted = false AND lspt.lspt_is_active = true) AS points_count, '
    || '(SELECT COUNT(*) FROM sales.loyalty_sch_gift lsg WHERE lsg.lsg_ls_id = ls.ls_id AND lsg.lsg_is_deleted = false AND lsg.lsg_is_active = true) AS gifts_count, '
    || '(SELECT COUNT(*) FROM sales.loyalty_sch_party lps WHERE lps.lps_ls_id = ls.ls_id AND lps.lps_is_deleted = false AND lps.lps_is_active = true) AS parties_count '
    || 'FROM sales.loyalty_sch_list ls '
    || 'WHERE ls.ls_is_deleted = false '
    || 'AND ls.ls_comp_id = p_comp_id::uuid '
    || 'AND (NULLIF(p_branch_id, '''') IS NULL OR ls.ls_branch_id = NULLIF(p_branch_id, '''')::uuid) '
    || 'AND (NULLIF(p_status, '''') IS NULL OR ls.ls_status = NULLIF(p_status, '''')) '
    || 'AND (NULLIF(p_type, '''') IS NULL OR ls.ls_type = NULLIF(p_type, '''')) '
    || 'ORDER BY ls.ls_name, ls.ls_id';

  INSERT INTO fixed.grid_details
    (grid_id, grid_name, grid_description, grid_device_type, grid_sort_column, grid_sort_order, grid_sql, grid_status, grid_is_deleted)
  VALUES
    (v_grid_id, 'Loyalty Scheme List', 'Promotion loyalty scheme list grid', 'web', 'Scheme', 'Ascending', v_grid_sql, true, false);

  INSERT INTO fixed.grid_columns
    (grid_id, grid_column_number, grid_column_name, grid_column_width, grid_column_alignment,
     grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
     grid_column_data_type, grid_column_is_deleted, grid_column_sql_field_name, grid_column_id)
  VALUES
    (v_grid_id, 1, 'Scheme', 28.00, 'Left',   true, true,  false, false, 'Text',    false, 'ls_name',      uuidv7()),
    (v_grid_id, 2, 'Code',   14.00, 'Left',   true, true,  false, false, 'Text',    false, 'ls_code',      uuidv7()),
    (v_grid_id, 3, 'Type',   12.00, 'Center', true, true,  false, false, 'Text',    false, 'ls_type',      uuidv7()),
    (v_grid_id, 4, 'Status', 12.00, 'Center', true, true,  false, false, 'Text',    false, 'ls_status',    uuidv7()),
    (v_grid_id, 5, 'Active', 10.00, 'Center', true, false, false, false, 'Boolean', false, 'ls_is_active', uuidv7());

  -- Keep the autoincrement sequence ahead of the explicit id we just inserted.
  PERFORM setval('fixed.grid_details_grid_id_seq', (SELECT MAX(grid_id) FROM fixed.grid_details));
END $$;
