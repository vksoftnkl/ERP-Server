-- Qty-wise Prices (menu 244), 2026-11-25 (user): a Margin % column per price level on the card grid
-- (ui_table 68), right after that level's Profit: Profit | Margin | W/o tax | Price, as the item card
-- (ui_table 17, 20261121110000) and Change Selling Price (ui_table 44) show it. Margin = profit ÷
-- selling price, both without tax; the screen works it out and never saves it (no table column).
-- Layout data only; the seed (Ui_Table_Columns.sql) carries the same rows for a fresh database.
--
-- 1. Widths: every live column scaled by 0.855, once (while the 21 old columns still add up to more
--    than 99), so the 25 shown add up to 100 again over all four levels (a Margin as wide as its Profit).
-- 2. Columns 21..24 (L1..L4 Margin %, ids 2834-2837 unless a site used them) added where missing.
-- 3. Positions re-ranked: each Margin right after its level's Profit, every other column keeps its
--    order (a site's saved order is kept).
-- Re-runnable: run again it changes nothing.
DO $$
DECLARE
    lvl    record;
    pwidth numeric;
    new_id bigint;
BEGIN
    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);

    IF (SELECT COALESCE(SUM(ui_tbl_clm_column_width), 0) FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 68 AND ui_tbl_clm_no BETWEEN 0 AND 20 AND NOT ui_tbl_clm_is_deleted) > 99 THEN
        UPDATE fixed.ui_table_columns
           SET ui_tbl_clm_column_width = round(ui_tbl_clm_column_width * 0.855, 2),
               ui_tbl_clm_modified_by  = 'system',
               ui_tbl_clm_modified_on  = now()
         WHERE ui_tbl_clm_table_id = 68 AND ui_tbl_clm_no BETWEEN 0 AND 20 AND NOT ui_tbl_clm_is_deleted;
    END IF;

    FOR lvl IN SELECT * FROM (VALUES (2834::bigint, 21::bigint, 'L1 Margin %'::text, 7::bigint),
                                     (2835::bigint, 22::bigint, 'L2 Margin %'::text, 10::bigint),
                                     (2836::bigint, 23::bigint, 'L3 Margin %'::text, 13::bigint),
                                     (2837::bigint, 24::bigint, 'L4 Margin %'::text, 16::bigint)) v(id, no, name, profit_no)
    LOOP
        CONTINUE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns
                               WHERE ui_tbl_clm_table_id = 68 AND ui_tbl_clm_no = lvl.no AND NOT ui_tbl_clm_is_deleted);
        SELECT ui_tbl_clm_column_width INTO pwidth
          FROM fixed.ui_table_columns
         WHERE ui_tbl_clm_table_id = 68 AND ui_tbl_clm_no = lvl.profit_no AND NOT ui_tbl_clm_is_deleted
         ORDER BY ui_tbl_clm_id
         LIMIT 1;
        IF pwidth IS NULL THEN
            RAISE EXCEPTION 'ui_table 68 has no live column % (the level''s Profit)', lvl.profit_no;
        END IF;
        -- The seeded id, unless a site already used it for a row of its own.
        new_id := CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_id = lvl.id)
                       THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
                       ELSE lvl.id END;
        INSERT INTO fixed.ui_table_columns
            (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
             ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
             ui_tbl_clm_column_necessity, ui_tbl_clm_next_column, ui_tbl_clm_previous_column,
             ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (new_id, 68, lvl.no, lvl.name, pwidth, true, true, 0, false, NULL, NULL, true, false, 'system');
    END LOOP;

    -- Ranked: a Margin sorts half a place after its level's Profit, the rest by where they stand now.
    WITH keyed AS (
        SELECT c.ui_tbl_clm_id AS id,
               c.ui_tbl_clm_column_position AS pos,
               CASE WHEN c.ui_tbl_clm_no BETWEEN 21 AND 24
                    THEN (SELECT p.ui_tbl_clm_column_position FROM fixed.ui_table_columns p
                           WHERE p.ui_tbl_clm_table_id = 68 AND NOT p.ui_tbl_clm_is_deleted
                             AND p.ui_tbl_clm_no = 7 + 3 * (c.ui_tbl_clm_no - 21)
                           ORDER BY p.ui_tbl_clm_id LIMIT 1) + 0.5
                    ELSE c.ui_tbl_clm_column_position END AS sort_key,
               CASE WHEN c.ui_tbl_clm_no BETWEEN 21 AND 24 THEN 1 ELSE 0 END AS is_margin
          FROM fixed.ui_table_columns c
         WHERE c.ui_tbl_clm_table_id = 68 AND NOT c.ui_tbl_clm_is_deleted
    ), ranked AS (
        SELECT id, pos, (ROW_NUMBER() OVER (ORDER BY sort_key, is_margin, id) - 1)::bigint AS rnk FROM keyed
    )
    UPDATE fixed.ui_table_columns t
       SET ui_tbl_clm_column_position = r.rnk,
           ui_tbl_clm_modified_by     = 'system',
           ui_tbl_clm_modified_on     = now()
      FROM ranked r
     WHERE t.ui_tbl_clm_id = r.id AND t.ui_tbl_clm_column_position IS DISTINCT FROM r.rnk;

    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);
END $$;
