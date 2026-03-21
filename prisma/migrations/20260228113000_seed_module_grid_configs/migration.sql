DO $$
DECLARE
  v_spec RECORD;
  v_schema TEXT;
  v_grid_id BIGINT;
  v_existing_grid_id BIGINT;
  v_existing_columns_count INTEGER;
  v_deleted_column TEXT;
  v_primary_column TEXT;
  v_sort_column TEXT;
  v_columns_select TEXT;
  v_where_clause TEXT;
  v_order_by_clause TEXT;
  v_grid_sql TEXT;
  v_column RECORD;
BEGIN
  CREATE TEMP TABLE tmp_grid_specs (
    sort_index INTEGER NOT NULL,
    table_name TEXT PRIMARY KEY,
    grid_name TEXT NOT NULL,
    grid_description TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_grid_specs (sort_index, table_name, grid_name, grid_description)
  VALUES
    (1, 'item_group_master', 'Item Group Master', 'Item group master list grid'),
    (2, 'category_master', 'Item Category Master', 'Item category master list grid'),
    (3, 'item_brand_master', 'Item Brand Master', 'Item brand master list grid'),
    (4, 'item_section_master', 'Item Section Master', 'Item section master list grid'),
    (5, 'units', 'Unit Master', 'Unit master list grid'),
    (6, 'godown_locations', 'Godown Master', 'Godown master list grid'),
    (7, 'item_tax_master', 'Tax Master', 'Item tax master list grid'),
    (8, 'item_master', 'Item Master', 'Item master list grid'),
    (9, 'item_price_master', 'Item Price Master', 'Item price master list grid'),
    (10, 'item_qtywise_rates', 'Item Qtywise Rates Master', 'Item quantity wise rates list grid'),
    (11, 'item_reorders', 'Item Reorder Master', 'Item reorder master list grid'),
    (12, 'item_tax_history', 'Item Tax History Master', 'Item tax history master list grid'),
    (13, 'item_ean_codes', 'Item EAN Code Master', 'Item EAN code master list grid'),
    (14, 'cust_item_rates', 'Item Customer Rates Master', 'Item customer rates master list grid'),
    (15, 'supplier_groups', 'Supplier Group Master', 'Supplier group master list grid'),
    (16, 'suppliers', 'Suppliers Master', 'Suppliers master list grid'),
    (17, 'customers', 'Customer Master', 'Customer master list grid'),
    (18, 'cust_groups', 'Customer Group Master', 'Customer group master list grid'),
    (19, 'state_master', 'State Master', 'State master list grid'),
    (20, 'city_master', 'City Master', 'City master list grid'),
    (21, 'area_master', 'Area Master', 'Area master list grid'),
    (22, 'account_groups', 'Account Ledger Groups Master', 'Account group master list grid'),
    (23, 'acc_ledger_master', 'Account Ledger Master', 'Account ledger master list grid'),
    (24, 'acc_ledger_bank_accounts', 'Ledger Bank Account Master', 'Ledger bank account master list grid'),
    (25, 'acc_ship_addrs', 'Ledger Shipping Address Master', 'Ledger shipping address master list grid'),
    (26, 'companys', 'Company Master', 'Company master list grid'),
    (27, 'company_group_master', 'Company Group Master', 'Company group master list grid'),
    (28, 'branch_master', 'Branch Master', 'Branch master list grid'),
    (29, 'emp_master', 'Employee Master', 'Employee master list grid'),
    (30, 'employee_designations', 'Employee Designation Master', 'Employee designation master list grid'),
    (31, 'gsp_provider_master', 'GSP Provider Master', 'GSP provider master list grid'),
    (32, 'gsp_company_service', 'GSP Company Service Master', 'GSP company service master list grid'),
    (33, 'tender_type_master', 'Tender Type Master', 'Tender type master list grid'),
    (34, 'tender_master', 'Tender Master', 'Tender master list grid'),
    (35, 'bank_master', 'Bank List Master', 'Bank list master grid'),
    (36, 'erp_device_master', 'Device List Master', 'Device list master grid'),
    (37, 'state_codes', 'State Code Master', 'State code master grid'),
    (38, 'avt_voucher_type_master', 'Account Voucher Type Master', 'Account voucher type master grid'),
    (39, 'user_login_sessions', 'User Login Sessions', 'User login sessions grid');

  FOR v_spec IN
    SELECT
      sort_index,
      table_name,
      grid_name,
      grid_description
    FROM tmp_grid_specs
    ORDER BY sort_index
  LOOP
    SELECT t.table_schema
      INTO v_schema
    FROM information_schema.tables t
    WHERE t.table_name = v_spec.table_name
      AND t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY
      CASE t.table_schema
        WHEN 'accounts' THEN 0
        WHEN 'inventory' THEN 1
        WHEN 'purchase' THEN 2
        WHEN 'sales' THEN 3
        WHEN 'fixed' THEN 4
        WHEN 'public' THEN 5
        ELSE 50
      END,
      t.table_schema
    LIMIT 1;

    IF v_schema IS NULL THEN
      CONTINUE;
    END IF;

    SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO v_columns_select
    FROM information_schema.columns c
    WHERE c.table_schema = v_schema
      AND c.table_name = v_spec.table_name;

    IF v_columns_select IS NULL THEN
      CONTINUE;
    END IF;

    SELECT c.column_name
      INTO v_deleted_column
    FROM information_schema.columns c
    WHERE c.table_schema = v_schema
      AND c.table_name = v_spec.table_name
      AND (
        c.column_name = 'is_deleted'
        OR c.column_name ~ '_is_deleted$'
      )
    ORDER BY
      CASE WHEN c.column_name = 'is_deleted' THEN 0 ELSE 1 END,
      c.ordinal_position
    LIMIT 1;

    SELECT kcu.column_name
      INTO v_primary_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = v_schema
      AND tc.table_name = v_spec.table_name
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
    LIMIT 1;

    IF v_primary_column IS NULL THEN
      SELECT c.column_name
        INTO v_primary_column
      FROM information_schema.columns c
      WHERE c.table_schema = v_schema
        AND c.table_name = v_spec.table_name
      ORDER BY c.ordinal_position
      LIMIT 1;
    END IF;

    SELECT c.column_name
      INTO v_sort_column
    FROM information_schema.columns c
    WHERE c.table_schema = v_schema
      AND c.table_name = v_spec.table_name
      AND c.column_name <> COALESCE(v_deleted_column, '')
    ORDER BY
      CASE
        WHEN c.column_name ~* '(_name|name)$' THEN 0
        WHEN c.column_name ~* '(_alias|alias)$' THEN 1
        WHEN c.column_name ~* '(_short|short)$' THEN 2
        WHEN c.column_name ~* '(_code|code)$' THEN 3
        WHEN c.column_name ~* '(sort|order|position)$' THEN 4
        WHEN c.column_name = v_primary_column THEN 5
        ELSE 20
      END,
      c.ordinal_position
    LIMIT 1;

    IF v_sort_column IS NULL THEN
      v_sort_column := v_primary_column;
    END IF;

    v_where_clause := CASE
      WHEN v_deleted_column IS NULL THEN ''
      ELSE format(' WHERE %I IS NOT TRUE', v_deleted_column)
    END;

    v_order_by_clause := CASE
      WHEN v_sort_column IS NULL THEN ''
      WHEN v_primary_column IS NULL OR v_primary_column = v_sort_column THEN format(' ORDER BY %I', v_sort_column)
      ELSE format(' ORDER BY %I, %I', v_sort_column, v_primary_column)
    END;

    v_grid_sql := format(
      'SELECT %s FROM %I.%I%s%s',
      v_columns_select,
      v_schema,
      v_spec.table_name,
      v_where_clause,
      v_order_by_clause
    );

    SELECT gd.grid_id
      INTO v_existing_grid_id
    FROM grid.grid_details gd
    WHERE gd.grid_is_deleted = false
      AND (
        lower(gd.grid_name) = lower(v_spec.grid_name)
        OR COALESCE(gd.grid_sql, '') ILIKE '%' || v_spec.table_name || '%'
      )
    ORDER BY
      CASE WHEN lower(gd.grid_name) = lower(v_spec.grid_name) THEN 0 ELSE 1 END,
      gd.grid_id DESC
    LIMIT 1;

    IF v_existing_grid_id IS NULL THEN
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
        v_spec.grid_name,
        v_spec.grid_description,
        v_sort_column,
        lpad((100 + (v_spec.sort_index * 10))::TEXT, 4, '0'),
        v_grid_sql,
        true,
        false
      )
      RETURNING grid_id INTO v_grid_id;
    ELSE
      v_grid_id := v_existing_grid_id;

      UPDATE grid.grid_details
      SET
        grid_description = COALESCE(grid_description, v_spec.grid_description),
        grid_sort_column = COALESCE(NULLIF(btrim(grid_sort_column), ''), v_sort_column),
        grid_sort_order = COALESCE(
          NULLIF(btrim(grid_sort_order), ''),
          lpad((100 + (v_spec.sort_index * 10))::TEXT, 4, '0')
        ),
        grid_sql = COALESCE(NULLIF(btrim(grid_sql), ''), v_grid_sql),
        grid_status = true,
        grid_is_deleted = false
      WHERE grid_id = v_grid_id;
    END IF;

    SELECT COUNT(*)
      INTO v_existing_columns_count
    FROM grid.grid_columns gc
    WHERE gc.grid_id = v_grid_id
      AND gc.grid_column_is_deleted = false;

    IF v_existing_columns_count > 0 THEN
      CONTINUE;
    END IF;

    FOR v_column IN
      SELECT
        c.column_name,
        c.ordinal_position,
        c.data_type,
        c.udt_name,
        c.character_maximum_length
      FROM information_schema.columns c
      WHERE c.table_schema = v_schema
        AND c.table_name = v_spec.table_name
      ORDER BY c.ordinal_position
    LOOP
      UPDATE grid.grid_columns
      SET
        grid_column_is_deleted = false,
        grid_column_number = v_column.ordinal_position
      WHERE grid_id = v_grid_id
        AND lower(grid_column_name) = lower(v_column.column_name)
        AND grid_column_is_deleted = true;

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
        v_grid_id,
        v_column.ordinal_position,
        v_column.column_name,
        CASE
          WHEN v_column.data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision') THEN 130.00::DECIMAL(12, 2)
          WHEN v_column.data_type = 'boolean' THEN 110.00::DECIMAL(12, 2)
          WHEN v_column.data_type = 'uuid' THEN 180.00::DECIMAL(12, 2)
          WHEN v_column.data_type IN ('date', 'time without time zone', 'time with time zone', 'timestamp without time zone', 'timestamp with time zone') THEN 170.00::DECIMAL(12, 2)
          WHEN v_column.character_maximum_length IS NOT NULL AND v_column.character_maximum_length <= 30 THEN 140.00::DECIMAL(12, 2)
          WHEN v_column.character_maximum_length IS NOT NULL AND v_column.character_maximum_length <= 80 THEN 180.00::DECIMAL(12, 2)
          ELSE 220.00::DECIMAL(12, 2)
        END,
        CASE
          WHEN v_column.data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision') THEN 'right'
          WHEN v_column.data_type = 'boolean' THEN 'center'
          ELSE 'left'
        END,
        CASE
          WHEN v_column.column_name = v_deleted_column THEN false
          ELSE true
        END,
        CASE
          WHEN v_column.column_name = v_deleted_column THEN false
          WHEN v_column.data_type IN (
            'text',
            'character varying',
            'character',
            'uuid',
            'boolean',
            'smallint',
            'integer',
            'bigint',
            'numeric',
            'decimal',
            'real',
            'double precision',
            'date',
            'timestamp without time zone',
            'timestamp with time zone'
          ) THEN true
          WHEN v_column.data_type = 'USER-DEFINED' THEN true
          ELSE false
        END,
        false,
        false,
        CASE
          WHEN v_column.data_type = 'USER-DEFINED' THEN v_column.udt_name
          ELSE v_column.data_type
        END,
        initcap(replace(v_column.column_name, '_', ' ')),
        false
      WHERE NOT EXISTS (
        SELECT 1
        FROM grid.grid_columns gc
        WHERE gc.grid_id = v_grid_id
          AND lower(gc.grid_column_name) = lower(v_column.column_name)
          AND gc.grid_column_is_deleted = false
      );
    END LOOP;
  END LOOP;
END;
$$;
