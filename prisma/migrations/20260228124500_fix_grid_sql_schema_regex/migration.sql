-- Follow-up: reliably qualify configured grid SQL table references by schema.
DO $$
DECLARE
  v_spec RECORD;
BEGIN
  CREATE TEMP TABLE tmp_grid_sql_schema_patch (
    table_name TEXT PRIMARY KEY,
    schema_name TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_grid_sql_schema_patch (table_name, schema_name)
  VALUES
    ('item_group_master', 'inventory'),
    ('category_master', 'inventory'),
    ('item_brand_master', 'inventory'),
    ('item_section_master', 'inventory'),
    ('units', 'inventory'),
    ('godown_locations', 'inventory'),
    ('item_master', 'inventory'),
    ('item_reorders', 'inventory'),
    ('item_tax_master', 'inventory'),
    ('supplier_groups', 'purchase'),
    ('suppliers', 'purchase'),
    ('customers', 'sales'),
    ('cust_groups', 'sales'),
    ('state_master', 'sales'),
    ('city_master', 'sales'),
    ('area_master', 'sales'),
    ('account_groups', 'accounts'),
    ('acc_ledger_master', 'accounts'),
    ('acc_ledger_bank_accounts', 'accounts'),
    ('acc_ship_addrs', 'accounts'),
    ('companys', 'accounts'),
    ('company_group_master', 'accounts'),
    ('branch_master', 'accounts'),
    ('emp_master', 'sales'),
    ('employee_designations', 'accounts'),
    ('gsp_provider_master', 'accounts'),
    ('gsp_company_service', 'accounts'),
    ('tender_type_master', 'accounts'),
    ('tender_master', 'accounts'),
    ('bank_master', 'fixed'),
    ('erp_device_master', 'fixed'),
    ('state_codes', 'fixed'),
    ('avt_voucher_type_master', 'fixed'),
    ('user_login_sessions', 'fixed');

  FOR v_spec IN
    SELECT table_name, schema_name
    FROM tmp_grid_sql_schema_patch
  LOOP
    UPDATE grid.grid_details gd
    SET grid_sql = regexp_replace(
      regexp_replace(
        gd.grid_sql,
        format(
          '(?i)from\\s+(?:public\\s*\\.\\s*)?"?%s"?',
          v_spec.table_name
        ),
        format('FROM %s.%s', v_spec.schema_name, v_spec.table_name),
        'g'
      ),
      format(
        '(?i)join\\s+(?:public\\s*\\.\\s*)?"?%s"?',
        v_spec.table_name
      ),
      format('JOIN %s.%s', v_spec.schema_name, v_spec.table_name),
      'g'
    )
    WHERE gd.grid_is_deleted = false
      AND gd.grid_sql IS NOT NULL
      AND gd.grid_sql ILIKE ('%' || v_spec.table_name || '%')
      AND gd.grid_sql !~* format(
        '%s\\s*\\.\\s*"?%s"?',
        v_spec.schema_name,
        v_spec.table_name
      );
  END LOOP;
END;
$$;
