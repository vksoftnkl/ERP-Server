-- ═══════════════════════════════════════════════════════════════════════════
--  Stock Summary report (stock), phase P1 (DB)                     2026-11-14
--
--  Folder: prisma/migrations/20261115100000_stock_summary_report/ (share
--  copy: Shared/Prathap/report/stock-summary-db/migration.sql).
--
--  Plan: Shared/Prathap/report/plan-stock-summary-2026-11-13.md §4.1 (a)-(e)
--  and the user's answers (2026-11-14, "do recommended, dry run only"):
--  Q1 = the users with a live View on 301 Item Ledger; Q2, Q3 and Q4 need no
--  DB change. The report writes nothing: its data comes from the GET routes
--  /stock/reports/summary/* (raw SQL in TypeScript). No table, column, index,
--  CHECK, function or trigger, so db_table_master, the Prisma models and
--  ensure_acc_year_partitions are not touched. Sorts after
--  20261114180000_app_theme_template_v64.
--
--  1 · menu 302 "Stock Summary" under 300 Stock Reports at 10.00 (before 301
--      Item Ledger at 20.00), verbs {VIEW,PRINT,EXPORT} as 301: VIEW opens the
--      page, PRINT / EXPORT gate the buttons. Checked free on the live DB
--      2026-11-14: max menu_id 301, sequence 301.
--
--  2 · grants (answer Q1): every user with a live View on 301 Item Ledger gets
--      302 with VIEW + PRINT + EXPORT; every other right (create, edit,
--      delete, post, cancel, amend, override, retender) false, not favourite,
--      not pinned, sort 0, um_visibility true (the menu shows), as 301 was
--      granted. um_created_by is taken from the user's 301 row. Dev
--      2026-11-14: 7 users (raman, ravi, tester1, VIGNESH, VIJAY, VKPOS,
--      VKPOS1). Each of them already holds 300 Stock Reports and 6 Reports,
--      so no folder row is added (the plan asks for none).
--
--  3 · fixed.error_message: the 12 STOCK_SUMMARY_* codes of plan §4.1(c); the
--      prefix was unused (0 rows, 2026-11-14). Catalogue 2026-11-14.3, the
--      version of prisma/seed/Error_Messages.json that carries these rows
--      (654 -> 666 active rows on dev). A malformed query is the house
--      ValidationPipe's 400 VALIDATION_*, whose rows already exist.
--
--  4 · print purpose STOCK_SUMMARY (REPORT / STOCK_SUMMARY, 1 copy, sort 133,
--      after ITEM_LEDGER 132), written like
--      20261111130000_item_ledger_report. Ships no template: the A4 landscape
--      design goes to docs/print-templates/stock-summary-a4/ (P2) and is
--      assigned in Printing Assignments (menu 248). Print purposes have no
--      seed file; this migration is their only source.
--
--  5 · ui_tables 78 / 79 (read-only, Desktop) and their columns 2625-2651.
--      ui_tbl_clm_no is the screen's column enum; titles are the on-screen
--      headers (caret column blank). No column takes focus, none is required.
--      Widths are percent; the shown ones add up to 97.00 and the last shown
--      column stretches.
--        78 "STOCK SUMMARY - ITEMS"  ids 2625-2641, numbers 0..16:
--           (caret) · Code · Item · Group · Unit · Opening · Inward · Outward
--           · Closing · Reserved · Available · In transit · Rate · Value ·
--           Last sale shown; Brand, ItemId hidden.
--        79 "STOCK SUMMARY - GROUPS" ids 2642-2651, numbers 0..9:
--           (caret) · Group (the screen retitles it by "Summarise by") ·
--           Items · Opening value · Inward value · Outward value · Cost adj.
--           · Closing value · Share % shown; Key hidden.
--      Godown-wise and Branch-wise have one column per godown / branch and
--      use NexTable::useLocalLayout(): not registered (plan D25).
--
--  Not in this migration: grid_details, dropdowns (17 / 18 / 26 / 61 / 22 are
--  used as they are), indexes (plan D24).
--
--  Ids are PINNED; the same menu rows are in prisma/seed/Menu_Master.sql, the
--  same layouts in Ui_Tables.sql / Ui_Table_Columns.sql and the same wording
--  in Error_Messages.json. On a fresh database menu 300 is seeded after
--  migrations, so 302 comes from the seed there and no grant is made (there
--  are no users yet). An id or name already held by something else stops the
--  migration. Re-runnable: every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids and names must be free (or already ours) ───────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s under %s)', m.menu_id, m.menu_name, m.menu_parent) AS x
          FROM fixed.menu_master m
         WHERE (m.menu_id = 302 AND m.menu_name IS DISTINCT FROM 'Stock Summary')
            OR (m.menu_id <> 302 AND m.menu_parent = 300 AND lower(m.menu_name) = 'stock summary')
        UNION ALL
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
          JOIN (VALUES (78::bigint, 'STOCK SUMMARY - ITEMS'::text),
                       (79, 'STOCK SUMMARY - GROUPS')
               ) v(id, name) ON v.id = t.ui_tbl_id OR upper(v.name) = upper(t.ui_tbl_name)
         WHERE (t.ui_tbl_id, t.ui_tbl_name) IS DISTINCT FROM (v.id, v.name)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES (78::bigint, 2625::bigint, 17), (79, 2642, 10)
               ) v(tbl, first_id, cnt) ON c.ui_tbl_clm_id BETWEEN v.first_id AND v.first_id + v.cnt - 1
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, c.ui_tbl_clm_id - v.first_id)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s, not one of ours)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_table_id IN (78, 79)
           AND c.ui_tbl_clm_is_deleted = false
           AND c.ui_tbl_clm_id NOT BETWEEN 2625 AND 2651
        UNION ALL
        SELECT format('print purpose %s (%s / %s)', p.ppo_code, p.ppo_src_module, p.ppo_doc_type)
          FROM public.print_purpose p
         WHERE p.ppo_company_id IS NULL
           AND lower(p.ppo_code::text) = 'stock_summary'
           AND p.ppo_is_deleted = false
           AND (p.ppo_src_module::text, p.ppo_doc_type::text) IS DISTINCT FROM ('REPORT', 'STOCK_SUMMARY')
        UNION ALL
        SELECT format('error code %s (worded "%s")', e.erm_code, e.erm_line)
          FROM fixed.error_message e
          JOIN (VALUES
                ('STOCK_SUMMARY_RIGHT_VIEW'::text, 'Not allowed'::text, 'You have no right to open the Stock Summary.'::text, 'Call manager.'::text),
                ('STOCK_SUMMARY_RIGHT_EXPORT', 'Not allowed', 'You have no right to export the Stock Summary.', 'Call manager.'),
                ('STOCK_SUMMARY_RIGHT_PRINT', 'Not allowed', 'You have no right to print the Stock Summary.', 'Call manager.'),
                ('STOCK_SUMMARY_RANGE_REVERSED', 'Dates the wrong way', 'From date is after To date.', 'Change From or To.'),
                ('STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY', 'Wrong branch', 'That branch is not part of this company.', 'Pick a branch of this company.'),
                ('STOCK_SUMMARY_GODOWN_NOT_IN_BRANCH', 'Wrong godown', 'That godown is not in this branch.', 'Pick a godown of this branch, or All godowns.'),
                ('STOCK_SUMMARY_GROUP_NOT_FOUND', 'Group not found', 'That item group is not there now.', 'Pick the group again, or All groups.'),
                ('STOCK_SUMMARY_BRAND_NOT_FOUND', 'Brand not found', 'That brand is not there now.', 'Pick the brand again, or All brands.'),
                ('STOCK_SUMMARY_ITEM_NOT_FOUND', 'Item not found', 'This item is not there now, or it belongs to another company.', 'Pick the row again.'),
                ('STOCK_SUMMARY_RUN_EXPIRED', 'Report expired', 'This report was shown too long ago to page through.', 'Press Show again.'),
                ('STOCK_SUMMARY_TOO_MANY_ROWS', 'Too many rows', 'Print and Excel take up to 20,000 rows; this report has more.', 'Pick a group or a brand, then try again.'),
                ('STOCK_SUMMARY_TOO_MANY_ITEMS', 'Too many items', 'This report would list more than 50,000 items.', 'Pick a group or a brand, then press Show.')
               ) v(code, title, line, todo) ON v.code = e.erm_code
         WHERE e.erm_variant = '' AND e.erm_lang = 'en'
           AND (e.erm_title, e.erm_line, e.erm_todo)::text IS DISTINCT FROM (v.title, v.line, v.todo)::text
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Stock Summary: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;
    IF EXISTS (SELECT 1 FROM public.print_purpose p
                WHERE p.ppo_sort_order = 133 AND p.ppo_is_deleted = false
                  AND lower(p.ppo_code::text) <> 'stock_summary') THEN
        RAISE NOTICE 'Stock Summary: another print purpose also sorts at 133; the two are listed side by side (not an error).';
    END IF;
END $$;


-- ── 1 · menu 302 "Stock Summary" ───────────────────────────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 302, 300, 'Stock Summary', NULL, true, 10.00, true, false, '{VIEW,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 300)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 302);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 302 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 1) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── 2 · rights (answer Q1) ─────────────────────────────────────────────────
-- 302 for every live View on 301 Item Ledger: VIEW, PRINT, EXPORT only.
-- (um_user_id, um_menu_id) is unique, so there is one 301 row per user.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 302, true, false, false, false,
       true, true, true, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 301
   AND u.um_is_deleted = false
   AND u.um_can_view = true
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 302 AND m.menu_name = 'Stock Summary')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 3 · plain wording rows (notes 120), catalogue 2026-11-14.3 ──────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('STOCK_SUMMARY_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open the Stock Summary.', 'Call manager.')
    ,('STOCK_SUMMARY_RIGHT_EXPORT', '', 'en', 'Not allowed', 'You have no right to export the Stock Summary.', 'Call manager.')
    ,('STOCK_SUMMARY_RIGHT_PRINT', '', 'en', 'Not allowed', 'You have no right to print the Stock Summary.', 'Call manager.')
    ,('STOCK_SUMMARY_RANGE_REVERSED', '', 'en', 'Dates the wrong way', 'From date is after To date.', 'Change From or To.')
    ,('STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY', '', 'en', 'Wrong branch', 'That branch is not part of this company.', 'Pick a branch of this company.')
    ,('STOCK_SUMMARY_GODOWN_NOT_IN_BRANCH', '', 'en', 'Wrong godown', 'That godown is not in this branch.', 'Pick a godown of this branch, or All godowns.')
    ,('STOCK_SUMMARY_GROUP_NOT_FOUND', '', 'en', 'Group not found', 'That item group is not there now.', 'Pick the group again, or All groups.')
    ,('STOCK_SUMMARY_BRAND_NOT_FOUND', '', 'en', 'Brand not found', 'That brand is not there now.', 'Pick the brand again, or All brands.')
    ,('STOCK_SUMMARY_ITEM_NOT_FOUND', '', 'en', 'Item not found', 'This item is not there now, or it belongs to another company.', 'Pick the row again.')
    ,('STOCK_SUMMARY_RUN_EXPIRED', '', 'en', 'Report expired', 'This report was shown too long ago to page through.', 'Press Show again.')
    ,('STOCK_SUMMARY_TOO_MANY_ROWS', '', 'en', 'Too many rows', 'Print and Excel take up to 20,000 rows; this report has more.', 'Pick a group or a brand, then try again.')
    ,('STOCK_SUMMARY_TOO_MANY_ITEMS', '', 'en', 'Too many items', 'This report would list more than 50,000 items.', 'Pick a group or a brand, then press Show.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-14.3',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-14.3';


-- ── 4 · print purpose STOCK_SUMMARY ────────────────────────────────────────
INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT 'STOCK_SUMMARY', 'Stock Summary', 'REPORT', 'STOCK_SUMMARY', 1,
       'NA', true, 133,
       'The Item-wise tab of the Stock Summary (menu 302): one row per item at one branch with opening, inward, outward and closing quantity, rate, value and last sale, then the value total. Datasets from the providers reports.stock_summary.head (one) and .rows (many), which read the report''s run; docId = the company; prompts run_id (optional), branch_id, from_date, to_date (required), then godown_id, group_id, brand_id, bucket, value_at, qty_in, hide_zero, only_negative, no_sale_days, sort, dir.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose
                    WHERE ppo_company_id IS NULL AND lower(ppo_code::text) = 'stock_summary'
                      AND ppo_is_deleted = false);


-- ── 5 · ui_tables 78 / 79 and their columns ────────────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (78, 'STOCK SUMMARY - ITEMS',  false, 'Desktop', true, false, 'system'),
       (79, 'STOCK SUMMARY - GROUPS', false, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, false, v.no::integer, false, true, false, 'system'
  FROM (VALUES
        (2625::bigint, 78::bigint, 0::bigint, ''::text,          1.40::numeric, true::boolean),
        (2626, 78,  1, 'Code',            7.40, true),
        (2627, 78,  2, 'Item',           21.00, true),
        (2628, 78,  3, 'Group',           9.60, true),
        (2629, 78,  4, 'Unit',            3.20, true),
        (2630, 78,  5, 'Opening',         5.20, true),
        (2631, 78,  6, 'Inward',          5.20, true),
        (2632, 78,  7, 'Outward',         5.20, true),
        (2633, 78,  8, 'Closing',         5.60, true),
        (2634, 78,  9, 'Reserved',        5.00, true),
        (2635, 78, 10, 'Available',       5.40, true),
        (2636, 78, 11, 'In transit',      5.00, true),
        (2637, 78, 12, 'Rate',            4.60, true),
        (2638, 78, 13, 'Value',           7.20, true),
        (2639, 78, 14, 'Last sale',       6.00, true),
        (2640, 78, 15, 'Brand',           6.00, false),
        (2641, 78, 16, 'ItemId',          4.00, false),
        (2642, 79,  0, '',                1.40, true),
        (2643, 79,  1, 'Group',          30.00, true),
        (2644, 79,  2, 'Items',           5.00, true),
        (2645, 79,  3, 'Opening value',  11.00, true),
        (2646, 79,  4, 'Inward value',   11.00, true),
        (2647, 79,  5, 'Outward value',  11.00, true),
        (2648, 79,  6, 'Cost adj.',       8.60, true),
        (2649, 79,  7, 'Closing value',  12.00, true),
        (2650, 79,  8, 'Share %',         7.00, true),
        (2651, 79,  9, 'Key',             4.00, false)
       ) v(id, tbl, no, name, width, visible)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t
                WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name LIKE 'STOCK SUMMARY - %')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT COALESCE(max(ui_tbl_id), 1) FROM fixed.ui_tables),
                       (SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq)));
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT COALESCE(max(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns),
                       (SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id = 302;
-- SELECT count(*) FROM public.user_menus WHERE um_menu_id = 302;
-- SELECT erm_code FROM fixed.error_message WHERE erm_code LIKE 'STOCK\_SUMMARY\_%' ORDER BY 1;
-- SELECT ppo_code, ppo_sort_order FROM public.print_purpose WHERE ppo_code = 'STOCK_SUMMARY';
-- SELECT ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width, ui_tbl_clm_column_visibility
--   FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id IN (78, 79) ORDER BY 1, 2;
