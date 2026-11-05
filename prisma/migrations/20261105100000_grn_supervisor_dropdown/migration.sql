-- GRN rework phase 2 (#9, 2026-11-05) — dropdown 72 EMPLOYEES BY DESIGNATION
--
-- 1. Company: a branch-less employee is listed only for the branch's own company (it was: of any company).
-- 2. iemp_strict = 'Y' turns the "everyone" fallback off: only those who hold the designation are listed.
--    GRN's Supervisor sends it. A caller that does not send it leaves the literal 'iemp_strict', so
--    'iemp_strict' <> 'Y' holds and its fallback stays (Godown Transfer / Branch Inward / Shortage crew pickers).
-- Source file: share grids/dropdown_72_employees_by_designation.json (kept in step).

UPDATE fixed.dropdown_details
   SET dropdown_sql = $sql$SELECT
	e.emp_id,
	e.emp_code,
	e.emp_name,
	d.ed_name AS emp_designation
FROM public.employee_master e
LEFT JOIN public.employee_designations d ON d.ed_id = e.emp_designation_id AND d.ed_is_deleted = false
WHERE e.emp_is_active = true AND e.emp_is_deleted = false
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
              AND (e2.emp_branch_id::text = 'iemp_branch_id'
                   OR (e2.emp_branch_id IS NULL
                       AND e2.emp_company_id = (SELECT b2.br_comp_id FROM public.branch_master b2 WHERE b2.br_id::text = 'iemp_branch_id')))
              AND (upper(d2.ed_code) = upper('iemp_role') OR upper(d2.ed_name) = upper('iemp_role')))))
ORDER BY e.emp_name$sql$,
       dropdown_description = 'Crew pickers (GRN Supervisor / Loadmen, transfer Loading / Unloading, shortage receipt, payees). '
                           || 'Params iemp_branch_id and iemp_role - ALWAYS sent, compared as text. iemp_role matches the '
                           || 'designation code or name (LOADMAN / DRIVER / SUPERVISOR); '''' = everyone. Lists the branch''s '
                           || 'employees and the branch-less employees of the branch''s company. While no one holds that '
                           || 'designation the list falls back to every such employee (a new company is never stuck with an '
                           || 'empty picker) - unless iemp_strict = ''Y'' (GRN Supervisor): then only the designation.',
       dropdown_modified_by = 'system',
       dropdown_modified_on = now()
 WHERE dropdown_id = 72
   AND dropdown_name = 'EMPLOYEES BY DESIGNATION';
