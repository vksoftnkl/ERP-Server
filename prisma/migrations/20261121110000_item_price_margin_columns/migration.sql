-- Item master (menu 29), 2026-11-21 (user): a Margin % column per price level on the price grid
-- (ui_table 17), right after that level's Profit: Profit | Margin | Wot | Price. Margin = profit ÷
-- selling price, both without tax; the card works it out and never saves it (no table column).
-- Layout data only; the seed (Ui_Table_Columns.sql) carries the same rows for a fresh database.
-- Positions are a rank: every live column after a level's Profit moves up one and its Margin takes
-- the place right after the Profit, so a site's saved column order is kept.
-- Re-runnable: a level whose Margin row already exists is skipped.
DO $$
DECLARE
    lvl    record;
    ppos   integer;
    new_id bigint;
BEGIN
    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);
    FOR lvl IN SELECT * FROM (VALUES (2814::bigint, 36::bigint, 'Margin_A'::text, 13::bigint),
                                     (2815::bigint, 37::bigint, 'Margin_B'::text, 16::bigint),
                                     (2816::bigint, 38::bigint, 'Margin_C'::text, 19::bigint),
                                     (2817::bigint, 39::bigint, 'Margin_D'::text, 22::bigint)) v(id, no, name, profit_no)
    LOOP
        CONTINUE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns
                               WHERE ui_tbl_clm_table_id = 17 AND ui_tbl_clm_no = lvl.no);
        SELECT ui_tbl_clm_column_position INTO ppos
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 17 AND ui_tbl_clm_no = lvl.profit_no AND NOT ui_tbl_clm_is_deleted
         ORDER BY ui_tbl_clm_id
         LIMIT 1;
        IF ppos IS NULL THEN
            RAISE EXCEPTION 'ui_table 17 has no live column % (the level''s Profit)', lvl.profit_no;
        END IF;
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_position = ui_tbl_clm_column_position + 1,
               ui_tbl_clm_modified_by     = 'system',
               ui_tbl_clm_modified_on     = now()
         WHERE ui_tbl_clm_table_id = 17 AND NOT ui_tbl_clm_is_deleted
           AND ui_tbl_clm_column_position > ppos;
        -- The seeded id, unless a site already used it for a row of its own.
        new_id := CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_id = lvl.id)
                       THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
                       ELSE lvl.id END;
        INSERT INTO fixed.ui_table_columns
            (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
             ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
             ui_tbl_clm_column_necessity, ui_tbl_clm_next_column, ui_tbl_clm_previous_column,
             ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (new_id, 17, lvl.no, lvl.name, 8, true, true, ppos + 1, false, NULL, NULL, true, false, 'system');
    END LOOP;
    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);
END $$;
