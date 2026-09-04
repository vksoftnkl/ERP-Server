-- Repair configured grid SQL after these master tables were moved or renamed.
-- Stale grid SQL causes runtime raw-query errors when list endpoints try to
-- execute configured grids. grid_details itself was also moved from the grid
-- schema into fixed, so resolve the live metadata schema first.
DO $$
DECLARE
  v_grid_details regclass;
BEGIN
  SELECT to_regclass('fixed.grid_details')
    INTO v_grid_details;

  IF v_grid_details IS NULL THEN
    SELECT to_regclass('grid.grid_details')
      INTO v_grid_details;
  END IF;

  IF v_grid_details IS NULL THEN
    RAISE EXCEPTION 'grid_details table was not found in fixed or grid schema';
  END IF;

  EXECUTE format(
    $sql$
      UPDATE %s
      SET grid_sql = regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    grid_sql,
                    '(?i)\maccounts\s*\.\s*"?companys"?',
                    'public.companys',
                    'g'
                  ),
                  '(?i)\maccounts\s*\.\s*"?branch_master"?',
                  'public.branch_master',
                  'g'
                ),
                '(?i)\maccounts\s*\.\s*"?company_group_master"?',
                'public.company_group_master',
                'g'
              ),
              '(?i)\maccounts\s*\.\s*"?gsp_provider_master"?',
              'fixed.gsp_provider_master',
              'g'
            ),
            '(?i)\maccounts\s*\.\s*"?gsp_company_service"?',
            'fixed.gsp_company_service',
            'g'
          ),
          '(?i)\mfixed\s*\.\s*"?user_login_sessions"?',
          'audit.user_login_sessions',
          'g'
        ),
        '(?i)\minventory\s*\.\s*"?units"?',
        'inventory.item_unit_master',
        'g'
      )
      WHERE grid_is_deleted = false
        AND grid_sql IS NOT NULL
        AND grid_sql ~* '\m(accounts|fixed|inventory)\s*\.'
    $sql$,
    v_grid_details
  );
END $$;
