-- ═══════════════════════════════════════════════════════════════════════════
--  Vehicle Master (menu 125) and Transporters (menu 149): the two lists as
--  in the approved mockups                                       2026-11-12
--  Plan: Shared/Prathap/sales/plan-vehicle-master-2026-11-11.md rev 3.
--  Follows 20261112120000_vehicle_transporter_masters (applied; not edited).
--  Config rows only: no table, column, index, CHECK, function or trigger, so
--  db_table_master and ensure_acc_year_partitions are not touched.
--
--  The user chose these from the mockup differences found on 11-12 (D36):
--
--  grid 206 "MAIN LIST - VEHICLES" (mockup vehicle_master_ui_mockup_v3.png)
--     Type shows "Regular" / "ODC", not the stored REGULAR / ODC. Only the
--     shown text changes: the column keeps its name veh_type, and the save
--     still stores REGULAR / ODC.
--
--  grid 200 "MAIN LIST - TRANSPORTERS" (mockup transporter_master_ui_mockup_v2.png)
--     The shown widths added up to 100, so the list scrolled sideways and the
--     Active column was cut off. They now add up to 95, in the mockup's
--     proportions:
--         Code 10 -> 8, Name 30 -> 27.5, GSTIN 16 -> 14, Mode 8 -> 6.5,
--         Phone 12 -> 11, Place 14 -> 13, State 5 -> 8, Active 5 -> 7
--     The GSTIN heading reads "GSTIN / TRANSIN".
--     Active is centred.
--     Mode shows "Road" / "Rail" / "Air" / "Ship", not the stored ROAD / RAIL / AIR / SHIP.
--
--  Only a value still as shipped moves. A grid SQL, heading, width or
--  alignment that a site changed in Grid Master is left alone. The SQL is
--  compared with its white space folded. Nothing runs when a grid is absent
--  or has another name. Re-running the file changes nothing. The column ids
--  are the pinned ones from 20261104130000 (grid 200) and 20261112120000
--  (grid 206). Neither grid is in a seed file: the migrations carry them.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── grid 206: Type as "Regular" / "ODC" ───────────────────────────────────
UPDATE fixed.grid_details g
   SET grid_sql = $new206$SELECT v.veh_id, v.veh_company_id, v.veh_vehicle_no,
       CASE v.veh_type WHEN 'REGULAR' THEN 'Regular' ELSE v.veh_type END AS veh_type,
       v.veh_description, v.veh_capacity_kg,
       CASE WHEN v.veh_is_own THEN 'Own' ELSE 'Hired' END AS veh_ownership,
       t.trn_name, e.emp_name AS driver_name, e.emp_mobile1 AS driver_mobile, b.br_name AS home_branch,
       v.veh_is_active
  FROM public.vehicle_master v
  LEFT JOIN public.transporter_master t ON t.trn_id = v.veh_transporter_id
  LEFT JOIN public.employee_master   e ON e.emp_id = v.veh_driver_id
  LEFT JOIN public.branch_master     b ON b.br_id  = v.veh_branch_id
 WHERE v.veh_is_deleted = false
   AND v.veh_company_id = 'icompany_id'::uuid
   AND ('ibranch_id' = '' OR v.veh_branch_id::text = 'ibranch_id')
   AND ('iinactive' = 'true' OR v.veh_is_active)
 ORDER BY v.veh_vehicle_no$new206$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE g.grid_id = 206
   AND g.grid_name = 'MAIN LIST - VEHICLES'
   AND regexp_replace(g.grid_sql, '\s+', ' ', 'g') = regexp_replace($old206$SELECT v.veh_id, v.veh_company_id, v.veh_vehicle_no, v.veh_type, v.veh_description, v.veh_capacity_kg,
       CASE WHEN v.veh_is_own THEN 'Own' ELSE 'Hired' END AS veh_ownership,
       t.trn_name, e.emp_name AS driver_name, e.emp_mobile1 AS driver_mobile, b.br_name AS home_branch,
       v.veh_is_active
  FROM public.vehicle_master v
  LEFT JOIN public.transporter_master t ON t.trn_id = v.veh_transporter_id
  LEFT JOIN public.employee_master   e ON e.emp_id = v.veh_driver_id
  LEFT JOIN public.branch_master     b ON b.br_id  = v.veh_branch_id
 WHERE v.veh_is_deleted = false
   AND v.veh_company_id = 'icompany_id'::uuid
   AND ('ibranch_id' = '' OR v.veh_branch_id::text = 'ibranch_id')
   AND ('iinactive' = 'true' OR v.veh_is_active)
 ORDER BY v.veh_vehicle_no$old206$, '\s+', ' ', 'g');

-- ── grid 200: Mode as "Road" ──────────────────────────────────────────────
UPDATE fixed.grid_details g
   SET grid_sql = $new200$SELECT t.trn_id, t.trn_company_id, t.trn_code, t.trn_name, t.trn_gstin,
       initcap(t.trn_mode) AS trn_mode, t.trn_phone, t.trn_place,
       t.trn_state_code, t.trn_is_active
  FROM public.transporter_master t
 WHERE t.trn_is_deleted = false
   AND (t.trn_company_id IS NULL OR t.trn_company_id::text = 'icompany_id')
   AND ('iinactive' = 'true' OR t.trn_is_active)
 ORDER BY t.trn_name$new200$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE g.grid_id = 200
   AND g.grid_name = 'MAIN LIST - TRANSPORTERS'
   AND regexp_replace(g.grid_sql, '\s+', ' ', 'g') = regexp_replace($old200$SELECT t.trn_id, t.trn_company_id, t.trn_code, t.trn_name, t.trn_gstin, t.trn_mode, t.trn_phone, t.trn_place,
       t.trn_state_code, t.trn_is_active
  FROM public.transporter_master t
 WHERE t.trn_is_deleted = false
   AND (t.trn_company_id IS NULL OR t.trn_company_id::text = 'icompany_id')
   AND ('iinactive' = 'true' OR t.trn_is_active)
 ORDER BY t.trn_name$old200$, '\s+', ' ', 'g');

-- ── grid 200: widths (95 in all) ──────────────────────────────────────────
UPDATE fixed.grid_columns c
   SET grid_column_width       = v.new_width,
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g,
       (VALUES ('01a1b463-e2ac-702f-ad22-fe601b34e379'::uuid, 'trn_code',       10.00,  8.00),
               ('01a1b463-e2ac-7044-80a6-135b526e7ada'::uuid, 'trn_name',       30.00, 27.50),
               ('01a1b463-e2ac-7058-99b6-090b5678f309'::uuid, 'trn_gstin',      16.00, 14.00),
               ('01a1b463-e2ac-7078-a75c-a607737dda77'::uuid, 'trn_mode',        8.00,  6.50),
               ('01a1b463-e2ac-708b-b198-b3a39c58bcb8'::uuid, 'trn_phone',      12.00, 11.00),
               ('01a1b463-e2ac-709e-a1ad-857252fb5af1'::uuid, 'trn_place',      14.00, 13.00),
               ('01a1b463-e2ac-70be-ad48-79fc68ccee68'::uuid, 'trn_state_code',  5.00,  8.00),
               ('01a1b463-e2ac-70d0-a0b2-978e81729e5c'::uuid, 'trn_is_active',   5.00,  7.00)
       ) AS v(id, field, old_width, new_width)
 WHERE g.grid_id = 200
   AND g.grid_name = 'MAIN LIST - TRANSPORTERS'
   AND c.grid_id = g.grid_id
   AND c.grid_column_id = v.id
   AND c.grid_column_sql_field_name = v.field
   AND c.grid_column_is_deleted = false
   AND c.grid_column_width = v.old_width;

-- ── grid 200: the GSTIN heading ───────────────────────────────────────────
UPDATE fixed.grid_columns c
   SET grid_column_name        = 'GSTIN / TRANSIN',
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g
 WHERE g.grid_id = 200
   AND g.grid_name = 'MAIN LIST - TRANSPORTERS'
   AND c.grid_id = g.grid_id
   AND c.grid_column_id = '01a1b463-e2ac-7058-99b6-090b5678f309'
   AND c.grid_column_sql_field_name = 'trn_gstin'
   AND c.grid_column_is_deleted = false
   AND c.grid_column_name = 'GSTIN';

-- ── grid 200: Active centred ──────────────────────────────────────────────
UPDATE fixed.grid_columns c
   SET grid_column_alignment   = 'Center',
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
  FROM fixed.grid_details g
 WHERE g.grid_id = 200
   AND g.grid_name = 'MAIN LIST - TRANSPORTERS'
   AND c.grid_id = g.grid_id
   AND c.grid_column_id = '01a1b463-e2ac-70d0-a0b2-978e81729e5c'
   AND c.grid_column_sql_field_name = 'trn_is_active'
   AND c.grid_column_is_deleted = false
   AND lower(c.grid_column_alignment) = 'left';

-- ── Check after apply ─────────────────────────────────────────────────────
-- SELECT grid_column_name, grid_column_width, grid_column_alignment
--   FROM fixed.grid_columns WHERE grid_id = 200 AND grid_column_visibility ORDER BY grid_column_number;
--   -> widths sum 95.00; 'GSTIN / TRANSIN'; Active 'Center'
-- SELECT grid_sql LIKE '%initcap(t.trn_mode)%' FROM fixed.grid_details WHERE grid_id = 200;   -> t
-- SELECT grid_sql LIKE '%''Regular''%'         FROM fixed.grid_details WHERE grid_id = 206;   -> t
