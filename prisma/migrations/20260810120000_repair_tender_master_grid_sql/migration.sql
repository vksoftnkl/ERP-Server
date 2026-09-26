-- Repair the configured grid SQL + column mappings for the tender master grid (grid 44).
--
-- The grid was seeded against the original accounts.account_tender_master shape
-- (acc_tnd_* / acc_ttm_* columns). That table was renamed to accounts.acc_tender_master by
-- 20260708000000_rename_account_tender_tables_to_acc_prefix and then dropped and recreated with a
-- completely new column shape (tnd_* / ttm_*) by 20260731080000_add_tender_types_and_master. The
-- grid metadata was never updated, so GET /configured-grid-sql/run?grid_id=44 fails with
-- `relation "accounts.account_tender_master" does not exist` (SQLSTATE 42P01), which the run
-- endpoint reports as 400 Bad Request.
--
-- The rewritten SQL also adopts the `<pk>_is_deleted = wantdelete` convention every other master
-- grid uses, so the grid_param the client already sends ({"wantdelete":false}) binds to a real
-- token instead of being silently ignored.
--
-- Guarded on the fixed.grid_details row existing: the master grids are seeded outside of
-- migrations, so on a freshly replayed (shadow) database grid 44 is absent and this is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 44) THEN
    RETURN;
  END IF;

  UPDATE fixed.grid_details
  SET grid_sql = $sql$SELECT
	TND.tnd_id,
	TND.tnd_name,
	TND.tnd_short_name,
	TTM.ttm_display_name AS tnd_type_name,
	TND.tnd_ledger_id,
	TND.tnd_min_amount,
	TND.tnd_max_amount,
	TND.tnd_surcharge_perc,
	TND.tnd_display_position,
	TND.tnd_is_active
FROM
	accounts.acc_tender_master TND
	LEFT JOIN accounts.acc_tender_types TTM ON TTM.ttm_type_id = TND.tnd_type_id
WHERE
	TND.tnd_is_deleted = wantdelete
ORDER BY
	TND.tnd_display_position, TND.tnd_name$sql$,
      grid_sort_column = 'tnd_name'
  WHERE grid_id = 44
    AND (grid_sql IS NULL OR grid_sql !~* '\macc_tender_master\M');

  -- Re-point the configured columns at the live field names. Only the mapping and the boolean
  -- data type change; width, alignment, visibility and the soft-deleted state of "Active" are
  -- left exactly as configured.
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'tnd_id'
    WHERE grid_id = 44 AND grid_column_sql_field_name = 'acc_tnd_id';
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'tnd_name'
    WHERE grid_id = 44 AND grid_column_sql_field_name = 'acc_tnd_tnd_name';
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'tnd_short_name'
    WHERE grid_id = 44 AND grid_column_sql_field_name = 'acc_tnd_tnd_short_name';
  UPDATE fixed.grid_columns
    SET grid_column_sql_field_name = 'tnd_is_active',
        grid_column_data_type = 'Boolean'
    WHERE grid_id = 44 AND grid_column_sql_field_name = 'acc_ttm_type_is_active';
END $$;
