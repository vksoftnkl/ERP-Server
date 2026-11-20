-- ═══════════════════════════════════════════════════════════════════════════
--  HR masters (menus 70 Departments, 71 Designations, 57 Employees): the DB
--  side of review step 5                                          2026-11-20
--  Folder: prisma/migrations/20261120100000_hr_masters_codes_status_fields/
--  (share copy: Shared/Prathap/admin/sql/hr-masters-migration.sql).
--
--  Analysis: Shared/Prathap/admin/review-hr-masters-2026-11-19.md §1-3, 6.
--  Answers: admin/review-answers-needed-2026-11-19.md, HR H1-H9 "all
--  recommended"; H4 / H7 / H8 = "use menu widget to hide / visible, I can
--  decide". Sorts after 20261119213000_company_branch_dropdowns_active_only.
--
--   0 · guards: the six new column names are free on public.employee_master
--       (or already there with this file's type), and no two LIVE rows share
--       a code (case-insensitive) in any of the three tables. Dev: none.
--   1 · partial unique indexes, the DB backstop for the services' own checks
--       (case-insensitive, live rows only, a blank code is allowed and never
--       clashes, a soft-deleted row frees its code):
--         ux_edpt_code  employee_departments  (lower(edpt_code))
--         ux_ed_code    employee_designations (lower(ed_code))
--         ux_emp_code   employee_master       (lower(emp_code))
--       Partial indexes are not declared in Prisma (see the fragments).
--   2 · emp_status (H5): NULL / blank / any-case "working" -> 'Working',
--       any-case "resigned" -> 'Resigned' (dev before: NULL 20 of which 18
--       deleted, 'WORKING' 1, 'Working' 8). Deleted rows too (harmless). The
--       sync trigger marks the touched rows for the next push. Then DEFAULT
--       'Working' for new rows. NO CHECK: the server normalises the case.
--   3 · six new NULL columns (H8), no CHECK (the server validates):
--         emp_bank_name               varchar(200)  bank name
--         emp_bank_account_no         varchar(50)   bank account no
--         emp_bank_ifsc               varchar(11)   IFSC
--         emp_uan_no                  varchar(20)   UAN (PF universal account no)
--         emp_emergency_contact_name  varchar(200)  emergency contact name
--         emp_emergency_contact_phone varchar(20)   emergency contact phone
--       Already there, only not on the Qt screen yet: emp_employment_type,
--       emp_confirmation_on, emp_overtime_allowed, emp_has_commission,
--       emp_commission_type, emp_commission_value.
--   4 · staff dropdowns (H5): 38 EMPLOYEES, 72 EMPLOYEES BY DESIGNATION and 76
--       VEHICLE DRIVERS leave out Resigned employees, in the "anyone holds
--       it?" fallback test too (else a resigned sole driver would empty the
--       list). 76 matches the designation by code OR name DRIVER, so a renamed
--       code cannot empty it. Same params as before; no comments in the SQL.
--       prisma/seed/Dropdown_Details.sql carries 38 and 76 (72 is not in the
--       seed: it came from the share registration script).
--   5 · field show / hide (H4 / H7 / H8): menu 57, platform Desktop, 11
--       sections (section_name = the Qt heading key) and 47 fields
--       (field_name = the NexCrudField key in employee_entry.cpp; new keys for
--       the new fields). Hidden by default: empShiftId, empAttConstraintId,
--       empHolidayGroupId (dropdown id 0, no tables behind them). Everything
--       else visible. Not registered (always on the screen): empName and
--       empDepartmentId (required), empStatus (drives Left On and the staff
--       dropdowns), empLeftOn (shown by Status = Resigned), empSalaryType (NOT
--       NULL, no default). Matched by NAME (menu 57 + Desktop + section_name;
--       a field by name anywhere under menu 57 Desktop), ids from the
--       sequences; a site's own hides and labels are never overwritten. Does
--       nothing while menu 57 is absent (a fresh database: the seed file
--       prisma/seed/Employee_Widget_Config_Menu57_Desktop.sql adds the same
--       rows after Menu_Master.sql). The existing Web rows (sections 48-54)
--       are left alone.
--
--  No table is created or dropped: the three tables keep db_table_master rows
--  120 / 121 / 122 and their sync columns; none is partitioned. Audit labels
--  for the new columns live in src/modules/audit-log/audit-screen-sql.constants.ts
--  (nestjs-backend). Error wording EMPLOYEE_CODE_DUPLICATE (+ the existing
--  DEPARTMENT_ / DESIGNATION_CODE_DUPLICATE, which had none) is in
--  prisma/seed/Error_Messages.json only. No business-logic function or
--  trigger. Re-runnable: IF NOT EXISTS, guarded UPDATEs, NOT EXISTS inserts.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · guards ────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('%s is %s', a.attname,
                             format_type(a.atttypid, a.atttypmod)), '; ')
      INTO v_clash
      FROM pg_attribute a
      JOIN (VALUES ('emp_bank_name',               'character varying(200)'),
                   ('emp_bank_account_no',         'character varying(50)'),
                   ('emp_bank_ifsc',               'character varying(11)'),
                   ('emp_uan_no',                  'character varying(20)'),
                   ('emp_emergency_contact_name',  'character varying(200)'),
                   ('emp_emergency_contact_phone', 'character varying(20)')) AS w(col, typ)
        ON w.col = a.attname
     WHERE a.attrelid = 'public.employee_master'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND format_type(a.atttypid, a.atttypmod) <> w.typ;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Employee master fields: % (expected the types in this file). Check the column first.', v_clash;
    END IF;

    SELECT string_agg(format('%s "%s" x%s', t.tbl, t.code, t.n), '; ')
      INTO v_clash
      FROM (SELECT 'department' AS tbl, lower(edpt_code) AS code, count(*) AS n
              FROM public.employee_departments
             WHERE edpt_code IS NOT NULL AND edpt_code <> '' AND edpt_is_deleted = false
             GROUP BY 2 HAVING count(*) > 1
            UNION ALL
            SELECT 'designation', lower(ed_code), count(*)
              FROM public.employee_designations
             WHERE ed_code IS NOT NULL AND ed_code <> '' AND ed_is_deleted = false
             GROUP BY 2 HAVING count(*) > 1
            UNION ALL
            SELECT 'employee', lower(emp_code), count(*)
              FROM public.employee_master
             WHERE emp_code IS NOT NULL AND emp_code <> '' AND emp_is_deleted = false
             GROUP BY 2 HAVING count(*) > 1) t;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'HR codes used twice by live rows: %. Change or clear one code of each pair, then deploy again.', v_clash;
    END IF;
END $$;


-- ── 1 · one live code per row, case-insensitive ───────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_edpt_code
    ON public.employee_departments (lower(edpt_code))
 WHERE edpt_code IS NOT NULL AND edpt_code <> '' AND edpt_is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ed_code
    ON public.employee_designations (lower(ed_code))
 WHERE ed_code IS NOT NULL AND ed_code <> '' AND ed_is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_emp_code
    ON public.employee_master (lower(emp_code))
 WHERE emp_code IS NOT NULL AND emp_code <> '' AND emp_is_deleted = false;


-- ── 2 · employee status: Working / Resigned, blank = Working ──────────────
UPDATE public.employee_master
   SET emp_status = 'Working'
 WHERE (emp_status IS NULL OR btrim(emp_status) = '' OR lower(btrim(emp_status)) = 'working')
   AND emp_status IS DISTINCT FROM 'Working';

UPDATE public.employee_master
   SET emp_status = 'Resigned'
 WHERE lower(btrim(emp_status)) = 'resigned'
   AND emp_status <> 'Resigned';

ALTER TABLE public.employee_master ALTER COLUMN emp_status SET DEFAULT 'Working';

COMMENT ON COLUMN public.employee_master.emp_status IS
    'Working or Resigned (the server stores these two spellings; blank = Working). Resigned employees are left out of the staff dropdowns 38 / 72 / 76. emp_is_active stays a separate switch.';


-- ── 3 · bank, UAN and emergency contact ───────────────────────────────────
ALTER TABLE public.employee_master
    ADD COLUMN IF NOT EXISTS emp_bank_name               varchar(200) NULL,
    ADD COLUMN IF NOT EXISTS emp_bank_account_no         varchar(50)  NULL,
    ADD COLUMN IF NOT EXISTS emp_bank_ifsc               varchar(11)  NULL,
    ADD COLUMN IF NOT EXISTS emp_uan_no                  varchar(20)  NULL,
    ADD COLUMN IF NOT EXISTS emp_emergency_contact_name  varchar(200) NULL,
    ADD COLUMN IF NOT EXISTS emp_emergency_contact_phone varchar(20)  NULL;

COMMENT ON COLUMN public.employee_master.emp_bank_name IS
    'Bank the salary / advances are paid to. Optional, free text.';
COMMENT ON COLUMN public.employee_master.emp_bank_account_no IS
    'Bank account no for salary / advances. Optional; the server checks the form.';
COMMENT ON COLUMN public.employee_master.emp_bank_ifsc IS
    'IFSC of the bank branch, 11 characters (AAAA0XXXXXX), upper case. Optional; the server checks the form.';
COMMENT ON COLUMN public.employee_master.emp_uan_no IS
    'UAN, the PF universal account no (12 digits). Optional; the server checks the form.';
COMMENT ON COLUMN public.employee_master.emp_emergency_contact_name IS
    'Person to call in an emergency (name, relation). Optional, free text.';
COMMENT ON COLUMN public.employee_master.emp_emergency_contact_phone IS
    'Phone of the emergency contact. Optional.';


-- ── 4 · staff dropdowns leave out Resigned employees ──────────────────────
UPDATE fixed.dropdown_details
   SET dropdown_sql = $dd$SELECT
    emp_id,
    emp_code,
    emp_name,
    emp_alias
FROM public.employee_master
WHERE emp_is_active = true
    AND emp_is_deleted = false
    AND upper(btrim(COALESCE(emp_status, ''))) <> 'RESIGNED'
    AND (
        emp_branch_id IS NULL
        OR emp_branch_id = iemp_branch_id::uuid
    )
ORDER BY emp_name;$dd$,
       dropdown_description = 'Staff picker: active, not deleted, not Resigned employees of the branch iemp_branch_id plus the branch-less ones, by name. Param iemp_branch_id, cast to uuid, so always sent.',
       dropdown_modified_by = 'system',
       dropdown_modified_on = now()
 WHERE dropdown_id = 38
   AND dropdown_name = 'EMPLOYEES'
   AND dropdown_sql NOT LIKE '%RESIGNED%';

UPDATE fixed.dropdown_details
   SET dropdown_sql = $dd$SELECT
	e.emp_id,
	e.emp_code,
	e.emp_name,
	d.ed_name AS emp_designation
FROM public.employee_master e
LEFT JOIN public.employee_designations d ON d.ed_id = e.emp_designation_id AND d.ed_is_deleted = false
WHERE e.emp_is_active = true AND e.emp_is_deleted = false
  AND upper(btrim(COALESCE(e.emp_status, ''))) <> 'RESIGNED'
  AND (e.emp_branch_id::text = 'iemp_branch_id'
       OR (e.emp_branch_id IS NULL
           AND e.emp_company_id = (SELECT b.br_comp_id FROM public.branch_master b WHERE b.br_id::text = 'iemp_branch_id')))
  AND ('iemp_role' = ''
       OR upper(d.ed_code) = upper('iemp_role')
       OR upper(d.ed_name) = upper('iemp_role')
       OR ('iemp_strict' <> 'Y' AND NOT EXISTS (
            SELECT 1
            FROM public.employee_master e2
            JOIN public.employee_designations d2 ON d2.ed_id = e2.emp_designation_id AND d2.ed_is_deleted = false
            WHERE e2.emp_is_active = true AND e2.emp_is_deleted = false
              AND upper(btrim(COALESCE(e2.emp_status, ''))) <> 'RESIGNED'
              AND (e2.emp_branch_id::text = 'iemp_branch_id'
                   OR (e2.emp_branch_id IS NULL
                       AND e2.emp_company_id = (SELECT b2.br_comp_id FROM public.branch_master b2 WHERE b2.br_id::text = 'iemp_branch_id')))
              AND (upper(d2.ed_code) = upper('iemp_role') OR upper(d2.ed_name) = upper('iemp_role')))))
ORDER BY e.emp_name$dd$,
       dropdown_description = 'Crew pickers (GRN Supervisor / Loadmen, transfer Loading / Unloading, shortage receipt, payees). '
                           || 'Params iemp_branch_id and iemp_role - ALWAYS sent, compared as text. iemp_role matches the '
                           || 'designation code or name (LOADMAN / DRIVER / SUPERVISOR); '''' = everyone. Lists the branch''s '
                           || 'employees and the branch-less employees of the branch''s company; Resigned employees are left '
                           || 'out. While no one (not Resigned) holds that designation the list falls back to every such '
                           || 'employee (a new company is never stuck with an empty picker) - unless iemp_strict = ''Y'' '
                           || '(GRN Supervisor): then only the designation.',
       dropdown_modified_by = 'system',
       dropdown_modified_on = now()
 WHERE dropdown_id = 72
   AND dropdown_name = 'EMPLOYEES BY DESIGNATION'
   AND dropdown_sql NOT LIKE '%RESIGNED%';

UPDATE fixed.dropdown_details
   SET dropdown_sql = $dd$SELECT e.emp_id, e.emp_code, e.emp_name, e.emp_mobile1, b.br_name AS emp_branch
  FROM public.employee_master e
  LEFT JOIN public.branch_master b ON b.br_id = e.emp_branch_id
  LEFT JOIN public.employee_designations d ON d.ed_id = e.emp_designation_id AND d.ed_is_deleted = false
 WHERE e.emp_is_active = true AND e.emp_is_deleted = false
   AND upper(btrim(COALESCE(e.emp_status, ''))) <> 'RESIGNED'
   AND e.emp_company_id::text = 'idrv_company_id'
   AND (upper(d.ed_code) = 'DRIVER' OR upper(d.ed_name) = 'DRIVER'
        OR NOT EXISTS (SELECT 1 FROM public.employee_master e2
                         JOIN public.employee_designations d2 ON d2.ed_id = e2.emp_designation_id AND d2.ed_is_deleted = false
                        WHERE e2.emp_is_active = true AND e2.emp_is_deleted = false
                          AND upper(btrim(COALESCE(e2.emp_status, ''))) <> 'RESIGNED'
                          AND e2.emp_company_id::text = 'idrv_company_id'
                          AND (upper(d2.ed_code) = 'DRIVER' OR upper(d2.ed_name) = 'DRIVER')))
 ORDER BY e.emp_name$dd$,
       dropdown_description = 'Vehicle Master (menu 125) Driver picker: this company''s active, not Resigned employees whose designation code or name is DRIVER (everyone while nobody holds it), with their mobile. Param idrv_company_id, always sent.',
       dropdown_modified_by = 'system',
       dropdown_modified_on = now()
 WHERE dropdown_id = 76
   AND dropdown_name = 'VEHICLE DRIVERS'
   AND dropdown_sql NOT LIKE '%RESIGNED%';


-- ── 5 · Employee entry (menu 57, Desktop): field show / hide ──────────────
SELECT setval(pg_get_serial_sequence('fixed.form_section', 'section_id'), MAX(section_id))
  FROM fixed.form_section
HAVING MAX(section_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_section', 'section_id')::regclass), 0);

SELECT setval(pg_get_serial_sequence('fixed.form_field', 'field_id'), MAX(field_id))
  FROM fixed.form_field
HAVING MAX(field_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_field', 'field_id')::regclass), 0);

INSERT INTO fixed.form_section
       (section_menu_id, section_name, section_gui_name, section_position,
        section_visibility, section_platform, section_created_by)
SELECT 57, v.name, v.gui, v.pos, true, 'Desktop', 'system'
  FROM (VALUES
               ('identity',   'Identity',            1),
               ('employment', 'Employment',          2),
               ('salary',     'Salary & Allowances', 3),
               ('commission', 'Commission',          4),
               ('personal',   'Personal',            5),
               ('address',    'Address',             6),
               ('statutory',  'Statutory',           7),
               ('bank',       'Bank Details',        8),
               ('emergency',  'Emergency Contact',   9),
               ('photo',      'Photo',               10),
               ('other',      'Other',               11)
       ) AS v(name, gui, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 57)
   AND NOT EXISTS (SELECT 1 FROM fixed.form_section s
                    WHERE s.section_menu_id = 57
                      AND s.section_platform = 'Desktop'
                      AND lower(btrim(s.section_name)) = v.name)
 ORDER BY v.pos;

WITH sec AS (
    SELECT DISTINCT ON (lower(btrim(section_name))) lower(btrim(section_name)) AS sname, section_id
      FROM fixed.form_section
     WHERE section_menu_id = 57
       AND section_platform = 'Desktop'
     ORDER BY lower(btrim(section_name)), section_id
)
INSERT INTO fixed.form_field
       (field_section_id, field_name, field_gui_name, field_position,
        field_visibility, field_created_by)
SELECT sec.section_id, v.fname, v.gui, v.pos, v.vis, 'system'
  FROM (VALUES
    ('identity',   'empAlias',                 'Alias',                 1,  true),
    ('identity',   'empCode',                  'Employee Code',         2,  true),
    ('identity',   'empDesignationId',         'Designation',           3,  true),
    ('identity',   'empCompanyId',             'Company',               4,  true),
    ('identity',   'empBranchId',              'Branch',                5,  true),
    ('identity',   'empMobile1',               'Mobile 1',              6,  true),
    ('identity',   'empMobile2',               'Mobile 2',              7,  true),
    ('identity',   'empEmail',                 'Email',                 8,  true),
    ('employment', 'empEmploymentType',        'Employment Type',       1,  true),
    ('employment', 'empJoinedOn',              'Joined On',             2,  true),
    ('employment', 'empProbationEndOn',        'Probation End On',      3,  true),
    ('employment', 'empConfirmationOn',        'Confirmation On',       4,  true),
    ('employment', 'empShiftId',               'Shift',                 5,  false),
    ('employment', 'empAttConstraintId',       'Attendance Constraint', 6,  false),
    ('employment', 'empHolidayGroupId',        'Holiday Group',         7,  false),
    ('salary',     'empSalaryAmount',          'Salary Amount',         1,  true),
    ('salary',     'empBataAmount',            'Bata Amount',           2,  true),
    ('salary',     'empKmBataAmount',          'Km Bata Amount',        3,  true),
    ('salary',     'empOvertimeAllowed',       'Overtime Allowed',      4,  true),
    ('salary',     'empLoanLedgerId',          'Staff Advance Ledger',  5,  true),
    ('commission', 'empHasCommission',         'Has Commission',        1,  true),
    ('commission', 'empCommissionType',        'Commission Type',       2,  true),
    ('commission', 'empCommissionValue',       'Commission Value',      3,  true),
    ('personal',   'empDob',                   'Date of Birth',         1,  true),
    ('personal',   'empGender',                'Gender',                2,  true),
    ('personal',   'empMaritalStatus',         'Marital Status',        3,  true),
    ('personal',   'empBloodGroup',            'Blood Group',           4,  true),
    ('address',    'empAddr1',                 'Address Line 1',        1,  true),
    ('address',    'empAddr2',                 'Address Line 2',        2,  true),
    ('address',    'empAddr3',                 'Address Line 3',        3,  true),
    ('address',    'empCity',                  'City',                  4,  true),
    ('address',    'empDistrict',              'District',              5,  true),
    ('address',    'empState',                 'State',                 6,  true),
    ('address',    'empPincode',               'Pincode',               7,  true),
    ('statutory',  'empPanNo',                 'PAN No',                1,  true),
    ('statutory',  'empAadharNo',              'Aadhaar No',            2,  true),
    ('statutory',  'empPfNo',                  'PF No',                 3,  true),
    ('statutory',  'empEsiNo',                 'ESI No',                4,  true),
    ('statutory',  'empUanNo',                 'UAN',                   5,  true),
    ('bank',       'empBankName',              'Bank Name',             1,  true),
    ('bank',       'empBankAccountNo',         'Account No',            2,  true),
    ('bank',       'empBankIfsc',              'IFSC',                  3,  true),
    ('emergency',  'empEmergencyContactName',  'Contact Name',          1,  true),
    ('emergency',  'empEmergencyContactPhone', 'Contact Phone',         2,  true),
    ('photo',      'empPhoto',                 'Photo',                 1,  true),
    ('other',      'empRemarks',               'Remarks',               1,  true),
    ('other',      'empIsActive',              'Active',                2,  true)
       ) AS v(sname, fname, gui, pos, vis)
  JOIN sec ON sec.sname = v.sname
 WHERE NOT EXISTS (SELECT 1
                     FROM fixed.form_field f
                     JOIN fixed.form_section s ON s.section_id = f.field_section_id
                    WHERE s.section_menu_id = 57
                      AND s.section_platform = 'Desktop'
                      AND lower(btrim(f.field_name)) = lower(v.fname))
 ORDER BY sec.section_id, v.pos;


-- Checks after deploy (read-only):
-- SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('ux_edpt_code', 'ux_ed_code', 'ux_emp_code');
-- SELECT emp_status, count(*) FROM public.employee_master GROUP BY 1 ORDER BY 1;
-- SELECT column_name, data_type, character_maximum_length, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_master' AND column_name IN ('emp_status', 'emp_bank_name', 'emp_bank_account_no', 'emp_bank_ifsc', 'emp_uan_no', 'emp_emergency_contact_name', 'emp_emergency_contact_phone');
-- SELECT dropdown_id, dropdown_sql LIKE '%RESIGNED%' AS leaves_out_resigned FROM fixed.dropdown_details WHERE dropdown_id IN (38, 72, 76);
-- SELECT s.section_name, f.field_name, f.field_visibility FROM fixed.form_section s JOIN fixed.form_field f ON f.field_section_id = s.section_id WHERE s.section_menu_id = 57 AND s.section_platform = 'Desktop' ORDER BY s.section_position, f.field_position;
-- SELECT * FROM public.v_db_table_master_drift;
