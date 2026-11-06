-- ═══════════════════════════════════════════════════════════════════════════
--  Cost Price – Bulk Change, phase 1 (DB)                         2026-11-05
--  Plan: Shared/Prathap/schema/stock/plan-cost-price-bulk-change-2026-11-05.md
--  (§0, §2 Phase 1, §3, §4; mockup bulk_cost_change_mockup.png). Ports 3.0 menu
--  176 "Cost Price - Bulk Change". Data and one CHECK only: no table, column,
--  function or trigger.
--
--  1 · ck_ipcl_source gains 'BULK_COST_CHANGE': every row the screen saves logs
--      one inventory.item_price_change_log row under that source and menu 298.
--      PRICE_CHANGE_SOURCES (item-price-log/types/price-change-log.types.ts)
--      mirrors the list.
--
--  2 · menu 298 "Cost Price – Bulk Change" under &3 Inventory (3) at 25.00,
--      after 30 Change Selling Price and before 244 Qty-wise Prices (whose
--      separator still closes the price group). Visible, no accelerator.
--      Verbs VIEW (load the grid) and EDIT (save). Grants are COPIED from
--      menu 30's live rows, View and Edit only: whoever may change selling
--      prices may use this screen (on the dev box ravi, VKPOS, VKPOS1, VIJAY).
--      Their parent 3 rows already exist; a VIEW-only parent row is added for
--      any that lacks one, as scripts/grant-posting-rights.js does.
--      The audit rows go under the existing audit screen 26 "Item Price
--      Master", as menu 30's do, so no audit screen is added.
--
--  3 · ui_table 67 "COST PRICE BULK CHANGE - ROWS" (editable, Desktop) and its
--      45 columns, ids 2326-2370. ui_tbl_clm_no is the Qt CostBulkCols enum
--      value: 0-21 shown in the mockup's order (# · Item · Uom · Rule · Cost ·
--      New Cost · Δ Cost · MRP · New MRP · Old / New / Profit for A-D · Min),
--      22-44 hidden. Widths are the mockup's column widths as a percentage of
--      its 1760 px grid. Enter stops (column focus) on New Cost, New MRP and
--      the four New prices; the screen lets Enter land on a New price only on
--      a By User row whose cost changed.
--
--  4 · fixed.error_message rows for COST_BULK_* (plan §3, plus the two right
--      codes assertMenuRight builds from the prefix COST_BULK); catalogue
--      2026-11-05.2.
--
--  5 · the item card's price grid (ui_table 17 "ITEM MASTER - PRICE"): column
--      9 (id 265) shown again and titled "Profit Type" — the unit's own rule,
--      which this screen reprices by (plan §1). It was hidden on 2026-10-22
--      (PUT /ui-table-masters/layout-settings) while every row was forced to
--      "By User"; that is reversed. Focus stays off: Enter does not stop on it.
--      Width, position and every other column are left as they are.
--
--  Ids are PINNED and the same rows are in prisma/seed (Menu_Master.sql,
--  Ui_Tables.sql, Ui_Table_Columns.sql, Error_Messages.json). On a fresh
--  database menu 3 is seeded after migrations, so the menu and its grants are
--  skipped here and come from the seed (with no grants: there are no users).
--  An id already taken by something else stops the migration. Re-runnable:
--  every statement is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, ', ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', m.menu_id, m.menu_name) AS x
          FROM fixed.menu_master m
         WHERE m.menu_id = 298
           AND m.menu_name <> 'Cost Price – Bulk Change'
        UNION ALL
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 67
           AND t.ui_tbl_name IS DISTINCT FROM 'COST PRICE BULK CHANGE - ROWS'
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES
                (2326::bigint, 67::bigint, 0::bigint),
                (2327, 67, 1),
                (2328, 67, 2),
                (2329, 67, 3),
                (2330, 67, 4),
                (2331, 67, 5),
                (2332, 67, 6),
                (2333, 67, 7),
                (2334, 67, 8),
                (2335, 67, 9),
                (2336, 67, 10),
                (2337, 67, 11),
                (2338, 67, 12),
                (2339, 67, 13),
                (2340, 67, 14),
                (2341, 67, 15),
                (2342, 67, 16),
                (2343, 67, 17),
                (2344, 67, 18),
                (2345, 67, 19),
                (2346, 67, 20),
                (2347, 67, 21),
                (2348, 67, 22),
                (2349, 67, 23),
                (2350, 67, 24),
                (2351, 67, 25),
                (2352, 67, 26),
                (2353, 67, 27),
                (2354, 67, 28),
                (2355, 67, 29),
                (2356, 67, 30),
                (2357, 67, 31),
                (2358, 67, 32),
                (2359, 67, 33),
                (2360, 67, 34),
                (2361, 67, 35),
                (2362, 67, 36),
                (2363, 67, 37),
                (2364, 67, 38),
                (2365, 67, 39),
                (2366, 67, 40),
                (2367, 67, 41),
                (2368, 67, 42),
                (2369, 67, 43),
                (2370, 67, 44)
               ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no)) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Cost Price – Bulk Change: ids already taken: %. Pick free ids here, in the seed files and in the Qt screen.', v_clash;
    END IF;
END $$;


-- ── 1 · price log source ───────────────────────────────────────────────────
ALTER TABLE inventory.item_price_change_log DROP CONSTRAINT IF EXISTS ck_ipcl_source;
ALTER TABLE inventory.item_price_change_log ADD CONSTRAINT ck_ipcl_source
  CHECK (ipcl_source IN ('ITEM_CARD','CHANGE_SELLING_PRICE','QTY_PRICE','BUCKET_REKEY','IMPORT','PURCHASE',
                         'BULK_COST_CHANGE'));


-- ── 2 · menu 298 and its rights ────────────────────────────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 298, 3, 'Cost Price – Bulk Change', NULL, true, 25.00, true, false, '{VIEW,EDIT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 3)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 298);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Menu 30's live grants, View and Edit only (the menu holds no other verb).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 298, u.um_can_view, false, u.um_can_edit, false,
       false, false, u.um_visibility, false, false,
       u.um_sort_order, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 30
   AND u.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 298 AND m.menu_name = 'Cost Price – Bulk Change')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The parent folder, VIEW only, for a grantee without one (else the tree is empty).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT n.um_user_id, 3, true, true, n.um_created_by
  FROM public.user_menus n
 WHERE n.um_menu_id = 298
   AND n.um_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM public.user_menus p WHERE p.um_user_id = n.um_user_id AND p.um_menu_id = 3)
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 3 · ui_table 67 and its columns ────────────────────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (67, 'COST PRICE BULK CHANGE - ROWS', true, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2326::bigint, 67::bigint, 0::bigint, '#'::text, 1.59::numeric, true::boolean, false::boolean, 0::integer),
        (2327, 67, 1, 'Item', 14.20, true, false, 1),
        (2328, 67, 2, 'Uom', 5.45, true, false, 2),
        (2329, 67, 3, 'Rule', 4.55, true, false, 3),
        (2330, 67, 4, 'Cost', 4.20, true, false, 4),
        (2331, 67, 5, 'New Cost', 5.23, true, true, 5),
        (2332, 67, 6, 'Δ Cost', 3.52, true, false, 6),
        (2333, 67, 7, 'MRP', 3.86, true, false, 7),
        (2334, 67, 8, 'New MRP', 4.32, true, true, 8),
        (2335, 67, 9, 'Old', 3.75, true, false, 9),
        (2336, 67, 10, 'New', 5.11, true, true, 10),
        (2337, 67, 11, 'Profit', 3.52, true, false, 11),
        (2338, 67, 12, 'Old', 3.75, true, false, 12),
        (2339, 67, 13, 'New', 5.11, true, true, 13),
        (2340, 67, 14, 'Profit', 3.52, true, false, 14),
        (2341, 67, 15, 'Old', 3.75, true, false, 15),
        (2342, 67, 16, 'New', 5.11, true, true, 16),
        (2343, 67, 17, 'Profit', 3.52, true, false, 17),
        (2344, 67, 18, 'Old', 3.75, true, false, 18),
        (2345, 67, 19, 'New', 5.11, true, true, 19),
        (2346, 67, 20, 'Profit', 3.52, true, false, 20),
        (2347, 67, 21, 'Min', 3.52, true, false, 21),
        (2348, 67, 22, 'IpmId', 0, false, false, 22),
        (2349, 67, 23, 'ItemId', 0, false, false, 23),
        (2350, 67, 24, 'ItemCode', 0, false, false, 24),
        (2351, 67, 25, 'UomId', 0, false, false, 25),
        (2352, 67, 26, 'ParentUomId', 0, false, false, 26),
        (2353, 67, 27, 'UnitsPerParent', 0, false, false, 27),
        (2354, 67, 28, 'UnitSlno', 0, false, false, 28),
        (2355, 67, 29, 'PriceScope', 0, false, false, 29),
        (2356, 67, 30, 'TaxPerc', 0, false, false, 30),
        (2357, 67, 31, 'RoundOff', 0, false, false, 31),
        (2358, 67, 32, 'LoadedCost', 0, false, false, 32),
        (2359, 67, 33, 'LoadedMrp', 0, false, false, 33),
        (2360, 67, 34, 'LoadedA', 0, false, false, 34),
        (2361, 67, 35, 'LoadedB', 0, false, false, 35),
        (2362, 67, 36, 'LoadedC', 0, false, false, 36),
        (2363, 67, 37, 'LoadedD', 0, false, false, 37),
        (2364, 67, 38, 'LoadedMin', 0, false, false, 38),
        (2365, 67, 39, 'LoadedRule', 0, false, false, 39),
        (2366, 67, 40, 'UpdatedOn', 0, false, false, 40),
        (2367, 67, 41, 'FollowFrom', 0, false, false, 41),
        (2368, 67, 42, 'TypedLevels', 0, false, false, 42),
        (2369, 67, 43, 'ScheduledFrom', 0, false, false, 43),
        (2370, 67, 44, 'HasQtySlabs', 0, false, false, 44)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'COST PRICE BULK CHANGE - ROWS')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 4 · plain wording rows (notes 120), catalogue 2026-11-05.2 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('COST_BULK_NOT_PLAIN_STOCK', '', 'en', 'Not a plain stock item', 'This item keeps its stock by batch, MRP, sale price or serial, so its cost can''t be changed here.', 'Change its prices in Change Selling Price.')
    ,('COST_BULK_INACTIVE', '', 'en', 'Item switched off', 'This item is not active, so its cost can''t be changed.', 'Make the item active on the item card first.')
    ,('COST_BULK_NO_PRICE_ROW', '', 'en', 'No price for this unit', 'This unit has no price in force today at this branch.', 'Set its prices on the item card first.')
    ,('COST_BULK_ROW_NOT_CURRENT', '', 'en', 'Not today''s price any more', 'This unit''s price is no longer the one in force today.', 'Load the items again.')
    ,('COST_BULK_ROW_CHANGED', '', 'en', 'Changed by someone else', 'This unit''s price was changed after you loaded it.', 'Load the items again, then type your change.')
    ,('COST_BULK_ABOVE_MRP', '', 'en', 'Price above MRP', 'A new price is above this unit''s MRP.', 'Lower the price, or type a higher New MRP.')
    ,('COST_BULK_BELOW_MIN', '', 'en', 'Price below minimum', 'A new price is below this unit''s minimum price.', 'Raise the price, or lower the Min.')
    ,('COST_BULK_BELOW_COST', '', 'en', 'Price below cost', 'A new price is below the new cost, so it sells at a loss.', 'Raise the price, or check it before you save.')
    ,('COST_BULK_BY_USER_PRICES_KEPT', '', 'en', 'Prices not typed', 'The cost changed on a By User unit, but its prices are still the old ones.', 'Type the new prices, or tick the warning to keep them.')
    ,('COST_BULK_TOO_MANY_ROWS', '', 'en', 'Too many rows', 'One save takes up to 1,000 rows.', 'Save in parts of 1,000 rows.')
    ,('COST_BULK_CHAIN_NEEDS_HQ', '', 'en', 'Head office only', 'This price is for all branches, so only head office can change it.', 'Leave this row out, or ask head office to change it.')
    ,('COST_BULK_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open this.', 'Call manager.')
    ,('COST_BULK_RIGHT_EDIT', '', 'en', 'Not allowed', 'You have no right to change this.', 'Call manager.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-05.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-05.2';


-- ── 5 · item card price grid (ui_table 17): Profit Type shown again ───────
UPDATE fixed.ui_table_columns
   SET ui_tbl_clm_column_visibility = true,
       ui_tbl_clm_name              = 'Profit Type',
       ui_tbl_clm_modified_on       = now()
 WHERE ui_tbl_clm_id = 265
   AND ui_tbl_clm_table_id = 17
   AND ui_tbl_clm_no = 9
   AND ui_tbl_clm_is_deleted = false
   AND (ui_tbl_clm_column_visibility, ui_tbl_clm_name) IS DISTINCT FROM (true, 'Profit Type');
