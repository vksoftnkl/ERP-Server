-- ═══════════════════════════════════════════════════════════════════════════
--  Item Ledger (menu 301): grid layouts and the item picker        2026-11-13
--  The user (2026-11-13) overrides plan D23 ("no ui_table rows",
--  Shared/Prathap/report/plan-item-ledger-2026-11-11.md): the three tab grids
--  move onto NexTable with loadLayout(tableId), so column widths and show /
--  hide are saved through NexTable's layout menu like every other grid. The
--  item field becomes a NexDropdownSingle in place of the grid 71 F2 popup.
--  Data rows only: no table, column, index, CHECK, function or trigger, so
--  db_table_master, the Prisma models and ensure_acc_year_partitions are not
--  touched. Sorts after 20261112180000_app_theme_template_v63.
--
--  1 · ui_tables 71 / 72 / 73 (read-only, Desktop), one per tab grid of
--      NexERP item_ledger_entry.cpp. ui_tbl_clm_no is the screen's column
--      enum, in today's on-screen order; titles are the on-screen headers.
--      No column takes focus, none is required. Widths are percent of the
--      grid, scaled from the code-built widths (PartyOutstandingGrid min +
--      share, read at 1600 px) so the columns add up to 97.00 and the last
--      shown column stretches into the rest (no row gutter on these grids).
--        71 "ITEM LEDGER - VOUCHERS"   VCol, ids 2477-2492, numbers 0..15:
--           (caret, title blank as on screen) · Date · Time · Type · Doc no ·
--           Party / detail · Godown · Batch · Received · Issued · Balance ·
--           Cost rate · Cost value · Doc rate · User · Bucket.
--           Bucket is stored VISIBLE: the screen shows it only while the
--           bucket filter is All buckets, and its own setColumnHidden wins
--           (Save Width skips a hidden column, so the stored width stays).
--           Date: the screen appends the sort arrow to the stored title.
--        72 "ITEM LEDGER - DAY-WISE"   DCol, ids 2493-2501, numbers 0..8:
--           Date · Docs · Opening · Received · Issued · Closing · Value in ·
--           Value out · Closing value.
--        73 "ITEM LEDGER - MONTH-WISE" MCol, ids 2502-2508, numbers 0..6:
--           Month · Docs · Opening · Inward · Outward · Closing ·
--           Closing value.
--      The grids carry no hidden id columns today (a row's date / month key
--      rides in Qt::UserRole). The totals rows follow the main grid and the
--      two side panes (By voucher type, Stock now) stay code-built: neither
--      is registered. fixed.ui_table_columns has no format column: date /
--      qty / money formats stay the screen's (setDisplayFormats).
--
--  2 · dropdown 77 "ITEMS BY COMPANY": one row per item of
--      inventory.item_master that is not deleted and this company's or
--      shared (item_company_id NULL), the rule the item-ledger routes apply
--      (ITEM_LEDGER_ITEM_NOT_FOUND). Inactive items are listed too (the
--      user, 2026-11-13): an item switched off still has a ledger to read.
--      Dropdown 42 ITEMS has no company filter and grid 71 lists one row per
--      unit, so neither fits. Param icompany_id, always sent, compared as
--      text and never cast. Shows Code, Item, Barcode; SKU hidden; all four
--      searchable (the Item field takes code, name or barcode, plan IL-03).
--      Unlike grid 71 it does not narrow by item_branch_id: the routes do
--      not (the user, 2026-11-13). The client asks for
--      dropdown_max_visible_items (12) rows per search, so a company of
--      10,023 items (CHANDRA SAW MILL on dev) is one paged query per
--      keystroke.
--
--  Dropdowns 22 COMPANYS and 61 BRANCHES BY COMPANY are used as they are.
--
--  Ids are PINNED; the same rows are in prisma/seed (Ui_Tables.sql,
--  Ui_Table_Columns.sql, Dropdown_Details.sql, Dropdown_Columns.sql). An id or
--  name already held by something else stops the migration. Re-runnable:
--  every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids and names must be free (or already ours) ────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name) AS x
          FROM fixed.ui_tables t
          JOIN (VALUES (71::bigint, 'ITEM LEDGER - VOUCHERS'::text),
                       (72, 'ITEM LEDGER - DAY-WISE'),
                       (73, 'ITEM LEDGER - MONTH-WISE')
               ) v(id, name) ON v.id = t.ui_tbl_id OR upper(v.name) = upper(t.ui_tbl_name)
         WHERE (t.ui_tbl_id, t.ui_tbl_name) IS DISTINCT FROM (v.id, v.name)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES (71::bigint, 2477::bigint, 16), (72, 2493, 9), (73, 2502, 7)
               ) v(tbl, first_id, cnt) ON c.ui_tbl_clm_id BETWEEN v.first_id AND v.first_id + v.cnt - 1
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, c.ui_tbl_clm_id - v.first_id)
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s, not one of ours)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_table_id IN (71, 72, 73)
           AND c.ui_tbl_clm_is_deleted = false
           AND c.ui_tbl_clm_id NOT BETWEEN 2477 AND 2508
        UNION ALL
        SELECT format('dropdown %s (%s)', d.dropdown_id, d.dropdown_name)
          FROM fixed.dropdown_details d
         WHERE (d.dropdown_id = 77 AND d.dropdown_name IS DISTINCT FROM 'ITEMS BY COMPANY')
            OR (upper(d.dropdown_name) = 'ITEMS BY COMPANY' AND d.dropdown_id <> 77)
        UNION ALL
        SELECT format('dropdown column %s (dropdown %s no %s)', c.dropdown_columns_id, c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
          FROM fixed.dropdown_columns c
         WHERE c.dropdown_columns_id IN ('01a1b2c0-7700-7000-8000-000000000770'::uuid,
                                         '01a1b2c0-7700-7000-8000-000000000771'::uuid,
                                         '01a1b2c0-7700-7000-8000-000000000772'::uuid,
                                         '01a1b2c0-7700-7000-8000-000000000773'::uuid,
                                         '01a1b2c0-7700-7000-8000-000000000774'::uuid)
           AND (c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
               IS DISTINCT FROM (77, right(c.dropdown_columns_id::text, 1)::int)
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Item Ledger layouts: ids or names already taken: %. Pick free ones here, in the seed files and in the Qt code.', v_clash;
    END IF;
END $$;


-- ── 1 · ui_tables 71 / 72 / 73 and their columns ───────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (71, 'ITEM LEDGER - VOUCHERS',   false, 'Desktop', true, false, 'system'),
       (72, 'ITEM LEDGER - DAY-WISE',   false, 'Desktop', true, false, 'system'),
       (73, 'ITEM LEDGER - MONTH-WISE', false, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, false, v.no::integer, false, true, false, 'system'
  FROM (VALUES
        (2477::bigint, 71::bigint, 0::bigint, ''::text,         1.40::numeric, true::boolean),
        (2478, 71,  1, 'Date',            5.40, true),
        (2479, 71,  2, 'Time',            4.60, true),
        (2480, 71,  3, 'Type',            6.60, true),
        (2481, 71,  4, 'Doc no',          7.80, true),
        (2482, 71,  5, 'Party / detail', 19.40, true),
        (2483, 71,  6, 'Godown',          7.40, true),
        (2484, 71,  7, 'Batch',           6.20, true),
        (2485, 71,  8, 'Received',        4.80, true),
        (2486, 71,  9, 'Issued',          4.80, true),
        (2487, 71, 10, 'Balance',         4.80, true),
        (2488, 71, 11, 'Cost rate',       4.40, true),
        (2489, 71, 12, 'Cost value',      5.60, true),
        (2490, 71, 13, 'Doc rate',        4.40, true),
        (2491, 71, 14, 'User',            5.00, true),
        (2492, 71, 15, 'Bucket',          4.40, true),
        (2493, 72,  0, 'Date',           16.00, true),
        (2494, 72,  1, 'Docs',            3.60, true),
        (2495, 72,  2, 'Opening',        10.00, true),
        (2496, 72,  3, 'Received',       10.00, true),
        (2497, 72,  4, 'Issued',         10.00, true),
        (2498, 72,  5, 'Closing',        10.00, true),
        (2499, 72,  6, 'Value in',       12.40, true),
        (2500, 72,  7, 'Value out',      12.40, true),
        (2501, 72,  8, 'Closing value',  12.60, true),
        (2502, 73,  0, 'Month',          21.20, true),
        (2503, 73,  1, 'Docs',            3.60, true),
        (2504, 73,  2, 'Opening',        13.50, true),
        (2505, 73,  3, 'Inward',         13.50, true),
        (2506, 73,  4, 'Outward',        13.50, true),
        (2507, 73,  5, 'Closing',        13.50, true),
        (2508, 73,  6, 'Closing value',  18.20, true)
       ) v(id, tbl, no, name, width, visible)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t
                WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name LIKE 'ITEM LEDGER - %')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 2 · dropdown 77 "ITEMS BY COMPANY" ─────────────────────────────────────
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT 77, 'ITEMS BY COMPANY',
       'Item Ledger (menu 301) Item picker: one row per item, not deleted (inactive ones included), this company''s or shared (item_company_id NULL), as the item-ledger routes accept them; by name. Searches code, name, barcode and SKU. Param icompany_id, always sent; compared as text, never cast.',
$d$SELECT item_id,
       COALESCE(item_code, '') AS item_code,
       item_name_en,
       COALESCE(item_default_barcode, '') AS item_default_barcode,
       COALESCE(item_sku, '') AS item_sku
  FROM inventory.item_master
 WHERE item_is_deleted = false
   AND (item_company_id IS NULL OR item_company_id::text = 'icompany_id')
 ORDER BY item_name_en$d$,
       'asc', 'item_name_en', 'item_name_en', 12, true, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 77);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.id, 77, v.no, 'Text', v.name, NULL, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    ('01a1b2c0-7700-7000-8000-000000000770'::uuid, 0, '#',       10.00, false, false, 'item_id'),
    ('01a1b2c0-7700-7000-8000-000000000771'::uuid, 1, 'Code',    20.00, true,  true,  'item_code'),
    ('01a1b2c0-7700-7000-8000-000000000772'::uuid, 2, 'Item',    55.00, true,  true,  'item_name_en'),
    ('01a1b2c0-7700-7000-8000-000000000773'::uuid, 3, 'Barcode', 25.00, true,  true,  'item_default_barcode'),
    ('01a1b2c0-7700-7000-8000-000000000774'::uuid, 4, 'SKU',     10.00, false, true,  'item_sku')
  ) AS v(id, no, name, width, visible, filter, field)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = 77 AND d.dropdown_name = 'ITEMS BY COMPANY')
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = 77)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT COALESCE(max(dropdown_id), 1) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type FROM fixed.ui_tables WHERE ui_tbl_id IN (71, 72, 73);
-- SELECT ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width, ui_tbl_clm_column_visibility
--   FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id IN (71, 72, 73) ORDER BY 1, 2;
-- SELECT dropdown_id, dropdown_name FROM fixed.dropdown_details WHERE dropdown_id = 77;
-- SELECT dropdown_columns_no, dropdown_columns_name, dropdown_columns_sql_name FROM fixed.dropdown_columns
--  WHERE dropdown_columns_dropdown_id = 77 ORDER BY 1;
