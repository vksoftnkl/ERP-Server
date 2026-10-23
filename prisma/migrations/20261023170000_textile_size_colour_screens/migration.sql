-- ════════════════════════════════════════════════════════════════════════════
-- 20261023170000_textile_size_colour_screens — notes 147 S1.5 (2026-10-23)
--
-- The size and colour masters' screens (tables: 20261023160000; routes
-- /item-sizes/* and /item-colours/*):
--
--   menu 291  Item Size Master     under 34 (item masters), at 4.10 — after Unit
--   menu 292  Item Colour Master   under 34, at 4.20
--   grid 181  MAIN LIST - ITEM SIZE     params iisz_is_deleted ('true'/'false'),
--                                       iisz_company_id ('' = shared rows only)
--   grid 182  MAIN LIST - ITEM COLOUR   params iicl_is_deleted, iicl_company_id
--   dropdown 70  ITEM SIZES    live + active, company + shared, by sort then
--                              name; param icompany_id
--   dropdown 71  ITEM COLOURS  the same
--
-- Ids are PINNED (the client opens screens, grids and dropdowns by id, and
-- user_menus stores rights by menu id); an id already taken under another name
-- stops the migration. The two menus are in prisma/seed/Menu_Master.sql too:
-- on a fresh database the menu tree is a seed that runs after migrations, so
-- nothing is inserted here while 34 is absent. Grid / dropdown SQL holds no
-- comment: the runner refuses `--` and `/*` (notes 130 / 132).
-- No user is granted the menus here; rights are given in User Administration.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, ', ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', menu_id, menu_name) AS x FROM fixed.menu_master
         WHERE (menu_id = 291 AND menu_name <> 'Item Size Master')
            OR (menu_id = 292 AND menu_name <> 'Item Colour Master')
        UNION ALL
        SELECT format('grid %s (%s)', grid_id, grid_name) FROM fixed.grid_details
         WHERE (grid_id = 181 AND grid_name <> 'MAIN LIST - ITEM SIZE')
            OR (grid_id = 182 AND grid_name <> 'MAIN LIST - ITEM COLOUR')
        UNION ALL
        SELECT format('dropdown %s (%s)', dropdown_id, dropdown_name) FROM fixed.dropdown_details
         WHERE (dropdown_id = 70 AND dropdown_name <> 'ITEM SIZES')
            OR (dropdown_id = 71 AND dropdown_name <> 'ITEM COLOURS')) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Size / colour screens: ids already taken: %. Pick free ids here, in Menu_Master.sql and in the module README.', v_clash;
    END IF;
END $$;

-- ── menus ──────────────────────────────────────────────────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT v.id, 34, v.name, true, v.pos, true, false, '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}'::text[], now(), now()
  FROM (VALUES (291, 'Item Size Master', 4.10), (292, 'Item Colour Master', 4.20)) AS v(id, name, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 34)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = v.id);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- ── list grids ─────────────────────────────────────────────────────────────
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status, grid_is_deleted, grid_created_by)
SELECT 181, 'MAIN LIST - ITEM SIZE',
       'Textile sizes (inventory.item_size_master): this company''s and the shared ones, by sort then name. iisz_is_deleted ''true''/''false''; iisz_company_id ('''' = shared rows only).',
       'Desktop', 'isz_sort', 'Ascending',
$g$SELECT s.isz_id,
       s.isz_code,
       s.isz_name,
       s.isz_size_set,
       CASE WHEN s.isz_company_id IS NULL THEN 'Shared' ELSE 'Own' END AS isz_scope,
       s.isz_sort,
       s.isz_is_active
  FROM inventory.item_size_master s
 WHERE s.isz_is_deleted = iisz_is_deleted::boolean
   AND (s.isz_company_id IS NULL OR s.isz_company_id = NULLIF(iisz_company_id, '')::uuid)
 ORDER BY s.isz_sort, s.isz_name$g$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 181);

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status, grid_is_deleted, grid_created_by)
SELECT 182, 'MAIN LIST - ITEM COLOUR',
       'Textile colours (inventory.item_colour_master): this company''s and the shared ones, by sort then name. iicl_is_deleted ''true''/''false''; iicl_company_id ('''' = shared rows only).',
       'Desktop', 'icl_sort', 'Ascending',
$g$SELECT c.icl_id,
       c.icl_code,
       c.icl_name,
       CASE WHEN c.icl_company_id IS NULL THEN 'Shared' ELSE 'Own' END AS icl_scope,
       c.icl_sort,
       c.icl_is_active
  FROM inventory.item_colour_master c
 WHERE c.icl_is_deleted = iicl_is_deleted::boolean
   AND (c.icl_company_id IS NULL OR c.icl_company_id = NULLIF(iicl_company_id, '')::uuid)
 ORDER BY c.icl_sort, c.icl_name$g$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 182);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT v.grid_id, v.col_no, v.col_name, v.width, v.align, v.visible, v.filterable,
       false, false, v.data_type, false, v.col_no, v.field, 'system'
  FROM (VALUES
    (181, 1, '#',        0.00, 'Left',   false, false, 'Text',     'isz_id'),
    (181, 2, 'Code',    14.00, 'Left',   true,  true,  'Text',     'isz_code'),
    (181, 3, 'Size',    30.00, 'Left',   true,  true,  'Text',     'isz_name'),
    (181, 4, 'Size Set',18.00, 'Left',   true,  true,  'Text',     'isz_size_set'),
    (181, 5, 'Scope',   12.00, 'Center', true,  false, 'Text',     'isz_scope'),
    (181, 6, 'Sort',    12.00, 'Right',  true,  false, 'NumberTS', 'isz_sort'),
    (181, 7, 'Active',  14.00, 'Center', true,  false, 'Boolean',  'isz_is_active'),
    (182, 1, '#',        0.00, 'Left',   false, false, 'Text',     'icl_id'),
    (182, 2, 'Code',    16.00, 'Left',   true,  true,  'Text',     'icl_code'),
    (182, 3, 'Colour',  40.00, 'Left',   true,  true,  'Text',     'icl_name'),
    (182, 4, 'Scope',   14.00, 'Center', true,  false, 'Text',     'icl_scope'),
    (182, 5, 'Sort',    14.00, 'Right',  true,  false, 'NumberTS', 'icl_sort'),
    (182, 6, 'Active',  16.00, 'Center', true,  false, 'Boolean',  'icl_is_active')
  ) AS v(grid_id, col_no, col_name, width, align, visible, filterable, data_type, field)
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = v.grid_id);

-- ── dropdowns ──────────────────────────────────────────────────────────────
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT v.id, v.name, v.descr, v.sql, 'Ascending', NULL, v.completion, 12, true, 0, 'Desktop', 'system'
  FROM (VALUES
    (70, 'ITEM SIZES',
     'Textile sizes for an inward line (notes 147): live and active, this company''s and the shared ones, by sort then name. Param icompany_id, always sent.',
$d$SELECT isz_id,
       isz_name,
       COALESCE(isz_code, '') AS isz_code,
       COALESCE(isz_size_set, '') AS isz_size_set
  FROM inventory.item_size_master
 WHERE isz_is_deleted = false
   AND isz_is_active = true
   AND (isz_company_id IS NULL OR isz_company_id::text = 'icompany_id')
 ORDER BY isz_sort, isz_name$d$, 'isz_name'),
    (71, 'ITEM COLOURS',
     'Textile colours for an inward line (notes 147): live and active, this company''s and the shared ones, by sort then name. Param icompany_id, always sent.',
$d$SELECT icl_id,
       icl_name,
       COALESCE(icl_code, '') AS icl_code
  FROM inventory.item_colour_master
 WHERE icl_is_deleted = false
   AND icl_is_active = true
   AND (icl_company_id IS NULL OR icl_company_id::text = 'icompany_id')
 ORDER BY icl_sort, icl_name$d$, 'icl_name')
  ) AS v(id, name, descr, sql, completion)
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = v.id);

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT max(dropdown_id) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.dd, v.no, 'text', v.name, v.name, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    (70, 0, '#',      10.00, false, false, 'isz_id'),
    (70, 1, 'Size',   45.00, true,  true,  'isz_name'),
    (70, 2, 'Code',   20.00, true,  true,  'isz_code'),
    (70, 3, 'Set',    25.00, true,  true,  'isz_size_set'),
    (71, 0, '#',      10.00, false, false, 'icl_id'),
    (71, 1, 'Colour', 65.00, true,  true,  'icl_name'),
    (71, 2, 'Code',   25.00, true,  true,  'icl_code')
  ) AS v(dd, no, name, width, visible, filter, field)
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = v.dd);
