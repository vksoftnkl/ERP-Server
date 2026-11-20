-- Employee entry ("Employees", menu 57) — its Desktop widget-master config:
-- the same rows migration 20261120100000_hr_masters_codes_status_fields writes
-- (review list 11-19, HR step 5; answers H4 / H7 / H8 "use menu widget to hide /
-- visible, I can decide").
--
-- 11 fixed.form_section rows (platform Desktop) and the 47 fixed.form_field rows
-- under them: what the Qt screen's Visibility Settings and menu 243 "Widgets"
-- edit, and what NexDialog reads (/widget-masters/get?menu_id=57&platform=Desktop)
-- to hide a NexCrudForm field whose key matches.
--
--   identity    empAlias, empCode, empDesignationId, empCompanyId, empBranchId,
--               empMobile1, empMobile2, empEmail
--   employment  empEmploymentType, empJoinedOn, empProbationEndOn,
--               empConfirmationOn, empShiftId*, empAttConstraintId*,
--               empHolidayGroupId*
--   salary      empSalaryAmount, empBataAmount, empKmBataAmount,
--               empOvertimeAllowed, empLoanLedgerId
--   commission  empHasCommission, empCommissionType, empCommissionValue
--   personal    empDob, empGender, empMaritalStatus, empBloodGroup
--   address     empAddr1, empAddr2, empAddr3, empCity, empDistrict, empState,
--               empPincode
--   statutory   empPanNo, empAadharNo, empPfNo, empEsiNo, empUanNo
--   bank        empBankName, empBankAccountNo, empBankIfsc
--   emergency   empEmergencyContactName, empEmergencyContactPhone
--   photo       empPhoto
--   other       empRemarks, empIsActive
--
-- section_name = the Qt heading key (employee_entry.cpp), field_name = the
-- NexCrudField key; field_gui_name is the label on screen. * = hidden by default
-- (Shift / Attendance Constraint / Holiday Group: dropdown id 0, no tables
-- behind them); everything else ships visible. Never registered, so always on
-- the screen: empName, empDepartmentId (required), empStatus, empLeftOn (shown
-- by Status = Resigned) and empSalaryType (NOT NULL, no default).
--
-- WHY A TARGETED SEED: Form_Section.sql skips a menu that already has any section
-- (menu 57 has its Web sections 48-54) and Form_Field.sql a section that already
-- has any field, so neither adds this config to a laid-out database (precedent:
-- Sale_Order_Widget_Config_Menu11_Desktop.sql).
--
-- Matched by NAME, never by id: a section by menu 57 + Desktop + section_name, a
-- field by its name anywhere under menu 57 Desktop. Ids come from the sequences
-- (pushed past the table's max first). Existing rows are never updated, so a
-- site's own hides and labels survive every run. Runs after Menu_Master.sql (FK)
-- and Form_Section.sql / Form_Field.sql (not in seed.manifest.json: the runner
-- appends unlisted files after the listed ones); does nothing while menu 57 is
-- absent.
--
-- Idempotent: a second run inserts nothing. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Employee_Widget_Config_Menu57_Desktop.sql
--      or: npm run seed:run -- --only=Employee_Widget_Config_Menu57_Desktop.sql

BEGIN;

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

COMMIT;
