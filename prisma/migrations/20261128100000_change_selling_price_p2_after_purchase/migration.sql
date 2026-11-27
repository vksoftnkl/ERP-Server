-- ═══════════════════════════════════════════════════════════════════════════
--  Change Selling Price P2, cost after a purchase, step P2-1 (DB)    2026-11-26
--  Folder: prisma/migrations/20261128100000_change_selling_price_p2_after_purchase/
--  (share copy: Shared/Prathap/admin/sql/csp-p2-migration.sql, run by
--  run-csp-p2-apply.sh, checked by csp-p2-assert.sql).
--
--  Plan: Shared/Prathap/inventory/plan-change-selling-price-p2-cost-after-purchase-2026-11-24.md
--  §6 (DB), §4.1 (the setting), §4.6 (results), §4.10 (offline); Q1-Q12 answered
--  "all recommended" 2026-11-24. Addendum: plan-change-selling-price-p2-addendum-1-2026-11-26.md
--  §6 (DB deltas), decisions 26 and 39; P2A-Q1 / P2A-Q2 answered as recommended
--  and the user's "go" 2026-11-26. Where the two differ the addendum wins.
--  Sorts after 20261127180000_app_theme_template_v69. Every id, name and value
--  list below was read from the live dev DB on 2026-11-26.
--
--   0 · guards: every pinned id / key / name is free or already ours. A clash
--       is named in a WARNING and only that piece is skipped (a ui column whose
--       id is taken gets a fresh id instead). Never raises on a live mismatch
--       (P3009); the runner's assert file is what refuses a dev apply with a
--       piece missing.
--   1 · settings catalogue (§6.1): purchase.price_update becomes "After a
--       purchase" (same key, same four tokens, default OPEN_CHANGE_SELLING,
--       sort 10, the new description); purchase.allow_price_update retired
--       (asd_is_active = false; the row stays, value rows reference it);
--       purchase.price_set_at gets its new description.
--   2 · value move (Q2: existing companies keep today's behaviour). Each live
--       company's purchase.allow_price_update is read as the server reads it:
--       its live COMPANY row, else the live GLOBAL row, else the catalogue
--       default 'false'; on = true / 1 / yes / y / on. Every row this step
--       inserts carries the FIXED id md5('csp-p2-price-update|' || comp_id)::uuid
--       (decision 39), so the cloud and every branch server make the same row
--       and ux_asv_scope_target cannot clash at sync; ON CONFLICT (asv_id) DO
--       NOTHING, so a fixed-id row already there (live, or reset = deleted and
--       synced in) is never made again.
--       a. switch OFF, no live COMPANY purchase.price_update row -> one is
--          inserted with value NONE ("Do nothing");
--       b. switch OFF, a live COMPANY purchase.price_update row it already has
--          -> NONE (the plan's second step), except the fixed-id row: a value
--          other than NONE there was chosen by an admin after P2 and stays;
--       c. switch ON, no live purchase.price_update row at all (COMPANY or
--          GLOBAL) -> one is inserted with value UPDATE_PRICES, the catalogue
--          default before P2 (20261028140000), which that company runs today
--          (the user, 2026-11-26: such a company keeps it; without the row it
--          would take the new default OPEN_CHANGE_SELLING);
--       d. switch ON with a live COMPANY or GLOBAL purchase.price_update row
--          -> kept as it is (it already says what the company runs).
--       Deleted rows are ignored (104 allow_price_update + 44 price_update on
--       dev, all deleted test toggles). A company made after P2 gets the
--       catalogue default.
--   3 · purchase.pur_invoice_item: ck_pii_price_result widened to the eight
--       results of §4.6 (+ COST_ONLY, LATER_BILL, NO_LINE, TO_REVIEW). Value
--       shape only; made on the partitioned parent, so every year partition
--       (and every later one) carries it. Replaced only while a value is
--       missing. All eight fit varchar(12).
--   4 · ui_table 44 CHANGE SELLING PRICE - ROWS (addendum §6.3, decision 26):
--       + 59 From the bill (id 2893, width 14.00, hidden, no Enter stop) at
--       position 6, right after Branch (5); + 60 BillKind (id 2894, width 0,
--       hidden) at 60. Every live column at position 6 or later moves one up
--       (Stock 7 ... Min 29, Sale Px 30 ... Spread 59); positions stay a rank,
--       each column its own. Only positions change: names, widths, hides and
--       Enter stops are as 20261124190000 left them, and the 28 shown widths
--       still add up to 100.00 (both new columns are hidden). The users' own
--       column choices (setting ui.grid_columns, keyed by column number) are
--       not touched.
--   5 · 11 wording rows (plan §6.4 + addendum §6.4): STOCK_PRICE_BILL_NOT_FOUND,
--       STOCK_PRICE_BILL_NOT_POSTED, STOCK_PRICE_LATER_PURCHASE, PUR_PRICE_LATER_BILL,
--       PUR_PRICE_NO_LINE, PUR_PRICE_TO_REVIEW, PUR_PRICE_BELOW_NEW_COST,
--       PUR_PRICE_RESTORED, PUR_PRICE_KEPT_ON_CANCEL, STICKER_DOC_PRICES_PENDING
--       and the PUR_PRICE_NOT_WRITTEN variant rule=ABOVE_MRP (the plain row
--       stays); catalogue 2026-11-28.1 (1,015 -> 1,026 rows on dev).
--
--  No table, column, index, function or trigger; no db_table_master row.
--  prisma/seed/Ui_Table_Columns.sql and prisma/seed/Error_Messages.json carry
--  the same rows for a fresh database (ui tables are seeded after the
--  migrations, so section 4 no-ops there; a fresh database has no company
--  yet, so section 2 inserts nothing). The settings have no seed file: the
--  catalogue rows come from 20261028140000 and this migration. Every
--  statement is re-runnable: applied twice in one transaction the second run
--  changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / keys / names free (or already ours) ──────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('ui_table 44 is "%s"', t.ui_tbl_name) AS x
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 44 AND t.ui_tbl_name IS DISTINCT FROM 'CHANGE SELLING PRICE - ROWS'
        UNION ALL
        SELECT format('ui_table_columns id %s is table %s no %s (a fresh id is used instead)',
                      c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id IN (2893, 2894)
           AND (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (44::bigint, (c.ui_tbl_clm_id - 2834)::bigint)
        UNION ALL
        SELECT format('ui_table 44 column %s is "%s" (want "%s")', c.ui_tbl_clm_no, c.ui_tbl_clm_name, v.name)
          FROM fixed.ui_table_columns c
          JOIN (VALUES (59::bigint, 'From the bill'::text), (60, 'BillKind')) v(no, name) ON v.no = c.ui_tbl_clm_no
         WHERE c.ui_tbl_clm_table_id = 44 AND c.ui_tbl_clm_is_deleted = false AND c.ui_tbl_clm_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('setting %s is missing or %s (want %s)', v.key, COALESCE(s.asd_data_type, 'absent'), v.typ)
          FROM (VALUES ('purchase.price_update'::text, 'TEXT'::text),
                       ('purchase.allow_price_update', 'BOOL'),
                       ('purchase.price_set_at', 'TEXT')) v(key, typ)
          LEFT JOIN public.app_setting_def s ON s.asd_key = v.key
         WHERE s.asd_data_type IS DISTINCT FROM v.typ
        UNION ALL
        SELECT format('app_setting_value %s (a P2 fixed id) is %s %s of company %s', v.asv_id, v.asv_setting_key, v.asv_scope, v.asv_company_id)
          FROM public.app_setting_value v
          JOIN public.companys c ON v.asv_id = md5('csp-p2-price-update|' || c.comp_id::text)::uuid
         WHERE (v.asv_setting_key, v.asv_scope, v.asv_company_id) IS DISTINCT FROM ('purchase.price_update'::varchar, 'COMPANY'::varchar, c.comp_id)
        UNION ALL
        SELECT 'purchase.pur_invoice_item is missing or not partitioned'
         WHERE NOT EXISTS (SELECT 1 FROM pg_class c
                            WHERE c.oid = to_regclass('purchase.pur_invoice_item') AND c.relkind = 'p')
        UNION ALL
        SELECT format('wording %s%s is already "%s" (kept as it is)', e.erm_code,
                      CASE WHEN e.erm_variant = '' THEN '' ELSE ' ' || e.erm_variant END, e.erm_title)
          FROM fixed.error_message e
          JOIN (VALUES ('STOCK_PRICE_BILL_NOT_FOUND'::text, ''::text, 'Bill not found'::text),
                       ('STOCK_PRICE_BILL_NOT_POSTED', '', 'Bill not posted'),
                       ('STOCK_PRICE_LATER_PURCHASE', '', 'A later purchase'),
                       ('PUR_PRICE_LATER_BILL', '', 'Price not changed'),
                       ('PUR_PRICE_NO_LINE', '', 'No price yet'),
                       ('PUR_PRICE_TO_REVIEW', '', 'Prices to review'),
                       ('PUR_PRICE_BELOW_NEW_COST', '', 'Price below the new cost'),
                       ('PUR_PRICE_RESTORED', '', 'Prices put back'),
                       ('PUR_PRICE_KEPT_ON_CANCEL', '', 'Prices kept'),
                       ('STICKER_DOC_PRICES_PENDING', '', 'Prices wait for a review'),
                       ('PUR_PRICE_NOT_WRITTEN', 'rule=ABOVE_MRP', 'Price not changed')) w(code, variant, title)
            ON e.erm_code = w.code AND e.erm_variant = w.variant AND e.erm_lang = 'en'
         WHERE e.erm_title IS DISTINCT FROM w.title
    ) s;
    IF v_clash IS NOT NULL THEN
        RAISE WARNING 'Change Selling Price P2: already taken by something else, so that piece is skipped: %', v_clash;
    END IF;
END $$;


-- ── 1 · settings catalogue: "After a purchase" (§6.1, Q1) ─────────────────
UPDATE public.app_setting_def
   SET asd_label          = 'After a purchase',
       asd_default_value  = 'OPEN_CHANGE_SELLING',
       asd_allowed_values = '["NONE", "COST_ONLY", "UPDATE_PRICES", "OPEN_CHANGE_SELLING"]'::jsonb,
       asd_sort_order     = 10,
       asd_description    = 'What a posted purchase invoice does to the price lines of what it bought (a GRN never changes prices). NONE: Do nothing. COST_ONLY: Update cost only — the bought lines and their other units take the bill''s landing cost; selling prices stay. UPDATE_PRICES: Update cost and prices — as cost only, and the prices follow each line''s Profit Type; a price typed on the bill wins for the bought unit. OPEN_CHANGE_SELLING: Open Change Selling Price — nothing changes at post; Change Selling Price opens with the bill for a user with Edit on it. Only the latest purchase of an item moves its lines.',
       asd_modified_on    = now(),
       asd_modified_by    = 'system'
 WHERE asd_key = 'purchase.price_update'
   AND asd_data_type = 'TEXT'
   AND (asd_label, asd_default_value, asd_allowed_values, asd_sort_order, asd_description)
       IS DISTINCT FROM ('After a purchase'::varchar, 'OPEN_CHANGE_SELLING'::text,
                         '["NONE", "COST_ONLY", "UPDATE_PRICES", "OPEN_CHANGE_SELLING"]'::jsonb, 10::smallint,
                         'What a posted purchase invoice does to the price lines of what it bought (a GRN never changes prices). NONE: Do nothing. COST_ONLY: Update cost only — the bought lines and their other units take the bill''s landing cost; selling prices stay. UPDATE_PRICES: Update cost and prices — as cost only, and the prices follow each line''s Profit Type; a price typed on the bill wins for the bought unit. OPEN_CHANGE_SELLING: Open Change Selling Price — nothing changes at post; Change Selling Price opens with the bill for a user with Edit on it. Only the latest purchase of an item moves its lines.'::text);

-- Retired, not deleted: its value rows reference it (fk_asv_setting), and
-- fn_app_settings_effective lists active settings only, so the server reads
-- "off" for it from here on (loadPurchaseSettings' default).
UPDATE public.app_setting_def
   SET asd_is_active   = false,
       asd_description = 'Retired 2026-11 (Change Selling Price P2): After a purchase = Do nothing replaces it.',
       asd_modified_on = now(),
       asd_modified_by = 'system'
 WHERE asd_key = 'purchase.allow_price_update'
   AND asd_data_type = 'BOOL'
   AND (asd_is_active, asd_description)
       IS DISTINCT FROM (false, 'Retired 2026-11 (Change Selling Price P2): After a purchase = Do nothing replaces it.'::text);

UPDATE public.app_setting_def
   SET asd_description = 'Where Sell A–D are typed: on the bill (INVOICE) or already on the GRN (GRN). Either way they change the price lines only when the bill is posted (After a purchase).',
       asd_modified_on = now(),
       asd_modified_by = 'system'
 WHERE asd_key = 'purchase.price_set_at'
   AND asd_data_type = 'TEXT'
   AND asd_description IS DISTINCT FROM 'Where Sell A–D are typed: on the bill (INVOICE) or already on the GRN (GRN). Either way they change the price lines only when the bill is posted (After a purchase).';


-- ── 2 · value move: existing companies keep today's mode (Q2, decision 39) ─
DO $$
DECLARE
    v_live   int;
    v_off    uuid[];
    v_on     uuid[];
    v_ins    int := 0;
    v_ins_up int := 0;
    v_upd    int := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_setting_def
                    WHERE asd_key = 'purchase.price_update' AND asd_data_type = 'TEXT'
                      AND asd_is_active AND NOT asd_is_deleted)
       OR NOT EXISTS (SELECT 1 FROM public.app_setting_def
                       WHERE asd_key = 'purchase.allow_price_update' AND asd_data_type = 'BOOL') THEN
        RAISE WARNING 'Change Selling Price P2: value move skipped (purchase.price_update / allow_price_update not as expected)';
        RETURN;
    END IF;

    SELECT count(*),
           COALESCE(array_agg(s.comp_id ORDER BY s.comp_id)
                    FILTER (WHERE lower(btrim(COALESCE(s.allow_value, ''))) NOT IN ('true', '1', 'yes', 'y', 'on')),
                    '{}'),
           COALESCE(array_agg(s.comp_id ORDER BY s.comp_id)
                    FILTER (WHERE lower(btrim(COALESCE(s.allow_value, ''))) IN ('true', '1', 'yes', 'y', 'on')),
                    '{}')
      INTO v_live, v_off, v_on
      FROM (SELECT c.comp_id,
                   CASE WHEN co.asv_id IS NOT NULL THEN co.asv_value
                        WHEN gl.asv_id IS NOT NULL THEN gl.asv_value
                        ELSE d.asd_default_value END AS allow_value
              FROM public.companys c
              JOIN public.app_setting_def d ON d.asd_key = 'purchase.allow_price_update'
              LEFT JOIN public.app_setting_value co
                     ON co.asv_setting_key = 'purchase.allow_price_update' AND co.asv_scope = 'COMPANY'
                    AND co.asv_company_id = c.comp_id AND co.asv_is_deleted = false
              LEFT JOIN public.app_setting_value gl
                     ON gl.asv_setting_key = 'purchase.allow_price_update' AND gl.asv_scope = 'GLOBAL'
                    AND gl.asv_is_deleted = false
             WHERE NOT COALESCE(c.comp_is_deleted, false)) s;

    INSERT INTO public.app_setting_value
           (asv_id, asv_setting_key, asv_scope, asv_company_id, asv_value, asv_remarks, asv_created_by)
    SELECT md5('csp-p2-price-update|' || c.comp_id::text)::uuid,
           'purchase.price_update', 'COMPANY', c.comp_id, 'NONE',
           'P2: kept as before (purchase.allow_price_update was off)', 'system'
      FROM public.companys c
     WHERE c.comp_id = ANY (v_off)
       AND NOT EXISTS (SELECT 1 FROM public.app_setting_value v
                        WHERE v.asv_setting_key = 'purchase.price_update' AND v.asv_scope = 'COMPANY'
                          AND v.asv_company_id = c.comp_id AND v.asv_is_deleted = false)
    ON CONFLICT (asv_id) DO NOTHING;
    GET DIAGNOSTICS v_ins = ROW_COUNT;

    UPDATE public.app_setting_value v
       SET asv_value       = 'NONE',
           asv_remarks     = left('P2: Do nothing (was ' || COALESCE(v.asv_value, 'blank')
                                  || ' while purchase.allow_price_update was off)', 250),
           asv_modified_on = now(),
           asv_modified_by = 'system'
     WHERE v.asv_setting_key = 'purchase.price_update'
       AND v.asv_scope = 'COMPANY'
       AND v.asv_is_deleted = false
       AND v.asv_company_id = ANY (v_off)
       AND v.asv_id <> md5('csp-p2-price-update|' || v.asv_company_id::text)::uuid
       AND v.asv_value IS DISTINCT FROM 'NONE';
    GET DIAGNOSTICS v_upd = ROW_COUNT;

    INSERT INTO public.app_setting_value
           (asv_id, asv_setting_key, asv_scope, asv_company_id, asv_value, asv_remarks, asv_created_by)
    SELECT md5('csp-p2-price-update|' || c.comp_id::text)::uuid,
           'purchase.price_update', 'COMPANY', c.comp_id, 'UPDATE_PRICES',
           'P2: kept as before (purchase.allow_price_update was on, mode the old default)', 'system'
      FROM public.companys c
     WHERE c.comp_id = ANY (v_on)
       AND NOT EXISTS (SELECT 1 FROM public.app_setting_value v
                        WHERE v.asv_setting_key = 'purchase.price_update' AND v.asv_is_deleted = false
                          AND (v.asv_scope = 'GLOBAL' OR (v.asv_scope = 'COMPANY' AND v.asv_company_id = c.comp_id)))
    ON CONFLICT (asv_id) DO NOTHING;
    GET DIAGNOSTICS v_ins_up = ROW_COUNT;

    RAISE NOTICE 'value move: % live companies, % with purchase.allow_price_update off, % on; purchase.price_update: % inserted as NONE, % inserted as UPDATE_PRICES (fixed ids), % kept as they are, % set to NONE',
                 v_live, cardinality(v_off), cardinality(v_on), v_ins, v_ins_up, v_live - v_ins - v_ins_up - v_upd, v_upd;
END $$;


-- ── 3 · purchase.pur_invoice_item: the result CHECK (§6.2, §4.6) ──────────
DO $$
DECLARE
    v_def     text;
    v_missing text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c
                    WHERE c.oid = to_regclass('purchase.pur_invoice_item') AND c.relkind = 'p') THEN
        RETURN;
    END IF;
    SELECT pg_get_constraintdef(c.oid) INTO v_def
      FROM pg_constraint c
     WHERE c.conrelid = 'purchase.pur_invoice_item'::regclass AND c.conname = 'ck_pii_price_result' AND c.contype = 'c';
    SELECT string_agg(x, ', ') INTO v_missing
      FROM unnest(ARRAY['UPDATED', 'KEPT_NEWER', 'OFF', 'NONE', 'COST_ONLY', 'LATER_BILL', 'NO_LINE', 'TO_REVIEW']) x
     WHERE v_def IS NULL OR position(quote_literal(x) IN v_def) = 0;
    IF v_missing IS NULL THEN
        RAISE NOTICE 'ck_pii_price_result: already takes the eight results';
        RETURN;
    END IF;
    ALTER TABLE purchase.pur_invoice_item DROP CONSTRAINT IF EXISTS ck_pii_price_result;
    ALTER TABLE purchase.pur_invoice_item ADD CONSTRAINT ck_pii_price_result CHECK (
        pii_price_update_result IS NULL
        OR pii_price_update_result IN ('UPDATED', 'KEPT_NEWER', 'OFF', 'NONE',
                                       'COST_ONLY', 'LATER_BILL', 'NO_LINE', 'TO_REVIEW'));
    RAISE NOTICE 'ck_pii_price_result: widened (added %), on the parent and its % partitions',
                 v_missing, (SELECT count(*) FROM pg_inherits WHERE inhparent = 'purchase.pur_invoice_item'::regclass);
END $$;


-- ── 4 · ui_table 44: From the bill at 6, BillKind at 60 (addendum §6.3) ───
-- Numbers are the screen's ChangeSellingPriceCols (From the bill = 59,
-- BillKind = 60). Positions are a rank (NexTable::applyLayout: the first row
-- of a position wins it), so every column keeps its own. Matched on the
-- column number; only the position moves. A column id that is taken by
-- another table's column gets a fresh id from the sequence instead (section 0
-- names it).
DO $$
DECLARE
    v_missing text;
    v_moved   int := 0;
    v_new     int := 0;
BEGIN
    -- Only where the grid's layout exists (a fresh database gets the rows from the seed).
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 44 AND ui_tbl_name = 'CHANGE SELLING PRICE - ROWS')
       OR NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted) THEN
        RETURN;
    END IF;
    -- Columns 0..58 must all be there (the flat-rows layout, 20261124190000).
    SELECT string_agg(n::text, ', ' ORDER BY n) INTO v_missing
      FROM generate_series(0, 58) n
     WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns c
                        WHERE c.ui_tbl_clm_table_id = 44 AND c.ui_tbl_clm_no = n AND NOT c.ui_tbl_clm_is_deleted);
    IF v_missing IS NOT NULL THEN
        RAISE WARNING 'Change Selling Price P2: ui_table 44 has no live column % (apply 20261124190000 first), so its layout is skipped', v_missing;
        RETURN;
    END IF;

    UPDATE fixed.ui_table_columns c
       SET ui_tbl_clm_column_position = v.pos,
           ui_tbl_clm_modified_by     = 'system',
           ui_tbl_clm_modified_on     = now()
      FROM (VALUES
             ( 0::bigint,  0::integer), ( 1,  1), ( 2,  2), ( 4,  3), (47,  4), (35,  5)
            ,( 3,  7), (50,  8), (25,  9), (48, 10), ( 7, 11), (36, 12)
            ,( 8, 13), (43, 14), (37, 15), ( 9, 16)
            ,(10, 17), (44, 18), (38, 19), (11, 20)
            ,(12, 21), (45, 22), (39, 23), (13, 24)
            ,(14, 25), (46, 26), (40, 27), (15, 28), (16, 29)
            ,( 5, 30), ( 6, 31), (17, 32), (18, 33), (19, 34), (20, 35), (21, 36), (22, 37), (23, 38)
            ,(24, 39), (26, 40), (27, 41), (28, 42), (29, 43), (30, 44), (31, 45), (32, 46), (33, 47)
            ,(34, 48), (41, 49), (42, 50), (49, 51), (51, 52), (52, 53), (53, 54), (54, 55), (55, 56)
            ,(56, 57), (57, 58), (58, 59)
           ) v(no, pos)
     WHERE c.ui_tbl_clm_table_id = 44
       AND c.ui_tbl_clm_no = v.no
       AND NOT c.ui_tbl_clm_is_deleted
       AND c.ui_tbl_clm_column_position IS DISTINCT FROM v.pos;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    INSERT INTO fixed.ui_table_columns
           (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
            ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
            ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
    SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns x WHERE x.ui_tbl_clm_id = v.id)
                THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
                ELSE v.id END,
           44, v.no, v.name, v.width, false, false, v.pos, false, true, false, 'system'
      FROM (VALUES
             (2893::bigint, 59::bigint, 'From the bill'::text, 14.00::numeric,  6::integer)
            ,(2894,         60,         'BillKind',             0.00,          60)
           ) v(id, no, name, width, pos)
     WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                        WHERE e.ui_tbl_clm_table_id = 44 AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
    ON CONFLICT (ui_tbl_clm_id) DO NOTHING;
    GET DIAGNOSTICS v_new = ROW_COUNT;

    RAISE NOTICE 'ui_table 44: % columns moved one place up, % columns added (From the bill at 6, BillKind at 60)', v_moved, v_new;
END $$;

SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 5 · plain wording rows (notes 120), catalogue 2026-11-28.1 (§6.4) ──────
-- {name} values are filled by the server (refusals, post / cancel notes) or by
-- Qt (the line under the after-post sticker question); the filler drops a name
-- it cannot fill. prisma/seed/Error_Messages.json carries the same rows.
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('STOCK_PRICE_BILL_NOT_FOUND', '', 'en', 'Bill not found', 'This purchase bill is not there any more.', 'Open the purchase list again and pick it.')
    ,('STOCK_PRICE_BILL_NOT_POSTED', '', 'en', 'Bill not posted', '{bill} is {status}, so its costs do not move any price.', 'Post the bill first.')
    ,('STOCK_PRICE_LATER_PURCHASE', '', 'en', 'A later purchase', '{bill} of {date} was posted after this bill and set {item} {unit} at {cost}.', 'Load this bill''s prices again.')
    ,('PUR_PRICE_LATER_BILL', '', 'en', 'Price not changed', 'Line {n}: {bill} of {date} is a later purchase of {item}, so this bill did not change its cost or prices.', 'Nothing to do: the later bill''s figures stand.')
    ,('PUR_PRICE_NO_LINE', '', 'en', 'No price yet', 'Line {n}: {item} MRP {mrp} has no price line, so it sells at the other-MRPs price {price}.', 'Set its price on Change Selling Price.')
    ,('PUR_PRICE_TO_REVIEW', '', 'en', 'Prices to review', 'This bill''s costs and prices wait for a review on Change Selling Price.', 'Open them with Selling prices · Ctrl+Shift+G (needs Edit on Change Selling Price).')
    ,('PUR_PRICE_BELOW_NEW_COST', '', 'en', 'Price below the new cost', 'Line {n}: {level} {price} of {item} {unit} is now below the cost {cost}.', 'Check it on Change Selling Price.')
    ,('PUR_PRICE_RESTORED', '', 'en', 'Prices put back', '{count} price lines went back to their figures before {bill}.', 'Nothing to do.')
    ,('PUR_PRICE_KEPT_ON_CANCEL', '', 'en', 'Prices kept', '{item} {unit} was changed after {bill}, so its old prices were not put back.', 'Check it on Change Selling Price.')
    ,('STICKER_DOC_PRICES_PENDING', '', 'en', 'Prices wait for a review', 'Its prices wait for a review on Change Selling Price, so labels printed now carry today''s prices.', 'Or press Not now and print after the review with Stickers · Ctrl+Shift+P.')
    ,('PUR_PRICE_NOT_WRITTEN', 'rule=ABOVE_MRP', 'en', 'Price not changed', 'Line {n}: {level} {price} of {item} {unit} would be above its MRP {mrp}, so its prices were kept; its cost moved.', 'Check it on Change Selling Price.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-28.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-28.1';


-- Checks after deploy (read-only): Shared/Prathap/admin/sql/csp-p2-assert.sql
