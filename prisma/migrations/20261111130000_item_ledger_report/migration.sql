-- ═══════════════════════════════════════════════════════════════════════════
--  Item Ledger report (stock), phase P1 (DB)                     2026-11-11
--  Plan: Shared/Prathap/report/plan-item-ledger-2026-11-11.md §4.1 and the
--  user's answers Q1-Q3 (2026-11-11); mockup item_ledger_ui_mockup_v2.png
--  (approved). The report writes nothing: its data comes from the GET routes
--  /stock/reports/item-ledger/* (raw SQL in TypeScript). No table, column,
--  CHECK, function or trigger, so db_table_master, the Prisma models and
--  ensure_acc_year_partitions are not touched. Sorts after
--  20261111120000_sales_order_entry_grid205_widths.
--
--  1 · menus (ids pinned; checked free on the live DB 2026-11-11: max 299,
--      sequence 299, no user_menus row for 300 / 301):
--        300  "Stock Reports"  folder under 6 Reports at 15.00, between
--                              137 Accounts Reports (10.00) and 290 Price
--                              Change Log (20.00). Verbs {VIEW}. The Stock
--                              Summary will take 300 / 10.00 later.
--        301  "Item Ledger"    under 300 at 20.00. Verbs {VIEW,PRINT,EXPORT}
--                              as Party Outstanding (279): VIEW opens the page
--                              and the Ctrl+F10 popup, PRINT / EXPORT gate the
--                              buttons (plan D21).
--
--  2 · grants (answer Q2): every user with a live View on a screen that moves
--      stock or will open the report by Ctrl+F10: 11 Sales Order, 12 Sales
--      Bill, 182 Delivery Challan, 23 Purchase Order, 24 Purchase Entry,
--      41 Godown Transfer, 192 Branch Outward, 193 Branch Inward, 264 Stock
--      Adjustment, 44 Opening Stock, 45 Physical Stock (dev: 7 users). Each
--      gets 301 with VIEW + PRINT + EXPORT (every other flag false), and a
--      VIEW-only 300 and 6 row where one is missing, so the tree is not empty.
--
--  3 · fixed.error_message: the 9 ITEM_LEDGER_* codes of plan §4.1(c); the
--      prefix was unused. Catalogue 2026-11-11.1. A malformed query is the
--      house ValidationPipe's 400 VALIDATION_*, whose rows already exist.
--
--  4 · print purpose ITEM_LEDGER (REPORT / ITEM_LEDGER, 1 copy, sort 132,
--      after PARTY_OUTSTANDING 131), written like
--      20261015130000_party_outstanding_print_purpose. Ships no template: the
--      A4 design goes to docs/print-templates/item-ledger-a4/ (P2) and is
--      assigned in Printing Assignments (menu 248).
--
--  5 · ix_sml_item_ledger on stock.stock_ledger (plan §4.1(e) / §5.5): a
--      covering index, so the opening sum (every row of the item at the branch
--      before From, all years) is an index-only range scan with no heap visit.
--      Created on the partitioned parent, PostgreSQL builds it on every
--      partition (2024-2025 .. 2027-2028 on dev) and clones it onto every
--      partition created later (stock.fn_create_stock_partitions, reached from
--      public.ensure_acc_year_partitions, uses CREATE TABLE ... PARTITION OF),
--      so the helper needs no change. Non-unique, no CHECK: two offline
--      branches can never trip it. Partial (WHERE sml_is_deleted = false), so
--      it is NOT declared in prisma/stocks/stockLedger.prisma, like every other
--      index on this table. ix_sml_item_date stays (the From..To rows).
--      LOCKING: a plain CREATE INDEX holds a SHARE lock on the ledger and all
--      its partitions until the migration commits: reads go on, stock posting
--      (sales, purchase, stock vouchers) waits. CONCURRENTLY cannot run inside
--      the transaction Prisma wraps a migration in. It is therefore the LAST
--      statement here, so the lock lasts only for the build itself, and it
--      runs under lock_timeout 10s (the user's choice, 2026-11-11): if a long
--      transaction holds the ledger, the migration fails fast instead of
--      queueing every ledger post behind it.
--
--  Ids are PINNED; the same menu rows are in prisma/seed/Menu_Master.sql and
--  the same wording rows in prisma/seed/Error_Messages.json. On a fresh
--  database menu 6 is seeded after migrations, so 300 / 301 come from the
--  seed there and no grant is made (there are no users yet). An id or name
--  already taken by something else stops the migration. Re-runnable: every
--  statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids and names must be free (or already ours) ────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', m.menu_id, m.menu_name) AS x
          FROM fixed.menu_master m
          JOIN (VALUES (300, 'Stock Reports'::text),
                       (301, 'Item Ledger')
               ) v(id, name) ON v.id = m.menu_id
         WHERE m.menu_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('print purpose %s (%s / %s)', p.ppo_code, p.ppo_src_module, p.ppo_doc_type)
          FROM public.print_purpose p
         WHERE p.ppo_company_id IS NULL
           AND lower(p.ppo_code::text) = 'item_ledger'
           AND p.ppo_is_deleted = false
           AND (p.ppo_src_module::text, p.ppo_doc_type::text) IS DISTINCT FROM ('REPORT', 'ITEM_LEDGER')
        UNION ALL
        SELECT format('index %s (%s)', i.indexrelid::regclass, pg_get_indexdef(i.indexrelid))
          FROM pg_index i
         WHERE i.indexrelid = to_regclass('stock.ix_sml_item_ledger')
           AND (i.indrelid <> 'stock.stock_ledger'::regclass
                OR strpos(pg_get_indexdef(i.indexrelid),
                          '(sml_company_id, sml_branch_id, sml_item_id, sml_doc_date) INCLUDE (sml_signed_base_qty, sml_direction, sml_cost_value, sml_cost_value_wot, sml_godown_id, sml_lot_id, sml_bucket) WHERE (sml_is_deleted = false)') = 0)
        UNION ALL
        SELECT format('error code %s (worded "%s")', e.erm_code, e.erm_line)
          FROM fixed.error_message e
          JOIN (VALUES
                ('ITEM_LEDGER_RIGHT_VIEW'::text, 'Not allowed'::text, 'You have no right to open the Item Ledger.'::text, 'Call manager.'::text),
                ('ITEM_LEDGER_BRANCH_NOT_IN_COMPANY', 'Wrong branch', 'That branch is not part of this company.', 'Pick a branch of this company.'),
                ('ITEM_LEDGER_ITEM_NOT_FOUND', 'Item not found', 'This item is not there now, or it belongs to another company.', 'Pick the item again.'),
                ('ITEM_LEDGER_RANGE_REVERSED', 'Dates the wrong way', 'From date is after To date.', 'Change From or To.'),
                ('ITEM_LEDGER_GODOWN_NOT_IN_BRANCH', 'Wrong godown', 'That godown is not in this branch.', 'Pick a godown of this branch, or All godowns.'),
                ('ITEM_LEDGER_LOT_NOT_OF_ITEM', 'Wrong batch', 'That batch is not one of this item''s.', 'Pick one of its batches, or All batches.'),
                ('ITEM_LEDGER_UNIT_NOT_OF_ITEM', 'Wrong unit', 'That unit is not one of this item''s units.', 'Pick one of its units, or the base unit.'),
                ('ITEM_LEDGER_NO_FISCAL_YEAR', 'No financial year', 'The To date is outside every financial year of this company.', 'Pick a To date inside a financial year.'),
                ('ITEM_LEDGER_TOO_MANY_ROWS', 'Too many rows', 'Print and Excel take up to 20,000 rows; this period has more.', 'Pick a shorter period, then try again.')
               ) v(code, title, line, todo) ON v.code = e.erm_code
         WHERE e.erm_variant = '' AND e.erm_lang = 'en'
           AND (e.erm_title, e.erm_line, e.erm_todo)::text IS DISTINCT FROM (v.title, v.line, v.todo)::text
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Item Ledger: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;
END $$;


-- ── 1 · menus 300 "Stock Reports" and 301 "Item Ledger" ────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 300, 6, 'Stock Reports', NULL, true, 15.00, true, false, '{VIEW}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 6)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 300);

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 301, 300, 'Item Ledger', NULL, true, 20.00, true, false, '{VIEW,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 300)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 301);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 301 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── 2 · rights (answer Q2) ─────────────────────────────────────────────────
-- 301 for every live View on a stock-moving screen: VIEW, PRINT, EXPORT only.
-- One row per user (DISTINCT ON); um_created_by is taken from the user's
-- lowest-numbered source row.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT DISTINCT ON (u.um_user_id)
       u.um_user_id, 301, true, false, false, false,
       true, true, true, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id IN (11, 12, 182, 23, 24, 41, 192, 193, 264, 44, 45)
   AND u.um_is_deleted = false
   AND u.um_can_view = true
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 301 AND m.menu_name = 'Item Ledger')
 ORDER BY u.um_user_id, u.um_menu_id
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The folder 300, VIEW only, for a 301 grantee without one.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT n.um_user_id, 300, true, true, n.um_created_by
  FROM public.user_menus n
 WHERE n.um_menu_id = 301
   AND n.um_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM public.user_menus p WHERE p.um_user_id = n.um_user_id AND p.um_menu_id = 300)
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The module 6 Reports, VIEW only, for a 301 grantee without one.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT n.um_user_id, 6, true, true, n.um_created_by
  FROM public.user_menus n
 WHERE n.um_menu_id = 301
   AND n.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 6)
   AND NOT EXISTS (SELECT 1 FROM public.user_menus p WHERE p.um_user_id = n.um_user_id AND p.um_menu_id = 6)
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 3 · plain wording rows (notes 120), catalogue 2026-11-11.1 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('ITEM_LEDGER_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open the Item Ledger.', 'Call manager.')
    ,('ITEM_LEDGER_BRANCH_NOT_IN_COMPANY', '', 'en', 'Wrong branch', 'That branch is not part of this company.', 'Pick a branch of this company.')
    ,('ITEM_LEDGER_ITEM_NOT_FOUND', '', 'en', 'Item not found', 'This item is not there now, or it belongs to another company.', 'Pick the item again.')
    ,('ITEM_LEDGER_RANGE_REVERSED', '', 'en', 'Dates the wrong way', 'From date is after To date.', 'Change From or To.')
    ,('ITEM_LEDGER_GODOWN_NOT_IN_BRANCH', '', 'en', 'Wrong godown', 'That godown is not in this branch.', 'Pick a godown of this branch, or All godowns.')
    ,('ITEM_LEDGER_LOT_NOT_OF_ITEM', '', 'en', 'Wrong batch', 'That batch is not one of this item''s.', 'Pick one of its batches, or All batches.')
    ,('ITEM_LEDGER_UNIT_NOT_OF_ITEM', '', 'en', 'Wrong unit', 'That unit is not one of this item''s units.', 'Pick one of its units, or the base unit.')
    ,('ITEM_LEDGER_NO_FISCAL_YEAR', '', 'en', 'No financial year', 'The To date is outside every financial year of this company.', 'Pick a To date inside a financial year.')
    ,('ITEM_LEDGER_TOO_MANY_ROWS', '', 'en', 'Too many rows', 'Print and Excel take up to 20,000 rows; this period has more.', 'Pick a shorter period, then try again.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-11.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-11.1';


-- ── 4 · print purpose ITEM_LEDGER ──────────────────────────────────────────
INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT 'ITEM_LEDGER', 'Item Ledger', 'REPORT', 'ITEM_LEDGER', 1,
       'NA', true, 132,
       'The Vouchers tab of the Item Ledger (menu 301): the opening, every movement of one item at one branch in posting order with the running balance, the period total and the closing. Datasets from the providers reports.item_ledger.head (one) and .rows (many), which call the report''s own /export; docId = the company; prompts item_id, branch_id, from_date, to_date (required), then godown_id, bucket, lot_id, types, unit_id, value_at, show_reversed, order.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose
                    WHERE ppo_company_id IS NULL AND lower(ppo_code::text) = 'item_ledger'
                      AND ppo_is_deleted = false);


-- ── 5 · covering index for the opening sum (LAST: it blocks ledger writes) ──
-- Fail fast instead of queueing ledger posts: a CREATE INDEX waiting for its
-- SHARE lock makes every later stock post wait behind it. After 10 s it gives
-- up and the whole migration rolls back. On a failed apply, DELETE the failed
-- _prisma_migrations row for 20261111130000_item_ledger_report and run
-- migrate deploy again out of hours. SET LOCAL ends with the migration's
-- transaction.
SET LOCAL lock_timeout = '10s';

CREATE INDEX IF NOT EXISTS ix_sml_item_ledger
    ON stock.stock_ledger
       (sml_company_id, sml_branch_id, sml_item_id, sml_doc_date)
       INCLUDE (sml_signed_base_qty, sml_direction, sml_cost_value, sml_cost_value_wot,
                sml_godown_id, sml_lot_id, sml_bucket)
    WHERE sml_is_deleted = false;


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id IN (300, 301);
-- SELECT um_menu_id, count(*) FROM public.user_menus WHERE um_menu_id IN (300, 301) GROUP BY 1;
-- SELECT erm_code FROM fixed.error_message WHERE erm_code LIKE 'ITEM_LEDGER%';
-- SELECT ppo_code, ppo_sort_order FROM public.print_purpose WHERE ppo_code = 'ITEM_LEDGER';
-- SELECT indexrelid::regclass FROM pg_index WHERE indexrelid::regclass::text LIKE '%ix_sml_item_ledger%' OR indrelid::regclass::text LIKE 'stock.stock_ledger_%';
