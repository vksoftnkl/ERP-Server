DO $$
DECLARE
  v_state_grid_id BIGINT;
  v_city_grid_id BIGINT;
  v_area_grid_id BIGINT;
BEGIN
  SELECT gd.grid_id
    INTO v_state_grid_id
  FROM grid.grid_details gd
  WHERE gd.grid_is_deleted = false
    AND (
      lower(gd.grid_name) = 'state master'
      OR COALESCE(gd.grid_sql, '') ILIKE '%state_master%'
    )
  ORDER BY
    CASE
      WHEN lower(gd.grid_name) = 'state master' THEN 0
      ELSE 1
    END,
    gd.grid_id DESC
  LIMIT 1;

  IF v_state_grid_id IS NULL THEN
    INSERT INTO grid.grid_details (
      grid_name,
      grid_description,
      grid_sort_column,
      grid_sort_order,
      grid_sql,
      grid_status,
      grid_is_deleted
    )
    VALUES (
      'State Master',
      'State master list grid',
      2,
      100,
      'SELECT stm_id, stm_name, stm_alias, stm_short, stm_order, stm_is_active FROM sales.state_master WHERE stm_is_deleted = false ORDER BY stm_name, stm_id',
      true,
      false
    )
    RETURNING grid_id INTO v_state_grid_id;
  END IF;

  INSERT INTO grid.grid_columns (
    grid_id,
    grid_column_number,
    grid_column_name,
    grid_column_width,
    grid_column_alignment,
    grid_column_visibility,
    grid_column_filter,
    grid_column_group,
    grid_column_total,
    grid_column_data_type,
    grid_column_notes,
    grid_column_is_deleted
  )
  SELECT
    v_state_grid_id,
    src.grid_column_number,
    src.grid_column_name,
    src.grid_column_width,
    src.grid_column_alignment,
    true,
    src.grid_column_filter,
    false,
    false,
    src.grid_column_data_type,
    src.grid_column_notes,
    false
  FROM (
    VALUES
      (1, 'stm_id', 180.00::DECIMAL(12, 2), 'left', false, 'uuid', 'State ID'),
      (2, 'stm_name', 220.00::DECIMAL(12, 2), 'left', true, 'text', 'State Name'),
      (3, 'stm_alias', 160.00::DECIMAL(12, 2), 'left', true, 'text', 'State Alias'),
      (4, 'stm_short', 120.00::DECIMAL(12, 2), 'left', true, 'text', 'State Short'),
      (5, 'stm_order', 100.00::DECIMAL(12, 2), 'right', false, 'number', 'Sort Order'),
      (6, 'stm_is_active', 110.00::DECIMAL(12, 2), 'center', true, 'boolean', 'Active Status')
  ) AS src (
    grid_column_number,
    grid_column_name,
    grid_column_width,
    grid_column_alignment,
    grid_column_filter,
    grid_column_data_type,
    grid_column_notes
  )
  WHERE NOT EXISTS (
    SELECT 1
    FROM grid.grid_columns gc
    WHERE gc.grid_id = v_state_grid_id
      AND lower(gc.grid_column_name) = lower(src.grid_column_name)
      AND gc.grid_column_is_deleted = false
  );

  SELECT gd.grid_id
    INTO v_city_grid_id
  FROM grid.grid_details gd
  WHERE gd.grid_is_deleted = false
    AND (
      lower(gd.grid_name) = 'city master'
      OR COALESCE(gd.grid_sql, '') ILIKE '%city_master%'
    )
  ORDER BY
    CASE
      WHEN lower(gd.grid_name) = 'city master' THEN 0
      ELSE 1
    END,
    gd.grid_id DESC
  LIMIT 1;

  IF v_city_grid_id IS NULL THEN
    INSERT INTO grid.grid_details (
      grid_name,
      grid_description,
      grid_sort_column,
      grid_sort_order,
      grid_sql,
      grid_status,
      grid_is_deleted
    )
    VALUES (
      'City Master',
      'City master list grid',
      2,
      110,
      'SELECT ctm_id, ctm_name, ctm_alias, ctm_short, ctm_state_id, ctm_order, ctm_is_active FROM sales.city_master WHERE ctm_is_deleted = false ORDER BY ctm_name, ctm_id',
      true,
      false
    )
    RETURNING grid_id INTO v_city_grid_id;
  END IF;

  INSERT INTO grid.grid_columns (
    grid_id,
    grid_column_number,
    grid_column_name,
    grid_column_width,
    grid_column_alignment,
    grid_column_visibility,
    grid_column_filter,
    grid_column_group,
    grid_column_total,
    grid_column_data_type,
    grid_column_notes,
    grid_column_is_deleted
  )
  SELECT
    v_city_grid_id,
    src.grid_column_number,
    src.grid_column_name,
    src.grid_column_width,
    src.grid_column_alignment,
    true,
    src.grid_column_filter,
    false,
    false,
    src.grid_column_data_type,
    src.grid_column_notes,
    false
  FROM (
    VALUES
      (1, 'ctm_id', 180.00::DECIMAL(12, 2), 'left', false, 'uuid', 'City ID'),
      (2, 'ctm_name', 220.00::DECIMAL(12, 2), 'left', true, 'text', 'City Name'),
      (3, 'ctm_alias', 160.00::DECIMAL(12, 2), 'left', true, 'text', 'City Alias'),
      (4, 'ctm_short', 120.00::DECIMAL(12, 2), 'left', true, 'text', 'City Short'),
      (5, 'ctm_state_id', 180.00::DECIMAL(12, 2), 'left', true, 'uuid', 'State ID'),
      (6, 'ctm_order', 100.00::DECIMAL(12, 2), 'right', false, 'number', 'Sort Order'),
      (7, 'ctm_is_active', 110.00::DECIMAL(12, 2), 'center', true, 'boolean', 'Active Status')
  ) AS src (
    grid_column_number,
    grid_column_name,
    grid_column_width,
    grid_column_alignment,
    grid_column_filter,
    grid_column_data_type,
    grid_column_notes
  )
  WHERE NOT EXISTS (
    SELECT 1
    FROM grid.grid_columns gc
    WHERE gc.grid_id = v_city_grid_id
      AND lower(gc.grid_column_name) = lower(src.grid_column_name)
      AND gc.grid_column_is_deleted = false
  );

  SELECT gd.grid_id
    INTO v_area_grid_id
  FROM grid.grid_details gd
  WHERE gd.grid_is_deleted = false
    AND (
      lower(gd.grid_name) = 'area master'
      OR COALESCE(gd.grid_sql, '') ILIKE '%area_master%'
    )
  ORDER BY
    CASE
      WHEN lower(gd.grid_name) = 'area master' THEN 0
      ELSE 1
    END,
    gd.grid_id DESC
  LIMIT 1;

  IF v_area_grid_id IS NULL THEN
    INSERT INTO grid.grid_details (
      grid_name,
      grid_description,
      grid_sort_column,
      grid_sort_order,
      grid_sql,
      grid_status,
      grid_is_deleted
    )
    VALUES (
      'Area Master',
      'Area master list grid',
      2,
      120,
      'SELECT arm_id, arm_name, arm_alias, arm_short, arm_city_id, arm_sort, arm_distance_km, arm_collection_days, arm_is_active FROM sales.area_master WHERE arm_is_deleted = false ORDER BY arm_name, arm_id',
      true,
      false
    )
    RETURNING grid_id INTO v_area_grid_id;
  END IF;

  INSERT INTO grid.grid_columns (
    grid_id,
    grid_column_number,
    grid_column_name,
    grid_column_width,
    grid_column_alignment,
    grid_column_visibility,
    grid_column_filter,
    grid_column_group,
    grid_column_total,
    grid_column_data_type,
    grid_column_notes,
    grid_column_is_deleted
  )
  SELECT
    v_area_grid_id,
    src.grid_column_number,
    src.grid_column_name,
    src.grid_column_width,
    src.grid_column_alignment,
    true,
    src.grid_column_filter,
    false,
    false,
    src.grid_column_data_type,
    src.grid_column_notes,
    false
  FROM (
    VALUES
      (1, 'arm_id', 180.00::DECIMAL(12, 2), 'left', false, 'uuid', 'Area ID'),
      (2, 'arm_name', 220.00::DECIMAL(12, 2), 'left', true, 'text', 'Area Name'),
      (3, 'arm_alias', 160.00::DECIMAL(12, 2), 'left', true, 'text', 'Area Alias'),
      (4, 'arm_short', 120.00::DECIMAL(12, 2), 'left', true, 'text', 'Area Short'),
      (5, 'arm_city_id', 180.00::DECIMAL(12, 2), 'left', true, 'uuid', 'City ID'),
      (6, 'arm_sort', 100.00::DECIMAL(12, 2), 'right', false, 'number', 'Sort Order'),
      (7, 'arm_distance_km', 130.00::DECIMAL(12, 2), 'right', false, 'integer', 'Distance (KM)'),
      (8, 'arm_collection_days', 180.00::DECIMAL(12, 2), 'left', false, 'integer[]', 'Collection Days'),
      (9, 'arm_is_active', 110.00::DECIMAL(12, 2), 'center', true, 'boolean', 'Active Status')
  ) AS src (
    grid_column_number,
    grid_column_name,
    grid_column_width,
    grid_column_alignment,
    grid_column_filter,
    grid_column_data_type,
    grid_column_notes
  )
  WHERE NOT EXISTS (
    SELECT 1
    FROM grid.grid_columns gc
    WHERE gc.grid_id = v_area_grid_id
      AND lower(gc.grid_column_name) = lower(src.grid_column_name)
      AND gc.grid_column_is_deleted = false
  );
END;
$$;
