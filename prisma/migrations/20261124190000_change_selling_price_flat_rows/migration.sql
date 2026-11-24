-- ═══════════════════════════════════════════════════════════════════════════
-- Change Selling Price (menu 30): flat rows, one row per price line (the DB half)
-- Mockup: Shared/Prathap/inventory/mockup-change-selling-price-flat-rows-2026-11-24.md
-- and change_selling_price_flat_rows_mockup.png (the user, 2026-11-24: "mockup ok",
-- every question answered as recommended).
--
--   1 · ui_table 44 "CHANGE SELLING PRICE - ROWS" laid out again (v3). The item header
--       rows go, so the Item column (number 1, there since the start and hidden by P1)
--       comes right after # at position 1, shown, width 12.00 (Q5). It is never an
--       Enter stop (focus stays off). Every column that was at position 1..27 moves up
--       one (Unit 2 ... Min 28). Branch (35) is shown again for everyone (Q10: it was
--       hidden on 11-24 with "Hide Column (for everyone)"); Company (47) stays hidden,
--       and a user may show it with Columns... . The other 27 shown widths are scaled
--       by 88.00 / 96.46, so the 28 shown columns add up to 100.00 again; Company gets
--       the same factor (3.54 -> 3.23) and keeps its share when a user shows it; the
--       rounding rest (-0.02) goes to Branch, the widest (as P1 did). Names, Enter stops
--       and the hidden tail (positions 29..58) are as 20261124090000 left them.
--       Every live column of the table gets these values (as P1 did), so any database
--       ends with the same layout; a site's own widths / hides on this grid are replaced
--       once. The users' own choices (setting ui.grid_columns, per user, keyed by
--       column number) are not touched, and the numbers do not change.
--   2 · checks: raise when the result is not the v3 layout.
--
-- Layout data only: no table, column, index, CHECK, function or trigger; no
-- db_table_master row. Migrations run before seeds, so on a fresh database this is a
-- no-op and prisma/seed/Ui_Table_Columns.sql carries the same rows. Re-runnable: the
-- UPDATE only touches a row whose values differ.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · ui_table 44 v3 ─────────────────────────────────────────────────────
DO $$
DECLARE
    missing text;
    v_rows  int;
BEGIN
    -- Only where the grid's layout exists (a fresh database gets the rows from the seed).
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted) THEN
        RETURN;
    END IF;
    -- Columns 0..58 must all be there (58 since 20261124090000): they are the screen's enum.
    SELECT string_agg(n::text, ', ' ORDER BY n) INTO missing
      FROM generate_series(0, 58) n
     WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns c
                        WHERE c.ui_tbl_clm_table_id = 44 AND c.ui_tbl_clm_no = n AND NOT c.ui_tbl_clm_is_deleted);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'ui_table 44 has no live column %: apply 20261124090000 first', missing;
    END IF;

    UPDATE fixed.ui_table_columns c
       SET ui_tbl_clm_name              = v.name,
           ui_tbl_clm_column_width      = v.width,
           ui_tbl_clm_column_visibility = v.visible,
           ui_tbl_clm_column_focus      = v.focus,
           ui_tbl_clm_column_position   = v.pos,
           ui_tbl_clm_column_necessity  = false,
           ui_tbl_clm_modified_by       = 'system',
           ui_tbl_clm_modified_on       = now()
      FROM (VALUES
            ( 0::bigint, '#'::text        ,  1.31::numeric, true , false,  0)
            ,( 1, 'Item'           , 12.00, true , false,  1)
            ,( 2, 'Unit'           ,  2.53, true , false,  2)
            ,( 4, 'MRP / sold at'  ,  4.24, true , true ,  3)
            ,(47, 'Company'        ,  3.23, false, false,  4)
            ,(35, 'Branch'         ,  9.26, true , false,  5)
            ,( 3, 'Stock'          ,  2.22, true , false,  6)
            ,(50, 'Profit Type'    ,  3.73, true , true ,  7)
            ,(25, 'R.Off'          ,  2.22, true , true ,  8)
            ,(48, 'Stock cost'     ,  3.63, true , false,  9)
            ,( 7, 'Cost'           ,  3.93, true , true , 10)
            ,(36, 'Cost Wot'       ,  3.63, true , false, 11)
            ,( 8, 'Profit'         ,  2.93, true , true , 12)
            ,(43, 'Margin'         ,  2.53, true , true , 13)
            ,(37, 'Wot'            ,  3.23, true , false, 14)
            ,( 9, 'Price'          ,  3.63, true , true , 15)
            ,(10, 'Profit'         ,  2.93, true , true , 16)
            ,(44, 'Margin'         ,  2.53, true , true , 17)
            ,(38, 'Wot'            ,  3.23, true , false, 18)
            ,(11, 'Price'          ,  3.63, true , true , 19)
            ,(12, 'Profit'         ,  2.93, true , true , 20)
            ,(45, 'Margin'         ,  2.53, true , true , 21)
            ,(39, 'Wot'            ,  3.23, true , false, 22)
            ,(13, 'Price'          ,  3.63, true , true , 23)
            ,(14, 'Profit'         ,  2.93, true , true , 24)
            ,(46, 'Margin'         ,  2.53, true , true , 25)
            ,(40, 'Wot'            ,  3.23, true , false, 26)
            ,(15, 'Price'          ,  3.63, true , true , 27)
            ,(16, 'Min'            ,  2.02, true , true , 28)
            ,( 5, 'Sale Px'        ,  3.00, false, false, 29)
            ,( 6, 'Src'            ,     0, false, false, 30)
            ,(17, 'ItemId'         ,     0, false, false, 31)
            ,(18, 'UomId'          ,     0, false, false, 32)
            ,(19, 'BucketId'       ,     0, false, false, 33)
            ,(20, 'PriceScope'     ,     0, false, false, 34)
            ,(21, 'PriceSource'    ,     0, false, false, 35)
            ,(22, 'BucketMrp'      ,     0, false, false, 36)
            ,(23, 'BucketSp'       ,     0, false, false, 37)
            ,(24, 'TaxPerc'        ,     0, false, false, 38)
            ,(26, 'HasCess'        ,     0, false, false, 39)
            ,(27, 'ItemCode'       ,     0, false, false, 40)
            ,(28, 'TrackSig'       ,     0, false, false, 41)
            ,(29, 'State'          ,     0, false, false, 42)
            ,(30, 'BaseA'          ,     0, false, false, 43)
            ,(31, 'BaseB'          ,     0, false, false, 44)
            ,(32, 'BaseC'          ,     0, false, false, 45)
            ,(33, 'BaseD'          ,     0, false, false, 46)
            ,(34, 'BaseMin'        ,     0, false, false, 47)
            ,(41, 'CostBasis'      ,     0, false, false, 48)
            ,(42, 'Barcode'        ,  4.96, false, false, 49)
            ,(49, 'Stock cost Wot' ,  3.98, false, false, 50)
            ,(51, 'RowKind'        ,     0, false, false, 51)
            ,(52, 'LineKind'       ,     0, false, false, 52)
            ,(53, 'UnitFactor'     ,     0, false, false, 53)
            ,(54, 'CompanyId'      ,     0, false, false, 54)
            ,(55, 'LineBranchId'   ,     0, false, false, 55)
            ,(56, 'BaseCost'       ,     0, false, false, 56)
            ,(57, 'BaseProfitType' ,     0, false, false, 57)
            ,(58, 'Spread'         ,     0, false, false, 58)
           ) v(no, name, width, visible, focus, pos)
     WHERE c.ui_tbl_clm_table_id = 44
       AND c.ui_tbl_clm_no = v.no
       AND NOT c.ui_tbl_clm_is_deleted
       AND (c.ui_tbl_clm_name, c.ui_tbl_clm_column_width, c.ui_tbl_clm_column_visibility,
            c.ui_tbl_clm_column_focus, c.ui_tbl_clm_column_position, c.ui_tbl_clm_column_necessity)
           IS DISTINCT FROM (v.name, v.width, v.visible, v.focus, v.pos, false);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'ui_table 44 v3: % rows changed', v_rows;
END $$;


-- ── 2 · checks: raise when anything is wrong ──────────────────────────────
DO $$
DECLARE
    n    int;
    bad  text;
    sumw numeric;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted) THEN
        RETURN;
    END IF;
    SELECT string_agg(no::text, ', ' ORDER BY no) INTO bad
      FROM (SELECT g AS no FROM generate_series(0, 58) g
             WHERE (SELECT count(*) FROM fixed.ui_table_columns c
                     WHERE c.ui_tbl_clm_table_id = 44 AND c.ui_tbl_clm_no = g AND NOT c.ui_tbl_clm_is_deleted) <> 1) x;
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'ui_table 44: columns without exactly one live row: %', bad;
    END IF;
    SELECT count(*) INTO n FROM fixed.ui_table_columns
     WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted AND ui_tbl_clm_no NOT BETWEEN 0 AND 58;
    IF n <> 0 THEN RAISE EXCEPTION 'ui_table 44: % live columns outside 0..58', n; END IF;
    SELECT count(*), sum(ui_tbl_clm_column_width) INTO n, sumw FROM fixed.ui_table_columns
     WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted AND ui_tbl_clm_column_visibility;
    IF n <> 28 OR sumw <> 100.00 THEN
        RAISE EXCEPTION 'ui_table 44: % shown columns adding up to % (expected 28 and 100.00)', n, sumw;
    END IF;
    SELECT count(*) INTO n FROM (SELECT ui_tbl_clm_column_position FROM fixed.ui_table_columns
                                  WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted
                                  GROUP BY 1 HAVING count(*) > 1) x;
    IF n <> 0 THEN RAISE EXCEPTION 'ui_table 44: % positions used twice', n; END IF;
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 44 AND ui_tbl_clm_no = 1 AND NOT ui_tbl_clm_is_deleted
                      AND ui_tbl_clm_name = 'Item' AND ui_tbl_clm_column_position = 1
                      AND ui_tbl_clm_column_visibility AND NOT ui_tbl_clm_column_focus
                      AND ui_tbl_clm_column_width = 12.00) THEN
        RAISE EXCEPTION 'ui_table 44: Item (1) is not shown at position 1, width 12.00, focus off';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns
                    WHERE ui_tbl_clm_table_id = 44 AND ui_tbl_clm_no = 35 AND NOT ui_tbl_clm_is_deleted
                      AND ui_tbl_clm_column_visibility AND ui_tbl_clm_column_position = 5)
       OR EXISTS (SELECT 1 FROM fixed.ui_table_columns
                   WHERE ui_tbl_clm_table_id = 44 AND ui_tbl_clm_no = 47 AND NOT ui_tbl_clm_is_deleted
                     AND ui_tbl_clm_column_visibility) THEN
        RAISE EXCEPTION 'ui_table 44: Branch (35) must be shown at position 5 and Company (47) hidden';
    END IF;
END $$;
