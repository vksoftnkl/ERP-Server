-- ═══════════════════════════════════════════════════════════════════════════
--  Vehicle Master (menu 125) + Transporters (menu 149), phase P1 (DB)  2026-11-12
--  Plan: Shared/Prathap/sales/plan-vehicle-master-2026-11-11.md rev 3, §4;
--  mockups vehicle_master_ui_mockup_v3.png and transporter_master_ui_mockup_v2.png
--  (approved 2026-11-11). Q18-Q22 = the plan's recommendations. Sorts after
--  20261111150000_app_theme_template_v62. No new column on either master.
--
--  1 · ux_veh_no (UNIQUE) -> plain ix_veh_no (D11, offline rule): two branches
--      may save the same number offline; the server refuses it online
--      (VEH_NO_TAKEN). 0 rows today.
--  2 · menu 125 "Vehicle Master" under 17 Sales Masters at 75.00 (after 177
--      Loading Charges); every live menu-17 row copied to 125 with its six
--      flags; db_table_master 1302 -> 125.
--  3 · menu 149 rights (D26): each 125 holder with his 17 flags, each live
--      menu-26 viewer with his 26 flags; a VIEW-only 26 row where missing.
--  4 · account group "Transporters" (shared, reserved, Party) under Sundry
--      Creditors, pinned id 01a1ca91-1010-73d8-a329-f97aa1de5c9c (D29, D30);
--      the server's TRANSPORTER_LEDGER_GROUP_ID.
--  5 · fk_trn_ledger: transporter_master.trn_ledger_id -> acc_ledger_master
--      (D31; the transporter's id IS its ledger's id). 0 rows today.
--  6 · grid 206 "MAIN LIST - VEHICLES" (tokens icompany_id, ibranch_id,
--      iinactive, always sent).
--  7 · dropdown 76 "VEHICLE DRIVERS" (param idrv_company_id, always sent).
--  8 · audit screens 161 "Vehicle Master" / 162 "Transporter Master".
--  9 · fixed.error_message: VEH_* and the new TRN_* rows; catalogue
--      2026-11-12.1.
--
--  Ids are PINNED; the same menu, group, dropdown and wording rows are in the
--  seed files. An id or name already held by something else stops the
--  migration. Re-runnable: every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids and names must be free (or already ours) ────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM accounts.acc_group_master
                    WHERE acc_group_id = '019eee86-f34b-7d73-8a79-f5c6f036439a'
                      AND acc_group_is_deleted = false) THEN
        RAISE EXCEPTION 'Vehicle / Transporters: account group Sundry Creditors (019eee86-f34b-7d73-8a79-f5c6f036439a) is missing.';
    END IF;

    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', m.menu_id, m.menu_name) AS x
          FROM fixed.menu_master m
         WHERE m.menu_id = 125 AND m.menu_name IS DISTINCT FROM 'Vehicle Master'
        UNION ALL
        SELECT format('menu 149 is "%s" under %s', m.menu_name, m.menu_parent)
          FROM fixed.menu_master m
         WHERE m.menu_id = 149 AND (m.menu_name, m.menu_parent) IS DISTINCT FROM ('Transporters'::varchar, 26)
        UNION ALL
        SELECT format('grid %s (%s)', g.grid_id, g.grid_name)
          FROM fixed.grid_details g
         WHERE g.grid_id = 206 AND g.grid_name IS DISTINCT FROM 'MAIN LIST - VEHICLES'
        UNION ALL
        SELECT format('dropdown %s (%s)', d.dropdown_id, d.dropdown_name)
          FROM fixed.dropdown_details d
         WHERE (d.dropdown_id = 76 AND d.dropdown_name IS DISTINCT FROM 'VEHICLE DRIVERS')
            OR (d.dropdown_name = 'VEHICLE DRIVERS' AND d.dropdown_id <> 76)
        UNION ALL
        SELECT format('audit screen %s (%s)', s.screen_id, s.screen_name)
          FROM audit.audit_screen s
          JOIN (VALUES (161, 'Vehicle Master'::text), (162, 'Transporter Master')) v(id, name)
            ON v.id = s.screen_id OR lower(v.name) = lower(s.screen_name)
         WHERE (s.screen_id, s.screen_name) IS DISTINCT FROM (v.id, v.name)
        UNION ALL
        SELECT format('account group %s (%s)', g.acc_group_id, g.acc_group_name)
          FROM accounts.acc_group_master g
         WHERE g.acc_group_is_deleted = false
           AND ((g.acc_group_id = '01a1ca91-1010-73d8-a329-f97aa1de5c9c' AND g.acc_group_name IS DISTINCT FROM 'Transporters')
             OR (g.acc_group_company_id IS NULL AND lower(g.acc_group_name) = 'transporters'
                 AND g.acc_group_id <> '01a1ca91-1010-73d8-a329-f97aa1de5c9c'))
        UNION ALL
        SELECT format('constraint fk_trn_ledger on %s', c.conrelid::regclass)
          FROM pg_constraint c
         WHERE c.conname = 'fk_trn_ledger' AND c.conrelid <> 'public.transporter_master'::regclass
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Vehicle / Transporters: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;
END $$;


-- ── 1 · the offline index (D11) ────────────────────────────────────────────
DROP INDEX IF EXISTS public.ux_veh_no;
CREATE INDEX IF NOT EXISTS ix_veh_no
    ON public.vehicle_master (veh_company_id, veh_vehicle_no)
    WHERE veh_is_deleted = false;


-- ── 2 · menu 125 "Vehicle Master" + its rights + the table registry ────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 125, 17, 'Vehicle Master', NULL, true, 75.00, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 17)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 125);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Each live Sales Masters (17) row -> a 125 row with the same six flags (D1).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 125, u.um_can_view, u.um_can_create, u.um_can_edit, u.um_can_delete,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 17
   AND u.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 125 AND m.menu_name = 'Vehicle Master')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

UPDATE public.db_table_master
   SET dtm_menu_id = 125, dtm_modified_on = now()
 WHERE dtm_id = 1302
   AND dtm_table = 'vehicle_master'
   AND dtm_menu_id IS NULL;


-- ── 3 · menu 149 "Transporters" rights (D26) ───────────────────────────────
-- Each user who holds 125 gets 149 with his 17 flags; then each live menu-26
-- viewer with his 26 flags. One row per user: the 17 flags win (ORDER BY src).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT DISTINCT ON (s.um_user_id)
       s.um_user_id, 149, s.um_can_view, s.um_can_create, s.um_can_edit, s.um_can_delete,
       s.um_can_print, s.um_can_export, s.um_visibility, false, false,
       0, false, s.um_created_by, false, false,
       false, false, false
  FROM (SELECT 1 AS src, u.*
          FROM public.user_menus u
         WHERE u.um_menu_id = 17 AND u.um_is_deleted = false
           AND EXISTS (SELECT 1 FROM public.user_menus v
                        WHERE v.um_user_id = u.um_user_id AND v.um_menu_id = 125 AND v.um_is_deleted = false)
        UNION ALL
        SELECT 2 AS src, u.*
          FROM public.user_menus u
         WHERE u.um_menu_id = 26 AND u.um_is_deleted = false AND u.um_can_view = true) s
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 149 AND m.menu_name = 'Transporters')
 ORDER BY s.um_user_id, s.src
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The parent 26 Purchase Masters, VIEW only, for a 149 holder without any 26
-- row (an explicit "no" row stays as it is), and the module 2 Purchase likewise.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT n.um_user_id, p.id, true, true, n.um_created_by
  FROM public.user_menus n
 CROSS JOIN (VALUES (26), (2)) p(id)
 WHERE n.um_menu_id = 149
   AND n.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM public.user_menus x WHERE x.um_user_id = n.um_user_id AND x.um_menu_id = p.id)
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 4 · account group "Transporters" under Sundry Creditors (D29, D30) ─────
-- Shaped as "Suppliers" is (Account_Groups.sql): shared (company NULL),
-- reserved, Liabilities, BALANCESHEET, profile Party.
INSERT INTO accounts.acc_group_master
       (acc_group_id, acc_group_name, acc_group_alias, acc_group_short, acc_group_tally_name,
        acc_group_primary_name, acc_group_nature, acc_group_parent_id, acc_group_sort, acc_group_type,
        acc_ledger_profile, acc_group_is_default, acc_group_is_reserved, acc_group_behave_as_subledger,
        acc_group_net_debit_credit, acc_group_used_for_calculation, acc_group_affects_gross_profit,
        acc_group_is_active, acc_group_is_deleted, acc_group_created_by, acc_group_modified_by)
VALUES ('01a1ca91-1010-73d8-a329-f97aa1de5c9c', 'Transporters', NULL, NULL, NULL,
        NULL, 'Liabilities', '019eee86-f34b-7d73-8a79-f5c6f036439a', 0, 'BALANCESHEET',
        'Party', false, true, false,
        false, false, false,
        true, false, 'system', 'system')
ON CONFLICT (acc_group_id) DO NOTHING;


-- ── 5 · the transporter -> ledger link (D31) ───────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_trn_ledger'
                      AND conrelid = 'public.transporter_master'::regclass) THEN
        ALTER TABLE public.transporter_master
          ADD CONSTRAINT fk_trn_ledger FOREIGN KEY (trn_ledger_id)
              REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;


-- ── 6 · grid 206 "MAIN LIST - VEHICLES" ────────────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES (206, 'MAIN LIST - VEHICLES',
        'Vehicle Master (menu 125): this company''s live vehicles with transporter, driver and home branch. Tokens (send every one): icompany_id (uuid), ibranch_id ('''' = all branches), iinactive (''true'' = show switched-off ones too).',
        'veh_vehicle_no', 'Ascending', 'Desktop', true, false, 'system', $mig$SELECT v.veh_id, v.veh_company_id, v.veh_vehicle_no, v.veh_type, v.veh_description, v.veh_capacity_kg,
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
 ORDER BY v.veh_vehicle_no$mig$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_is_deleted, grid_column_created_by)
SELECT v.id, 206, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter, false, false, false, 'system'
  FROM (VALUES
        ('01a1cebc-4a7d-7cdb-bdec-cd65fedf6173'::uuid, 1::integer, '#'::text, 'veh_id'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean),
        ('01a1cebc-4a7e-7383-bb74-9bfc0e9345fe', 2, 'Company', 'veh_company_id', 'Text', 0.00, 'Left', false, false),
        ('01a1cebc-4a7f-723d-8f9a-957f6e85fe57', 3, 'Vehicle No', 'veh_vehicle_no', 'Text', 9.00, 'Left', true, true),
        ('01a1cebc-4a80-7add-a7bf-fb41c4e6f717', 4, 'Type', 'veh_type', 'Text', 6.00, 'Left', true, false),
        ('01a1cebc-4a81-70e0-91a2-52326695382b', 5, 'Description', 'veh_description', 'Text', 18.00, 'Left', true, true),
        ('01a1cebc-4a82-739c-aa2b-4d30c4a425b3', 6, 'Capacity (kg)', 'veh_capacity_kg', 'Number', 8.00, 'Right', true, false),
        ('01a1cebc-4a83-7c61-b485-47511713bcfd', 7, 'Own / Hired', 'veh_ownership', 'Text', 7.00, 'Left', true, false),
        ('01a1cebc-4a84-7b8d-809d-40f09317ca88', 8, 'Transporter', 'trn_name', 'Text', 14.00, 'Left', true, true),
        ('01a1cebc-4a85-74bc-8135-be5b4ccdb2a1', 9, 'Driver', 'driver_name', 'Text', 9.00, 'Left', true, true),
        ('01a1cebc-4a86-7959-be87-b52ffe1a9c20', 10, 'Driver mobile', 'driver_mobile', 'Text', 9.00, 'Left', true, false),
        ('01a1cebc-4a87-7fe4-9384-d1728fe3704c', 11, 'Home branch', 'home_branch', 'Text', 9.00, 'Left', true, false),
        ('01a1cebc-4a88-731b-ad4c-2ab4f507f17b', 12, 'Active', 'veh_is_active', 'Boolean', 6.00, 'Center', true, false)
       ) AS v(id, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details g WHERE g.grid_id = 206 AND g.grid_name = 'MAIN LIST - VEHICLES')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = 206 AND c.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;


-- ── 7 · dropdown 76 "VEHICLE DRIVERS" (D16) ────────────────────────────────
-- This company's active employees with designation DRIVER; everyone while
-- nobody holds it. Dropdown 72 (branch crews) is not touched.
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT 76, 'VEHICLE DRIVERS',
       'Vehicle Master (menu 125) Driver picker: this company''s active employees with designation DRIVER (everyone while nobody holds it), with their mobile. Param idrv_company_id, always sent.',
$d$SELECT e.emp_id, e.emp_code, e.emp_name, e.emp_mobile1, b.br_name AS emp_branch
  FROM public.employee_master e
  LEFT JOIN public.branch_master b ON b.br_id = e.emp_branch_id
  LEFT JOIN public.employee_designations d ON d.ed_id = e.emp_designation_id AND d.ed_is_deleted = false
 WHERE e.emp_is_active = true AND e.emp_is_deleted = false
   AND e.emp_company_id::text = 'idrv_company_id'
   AND (upper(d.ed_code) = 'DRIVER'
        OR NOT EXISTS (SELECT 1 FROM public.employee_master e2
                         JOIN public.employee_designations d2 ON d2.ed_id = e2.emp_designation_id AND d2.ed_is_deleted = false
                        WHERE e2.emp_is_active = true AND e2.emp_is_deleted = false
                          AND e2.emp_company_id::text = 'idrv_company_id' AND upper(d2.ed_code) = 'DRIVER'))
 ORDER BY e.emp_name$d$,
       'asc', 'emp_name', 'emp_name', 10, true, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 76);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.id, 76, v.no, 'Text', v.name, NULL, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    ('01a1b2c0-7600-7000-8000-000000000760'::uuid, 0, '#',      10.00, false, false, 'emp_id'),
    ('01a1b2c0-7600-7000-8000-000000000761'::uuid, 1, 'Code',   20.00, true,  true,  'emp_code'),
    ('01a1b2c0-7600-7000-8000-000000000762'::uuid, 2, 'Driver', 40.00, true,  true,  'emp_name'),
    ('01a1b2c0-7600-7000-8000-000000000763'::uuid, 3, 'Mobile', 20.00, true,  true,  'emp_mobile1'),
    ('01a1b2c0-7600-7000-8000-000000000764'::uuid, 4, 'Branch', 20.00, true,  false, 'emp_branch')
  ) AS v(id, no, name, width, visible, filter, field)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = 76 AND d.dropdown_name = 'VEHICLE DRIVERS')
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = 76)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT COALESCE(max(dropdown_id), 1) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));


-- ── 8 · audit screens (D19); the SQL text is filled by the server on first
--       write from AUDIT_SCREEN_SQL_BY_NAME ─────────────────────────────────
INSERT INTO audit.audit_screen (screen_id, screen_name, screen_type, screen_status, screen_module)
SELECT v.id, v.name, 'master'::audit.audit_screen_type, true, 'TRANSPORT'
  FROM (VALUES (161, 'Vehicle Master'), (162, 'Transporter Master')) v(id, name)
 WHERE NOT EXISTS (SELECT 1 FROM audit.audit_screen s WHERE s.screen_id = v.id);

SELECT setval('audit.audit_screen_screen_id_seq',
              GREATEST((SELECT COALESCE(max(screen_id), 1) FROM audit.audit_screen),
                       (SELECT last_value FROM audit.audit_screen_screen_id_seq)));


-- ── 9 · plain wording rows (notes 120), catalogue 2026-11-12.1 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('VEH_NO_REQUIRED', '', 'en', 'Vehicle number missing', 'The vehicle number is empty.', 'Type it as on the RC, e.g. TN38AB1234.')
    ,('VEH_NO_INVALID', '', 'en', 'Vehicle number not right', 'A vehicle number has 4 to 20 letters and digits only.', 'Type it as on the RC, e.g. TN38AB1234.')
    ,('VEH_NO_TAKEN', '', 'en', 'Vehicle number already used', 'This vehicle is already in Vehicle Master.', 'Open the old one from the list, or check the number.')
    ,('VEH_NOT_FOUND', '', 'en', 'Vehicle not found', 'This vehicle is not in Vehicle Master now.', 'Refresh the list.')
    ,('VEH_TRANSPORTER_INVALID', '', 'en', 'Transporter not found', 'This transporter is not in Transporters, or is switched off.', 'Pick one from the list.')
    ,('VEH_DRIVER_INVALID', '', 'en', 'Driver not found', 'This driver is not an active employee of this company.', 'Pick one from the list.')
    ,('VEH_BRANCH_INVALID', '', 'en', 'Branch not right', 'This branch is not one of this company''s.', 'Pick one from the list.')
    ,('VEH_COMPANY_MISMATCH', '', 'en', 'Wrong company', 'This belongs to another company.', 'Log in to that company to change it.')
    ,('VEH_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open this.', 'Call manager.')
    ,('VEH_RIGHT_CREATE', '', 'en', 'Not allowed', 'You have no right to make new ones.', 'Call manager.')
    ,('VEH_RIGHT_EDIT', '', 'en', 'Not allowed', 'You have no right to change this.', 'Call manager.')
    ,('VEH_RIGHT_DELETE', '', 'en', 'Not allowed', 'You have no right to delete this.', 'Call manager.')
    ,('TRN_NOT_FOUND', '', 'en', 'Transporter not found', 'This transporter is not in Transporters now.', 'Refresh the list.')
    ,('TRN_STATE_INVALID', '', 'en', 'State not right', 'This is not a GST state code.', 'Pick the state from the list.')
    ,('TRN_COMPANY_MISMATCH', '', 'en', 'Wrong company', 'This belongs to another company.', 'Log in to that company to change it.')
    ,('TRN_LEDGER_NAME_TAKEN', '', 'en', 'Name already a ledger', 'Another ledger of this company already has this name.', 'Use another name, e.g. add the place: KPN Parcel Service (Erode).')
    ,('TRN_HAS_BALANCE', '', 'en', 'Cannot delete transporter', 'This transporter''s balance is not zero.', 'Settle it to zero first, then delete.')
    ,('TRN_HAS_CHEQUE_IN_HAND', '', 'en', 'Cannot delete transporter', 'A cheque for this transporter is not cleared yet.', 'Clear or cancel the cheque first.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-12.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-12.1';


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT indexname FROM pg_indexes WHERE tablename = 'vehicle_master';
-- SELECT menu_id, menu_parent, menu_name, menu_position FROM fixed.menu_master WHERE menu_id IN (125, 149);
-- SELECT um_menu_id, count(*) FROM public.user_menus WHERE um_menu_id IN (125, 149) GROUP BY 1;
-- SELECT acc_group_id, acc_group_name, acc_group_parent_id FROM accounts.acc_group_master WHERE acc_group_name = 'Transporters';
-- SELECT conname FROM pg_constraint WHERE conname = 'fk_trn_ledger';
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_id = 206;
-- SELECT dropdown_id, dropdown_name FROM fixed.dropdown_details WHERE dropdown_id = 76;
-- SELECT screen_id, screen_name FROM audit.audit_screen WHERE screen_id IN (161, 162);
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
