-- ═══════════════════════════════════════════════════════════════════════════
--  Delivery Challan (menu 182, rework) + Challan Return (menu 251, new),
--  phase P1 (DB)                                                  2026-11-16
--  Folder: prisma/migrations/20261118100000_dc_dc_return/ (share copy:
--  Shared/Prathap/sales/sql/dc-dc-return-p1-migration.sql).
--
--  Plan: Shared/Prathap/sales/plan-dc-dc-return-2026-11-16.md §7 (DB), §5.1
--  (numbering), §5.6 (ageing), decisions 1-41, answers Q-N1..Q-N5 = the
--  recommendations ("all recommended", 2026-11-16 ~11:45). Mockups v2
--  approved. Sorts after 20261117100000_delivery_tracking (committed
--  9dea63e5). Every table, column, index and id checked against the live dev
--  DB on 2026-11-16.
--
--  Statement order = plan §7.8, with the voucher-type UPDATE (§7.8 step 2)
--  moved after the menus and the print purpose it points at:
--   0 · guards: every pinned id / name is free or already ours.
--   1 · accounts.acc_voucher_types.vchr_gst_doc_no boolean NOT NULL DEFAULT
--       false + COMMENT (§7.1.1, decision 32).
--   2 · DROP INDEX sales.ux_sdc_counter_slno (the partitioned parent index;
--       its partition indexes go with it). ux_sdc_refno / ux_sdr_refno stay
--       (decision 33).
--   3 · menus: 182 "Delivery Challan" unhidden, 5.00 -> 42.00 (Q1, Q2); 251
--       "Challan Return" new under Sales (1) at 43.00, verbs VIEW CREATE EDIT
--       DELETE PRINT EXPORT POST CANCEL (Q3). Rights (Q4): each live menu-12
--       row gives its user the same view / create / edit / delete / print /
--       export / post / cancel flags on 182 and 251, plus amend / override on
--       182; a deleted 182 row comes back (raman, VIGNESH, VKPOS, VKPOS1).
--   4 · public.db_table_master 626 / 627 (sale_dc_return / _item) -> menu 251.
--   5 · public.print_purpose DC_RETURN "Challan Return" (SALES / DC_RETURN,
--       2 copies ORIGINAL,DUPLICATE, pinned id, no template row: P5).
--   6 · voucher types DCh / DCR (19 / 20 here; matched by code, as their ids
--       come from a sequence): prefix DC{FYC}{DV}- / DR{FYC}{DV}-, width 5,
--       vchr_gst_doc_no true, menu 182 / 251, print purpose DELIVERY_CHALLAN /
--       DC_RETURN. The prefix moves only from the shipped 'dc' / 'dcr'; the
--       MAIN counter rows are not touched (they keep their snapshot prefix).
--       Until P2 teaches the sequence helper {FYC} / {DV}, a NEW DCh / DCR
--       counter cannot open (SEQUENCE_FORMAT_TOKEN_UNKNOWN); the existing MAIN
--       counters keep drawing dc000NN / dcr000NN.
--   7 · stock.stock_reason_master: six shared DC_RETURN reasons, IN, sort
--       510-590 (Q16).
--   8 · dropdown 79 "DC RETURN REASONS" (dropdown 78's SQL on DC_RETURN) and
--       its columns.
--   9 · grids: 116 gains days / open_pkgs / open_kg / age_level and the tokens
--       iamber_days / iold_days (an unsent one reads as 7 / 30, so the Qt list
--       works before P3); compares as text. New 219 MAIN LIST - DC RETURNS,
--       220 POPUP - CHALLANS TO RETURN, 221 CHALLAN - USED ON. No grid SQL
--       holds a comment marker. 221 is WITH used_on AS (bill lines UNION
--       ALL return lines) SELECT ... FROM used_on: the run route anchors on
--       the relation the top-level FROM names, and refuses a derived table
--       there (GRID_RUN_SQL_INVALID). DC_Grids_219_221.sql carries the same
--       rows. 116's age_level is shown as a narrow "Age" badge right after
--       Days (4.50, from Customer / Place / Phone); 220's DC no is 15.65 wide
--       so a 15-character number fits (from Customer / Area). Layout fix of
--       2026-11-16 (user, after the Qt build), folded in here. 116's By
--       (sdc_created_by) is the creator's name (user_master display name,
--       else login name, else the stored id, as 219) and the fulfilment of
--       a challan that is not POSTED (draft or cancelled) reads '—' (an
--       ifulfil filter lists POSTED challans only): fix of 2026-11-17 (user),
--       folded in here.
--  10 · ui_tables: 38 laid out as entry mockup A (layout fix 2026-11-16):
--       Barcode · Item · Src · Lot / batch · Godown · Unit · Stock · Qty ·
--       Free (the IsFree flag) · Kg · Rate · Disc % · Taxable · GST % ·
--       Amount · Billed · Ret'd · Open (Kg between Qty and Rate, user 11-16),
--       shown widths 95.00 so the row gutter fits; Cost / Status / Bucket
--       hidden, not deleted; the hidden columns ranked after the shown ones
--       by number. New 87 DC RETURN - LINES (ids 2789-2813).
--  11 · fixed.error_message: 16 rows (plan §7.7; STOCK_DEVICE_NOT_FOUND /
--       _BLOCKED were still missing), catalogue 2026-11-16.2.
--       prisma/seed/Error_Messages.json carries the same rows.
--
--  No new table, no business-logic function or trigger. No CHECK or UNIQUE on
--  a quantity. Every statement is re-runnable. On a fresh database menus,
--  grids, ui_tables, dropdowns, rights and reasons are seeded after the
--  migrations, so those parts no-op here and the seed files carry the rows.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / names free (or already ours) ─────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s, parent %s)', m.menu_id, m.menu_name, m.menu_parent) AS x
          FROM fixed.menu_master m
         WHERE (m.menu_id = 251 AND (m.menu_name, m.menu_parent) IS DISTINCT FROM ('Challan Return', 1))
            OR (m.menu_id = 182 AND m.menu_name IS DISTINCT FROM 'Delivery Challan')
        UNION ALL
        SELECT format('grid %s (%s)', g.grid_id, g.grid_name)
          FROM fixed.grid_details g
          JOIN (VALUES (116, 'MAIN LIST - DELIVERY CHALLANS'::text), (219, 'MAIN LIST - DC RETURNS'),
                       (220, 'POPUP - CHALLANS TO RETURN'), (221, 'CHALLAN - USED ON')) v(id, name)
            ON v.id = g.grid_id
         WHERE g.grid_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('grid column %s (grid %s)', c.grid_column_id, c.grid_id)
          FROM fixed.grid_columns c
         WHERE c.grid_column_id::text LIKE '01a1e5d0-%'
           AND c.grid_id NOT IN (116, 219, 220, 221)
        UNION ALL
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
         WHERE (t.ui_tbl_id = 87 AND t.ui_tbl_name IS DISTINCT FROM 'DC RETURN - LINES')
            OR (t.ui_tbl_id = 38 AND t.ui_tbl_name IS DISTINCT FROM 'DELIVERY CHALLAN - LINES')
        UNION ALL
        SELECT format('ui_table_columns id %s (table %s, no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_id BETWEEN 2789 AND 2813
           AND (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (87::bigint, (c.ui_tbl_clm_id - 2789)::bigint)
        UNION ALL
        SELECT format('dropdown %s (%s)', d.dropdown_id, d.dropdown_name)
          FROM fixed.dropdown_details d
         WHERE (d.dropdown_id = 79 AND d.dropdown_name IS DISTINCT FROM 'DC RETURN REASONS')
            OR (upper(d.dropdown_name) = 'DC RETURN REASONS' AND d.dropdown_id <> 79)
        UNION ALL
        SELECT format('dropdown column %s (dropdown %s no %s)', c.dropdown_columns_id, c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
          FROM fixed.dropdown_columns c
         WHERE c.dropdown_columns_id::text LIKE '01a1e5d0-7900-7000-8000-00000000079%'
           AND (c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
               IS DISTINCT FROM (79, right(c.dropdown_columns_id::text, 1)::int)
        UNION ALL
        SELECT format('print purpose %s (%s / %s, id %s)', p.ppo_code, p.ppo_src_module, p.ppo_doc_type, p.ppo_id)
          FROM public.print_purpose p
         WHERE (p.ppo_id = '01a1e3a2-59d1-74c1-919c-92b3796dd063'::uuid
                OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = 'dc_return' AND p.ppo_is_deleted = false))
           AND (p.ppo_id, upper(p.ppo_code::text), p.ppo_src_module::text, p.ppo_doc_type::text)
               IS DISTINCT FROM ('01a1e3a2-59d1-74c1-919c-92b3796dd063'::uuid, 'DC_RETURN', 'SALES', 'DC_RETURN')
        UNION ALL
        SELECT format('stock reason %s (%s, %s)', r.srm_code, r.srm_direction, r.srm_allowed_txn_types)
          FROM stock.stock_reason_master r
         WHERE r.srm_company_id IS NULL
           AND r.srm_code IN ('DCR_NOT_NEEDED', 'DCR_APPROVAL_BACK', 'DCR_JOB_WORK_BACK',
                              'DCR_WRONG_ITEM', 'DCR_DAMAGED', 'DCR_OTHER')
           AND r.srm_is_deleted = false
           AND (r.srm_direction::text, r.srm_allowed_txn_types) IS DISTINCT FROM ('IN', ARRAY['DC_RETURN']::text[])
        UNION ALL
        SELECT format('db_table_master %s is %s.%s', d.dtm_id, d.dtm_schema, d.dtm_table)
          FROM public.db_table_master d
          JOIN (VALUES (626, 'sale_dc_return'::text), (627, 'sale_dc_return_item')) v(id, tbl)
            ON v.id = d.dtm_id
         WHERE (d.dtm_schema::text, d.dtm_table::text) IS DISTINCT FROM ('sales', v.tbl)
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'DC / DC return P1: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;
END $$;


-- ── 1 · accounts.acc_voucher_types.vchr_gst_doc_no (decision 32) ───────────
-- Constant default: existing rows take false with no rewrite. Section 6 sets
-- it on DCh / DCR (and on any child of them).
ALTER TABLE accounts.acc_voucher_types
    ADD COLUMN IF NOT EXISTS vchr_gst_doc_no boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN accounts.acc_voucher_types.vchr_gst_doc_no IS
    'The number is a GST document number (Rules 46 / 53 / 55): at most 16 characters, A–Z a–z 0–9 - /. Checked at counter creation, at the type''s save and at each draw.';


-- ── 2 · per-device challan numbers: the counter-slno unique goes (decision 33)
-- Two devices on one till counter would both draw 1. ux_sdc_refno stays: the
-- refno holds year + device code + number.
DROP INDEX IF EXISTS sales.ux_sdc_counter_slno;


-- ── 3 · menus 182 / 251 and their rights (Q1-Q4) ───────────────────────────
UPDATE fixed.menu_master
   SET menu_visiblity   = true,
       menu_position    = 42.00,
       menu_modified_on = now()
 WHERE menu_id = 182
   AND menu_name = 'Delivery Challan'
   AND (menu_visiblity, menu_position) IS DISTINCT FROM (true, 42.00::numeric);

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 251, 1, 'Challan Return', NULL, true, 43.00, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = 1)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 251);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 306 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 1) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Q4: every user with a live Sales Bill (12) row gets the same flags on 182
-- and 251. 182 also takes amend / override (its verbs list them); 251 has no
-- AMEND / OVERRIDE verb. A row that exists (live or deleted) is set to those
-- flags and made live; one already equal is left alone.
INSERT INTO public.user_menus AS u
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT s.um_user_id, v.menu_id, s.um_can_view, s.um_can_create, s.um_can_edit, s.um_can_delete,
       s.um_can_print, s.um_can_export, s.um_visibility, false, false,
       0, false, s.um_created_by, s.um_can_post, s.um_can_cancel,
       CASE WHEN v.menu_id = 182 THEN s.um_can_amend ELSE false END,
       CASE WHEN v.menu_id = 182 THEN s.um_can_override ELSE false END,
       false
  FROM public.user_menus s
 CROSS JOIN (VALUES (182), (251)) v(menu_id)
 WHERE s.um_menu_id = 12
   AND s.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m
                WHERE m.menu_id = v.menu_id
                  AND m.menu_name = CASE v.menu_id WHEN 182 THEN 'Delivery Challan' ELSE 'Challan Return' END)
ON CONFLICT (um_user_id, um_menu_id) DO UPDATE
   SET um_can_view     = EXCLUDED.um_can_view,
       um_can_create   = EXCLUDED.um_can_create,
       um_can_edit     = EXCLUDED.um_can_edit,
       um_can_delete   = EXCLUDED.um_can_delete,
       um_can_print    = EXCLUDED.um_can_print,
       um_can_export   = EXCLUDED.um_can_export,
       um_visibility   = EXCLUDED.um_visibility,
       um_can_post     = EXCLUDED.um_can_post,
       um_can_cancel   = EXCLUDED.um_can_cancel,
       um_can_amend    = EXCLUDED.um_can_amend,
       um_can_override = EXCLUDED.um_can_override,
       um_can_retender = false,
       um_is_deleted   = false,
       um_modified_on  = now()
 WHERE (u.um_can_view, u.um_can_create, u.um_can_edit, u.um_can_delete, u.um_can_print,
        u.um_can_export, u.um_visibility, u.um_can_post, u.um_can_cancel, u.um_can_amend,
        u.um_can_override, u.um_can_retender, u.um_is_deleted)
       IS DISTINCT FROM
       (EXCLUDED.um_can_view, EXCLUDED.um_can_create, EXCLUDED.um_can_edit, EXCLUDED.um_can_delete,
        EXCLUDED.um_can_print, EXCLUDED.um_can_export, EXCLUDED.um_visibility, EXCLUDED.um_can_post,
        EXCLUDED.um_can_cancel, EXCLUDED.um_can_amend, EXCLUDED.um_can_override, false, false);


-- ── 4 · table registry: the challan return tables get their menu (G16) ─────
-- Db_Table_Master.sql carries the same (it owns these rows).
UPDATE public.db_table_master
   SET dtm_menu_id     = 251,
       dtm_modified_on = now()
 WHERE dtm_id IN (626, 627)
   AND dtm_schema = 'sales'
   AND dtm_table IN ('sale_dc_return', 'sale_dc_return_item')
   AND dtm_menu_id IS DISTINCT FROM 251
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 251);


-- ── 5 · print purpose DC_RETURN (Q7, G14; the design comes in P5) ──────────
INSERT INTO public.print_purpose
       (ppo_id, ppo_company_id, ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes, ppo_is_active, ppo_is_deleted)
SELECT '01a1e3a2-59d1-74c1-919c-92b3796dd063'::uuid, NULL, 'DC_RETURN', 'Challan Return', 'SALES',
       'DC_RETURN', 2, 'ORIGINAL,DUPLICATE', true, 85,
       'The Challan Return (menu 251): goods of a delivery challan taken back un-billed. Header (return no / date, the challan it returns, customer, reason, vehicle), lines (item, lot, unit, qty back, condition, bucket, godown, cost), cost back into stock; no money to the party. docId = sdr_id, accYear = sdr_acc_year.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p
                    WHERE p.ppo_id = '01a1e3a2-59d1-74c1-919c-92b3796dd063'::uuid
                       OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = 'dc_return' AND p.ppo_is_deleted = false));


-- ── 6 · voucher types DCh / DCR (§7.2, decisions 31 / 32) ──────────────────
-- Matched by code: 20260921220000 created both from the sequence, so the ids
-- (19 / 20 on dev) are not fixed. The menu is set only where it exists
-- (fk_vchr_menu; a fresh database links it in Acc_Voucher_Types_Register.sql).
UPDATE accounts.acc_voucher_types t
   SET vchr_no_prefix  = CASE WHEN t.vchr_no_prefix = v.old_prefix THEN v.new_prefix ELSE t.vchr_no_prefix END,
       vchr_no_width   = CASE WHEN t.vchr_no_prefix = v.old_prefix THEN 5 ELSE t.vchr_no_width END,
       vchr_gst_doc_no = true,
       vchr_menu_id    = COALESCE(t.vchr_menu_id,
                                  (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = v.menu_id)),
       vchr_print_purpose_id = COALESCE(t.vchr_print_purpose_id,
                                        (SELECT p.ppo_id FROM public.print_purpose p
                                          WHERE p.ppo_company_id IS NULL
                                            AND upper(p.ppo_code::text) = v.purpose
                                            AND p.ppo_is_deleted = false)),
       vchr_updated_on = now(),
       vchr_updated_by = '20261118100000_dc_dc_return'
  FROM (VALUES ('DCh'::text, 'dc'::text, 'DC{FYC}{DV}-'::text, 182, 'DELIVERY_CHALLAN'::text),
               ('DCR',       'dcr',      'DR{FYC}{DV}-',       251, 'DC_RETURN')
       ) v(code, old_prefix, new_prefix, menu_id, purpose)
 WHERE t.vchr_type_code = v.code
   AND t.vchr_parent_id IS NULL
   AND (t.vchr_no_prefix = v.old_prefix OR t.vchr_gst_doc_no = false
        OR t.vchr_menu_id IS NULL OR t.vchr_print_purpose_id IS NULL);

-- A child type of DCh / DCR (none today) numbers GST documents too.
UPDATE accounts.acc_voucher_types c
   SET vchr_gst_doc_no = true,
       vchr_updated_on = now(),
       vchr_updated_by = '20261118100000_dc_dc_return'
  FROM accounts.acc_voucher_types b
 WHERE c.vchr_parent_id = b.vchr_type_id
   AND b.vchr_type_code IN ('DCh', 'DCR')
   AND b.vchr_parent_id IS NULL
   AND c.vchr_gst_doc_no = false;


-- ── 7 · stock reasons for DC_RETURN (Q16) ──────────────────────────────────
-- Shared system rows, IN, named only for DC_RETURN, so no other picker offers
-- them. Stock_Reason_Master.sql carries the same six.
INSERT INTO stock.stock_reason_master
       (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types,
        srm_require_remarks, srm_sort_order, srm_remarks, srm_default_condition, srm_created_by)
SELECT NULL, v.code, v.name, 'IN', ARRAY['DC_RETURN']::text[], v.remarks, v.sort, v.note, v.cond, 'system'
  FROM (VALUES
        ('DCR_NOT_NEEDED'::varchar,  'Not needed / over-supply'::varchar,  false, 510, NULL::varchar,
         'Challan return: the customer did not need the goods, or more went than asked.'::varchar),
        ('DCR_APPROVAL_BACK',        'Approval goods not taken',          false, 520, NULL,
         'Challan return: goods sent on approval came back.'),
        ('DCR_JOB_WORK_BACK',        'Back from job work',                false, 530, NULL,
         'Challan return: goods sent for job work came back.'),
        ('DCR_WRONG_ITEM',           'Wrong item sent',                   false, 540, NULL,
         'Challan return: we sent the wrong item.'),
        ('DCR_DAMAGED',              'Damaged in transit',                false, 550, 'DAMAGED',
         'Challan return: damaged on the way; a new line takes the condition Damaged.'),
        ('DCR_OTHER',                'Other',                             true,  590, NULL,
         'Challan return: any other reason; the remarks say which.')
       ) v(code, name, remarks, sort, cond, note)
 WHERE to_regclass('stock.stock_reason_master') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM stock.stock_reason_master e
                    WHERE e.srm_company_id IS NULL AND e.srm_code = v.code AND e.srm_is_deleted = false);


-- ── 8 · dropdown 79 "DC RETURN REASONS" (dropdown 78 on DC_RETURN) ─────────
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT 79, 'DC RETURN REASONS',
       'Challan Return (menu 251) Reason picker: active DC_RETURN reasons, shared (company NULL) and this company''s; a company row with a shared row''s code hides the shared one. Gives the default line Condition and whether the reason needs remarks. Param icompany_id, always sent; compared as text, never cast.',
$d$SELECT r.srm_id, r.srm_name, r.srm_code,
       COALESCE(r.srm_default_condition, '') AS srm_default_condition,
       r.srm_require_remarks
  FROM stock.stock_reason_master r
 WHERE r.srm_is_active = true
   AND r.srm_is_deleted = false
   AND r.srm_allowed_txn_types && ARRAY['DC_RETURN']
   AND (r.srm_company_id IS NULL OR r.srm_company_id::text = 'icompany_id')
   AND NOT (r.srm_company_id IS NULL
            AND EXISTS (SELECT 1 FROM stock.stock_reason_master c
                         WHERE c.srm_company_id::text = 'icompany_id'
                           AND c.srm_code = r.srm_code
                           AND c.srm_is_deleted = false))
 ORDER BY r.srm_sort_order, r.srm_name$d$,
       'asc', 'srm_name', 'srm_name', 10, true, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 79);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.id, 79, v.no, 'Text', v.name, NULL, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    ('01a1e5d0-7900-7000-8000-000000000790'::uuid, 0, '#',              10.00, false, false, 'srm_id'),
    ('01a1e5d0-7900-7000-8000-000000000791'::uuid, 1, 'Reason',         60.00, true,  true,  'srm_name'),
    ('01a1e5d0-7900-7000-8000-000000000792'::uuid, 2, 'Code',           20.00, true,  true,  'srm_code'),
    ('01a1e5d0-7900-7000-8000-000000000793'::uuid, 3, 'Condition',      20.00, true,  false, 'srm_default_condition'),
    ('01a1e5d0-7900-7000-8000-000000000794'::uuid, 4, 'Remarks needed', 10.00, false, false, 'srm_require_remarks')
  ) AS v(id, no, name, width, visible, filter, field)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = 79 AND d.dropdown_name = 'DC RETURN REASONS')
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = 79)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT COALESCE(max(dropdown_id), 1) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));


-- ── 9 · grids: 116 (days, open, kg, age level), 219, 220, 221 ─────────────
-- Grid 116 "MAIN LIST - DELIVERY CHALLANS": the SQL is replaced only while it
-- is still the shipped text (compared with its whitespace folded), so a site's
-- own edit is kept (NOTICE). Grid_Details.sql carries the new text. By =
-- the creator's name; fulfilment is '—' unless POSTED (11-17).
DO $g116$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 116 AND grid_name = 'MAIN LIST - DELIVERY CHALLANS') THEN
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 116 AND position('age_level' IN grid_sql) > 0) THEN
        RETURN;
    END IF;
    IF (SELECT md5(regexp_replace(btrim(grid_sql), '\s+', ' ', 'g')) FROM fixed.grid_details WHERE grid_id = 116)
       IS DISTINCT FROM 'e27fd32724360d1fce60d65addd02cff' THEN
        RAISE NOTICE 'DC / DC return P1: grid 116 SQL is not as shipped; days / open_pkgs / open_kg / age_level were not added. Copy the new SQL from Grid_Details.sql by hand.';
        RETURN;
    END IF;
    UPDATE fixed.grid_details
       SET grid_sql         = $g$SELECT
       d.sdc_id,
       d.sdc_company_id,
       d.sdc_branch_id,
       d.sdc_acc_year,
       d.sdc_dc_date,
       d.sdc_dc_refno,
       d.sdc_purpose,
       d.sdc_cust_name,
       d.sdc_cust_place,
       d.sdc_cust_phone,
       d.sdc_tot_items,
       d.sdc_dc_amt,
       d.sdc_status,
       CASE WHEN d.sdc_status <> 'POSTED' THEN '—' ELSE d.sdc_fulfil_status END AS sdc_fulfil_status,
       d.sdc_vehicle_no,
       d.sdc_src_doc_refno,
       COALESCE(NULLIF(us.usr_display_name, ''), us.usr_login_name, d.sdc_created_by) AS sdc_created_by,
       (CURRENT_DATE - d.sdc_dc_date) AS days,
       round(COALESCE(ol.open_pkgs, 0), 3) AS open_pkgs,
       round(COALESCE(ol.open_kg, 0), 3) AS open_kg,
       CASE WHEN d.sdc_status <> 'POSTED' OR COALESCE(ol.open_pkgs, 0) <= 0 THEN ''
            WHEN d.sdc_purpose = 'SUPPLY' THEN
                 CASE WHEN CURRENT_DATE - d.sdc_dc_date > lim.old_days THEN 'RED'
                      WHEN CURRENT_DATE - d.sdc_dc_date > lim.amber_days THEN 'AMBER'
                      ELSE '' END
            WHEN win.window_days IS NOT NULL AND CURRENT_DATE - d.sdc_dc_date > win.window_days THEN 'RED'
            ELSE '' END AS age_level
  FROM sales.sale_dc d
  CROSS JOIN (SELECT COALESCE(substring('iamber_days' FROM '^[0-9]{1,4}$')::integer, 7) AS amber_days,
                     COALESCE(substring('iold_days' FROM '^[0-9]{1,4}$')::integer, 30) AS old_days) lim
  LEFT JOIN LATERAL (SELECT SUM(di.sdi_open_qty) AS open_pkgs,
                            SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0
                                                       THEN di.sdi_weight_qty / di.sdi_dc_qty
                                                       ELSE COALESCE(u.iuc_uom_weight, 0) END) AS open_kg
                       FROM sales.sale_dc_item di
                       LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
                      WHERE d.sdc_status = 'POSTED'
                        AND di.sdi_dc_id = d.sdc_id
                        AND di.sdi_acc_year = d.sdc_acc_year
                        AND di.sdi_is_deleted = false
                        AND di.sdi_open_qty > 0) ol ON true
  LEFT JOIN LATERAL (SELECT s.stl_value AS window_days
                       FROM public.statutory_limits s
                      WHERE d.sdc_purpose <> 'SUPPLY'
                        AND s.stl_code = 'DC_RETURN_WINDOW_DAYS'
                        AND s.stl_is_deleted = false
                        AND s.stl_is_active = true
                        AND (s.stl_company_id IS NULL OR s.stl_company_id = d.sdc_company_id)
                        AND s.stl_applies_to = 'ALL'
                        AND s.stl_aato_class IS NULL
                        AND s.stl_effective_from <= d.sdc_dc_date
                        AND (s.stl_effective_to IS NULL OR s.stl_effective_to >= d.sdc_dc_date)
                      ORDER BY (s.stl_company_id IS NOT NULL) DESC, s.stl_effective_from DESC
                      LIMIT 1) win ON true
  LEFT JOIN public.user_master us ON us.usr_id::text = d.sdc_created_by
 WHERE d.sdc_company_id::text = 'icompany_id'
   AND d.sdc_branch_id::text = 'ibranch_id'
   AND d.sdc_acc_year = 'iacc_year'
   AND d.sdc_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR d.sdc_dc_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR d.sdc_dc_date::text <= 'ito_date')
   AND (CASE WHEN NULLIF('ifulfil', '') IS NULL THEN true
             WHEN d.sdc_status <> 'POSTED' THEN false
             WHEN 'ifulfil' = 'OPEN' THEN d.sdc_fulfil_status IN ('OPEN', 'PARTIAL')
             ELSE d.sdc_fulfil_status = 'ifulfil' END)
 ORDER BY d.sdc_dc_date DESC, d.sdc_created_on DESC$g$,
           grid_description = 'Delivery challans (menu 182, TxnMainView). Tokens (send every one; '''' = no bound / all): icompany_id, ibranch_id, iacc_year, ifrom_date, ito_date (yyyy-MM-dd), ifulfil ('''' = all, OPEN = OPEN+PARTIAL, else that status; only a POSTED challan matches), iamber_days, iold_days (the company''s sales.delivery_amber_days / delivery_old_days; '''' or not sent = 7 / 30). days = today minus the challan date; open_pkgs / open_kg = what is still out on a POSTED challan (its lines with sdi_open_qty > 0; 0 on a draft or a cancelled one); age_level '''' / AMBER / RED, only while something is open (plan §5.6: Supply amber past iamber_days and red past iold_days; any other purpose red past DC_RETURN_WINDOW_DAYS from public.statutory_limits, the company row first, on the challan date; no row = never red). sdc_created_by = the creator''s name (user_master display name, else login name, else the stored id, as grid 219); sdc_fulfil_status = ''—'' on a challan that is not POSTED (a draft or a cancelled one). Search on DC no / customer / phone. Newest first.',
           grid_modified_by = 'system',
           grid_modified_on = now()
     WHERE grid_id = 116;
END $g116$;

-- Grid 116 columns: Days after Date, then Age (age_level, the AMBER / RED
-- badge the Qt list paints; centred like Status), Open and Kg after Items;
-- Customer 14 -> 11.50, Place and Phone 6 -> 5 make room, so the shown widths
-- stay 100.00. Done in full only on the shipped layout; otherwise the four go
-- to the end, hidden (NOTICE).
DO $c116$
DECLARE
    v_as_shipped boolean;
    v_last       numeric(12,2);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 116 AND position('age_level' IN grid_sql) > 0)
       OR EXISTS (SELECT 1 FROM fixed.grid_columns
                   WHERE grid_column_id IN ('01a1e5d0-1160-7000-8000-000000116021', '01a1e5d0-1160-7000-8000-000000116022',
                                            '01a1e5d0-1160-7000-8000-000000116023', '01a1e5d0-1160-7000-8000-000000116024')) THEN
        RETURN;
    END IF;
    SELECT count(*) = 17 AND count(*) FILTER (WHERE (c.grid_column_position, c.grid_column_width) = (v.pos, v.width)) = 17
      INTO v_as_shipped
      FROM fixed.grid_columns c
      LEFT JOIN (VALUES ('01a0ce44-3bd5-7631-a90e-c6d7bc0b44c3'::uuid,  1.00::numeric,  6.00::numeric),
                        ('01a0ce44-3bd6-748e-bd24-77cfe2309488',  2.00,  6.00),
                        ('01a0ce44-3bd6-7e52-95ad-c60a83f9f024',  3.00,  6.00),
                        ('01a0ce44-3bd7-77b3-b50f-bd827316c111',  4.00,  6.00),
                        ('01a0ce44-3bd8-70fa-9378-cbb025de4000',  5.00,  8.00),
                        ('01a0ce44-3bd8-7a3b-8329-186a3a834bfa',  6.00,  8.00),
                        ('01a0ce44-3bd9-72f3-84b5-047c9cf8c279',  7.00,  7.00),
                        ('01a0ce44-3bd9-7ad0-ba07-7ccce6c9ae98',  8.00, 16.00),
                        ('01a0ce44-3bda-73cc-8a34-f4b9c7e5df8e',  9.00,  8.00),
                        ('01a0ce44-3bda-7d74-bc2e-3396a437fcd8', 10.00,  8.00),
                        ('01a0ce44-3bdb-76e7-a087-52e02aa1f815', 11.00,  4.00),
                        ('01a0ce44-3bdc-7169-bb52-5b4e0f5b580b', 12.00,  8.00),
                        ('01a0ce44-3bdc-7bd8-9fdc-f1b4c57f8265', 13.00,  6.00),
                        ('01a0ce44-3bdd-75f8-a8ef-3cc1f8b6e7e4', 14.00,  7.00),
                        ('01a0ce44-3bde-7109-b271-fb355c7538d8', 15.00,  6.00),
                        ('01a0ce44-3bde-7bf4-b212-f04d7fa8459b', 16.00,  7.00),
                        ('01a0ce44-3be0-7abc-9ab5-10f35487407c', 17.00,  7.00)
                ) v(id, pos, width) ON v.id = c.grid_column_id
     WHERE c.grid_id = 116 AND c.grid_column_is_deleted = false;

    IF v_as_shipped THEN
        UPDATE fixed.grid_columns c
           SET grid_column_position    = v.pos,
               grid_column_width       = v.width,
               grid_column_modified_by = 'system',
               grid_column_modified_on = now()
          FROM (VALUES ('01a0ce44-3bd8-70fa-9378-cbb025de4000'::uuid,  5.00::numeric,  7.00::numeric),
                       ('01a0ce44-3bd8-7a3b-8329-186a3a834bfa',  8.00,  9.00),
                       ('01a0ce44-3bd9-72f3-84b5-047c9cf8c279',  9.00,  6.00),
                       ('01a0ce44-3bd9-7ad0-ba07-7ccce6c9ae98', 10.00, 11.50),
                       ('01a0ce44-3bda-73cc-8a34-f4b9c7e5df8e', 11.00,  5.00),
                       ('01a0ce44-3bda-7d74-bc2e-3396a437fcd8', 12.00,  5.00),
                       ('01a0ce44-3bdb-76e7-a087-52e02aa1f815', 13.00,  4.00),
                       ('01a0ce44-3bdc-7169-bb52-5b4e0f5b580b', 16.00,  7.00),
                       ('01a0ce44-3bdc-7bd8-9fdc-f1b4c57f8265', 17.00,  6.00),
                       ('01a0ce44-3bdd-75f8-a8ef-3cc1f8b6e7e4', 18.00,  7.00),
                       ('01a0ce44-3bde-7109-b271-fb355c7538d8', 19.00,  5.00),
                       ('01a0ce44-3bde-7bf4-b212-f04d7fa8459b', 20.00,  6.00),
                       ('01a0ce44-3be0-7abc-9ab5-10f35487407c', 21.00,  5.00)
               ) v(id, pos, width)
         WHERE c.grid_column_id = v.id AND c.grid_id = 116;

        INSERT INTO fixed.grid_columns
            (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
             grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
             grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
             grid_column_notes, grid_column_is_deleted, grid_column_created_by, grid_column_created_on)
        VALUES
            ('01a1e5d0-1160-7000-8000-000000116021', 116, 21, 'Days',      'days',      'Number', 3.00,  6.00, 'right',  true,  false, false, false, 'days',      false, 'system', now()),
            ('01a1e5d0-1160-7000-8000-000000116024', 116, 24, 'Age',       'age_level', 'Text',   4.50,  7.00, 'center', true,  false, false, false, 'age_level', false, 'system', now()),
            ('01a1e5d0-1160-7000-8000-000000116022', 116, 22, 'Open',      'open_pkgs', 'Number', 4.00, 14.00, 'right',  true,  false, false, false, 'open_pkgs', false, 'system', now()),
            ('01a1e5d0-1160-7000-8000-000000116023', 116, 23, 'Kg',        'open_kg',   'Number', 5.00, 15.00, 'right',  true,  false, false, false, 'open_kg',   false, 'system', now());
    ELSE
        SELECT COALESCE(max(grid_column_position), 0) INTO v_last FROM fixed.grid_columns WHERE grid_id = 116;
        RAISE NOTICE 'DC / DC return P1: grid 116 columns are not as shipped; Days, Open, Kg and Age go to the end, hidden.';
        INSERT INTO fixed.grid_columns
            (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
             grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
             grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
             grid_column_notes, grid_column_is_deleted, grid_column_created_by, grid_column_created_on)
        VALUES
            ('01a1e5d0-1160-7000-8000-000000116021', 116, 21, 'Days',      'days',      'Number', 3.00, v_last + 1, 'right', false, false, false, false, 'days',      false, 'system', now()),
            ('01a1e5d0-1160-7000-8000-000000116022', 116, 22, 'Open',      'open_pkgs', 'Number', 4.00, v_last + 2, 'right', false, false, false, false, 'open_pkgs', false, 'system', now()),
            ('01a1e5d0-1160-7000-8000-000000116023', 116, 23, 'Kg',        'open_kg',   'Number', 5.00, v_last + 3, 'right', false, false, false, false, 'open_kg',   false, 'system', now()),
            ('01a1e5d0-1160-7000-8000-000000116024', 116, 24, 'Age',       'age_level', 'Text',   4.50, v_last + 4, 'center', false, false, false, false, 'age_level', false, 'system', now());
    END IF;
END $c116$;

-- Grids 219-221 (DC_Grids_219_221.sql carries the same rows). 221's top-level
-- FROM names its CTE (used_on), never a derived table: the run route takes the
-- table it checks the SQL against from there.
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(219, 'MAIN LIST - DC RETURNS',
 'Challan Return list (menu 251, TxnMainView). Tokens (send every one; '''' = no bound): icompany_id, ibranch_id, iacc_year, ifrom_date, ito_date (yyyy-MM-dd, on sdr_return_date). One row per return: its lines, the qty and kg back (kg from the challan line''s per-unit weight, else the unit''s), the cost back, the status. Newest first.',
 'sdr_return_date', 'Descending', 'Desktop', true, false, 'system',
$g219$SELECT r.sdr_id,
       r.sdr_company_id,
       r.sdr_branch_id,
       r.sdr_acc_year,
       r.sdr_return_date,
       r.sdr_return_refno,
       r.sdr_dc_refno,
       r.sdr_cust_name,
       COALESCE(rs.srm_name, r.sdr_return_reason, '') AS reason_name,
       COALESCE(li.line_count, 0) AS line_count,
       round(COALESCE(li.return_qty, 0), 3) AS return_qty,
       round(COALESCE(li.return_kg, 0), 3) AS return_kg,
       r.sdr_total_cost,
       r.sdr_status,
       COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name, r.sdr_created_by) AS sdr_created_by_name,
       r.sdr_dc_id,
       r.sdr_dc_acc_year,
       r.sdr_dc_date,
       r.sdr_cust_id,
       r.sdr_print_count,
       r.sdr_device_id,
       r.sdr_return_slno
  FROM sales.sale_dc_return r
  LEFT JOIN stock.stock_reason_master rs ON rs.srm_id = r.sdr_reason_id
  LEFT JOIN LATERAL (SELECT count(*) AS line_count,
                            SUM(ri.sdri_return_qty) AS return_qty,
                            SUM(ri.sdri_return_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0
                                                          THEN di.sdi_weight_qty / di.sdi_dc_qty
                                                          ELSE COALESCE(u2.iuc_uom_weight, 0) END) AS return_kg
                       FROM sales.sale_dc_return_item ri
                       LEFT JOIN sales.sale_dc_item di ON di.sdi_id = ri.sdri_dc_item_id AND di.sdi_acc_year = ri.sdri_dc_acc_year
                       LEFT JOIN inventory.item_unit_conversion u2 ON u2.iuc_id = ri.sdri_item_unit_id
                      WHERE ri.sdri_return_id = r.sdr_id
                        AND ri.sdri_acc_year = r.sdr_acc_year
                        AND ri.sdri_is_deleted = false) li ON true
  LEFT JOIN public.user_master u ON u.usr_id::text = r.sdr_created_by
 WHERE r.sdr_company_id::text = 'icompany_id'
   AND r.sdr_branch_id::text = 'ibranch_id'
   AND r.sdr_acc_year = 'iacc_year'
   AND r.sdr_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR r.sdr_return_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR r.sdr_return_date::text <= 'ito_date')
 ORDER BY r.sdr_return_date DESC, r.sdr_created_on DESC$g219$),
(220, 'POPUP - CHALLANS TO RETURN',
 'Challan Return (menu 251) F4 picker: one row per POSTED, live challan of the branch with something still open (a line with sdi_open_qty > 0). Tokens (send every one; '''' = all): icompany_id, ibranch_id, icust_id, igodown_id (only challans with an open line in that godown; godown_names lists every godown with an open line), iamber_days, iold_days (as grid 116). open_text = open of sent, over the whole challan; on_drafts = the qty on its DRAFT returns (a draft holds nothing, Q17). Newest first.',
 'sdc_dc_date', 'Descending', 'Desktop', true, false, 'system',
$g220$SELECT d.sdc_id,
       d.sdc_acc_year,
       d.sdc_company_id,
       d.sdc_branch_id,
       d.sdc_dc_refno,
       d.sdc_dc_date,
       (CURRENT_DATE - d.sdc_dc_date) AS days,
       CASE WHEN d.sdc_purpose = 'SUPPLY' THEN
                 CASE WHEN CURRENT_DATE - d.sdc_dc_date > lim.old_days THEN 'RED'
                      WHEN CURRENT_DATE - d.sdc_dc_date > lim.amber_days THEN 'AMBER'
                      ELSE '' END
            WHEN win.window_days IS NOT NULL AND CURRENT_DATE - d.sdc_dc_date > win.window_days THEN 'RED'
            ELSE '' END AS age_level,
       d.sdc_cust_id,
       COALESCE(c.cus_name, d.sdc_cust_name) AS cust_name,
       COALESCE(a.arm_name, '') AS area_name,
       d.sdc_purpose,
       initcap(replace(d.sdc_purpose, '_', ' ')) AS purpose_name,
       COALESCE(ol.godown_names, '') AS godown_names,
       trim_scale(round(ol.open_pkgs, 3)) || ' of ' || trim_scale(round(ol.total_pkgs, 3)) AS open_text,
       round(ol.open_pkgs, 3) AS open_pkgs,
       round(ol.total_pkgs, 3) AS total_pkgs,
       round(COALESCE(ol.open_kg, 0), 3) AS open_kg,
       round(COALESCE(dr.on_drafts, 0), 3) AS on_drafts
  FROM sales.sale_dc d
  CROSS JOIN (SELECT COALESCE(substring('iamber_days' FROM '^[0-9]{1,4}$')::integer, 7) AS amber_days,
                     COALESCE(substring('iold_days' FROM '^[0-9]{1,4}$')::integer, 30) AS old_days) lim
  JOIN LATERAL (SELECT SUM(di.sdi_open_qty) FILTER (WHERE di.sdi_open_qty > 0) AS open_pkgs,
                       SUM(di.sdi_dc_qty) AS total_pkgs,
                       SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0
                                                  THEN di.sdi_weight_qty / di.sdi_dc_qty
                                                  ELSE COALESCE(u.iuc_uom_weight, 0) END)
                           FILTER (WHERE di.sdi_open_qty > 0) AS open_kg,
                       string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE di.sdi_open_qty > 0) AS godown_names,
                       count(*) FILTER (WHERE di.sdi_open_qty > 0
                                          AND ('igodown_id' = '' OR di.sdi_godown_id::text = 'igodown_id')) AS lines_in_scope
                  FROM sales.sale_dc_item di
                  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
                  LEFT JOIN inventory.godown_locations g ON g.gdl_id = di.sdi_godown_id
                 WHERE di.sdi_dc_id = d.sdc_id
                   AND di.sdi_acc_year = d.sdc_acc_year
                   AND di.sdi_is_deleted = false) ol ON ol.lines_in_scope > 0
  LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
  LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
  LEFT JOIN LATERAL (SELECT SUM(ri.sdri_return_qty) AS on_drafts
                       FROM sales.sale_dc_return h
                       JOIN sales.sale_dc_return_item ri ON ri.sdri_return_id = h.sdr_id AND ri.sdri_acc_year = h.sdr_acc_year
                      WHERE h.sdr_dc_id = d.sdc_id
                        AND h.sdr_dc_acc_year = d.sdc_acc_year
                        AND h.sdr_status = 'DRAFT'
                        AND h.sdr_is_deleted = false
                        AND ri.sdri_is_deleted = false) dr ON true
  LEFT JOIN LATERAL (SELECT s.stl_value AS window_days
                       FROM public.statutory_limits s
                      WHERE d.sdc_purpose <> 'SUPPLY'
                        AND s.stl_code = 'DC_RETURN_WINDOW_DAYS'
                        AND s.stl_is_deleted = false
                        AND s.stl_is_active = true
                        AND (s.stl_company_id IS NULL OR s.stl_company_id = d.sdc_company_id)
                        AND s.stl_applies_to = 'ALL'
                        AND s.stl_aato_class IS NULL
                        AND s.stl_effective_from <= d.sdc_dc_date
                        AND (s.stl_effective_to IS NULL OR s.stl_effective_to >= d.sdc_dc_date)
                      ORDER BY (s.stl_company_id IS NOT NULL) DESC, s.stl_effective_from DESC
                      LIMIT 1) win ON true
 WHERE d.sdc_company_id::text = 'icompany_id'
   AND d.sdc_branch_id::text = 'ibranch_id'
   AND d.sdc_is_deleted = false
   AND d.sdc_status = 'POSTED'
   AND ('icust_id' = '' OR d.sdc_cust_id::text = 'icust_id')
 ORDER BY d.sdc_dc_date DESC, d.sdc_created_on DESC$g220$),
(221, 'CHALLAN - USED ON',
 'Challan History, Used on (menus 182 / 251): every POSTED Sales Bill line that names a line of this challan (sbi_src_doc_type DELIVERY_CHALLAN) and every POSTED challan-return line. Tokens (send every one): icompany_id, idc_id (the sdc_id), iacc_year (the challan''s year). when_text is IST 12-hour; kind BILL opens menu 12, RETURN opens menu 251. Newest first.',
 'when_sort', 'Descending', 'Desktop', true, false, 'system',
$g221$WITH used_on AS (
        SELECT to_char(b.sb_bill_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS when_text,
               'Sales Bill ' || b.sb_bill_refno AS doc_text,
               'bill line ' || bi.sbi_line_no || ' ← challan line ' || di.sdi_line_no AS line_text,
               im.item_name_en AS item_name,
               round(bi.sbi_bill_qty, 3) AS qty,
               COALESCE(um.unit_name, '') AS unit_name,
               COALESCE(NULLIF(us.usr_display_name, ''), us.usr_login_name, b.sb_created_by) AS by_name,
               'BILL' AS kind,
               b.sb_id AS doc_id,
               b.sb_acc_year AS doc_acc_year,
               b.sb_bill_refno AS doc_refno,
               bi.sbi_line_no AS doc_line_no,
               di.sdi_line_no AS dc_line_no,
               di.sdi_id AS dc_item_id,
               '' AS condition,
               to_char(b.sb_bill_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS when_sort,
               b.sb_bill_datetime AS when_at
          FROM sales.sale_dc d
          JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
          JOIN sales.sale_bill_item bi ON bi.sbi_src_item_id = di.sdi_id AND bi.sbi_src_doc_type = 'DELIVERY_CHALLAN'
          JOIN sales.sale_bill b ON b.sb_id = bi.sbi_bill_id AND b.sb_acc_year = bi.sbi_acc_year
          JOIN inventory.item_master im ON im.item_id = bi.sbi_item_id
          LEFT JOIN inventory.item_unit_conversion iu ON iu.iuc_id = bi.sbi_item_unit_id
          LEFT JOIN inventory.item_unit_master um ON um.unit_id = iu.iuc_unit_id
          LEFT JOIN public.user_master us ON us.usr_id::text = b.sb_created_by
         WHERE d.sdc_company_id::text = 'icompany_id'
           AND d.sdc_id::text = 'idc_id'
           AND d.sdc_acc_year = 'iacc_year'
           AND di.sdi_is_deleted = false
           AND bi.sbi_is_deleted = false
           AND b.sb_is_deleted = false
           AND b.sb_status = 'POSTED'
        UNION ALL
        SELECT to_char(h.sdr_return_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM'),
               'Challan Return ' || h.sdr_return_refno,
               'line ' || di.sdi_line_no
                 || CASE WHEN row_number() OVER (PARTITION BY ri.sdri_return_id, ri.sdri_dc_item_id ORDER BY ri.sdri_line_no) > 1
                         THEN '·' || row_number() OVER (PARTITION BY ri.sdri_return_id, ri.sdri_dc_item_id ORDER BY ri.sdri_line_no)
                         ELSE '' END
                 || ' · ' || initcap(ri.sdri_condition),
               im.item_name_en,
               round(ri.sdri_return_qty, 3),
               COALESCE(um.unit_name, ''),
               COALESCE(NULLIF(us.usr_display_name, ''), us.usr_login_name, h.sdr_created_by),
               'RETURN',
               h.sdr_id,
               h.sdr_acc_year,
               h.sdr_return_refno,
               ri.sdri_line_no,
               di.sdi_line_no,
               di.sdi_id,
               ri.sdri_condition,
               to_char(h.sdr_return_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'),
               h.sdr_return_datetime
          FROM sales.sale_dc d
          JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
          JOIN sales.sale_dc_return_item ri ON ri.sdri_dc_item_id = di.sdi_id AND ri.sdri_dc_acc_year = di.sdi_acc_year
          JOIN sales.sale_dc_return h ON h.sdr_id = ri.sdri_return_id AND h.sdr_acc_year = ri.sdri_acc_year
          JOIN inventory.item_master im ON im.item_id = ri.sdri_item_id
          LEFT JOIN inventory.item_unit_conversion iu ON iu.iuc_id = ri.sdri_item_unit_id
          LEFT JOIN inventory.item_unit_master um ON um.unit_id = iu.iuc_unit_id
          LEFT JOIN public.user_master us ON us.usr_id::text = h.sdr_created_by
         WHERE d.sdc_company_id::text = 'icompany_id'
           AND d.sdc_id::text = 'idc_id'
           AND d.sdc_acc_year = 'iacc_year'
           AND di.sdi_is_deleted = false
           AND ri.sdri_is_deleted = false
           AND h.sdr_is_deleted = false
           AND h.sdr_status = 'POSTED')
SELECT x.when_text,
       x.doc_text,
       x.line_text,
       x.item_name,
       x.qty,
       x.unit_name,
       x.by_name,
       x.kind,
       x.doc_id,
       x.doc_acc_year,
       x.doc_refno,
       x.doc_line_no,
       x.dc_line_no,
       x.dc_item_id,
       x.condition,
       x.when_sort
  FROM used_on x
 ORDER BY x.when_at DESC, x.kind, x.doc_refno, x.doc_line_no$g221$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    -- 219 MAIN LIST - DC RETURNS
    ('01a1e5d0-2190-7000-8000-000000219001'::uuid, 219::bigint, 1::integer, '#'::text, 'sdr_id'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean)
   ,('01a1e5d0-2190-7000-8000-000000219002', 219, 2, 'Company', 'sdr_company_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219003', 219, 3, 'Branch', 'sdr_branch_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219004', 219, 4, 'Year', 'sdr_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219005', 219, 5, 'Date', 'sdr_return_date', 'Date', 8.00, 'Left', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219006', 219, 6, 'Return No', 'sdr_return_refno', 'Text', 13.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219007', 219, 7, 'Challan', 'sdr_dc_refno', 'Text', 12.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219008', 219, 8, 'Customer', 'sdr_cust_name', 'Text', 17.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219009', 219, 9, 'Reason', 'reason_name', 'Text', 12.00, 'Left', true, true)
   ,('01a1e5d0-2190-7000-8000-000000219010', 219, 10, 'Lines', 'line_count', 'Number', 5.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219011', 219, 11, 'Qty', 'return_qty', 'Number', 6.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219012', 219, 12, 'Kg', 'return_kg', 'Number', 6.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219013', 219, 13, 'Cost back', 'sdr_total_cost', 'Number', 8.00, 'Right', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219014', 219, 14, 'Status', 'sdr_status', 'Text', 7.00, 'Center', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219015', 219, 15, 'By', 'sdr_created_by_name', 'Text', 6.00, 'Left', true, false)
   ,('01a1e5d0-2190-7000-8000-000000219016', 219, 16, 'Challan id', 'sdr_dc_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219017', 219, 17, 'Challan year', 'sdr_dc_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219018', 219, 18, 'Challan date', 'sdr_dc_date', 'Date', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219019', 219, 19, 'Customer id', 'sdr_cust_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219020', 219, 20, 'Prints', 'sdr_print_count', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219021', 219, 21, 'Device', 'sdr_device_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2190-7000-8000-000000219022', 219, 22, 'Slno', 'sdr_return_slno', 'Number', 0.00, 'Right', false, false)
    -- 220 POPUP - CHALLANS TO RETURN (DC no 15.65: a 15-character number such as DC2627D14-00015 fits)
   ,('01a1e5d0-2200-7000-8000-000000220001', 220, 1, '#', 'sdc_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220002', 220, 2, 'Year', 'sdc_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220003', 220, 3, 'Company', 'sdc_company_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220004', 220, 4, 'Branch', 'sdc_branch_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220005', 220, 5, 'DC no', 'sdc_dc_refno', 'Text', 15.65, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220006', 220, 6, 'Date', 'sdc_dc_date', 'Date', 9.95, 'Left', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220007', 220, 7, 'Days', 'days', 'Number', 5.32, 'Right', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220008', 220, 8, 'Age level', 'age_level', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220009', 220, 9, 'Customer id', 'sdc_cust_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220010', 220, 10, 'Customer', 'cust_name', 'Text', 12.45, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220011', 220, 11, 'Area', 'area_name', 'Text', 10.11, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220012', 220, 12, 'Purpose code', 'sdc_purpose', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220013', 220, 13, 'Purpose', 'purpose_name', 'Text', 8.33, 'Left', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220014', 220, 14, 'Godown', 'godown_names', 'Text', 10.65, 'Left', true, true)
   ,('01a1e5d0-2200-7000-8000-000000220015', 220, 15, 'Open of sent', 'open_text', 'Text', 11.11, 'Right', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220016', 220, 16, 'Open', 'open_pkgs', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220017', 220, 17, 'Sent', 'total_pkgs', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2200-7000-8000-000000220018', 220, 18, 'Kg open', 'open_kg', 'Number', 8.10, 'Right', true, false)
   ,('01a1e5d0-2200-7000-8000-000000220019', 220, 19, 'On drafts', 'on_drafts', 'Number', 8.33, 'Right', true, false)
    -- 221 CHALLAN - USED ON
   ,('01a1e5d0-2210-7000-8000-000000221001', 221, 1, 'When', 'when_text', 'Text', 11.77, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221002', 221, 2, 'Document', 'doc_text', 'Text', 20.08, 'Left', true, true)
   ,('01a1e5d0-2210-7000-8000-000000221003', 221, 3, 'Line', 'line_text', 'Text', 16.62, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221004', 221, 4, 'Item', 'item_name', 'Text', 36.28, 'Left', true, true)
   ,('01a1e5d0-2210-7000-8000-000000221005', 221, 5, 'Qty', 'qty', 'Number', 4.16, 'Right', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221006', 221, 6, 'Unit', 'unit_name', 'Text', 4.16, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221007', 221, 7, 'By', 'by_name', 'Text', 6.93, 'Left', true, false)
   ,('01a1e5d0-2210-7000-8000-000000221008', 221, 8, 'Kind', 'kind', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221009', 221, 9, 'Doc id', 'doc_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221010', 221, 10, 'Doc year', 'doc_acc_year', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221011', 221, 11, 'Doc no', 'doc_refno', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221012', 221, 12, 'Doc line', 'doc_line_no', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221013', 221, 13, 'Challan line', 'dc_line_no', 'Number', 0.00, 'Right', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221014', 221, 14, 'Challan line id', 'dc_item_id', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221015', 221, 15, 'Condition', 'condition', 'Text', 0.00, 'Left', false, false)
   ,('01a1e5d0-2210-7000-8000-000000221016', 221, 16, 'Sort', 'when_sort', 'Text', 0.00, 'Left', false, false)
       ) v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = v.grid
                  AND d.grid_name IN ('MAIN LIST - DC RETURNS', 'POPUP - CHALLANS TO RETURN', 'CHALLAN - USED ON'))
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

SELECT setval('fixed.grid_details_grid_id_seq',
              GREATEST((SELECT COALESCE(max(grid_id), 1) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));


-- ── 10 · ui_tables: 38 laid out as entry mockup A; 87 DC RETURN - LINES ────
-- 38 DELIVERY CHALLAN - LINES, laid out as entry mockup A (layout fix of
-- 2026-11-16, user, after the Qt build). Shown in this order: Barcode (1) ·
-- Item (3) · Src (94) · Lot / batch (6) · Godown (8) · Unit (10) · Stock (9) ·
-- Qty (14) · Free (18, the IsFree Y/N flag, user 11-16) · Kg (19, the hidden
-- "Weight", decision 39) · Rate (22) · Disc % (25) · Taxable (41) · GST % (42)
-- · Amount (59) · Billed (99) · Ret'd (100) · Open (92). Free sits right after
-- Qty as the mockup draws it; Kg sits between Qty and Rate (user 11-16; the
-- mockup draws it after Amount). 15 Length Qty stays hidden. The mockup's "#"
-- is the row gutter. Widths in the mockup's proportions (Free 2.50, taken from
-- Item), adding up to 95.00 so the row gutter fits (as tables 69 / 70; user
-- 11-16). Every other column is hidden, never deleted (the Qt screen maps by
-- number and still writes Cost, Status, Bucket); the hidden ones rank 19..
-- after the shown ones, by number, and keep their widths. Focus stays on Item,
-- Qty and Rate. Only on the layout before this fix (titles Description /
-- Returned, 101 live columns numbered 0..100); a re-run, or a site that
-- retitled them, is left alone.
DO $u38$
DECLARE
    v_n   integer;
    v_sum numeric;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 38 AND ui_tbl_name = 'DELIVERY CHALLAN - LINES')
       OR EXISTS (SELECT 1 FROM fixed.ui_table_columns
                   WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_no = 3 AND ui_tbl_clm_is_deleted = false
                     AND ui_tbl_clm_name = 'Item') THEN
        RETURN;
    END IF;
    SELECT count(*) INTO v_n
      FROM fixed.ui_table_columns
     WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_is_deleted = false AND ui_tbl_clm_no BETWEEN 0 AND 100;
    IF v_n <> 101
       OR EXISTS (SELECT 1 FROM fixed.ui_table_columns
                   WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_is_deleted = false
                     AND (ui_tbl_clm_no IS NULL OR ui_tbl_clm_no NOT BETWEEN 0 AND 100))
       OR NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                       WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_no = 3 AND ui_tbl_clm_is_deleted = false
                         AND ui_tbl_clm_name = 'Description')
       OR NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                       WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_no = 18 AND ui_tbl_clm_is_deleted = false
                         AND ui_tbl_clm_name = 'IsFree')
       OR NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                       WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_no = 100 AND ui_tbl_clm_is_deleted = false
                         AND ui_tbl_clm_name = 'Returned') THEN
        RAISE NOTICE 'DC / DC return P1: ui_table 38 is not the shipped 0..100 layout; the entry mockup A layout was not applied.';
        RETURN;
    END IF;
    UPDATE fixed.ui_table_columns c
       SET ui_tbl_clm_name              = COALESCE(r.name, c.ui_tbl_clm_name),
           ui_tbl_clm_column_width      = COALESCE(r.width, c.ui_tbl_clm_column_width),
           ui_tbl_clm_column_visibility = r.shown,
           ui_tbl_clm_column_position   = r.pos,
           ui_tbl_clm_modified_on       = now(),
           ui_tbl_clm_modified_by       = 'system'
      FROM (SELECT x.ui_tbl_clm_id, s.name, s.width, s.pos IS NOT NULL AS shown,
                   COALESCE(s.pos, 18 + row_number() OVER (PARTITION BY s.pos IS NULL ORDER BY x.ui_tbl_clm_no))::integer AS pos
              FROM fixed.ui_table_columns x
              LEFT JOIN (VALUES (1::bigint, 'Barcode'::text, 7.00::numeric, 1::integer),
                                (3,   'Item',         21.80,  2),
                                (94,  'Src',           2.80,  3),
                                (6,   'Lot / batch',   5.60,  4),
                                (8,   'Godown',        5.90,  5),
                                (10,  'Unit',          3.00,  6),
                                (9,   'Stock',         4.90,  7),
                                (14,  'Qty',           3.40,  8),
                                (18,  'Free',          2.50,  9),
                                (19,  'Kg',            3.90, 10),
                                (22,  'Rate',          5.10, 11),
                                (25,  'Disc %',        3.70, 12),
                                (41,  'Taxable',       5.90, 13),
                                (42,  'GST %',         3.50, 14),
                                (59,  'Amount',        6.20, 15),
                                (99,  'Billed',        3.40, 16),
                                (100, 'Ret''d',        3.20, 17),
                                (92,  'Open',          3.20, 18)
                        ) s(no, name, width, pos) ON s.no = x.ui_tbl_clm_no
             WHERE x.ui_tbl_clm_table_id = 38 AND x.ui_tbl_clm_is_deleted = false) r
     WHERE c.ui_tbl_clm_id = r.ui_tbl_clm_id;
    SELECT sum(ui_tbl_clm_column_width) INTO v_sum
      FROM fixed.ui_table_columns
     WHERE ui_tbl_clm_table_id = 38 AND ui_tbl_clm_is_deleted = false AND ui_tbl_clm_column_visibility = true;
    IF v_sum <> 95.00 THEN
        RAISE NOTICE 'DC / DC return P1: ui_table 38 shown widths add up to % (not 95.00).', v_sum;
    END IF;
END $u38$;

INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (87, 'DC RETURN - LINES', true, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

-- Numbers = the Qt DcReturnCols; 0..15 shown (plan §7.5 widths, 100.00),
-- Return now / Condition / Godown / Notes take focus; 16..24 hidden.
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, 87, v.no, v.name, v.width, v.visible, v.focus, v.no, false, true, false, 'system'
  FROM (VALUES
    (2789::bigint, 0::bigint, '#'::text, 2.30::numeric, true::boolean, false::boolean)
   ,(2790, 1, 'Item', 21.00, true, false)
   ,(2791, 2, 'Lot / batch', 6.00, true, false)
   ,(2792, 3, 'Unit', 3.00, true, false)
   ,(2793, 4, 'Sent', 3.50, true, false)
   ,(2794, 5, 'Billed', 3.60, true, false)
   ,(2795, 6, 'Ret''d before', 5.70, true, false)
   ,(2796, 7, 'Open', 3.50, true, false)
   ,(2797, 8, 'Return now', 6.00, true, true)
   ,(2798, 9, 'Condition', 7.30, true, true)
   ,(2799, 10, 'Bucket', 6.80, true, false)
   ,(2800, 11, 'Godown', 7.60, true, true)
   ,(2801, 12, 'Kg', 3.80, true, false)
   ,(2802, 13, 'Cost rate', 5.30, true, false)
   ,(2803, 14, 'Cost back', 5.80, true, false)
   ,(2804, 15, 'Notes', 8.80, true, true)
   ,(2805, 16, 'DcItemId', 0.00, false, false)
   ,(2806, 17, 'ItemId', 0.00, false, false)
   ,(2807, 18, 'UnitId', 0.00, false, false)
   ,(2808, 19, 'GodownId', 0.00, false, false)
   ,(2809, 20, 'LotId', 0.00, false, false)
   ,(2810, 21, 'ToBaseFactor', 0.00, false, false)
   ,(2811, 22, 'UnitKg', 0.00, false, false)
   ,(2812, 23, 'SplitOf', 0.00, false, false)
   ,(2813, 24, 'SdriId', 0.00, false, false)
       ) v(id, no, name, width, visible, focus)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 87 AND t.ui_tbl_name = 'DC RETURN - LINES')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = 87 AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 11 · plain wording rows (notes 120), catalogue 2026-11-16.2 ────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('SALES_DC_CUSTOMER_REQUIRED', '', 'en', 'Customer needed', 'A challan needs a customer.', 'Pick the customer.')
    ,('SALES_DC_NO_LINES', '', 'en', 'No items', 'This challan has no items.', 'Add at least one item.')
    ,('SALES_DC_CHARGES_NOT_ALLOWED', '', 'en', 'No charges here', 'A challan or a challan return carries no charges.', 'Put freight and other charges on the Sales Bill.')
    ,('SALES_DCR_NO_LINES', '', 'en', 'Nothing to return', 'No line has a quantity to take back.', 'Type the quantity coming back.')
    ,('SALES_DCR_LINE_NOT_ON_DC', '', 'en', 'Wrong challan line', 'Line {n} is not on challan {dc}.', 'Pick the lines again from the challan.')
    ,('SALES_DCR_REASON_REQUIRED', '', 'en', 'Reason needed', 'Say why the goods came back.', 'Pick a reason.')
    ,('SALES_DCR_DAMAGED_BUCKET', '', 'en', 'Not for sale', '{qty} {unit} come back {condition}: the stock value comes back, but not for sale.', 'Nothing to do.')
    ,('SALES_BILL_DC_MISMATCH', 'rule=PARTY', 'en', 'Other customer''s challan', 'Challan {dc} is for {party}, not this bill''s customer.', 'Bill each customer''s challans on their own bill.')
    ,('SALES_BILL_DC_MISMATCH', 'rule=BRANCH', 'en', 'Other branch''s challan', 'Challan {dc} belongs to another branch.', 'Bill it at that branch.')
    ,('SALES_BILL_DC_MISMATCH', 'rule=GSTIN', 'en', 'GST No differs', 'Challan {dc} carries GST No {gstin}; this bill has {billGstin}.', 'Bill challans of one GST No together.')
    ,('SALES_BILL_DC_MISMATCH', 'rule=POS', 'en', 'Place of supply differs', 'Challan {dc} was sent to {pos}; this bill is for {billPos}.', 'Bill challans of one place of supply together.')
    ,('SALES_DC_PURPOSE_NOT_ALLOWED', 'rule=CONVERT', 'en', 'Convert first', 'Challan {dc} was sent for {purpose}.', 'Convert it to Supply on the challan, then bill it.')
    ,('SEQUENCE_REFNO_TOO_LONG', 'rule=GST16_DEVICE', 'en', 'Number too long for GST', '{sample} has {len} characters; a challan number may have 16 at most.', 'Give this PC a device code of 4 characters at most, or call support.')
    ,('SEQUENCE_REFNO_TOO_LONG', 'rule=GST16_CHARS', 'en', 'Number not allowed by GST', '{sample} has a character GST does not allow (only letters, digits, - and /).', 'Change the device code or the voucher type''s prefix.')
    ,('STOCK_DEVICE_NOT_FOUND', '', 'en', 'PC not registered', 'This PC is not registered.', 'Register it in Devices, or call support.')
    ,('STOCK_DEVICE_BLOCKED', '', 'en', 'PC blocked', 'This PC is blocked.', 'Call manager.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-16.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-16.2';


-- Checks after deploy (read-only):
-- SELECT vchr_type_id, vchr_type_code, vchr_no_prefix, vchr_no_width, vchr_gst_doc_no, vchr_menu_id, vchr_print_purpose_id FROM accounts.acc_voucher_types WHERE vchr_type_code IN ('DCh', 'DCR');
-- SELECT to_regclass('sales.ux_sdc_counter_slno');
-- SELECT menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id IN (182, 251);
-- SELECT um_menu_id, count(*) FILTER (WHERE NOT um_is_deleted) FROM public.user_menus WHERE um_menu_id IN (12, 182, 251) GROUP BY 1;
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_id IN (116, 219, 220, 221);
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
-- SELECT * FROM public.v_db_table_master_drift;
