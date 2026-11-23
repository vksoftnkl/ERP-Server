-- ═══════════════════════════════════════════════════════════════════════════
-- Change Selling Price (menu 30) rework, phase P1-1 (DB)
-- Plan: Shared/Prathap/inventory/plan-change-selling-price-rework-p1-2026-11-23.md section 6
-- (the user: "go", 2026-11-23; mockup v2; decisions-price-cost-chain-2026-11-23.md).
--
--   1 · ui_table 44 "CHANGE SELLING PRICE - ROWS" laid out again (v2, plan 6.1): the
--       item card's price grid for many items. Numbers 0..46 keep their meaning; 47..58
--       are new (ids 2822..2833): 47 Company, 48 Stock cost, 49 Stock cost Wot,
--       50 Profit Type, 51 RowKind (ITEM / LINE / BLANK), 52 LineKind (HEADLINE / MRP /
--       SOLD_AT / NO_PRICE / NEW), 53 UnitFactor, 54 CompanyId, 55 LineBranchId,
--       56 BaseCost, 57 BaseProfitType, 58 Spread (the stock-cost tip's text).
--       Shown, in this order, titled as on mockup v2: # · Unit · MRP / sold at ·
--       Company · Branch · Stock · Profit Type · R.Off · Stock cost · Cost · Cost Wot ·
--       per level Profit · Margin · Wot · Price · Min (28 columns, widths in proportion
--       to the mockup's pixel widths, adding up to 100.00 over all four levels; the
--       rounding rest goes to Branch, the widest). Enter stops (focus): MRP / sold at,
--       Profit Type, R.Off, Cost, each level's Profit / Margin / Price, Min; the screen
--       decides per row (MRP only on a plain item, item rows skipped).
--       Hidden: Item (the item row paints the name), Sale Px (shown inside MRP / sold
--       at), Src (retired), the ids and baselines, CostBasis, Barcode and the new ids.
--       A hidden column with a width is offered in the per-user Columns… list (Item,
--       Sale Px, Barcode, Stock cost Wot); one with width 0 never is.
--       Every live column of the table gets these values, so any database ends with the
--       same layout; a site's own widths / hides on this grid are replaced once.
--   2 · dropdown 80 "BRANCHES - THIS COMPANY" (plan 6.2): the Filter popup's Branch
--       picker, head office only (C7). Param icompany_id, compared as text.
--   3 · fixed.error_message (plan 6.3): STOCK_PRICE_BRANCH_HQ_ONLY, _LINE_EXISTS,
--       _BACK_NOT_OWN, _BACK_NOTHING_LEFT, _RIGHT_DELETE and the STOCK_PRICE_BELOW_COST
--       variant rule=BRANCHES; for the user's A3 answer (option C, 2026-11-23: below cost
--       is judged on the HIGHER of the line's own cost and the stock cost, and the
--       warning names both) also the variants rule=LINE_COST / rule=STOCK_COST (both
--       costs known; the plain row stays for a line with only one). The plain
--       STOCK_PRICE_BELOW_COST row ("below its cost") still reads true and is kept.
--       STOCK_PRICE_BUCKET_MRP_ZERO is reworded ("+ Line" makes it a user path).
--       STOCK_ITEM_PRICE_NOT_FOUND gets its first wording: the plain row for a price line
--       that is gone (Back to all branches on a stale line id), and the variant
--       field=ipm_item_id for the stock-balance reads, where an item and unit have no
--       price line at all.
--       prisma/seed/Error_Messages.json (version 2026-11-23.2) carries the same rows.
--
-- Layout and wording data only: no table, column, index, CHECK, function or trigger;
-- no db_table_master row. Migrations run before seeds, so on a fresh database the
-- ui_table 44 part is a no-op and Ui_Table_Columns.sql / Dropdown_*.sql carry the same
-- rows. Re-runnable: inserts are guarded, the layout UPDATE only touches a row whose
-- values differ, the wording only changes while its text differs, the catalogue bump
-- only while its version is older. Section 4 checks the result and raises on a fault.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · the ids and names are free, or already ours ────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('ui_table %s is %s', t.ui_tbl_id, t.ui_tbl_name)
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 44 AND t.ui_tbl_name IS DISTINCT FROM 'CHANGE SELLING PRICE - ROWS'
        UNION ALL
        SELECT format('dropdown %s (%s)', d.dropdown_id, d.dropdown_name)
          FROM fixed.dropdown_details d
         WHERE (d.dropdown_id = 80 AND d.dropdown_name IS DISTINCT FROM 'BRANCHES - THIS COMPANY')
            OR (upper(d.dropdown_name) = 'BRANCHES - THIS COMPANY' AND d.dropdown_id <> 80)
        UNION ALL
        SELECT format('dropdown column %s (dropdown %s no %s)', c.dropdown_columns_id,
                      c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
          FROM fixed.dropdown_columns c
         WHERE c.dropdown_columns_id::text LIKE '01a1f5c0-8000-7000-8000-00000000080%'
           AND (c.dropdown_columns_dropdown_id, c.dropdown_columns_no)
               IS DISTINCT FROM (80, right(c.dropdown_columns_id::text, 1)::int)
    ) s(x);
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'change selling price P1: already taken by something else: %', v_clash;
    END IF;
END $$;


-- ── 1 · ui_table 44 v2 ─────────────────────────────────────────────────────
DO $$
DECLARE
    r       record;
    new_id  bigint;
    missing text;
BEGIN
    -- Only where the grid's layout exists (a fresh database gets the rows from the seed).
    IF NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted) THEN
        RETURN;
    END IF;
    -- The 47 columns 0..46 must all be there: they are the screen's enum.
    SELECT string_agg(n::text, ', ' ORDER BY n) INTO missing
      FROM generate_series(0, 46) n
     WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns c
                        WHERE c.ui_tbl_clm_table_id = 44 AND c.ui_tbl_clm_no = n AND NOT c.ui_tbl_clm_is_deleted);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'ui_table 44 has no live column %: lay it out by hand first', missing;
    END IF;

    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);
    FOR r IN SELECT * FROM (VALUES (2822::bigint, 47::bigint, 'Company'::text), (2823, 48, 'Stock cost'),
                                   (2824, 49, 'Stock cost Wot'), (2825, 50, 'Profit Type'),
                                   (2826, 51, 'RowKind'), (2827, 52, 'LineKind'), (2828, 53, 'UnitFactor'),
                                   (2829, 54, 'CompanyId'), (2830, 55, 'LineBranchId'), (2831, 56, 'BaseCost'),
                                   (2832, 57, 'BaseProfitType'), (2833, 58, 'Spread')) v(id, no, name)
    LOOP
        CONTINUE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns
                               WHERE ui_tbl_clm_table_id = 44 AND ui_tbl_clm_no = r.no AND NOT ui_tbl_clm_is_deleted);
        new_id := CASE WHEN EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_id = r.id)
                       THEN nextval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'))
                       ELSE r.id END;
        -- Parked at the end, hidden; the UPDATE below gives it its place.
        INSERT INTO fixed.ui_table_columns
            (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
             ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
             ui_tbl_clm_column_necessity, ui_tbl_clm_next_column, ui_tbl_clm_previous_column,
             ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
        VALUES (new_id, 44, r.no, r.name, 0, false, false, 100 + r.no, false, NULL, NULL, true, false, 'system');
    END LOOP;
    PERFORM setval(pg_get_serial_sequence('fixed.ui_table_columns', 'ui_tbl_clm_id'),
                   GREATEST((SELECT MAX(ui_tbl_clm_id) FROM fixed.ui_table_columns), 1), true);

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
            ( 0::bigint, '#'::text        ,  1.44::numeric, true , false,  0)
            ,( 2, 'Unit'           ,  2.77, true , false,  1)
            ,( 4, 'MRP / sold at'  ,  4.65, true , true ,  2)
            ,(47, 'Company'        ,  3.54, true , false,  3)
            ,(35, 'Branch'         , 10.17, true , false,  4)
            ,( 3, 'Stock'          ,  2.43, true , false,  5)
            ,(50, 'Profit Type'    ,  4.09, true , true ,  6)
            ,(25, 'R.Off'          ,  2.43, true , true ,  7)
            ,(48, 'Stock cost'     ,  3.98, true , false,  8)
            ,( 7, 'Cost'           ,  4.31, true , true ,  9)
            ,(36, 'Cost Wot'       ,  3.98, true , false, 10)
            ,( 8, 'Profit'         ,  3.21, true , true , 11)
            ,(43, 'Margin'         ,  2.77, true , true , 12)
            ,(37, 'Wot'            ,  3.54, true , false, 13)
            ,( 9, 'Price'          ,  3.98, true , true , 14)
            ,(10, 'Profit'         ,  3.21, true , true , 15)
            ,(44, 'Margin'         ,  2.77, true , true , 16)
            ,(38, 'Wot'            ,  3.54, true , false, 17)
            ,(11, 'Price'          ,  3.98, true , true , 18)
            ,(12, 'Profit'         ,  3.21, true , true , 19)
            ,(45, 'Margin'         ,  2.77, true , true , 20)
            ,(39, 'Wot'            ,  3.54, true , false, 21)
            ,(13, 'Price'          ,  3.98, true , true , 22)
            ,(14, 'Profit'         ,  3.21, true , true , 23)
            ,(46, 'Margin'         ,  2.77, true , true , 24)
            ,(40, 'Wot'            ,  3.54, true , false, 25)
            ,(15, 'Price'          ,  3.98, true , true , 26)
            ,(16, 'Min'            ,  2.21, true , true , 27)
            ,( 1, 'Item'           ,  7.90, false, false, 28)
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
END $$;


-- ── 2 · dropdown 80 "BRANCHES - THIS COMPANY" ──────────────────────────────
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT 80, 'BRANCHES - THIS COMPANY',
       'Change Selling Price (menu 30) Filter popup: the Branch head office picks to work on another branch (plan C7). Live, active branches of this company, by name. Param icompany_id, always sent; compared as text, never cast.',
$d$SELECT br_id, br_name, COALESCE(br_short, '') AS br_short
  FROM public.branch_master
 WHERE br_is_deleted = false
   AND br_is_active = true
   AND br_comp_id::text = 'icompany_id'
 ORDER BY br_name$d$,
       'asc', 'br_name', 'br_name', 10, true, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 80);

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.id, 80, v.no, 'Text', v.name, NULL, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    ('01a1f5c0-8000-7000-8000-000000000800'::uuid, 0, '#',      10.00, false, false, 'br_id'),
    ('01a1f5c0-8000-7000-8000-000000000801'::uuid, 1, 'Branch', 75.00, true,  true,  'br_name'),
    ('01a1f5c0-8000-7000-8000-000000000802'::uuid, 2, 'Short',  25.00, true,  true,  'br_short')
  ) AS v(id, no, name, width, visible, filter, field)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = 80 AND d.dropdown_name = 'BRANCHES - THIS COMPANY')
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = 80)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT COALESCE(max(dropdown_id), 1) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));


-- ── 3 · the plain wording (plan 6.3; A3 option C) ──────────────────────────
-- Braces are filled by the server from the error's params (then its own keys); one
-- with no value is dropped. {level} the level's short name, {price} / {cost} /
-- {lineCost} / {stockCost} 2 decimals, {branch} the branch's short name else its name.
-- rule=LINE_COST: both costs known, the line's own cost (the last purchase) the higher.
-- rule=STOCK_COST: both known, the stock cost the higher. rule=BRANCHES: an All
-- branches line below the stock cost at another branch ({cost} = that stock cost).
-- STOCK_ITEM_PRICE_NOT_FOUND field=ipm_item_id: itemstockBalanceService / itemBatchStockService.
INSERT INTO fixed.error_message AS e
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('STOCK_PRICE_BRANCH_HQ_ONLY', '', 'en', 'Head office only', 'Only head office can see or change another branch''s prices.', 'Work on your own branch.')
    ,('STOCK_PRICE_LINE_EXISTS', '', 'en', 'Line already there', '{unit} {mrp} already has a price line for {branch}: line {n}.', 'Type the prices on that line.')
    ,('STOCK_PRICE_BACK_NOT_OWN', '', 'en', 'Not a branch''s own price', 'This line is the price for all branches, so there is nothing to go back to.', 'Pick a branch''s own line.')
    ,('STOCK_PRICE_BACK_NOTHING_LEFT', '', 'en', 'No price left', 'Without this line, {item} {unit} would have no price at {branch}.', 'Set an All branches price first, or keep this line.')
    ,('STOCK_PRICE_RIGHT_DELETE', '', 'en', 'Not allowed', 'You have no right to remove a branch''s own price.', 'Ask the admin for Delete on Change Selling Price.')
    ,('STOCK_PRICE_BELOW_COST', 'rule=BRANCHES', 'en', 'Below cost at some branches', '{level} {price} is below the stock cost at {branch} ({cost}).', 'Go back and change the price, or save anyway.')
    ,('STOCK_PRICE_BELOW_COST', 'rule=LINE_COST', 'en', 'Price below cost', '{level} {price} is below the last purchase cost {lineCost} (stock cost {stockCost}).', 'Raise the price, or check it before you save.')
    ,('STOCK_PRICE_BELOW_COST', 'rule=STOCK_COST', 'en', 'Price below cost', '{level} {price} is below the stock cost {stockCost} (last purchase cost {lineCost}).', 'Raise the price, or check it before you save.')
    ,('STOCK_PRICE_BUCKET_MRP_ZERO', '', 'en', 'MRP missing', 'The MRP is 0.', 'Type the MRP printed on the new stock.')
    ,('STOCK_ITEM_PRICE_NOT_FOUND', '', 'en', 'Price line not found', 'This price line is not there now. Someone may have changed or removed it.', 'Load the item again, then try again.')
    ,('STOCK_ITEM_PRICE_NOT_FOUND', 'field=ipm_item_id', 'en', 'No price yet', 'This item has no price line for this unit.', 'Set its prices on the item card or in Change Selling Price.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO UPDATE
   SET erm_title       = EXCLUDED.erm_title,
       erm_line        = EXCLUDED.erm_line,
       erm_todo        = EXCLUDED.erm_todo,
       erm_is_active   = true,
       erm_modified_on = now()
 WHERE (e.erm_title, e.erm_line, e.erm_todo, e.erm_is_active)
       IS DISTINCT FROM (EXCLUDED.erm_title, EXCLUDED.erm_line, EXCLUDED.erm_todo, true);

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-23.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-23.2';


-- ── 4 · checks: raise when anything is wrong ──────────────────────────────
DO $$
DECLARE
    n   int;
    bad text;
    sumw numeric;
BEGIN
    IF EXISTS (SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 44 AND NOT ui_tbl_clm_is_deleted) THEN
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
    END IF;

    SELECT count(*) INTO n FROM fixed.dropdown_columns WHERE dropdown_columns_dropdown_id = 80;
    IF NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 80 AND dropdown_name = 'BRANCHES - THIS COMPANY') OR n <> 3 THEN
        RAISE EXCEPTION 'dropdown 80 missing or with % columns (expected 3)', n;
    END IF;

    SELECT count(*) INTO n FROM fixed.error_message
     WHERE erm_lang = 'en' AND erm_is_active
       AND (erm_code, erm_variant) IN (('STOCK_PRICE_BRANCH_HQ_ONLY', ''), ('STOCK_PRICE_LINE_EXISTS', ''),
                                       ('STOCK_PRICE_BACK_NOT_OWN', ''), ('STOCK_PRICE_BACK_NOTHING_LEFT', ''),
                                       ('STOCK_PRICE_RIGHT_DELETE', ''), ('STOCK_PRICE_BELOW_COST', 'rule=BRANCHES'),
                                       ('STOCK_PRICE_BELOW_COST', 'rule=LINE_COST'), ('STOCK_PRICE_BELOW_COST', 'rule=STOCK_COST'),
                                       ('STOCK_ITEM_PRICE_NOT_FOUND', ''), ('STOCK_ITEM_PRICE_NOT_FOUND', 'field=ipm_item_id'));
    IF n <> 10 THEN RAISE EXCEPTION 'wording: % of the 10 new rows found', n; END IF;
    IF NOT EXISTS (SELECT 1 FROM fixed.error_message
                    WHERE erm_code = 'STOCK_PRICE_BUCKET_MRP_ZERO' AND erm_variant = '' AND erm_lang = 'en'
                      AND erm_title = 'MRP missing' AND erm_is_active) THEN
        RAISE EXCEPTION 'wording: STOCK_PRICE_BUCKET_MRP_ZERO not reworded';
    END IF;
END $$;
