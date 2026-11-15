-- ═══════════════════════════════════════════════════════════════════════════
--  Dropdown 48 "PRINT PURPOSES - DESKTOP" returns ppo_company_id  2026-11-15
--  Folder: prisma/migrations/20261116130000_print_purpose_dropdown_company/
--  (share copy: Shared/Prathap/accounts/sql/voucher-types-print-purpose-dropdown-company-2026-11-15.sql).
--  Review: Shared/Prathap/accounts/voucher-types-review-2026-11-15.md, S1.
--  Plan:   Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md, decision 61.
--
--  ux_ppo_code is unique per company, so two companies may each own a design
--  with the same code. NexERP printing (DocumentPrint::findPurposeId) now takes
--  the document company's own design, else a shared one (ppo_company_id NULL),
--  never another company's; it can tell them apart only when dropdown 48 carries
--  ppo_company_id. Until then it refuses any code more than one company holds.
--
--  1 · dropdown_sql gains ppo_company_id as its third column. Still NOT filtered
--      by company: the Print Designer (62), Print Templates and Print
--      Assignments (248) list every purpose, and Qt does the filtering. Every
--      reader takes the row by key (ppo_id, ppo_code); NexDropdown takes column
--      0 (ppo_id) as the id and the completion column (ppo_code) as the text,
--      so columns 0 and 1 stay as they are. Web dropdown 47 is not touched.
--      Guard: the SQL moves only while it is the shipped text (white space
--      folded). Already the new text: nothing to do. Dropdown 48 absent (a
--      fresh database: dropdowns are seeded after migrations, and
--      prisma/seed/Dropdown_Details.sql carries the new text): skipped. Any
--      other text: left as is, with a notice.
--  2 · dropdown_columns: column 2 'Company' (ppo_company_id), hidden, not
--      searched, pinned uuid ...0482 (prisma/seed/Dropdown_Columns.sql carries
--      it). Added only when the dropdown's SQL returns ppo_company_id, and no
--      column of dropdown 48 already reads it or holds number 2.
--
--  Re-runnable. No function, no trigger, no DDL.
-- ═══════════════════════════════════════════════════════════════════════════

DO $mig$
DECLARE
    v_old  text := $old48$SELECT
	ppo_id,
	ppo_code
FROM public.print_purpose
WHERE ppo_is_active = true AND ppo_is_deleted = false
ORDER BY ppo_code;$old48$;
    v_new  text := $new48$SELECT
	ppo_id,
	ppo_code,
	ppo_company_id
FROM public.print_purpose
WHERE ppo_is_active = true AND ppo_is_deleted = false
ORDER BY ppo_code;$new48$;
    v_name text;
    v_cur  text;
    v_col  text;
BEGIN
    SELECT d.dropdown_name, d.dropdown_sql INTO v_name, v_cur
      FROM fixed.dropdown_details d
     WHERE d.dropdown_id = 48;

    IF NOT FOUND THEN
        RAISE NOTICE '20261116130000: dropdown 48 is not here (fresh database: Dropdown_Details.sql and Dropdown_Columns.sql carry the new SQL and column). Skipped.';
        RETURN;
    END IF;
    IF v_name IS DISTINCT FROM 'PRINT PURPOSES - DESKTOP' THEN
        RAISE NOTICE '20261116130000: dropdown 48 is "%", not PRINT PURPOSES - DESKTOP. Left as is.', v_name;
        RETURN;
    END IF;

    IF regexp_replace(v_cur, '\s+', ' ', 'g') = regexp_replace(v_new, '\s+', ' ', 'g') THEN
        RAISE NOTICE '20261116130000: dropdown 48 already returns ppo_company_id. Nothing to do.';
    ELSIF regexp_replace(v_cur, '\s+', ' ', 'g') = regexp_replace(v_old, '\s+', ' ', 'g') THEN
        UPDATE fixed.dropdown_details
           SET dropdown_sql         = v_new,
               dropdown_modified_by = 'system',
               dropdown_modified_on = now()
         WHERE dropdown_id = 48;
        v_cur := v_new;
    ELSE
        RAISE NOTICE '20261116130000: dropdown 48 SQL is not the shipped text (edited since?). Left as is; Qt printing refuses a code more than one company holds until it returns ppo_company_id.';
    END IF;

    SELECT string_agg(format('column %s "%s" (%s)', c.dropdown_columns_no, c.dropdown_columns_name,
                             c.dropdown_columns_sql_name), '; ' ORDER BY c.dropdown_columns_no)
      INTO v_col
      FROM fixed.dropdown_columns c
     WHERE c.dropdown_columns_dropdown_id = 48
       AND (c.dropdown_columns_sql_name = 'ppo_company_id' OR c.dropdown_columns_no = 2);

    IF position('ppo_company_id' IN v_cur) = 0 THEN
        RAISE NOTICE '20261116130000: dropdown 48 SQL does not return ppo_company_id; no Company column added.';
    ELSIF v_col IS NOT NULL THEN
        RAISE NOTICE '20261116130000: dropdown 48 already has %. No Company column added.', v_col;
    ELSE
        INSERT INTO fixed.dropdown_columns
               (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
                dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
                dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
                dropdown_columns_sql_name, dropdown_columns_created_by)
        VALUES ('01a1b2c0-4800-7000-8000-000000000482', 48, 2, 'Text',
                'Company', NULL, 10.00,
                false, 'Left', false,
                'ppo_company_id', 'system')
        ON CONFLICT (dropdown_columns_id) DO NOTHING;
    END IF;
END $mig$;


-- Check after deploy (read-only):
-- SELECT position('ppo_company_id' IN dropdown_sql) > 0 AS has_company FROM fixed.dropdown_details WHERE dropdown_id = 48;
-- SELECT dropdown_columns_no, dropdown_columns_name, dropdown_columns_sql_name, dropdown_columns_visiblity
--   FROM fixed.dropdown_columns WHERE dropdown_columns_dropdown_id = 48 ORDER BY 1;
