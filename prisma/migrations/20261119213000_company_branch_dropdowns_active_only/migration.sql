-- ═══════════════════════════════════════════════════════════════════════════
--  Dropdowns 8 "company" and 5 "branch" list active, not-deleted rows only
--  2026-11-19
--  Folder: prisma/migrations/20261119213000_company_branch_dropdowns_active_only/
--  (share copy: Shared/Prathap/admin/sql/company-branch-dropdowns-active-only-2026-11-19.sql).
--  Review: Shared/Prathap/admin/review-devices-company-switch-2026-11-19.md,
--          task2 and menu 239 points 1 and 2. Review list 11-19, build step 2,
--          D1 / 239.1; row 5 added on the user's answer of 11-19 ("fix both").
--
--  GET /master-lookups/name-id/all-masters?module=companies (and
--  all-accounts-and-masters) takes the configured dropdown whose name is
--  exactly 'company', which is row 8, ahead of row 22 'COMPANYS'. In the same
--  way module=branches takes row 5 'branch', ahead of row 32 'BRANCHES'.
--  Neither row filtered on is_active, and row 8 not on is_deleted either.
--  Their regional SQL had no filter at all, and the regional SQL is the one
--  the lookup runs FIRST (the runner drops the stray comma before FROM and
--  rewrites accounts.companys / accounts.branch_master to public.*). So:
--    module=companies listed all 169 companies, 161 of them deleted: the
--      main-window company switch, Devices (239), App Settings, Loyalty
--      Scheme and Print Assignments;
--    module=branches listed all 212 branches, 199 of them deleted: the
--      Devices Branch combo.
--
--  For each row:
--  1 · dropdown_sql: the active and not-deleted filter of its sibling row
--      (22 for companies, 32 for branches), ORDER BY name, id (the code
--      fallback's order, module-fetchers.ts). Same output columns in the same
--      order as today: row 8 (comp_name, comp_id), row 5 (br_id, br_name).
--  2 · dropdown_sql_regional: NULL, as rows 22 and 32. There is no regional
--      name, and left in place it would still run first and list every row.
--  3 · dropdown_sort_column: comp_name / br_name (was 'company id' /
--      'Branch id', columns the SQL never returns, so the lookup already fell
--      back to name order).
--  4 · dropdown_description says what the row lists.
--
--  Each field moves only while it holds the shipped text (white space folded).
--  Already the new text: nothing to do. Row absent (a fresh database:
--  dropdowns are seeded after migrations, and prisma/seed/Dropdown_Details.sql
--  carries the new rows): skipped. Any other text: left as is, with a notice.
--  dropdown_columns of rows 8 and 5 are not touched.
--
--  Re-runnable. No function, no trigger, no DDL.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Row 8 'company' ─────────────────────────────────────────────────────────
DO $mig$
DECLARE
    v_old_sql  text := $old$SELECT comp_name, comp_id FROM public.companys$old$;
    v_old_reg  text := $oldreg$SELECT  comp_name,comp_id,
	FROM accounts.companys;$oldreg$;
    v_new_sql  text := $new$SELECT comp_name, comp_id FROM public.companys WHERE comp_is_active = true AND comp_is_deleted = false ORDER BY comp_name, comp_id$new$;
    v_old_sort text := 'company id';
    v_new_sort text := 'comp_name';
    v_old_desc text := 'company master';
    v_new_desc text := 'Company pickers (lookup module companies): active and not deleted companies, by name. '
                    || 'Main-window company switch, Devices, App Settings, Loyalty Scheme, Print Assignments.';
    r          fixed.dropdown_details%ROWTYPE;
    v_sql      text;
    v_reg      text;
    v_sort     varchar;
    v_desc     text;
BEGIN
    SELECT * INTO r
      FROM fixed.dropdown_details d
     WHERE d.dropdown_id = 8
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE NOTICE '20261119213000: dropdown 8 is not here (fresh database: Dropdown_Details.sql carries the new row). Skipped.';
        RETURN;
    END IF;
    IF r.dropdown_name IS DISTINCT FROM 'company' THEN
        RAISE NOTICE '20261119213000: dropdown 8 is "%", not company. Left as is.', r.dropdown_name;
        RETURN;
    END IF;

    v_sql  := r.dropdown_sql;
    v_reg  := r.dropdown_sql_regional;
    v_sort := r.dropdown_sort_column;
    v_desc := r.dropdown_description;

    IF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_new_sql, '\s+', ' ', 'g') THEN
        RAISE NOTICE '20261119213000: dropdown 8 SQL already lists active companies only. Nothing to do.';
    ELSIF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_old_sql, '\s+', ' ', 'g') THEN
        v_sql := v_new_sql;
    ELSE
        RAISE NOTICE '20261119213000: dropdown 8 SQL is not the shipped text (edited since?). Left as is.';
    END IF;

    IF v_reg IS NULL THEN
        NULL;
    ELSIF regexp_replace(v_reg, '\s+', ' ', 'g') = regexp_replace(v_old_reg, '\s+', ' ', 'g') THEN
        v_reg := NULL;
    ELSE
        RAISE NOTICE '20261119213000: dropdown 8 regional SQL is not the shipped text. Left as is; it runs before dropdown_sql, so it must filter too.';
    END IF;

    IF v_sort = v_old_sort THEN
        v_sort := v_new_sort;
    END IF;

    IF v_desc = v_old_desc THEN
        v_desc := v_new_desc;
    END IF;

    IF v_sql  IS DISTINCT FROM r.dropdown_sql
    OR v_reg  IS DISTINCT FROM r.dropdown_sql_regional
    OR v_sort IS DISTINCT FROM r.dropdown_sort_column
    OR v_desc IS DISTINCT FROM r.dropdown_description THEN
        UPDATE fixed.dropdown_details
           SET dropdown_sql          = v_sql,
               dropdown_sql_regional = v_reg,
               dropdown_sort_column  = v_sort,
               dropdown_description  = v_desc,
               dropdown_modified_by  = 'system',
               dropdown_modified_on  = now()
         WHERE dropdown_id = 8;
    END IF;
END
$mig$;

-- ── Row 5 'branch' ──────────────────────────────────────────────────────────
DO $mig$
DECLARE
    v_old_sql  text := $old$SELECT br_id, br_name FROM public.branch_master WHERE br_is_deleted = false$old$;
    v_old_reg  text := $oldreg$SELECT br_id, br_name,
	FROM accounts.branch_master;$oldreg$;
    v_new_sql  text := $new$SELECT br_id, br_name FROM public.branch_master WHERE br_is_deleted = false AND br_is_active = true ORDER BY br_name, br_id$new$;
    v_old_sort text := 'Branch id';
    v_new_sort text := 'br_name';
    v_old_desc text := 'branch master';
    v_new_desc text := 'Branch pickers (lookup module branches): active and not deleted branches of every company, by name. '
                    || 'Devices Branch combo.';
    r          fixed.dropdown_details%ROWTYPE;
    v_sql      text;
    v_reg      text;
    v_sort     varchar;
    v_desc     text;
BEGIN
    SELECT * INTO r
      FROM fixed.dropdown_details d
     WHERE d.dropdown_id = 5
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE NOTICE '20261119213000: dropdown 5 is not here (fresh database: Dropdown_Details.sql carries the new row). Skipped.';
        RETURN;
    END IF;
    IF r.dropdown_name IS DISTINCT FROM 'branch' THEN
        RAISE NOTICE '20261119213000: dropdown 5 is "%", not branch. Left as is.', r.dropdown_name;
        RETURN;
    END IF;

    v_sql  := r.dropdown_sql;
    v_reg  := r.dropdown_sql_regional;
    v_sort := r.dropdown_sort_column;
    v_desc := r.dropdown_description;

    IF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_new_sql, '\s+', ' ', 'g') THEN
        RAISE NOTICE '20261119213000: dropdown 5 SQL already lists active branches only. Nothing to do.';
    ELSIF regexp_replace(coalesce(v_sql, ''), '\s+', ' ', 'g') = regexp_replace(v_old_sql, '\s+', ' ', 'g') THEN
        v_sql := v_new_sql;
    ELSE
        RAISE NOTICE '20261119213000: dropdown 5 SQL is not the shipped text (edited since?). Left as is.';
    END IF;

    IF v_reg IS NULL THEN
        NULL;
    ELSIF regexp_replace(v_reg, '\s+', ' ', 'g') = regexp_replace(v_old_reg, '\s+', ' ', 'g') THEN
        v_reg := NULL;
    ELSE
        RAISE NOTICE '20261119213000: dropdown 5 regional SQL is not the shipped text. Left as is; it runs before dropdown_sql, so it must filter too.';
    END IF;

    IF v_sort = v_old_sort THEN
        v_sort := v_new_sort;
    END IF;

    IF v_desc = v_old_desc THEN
        v_desc := v_new_desc;
    END IF;

    IF v_sql  IS DISTINCT FROM r.dropdown_sql
    OR v_reg  IS DISTINCT FROM r.dropdown_sql_regional
    OR v_sort IS DISTINCT FROM r.dropdown_sort_column
    OR v_desc IS DISTINCT FROM r.dropdown_description THEN
        UPDATE fixed.dropdown_details
           SET dropdown_sql          = v_sql,
               dropdown_sql_regional = v_reg,
               dropdown_sort_column  = v_sort,
               dropdown_description  = v_desc,
               dropdown_modified_by  = 'system',
               dropdown_modified_on  = now()
         WHERE dropdown_id = 5;
    END IF;
END
$mig$;
