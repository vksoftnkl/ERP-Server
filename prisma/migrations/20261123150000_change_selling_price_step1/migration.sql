-- Change Selling Price (menu 30) step 1 (user 2026-11-23, review list points 5 and 7; "do all recommended").
-- 1. Setting ui.grid_columns, USER scope: each user's own column choices on the grids that allow them
--    (NexTable::setUserColumns; menu 30 first). JSON text {"<ui_table_id>": {"hidden": [..], "shown": [..]}}.
-- 2. A Margin % column per price level on the grid (ui_table 44), right after that level's Mkup%:
--    Mkup% | Margin% | Base Rate | Net Rate. Margin = profit ÷ price, both before tax; the screen works it
--    out and never saves it. Positions are a rank: every live column after a level's Mkup% moves up one.
-- Layout data only; Ui_Table_Columns.sql carries the same rows for a fresh database. Re-runnable.
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT 'ui.grid_columns', 'SYSTEM', 'Display', 'TEXT', '{}',
       'USER', 'My grid columns',
       'The columns a user has shown or hidden for themselves on a grid that allows it (right-click a column heading, Columns…). Kept per user, laid over the layout the administrator sets.',
       90, 'SYSTEM'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'ui.grid_columns');

DO $$
DECLARE
    lvl    record;
    ppos   integer;
    new_id bigint;
BEGIN
    -- Only where the grid's layout exists (a fresh database gets the rows from the seed).
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted) THEN
        RETURN;
    END IF;
    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);
    FOR lvl IN SELECT * FROM (VALUES (2818::bigint, 43::bigint, 8::bigint),
                                     (2819::bigint, 44::bigint, 10::bigint),
                                     (2820::bigint, 45::bigint, 12::bigint),
                                     (2821::bigint, 46::bigint, 14::bigint)) v(id, no, mkup_no)
    LOOP
        CONTINUE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns
                               WHERE ui_tbl_clm_table_id = 44 AND ui_tbl_clm_no = lvl.no AND NOT ui_tbl_clm_is_deleted);
        SELECT ui_tbl_clm_column_position INTO ppos
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 44 AND ui_tbl_clm_no = lvl.mkup_no AND NOT ui_tbl_clm_is_deleted
         ORDER BY ui_tbl_clm_id
         LIMIT 1;
        IF ppos IS NULL THEN
            RAISE EXCEPTION 'ui_table 44 has no live column % (the level''s Mkup%%)', lvl.mkup_no;
        END IF;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 1,
               ui_tbl_clm_modified_by     = 'system',
               ui_tbl_clm_modified_on     = now()
         WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted
           AND ui_tbl_clm_column_position > ppos;
        new_id := CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_id = lvl.id)
                       THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
                       ELSE lvl.id END;
        INSERT INTO fixed.ui_table_columns
            (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
             ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
             ui_tbl_clm_column_necessity, ui_tbl_clm_next_column, ui_tbl_clm_previous_column,
             ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (new_id, 44, lvl.no, 'Margin%', 4.2, true, false, ppos + 1, false, NULL, NULL, true, false, 'system');
    END LOOP;
    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);
END $$;
