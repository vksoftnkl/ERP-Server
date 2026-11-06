-- ═══════════════════════════════════════════════════════════════════════════
--  Qty-wise Prices + Cost + Card Rate: one form (menu 244), phase A1  2026-11-06
--  Plan: Shared/Prathap/inventory/plan-qty-price-card-rate-one-form.md §3 A1
--  and §4.5, with addendum-1 (Q9 = A: ITEM_QTY_PRICE_CHAIN_HQ_ONLY) and
--  addendum-2 (no React; the DB part is unchanged). Seed data only: no table,
--  column, CHECK, function or trigger.
--
--  1 · ui_table 68 "QTY-WISE PRICES - CARD RATE" (editable, Desktop): the card
--      band menu 244 gains on top of its slab grid, and its 21 columns, ids
--      2371-2391. ui_tbl_clm_no = position = the Qt column number, 0-20:
--      Unit · Rule · MRP · Stock · Stock avg · Cost w/o tax · Cost ·
--      L1-L4 (Profit % · W/o tax · Price) · Min · Changed. The level headings
--      are replaced at run time by the active level names, as Quick Rate does,
--      and an inactive level's three columns are hidden by the screen.
--      Widths are the mockup's column widths (qty_price_card_rate_one_form_ui_
--      mockup.py, CC) as a percentage of the 4-level grid (1744 px), so the
--      21 columns add up to 100.00, ui_table 67's style. Enter stops (column
--      focus) on Rule, MRP, Cost, every level's Profit % / W/o tax / Price and
--      Min (plan §3); the screen locks MRP and Cost where they cannot be typed.
--
--  2 · ui_table 19 "ITEM QTY WISE PRICE" (the slab grid both clients read):
--      four read-only columns, ids 2392-2395, numbers and positions 23-26
--      (IqpCols 23-26): Level · Each · With saved card · What moves it.
--      Visible, no focus. Widths are the mockup's (SC) as a percentage of its
--      1012 px slab grid; the Qt screen stretches its grid columns anyway.
--      Added only where table 19 is already laid out; on a fresh database the
--      seed lays the table out whole, these four rows included.
--
--  3 · fixed.error_message: 15 new codes (the form's save, the rights
--      assertMenuRight builds from the prefix ITEM_QTY_PRICE, and the Q9
--      CHAIN_HQ_ONLY refusal) plus 19 backfilled rows for codes the server
--      already throws with no wording (13 ITEM_QTY_PRICE_*, 6 STOCK_PRICE_*).
--      34 rows; catalogue 2026-11-06.1.
--
--  Ids are PINNED and the same rows are in prisma/seed (Ui_Tables.sql,
--  Ui_Table_Columns.sql, Error_Messages.json). An id already taken by
--  something else stops the migration. Re-runnable: every statement is
--  guarded. No sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, ', ') INTO v_clash FROM (
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name) AS x
          FROM fixed.ui_tables t
         WHERE t.ui_tbl_id = 68
           AND t.ui_tbl_name IS DISTINCT FROM 'QTY-WISE PRICES - CARD RATE'
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES
                (2371::bigint, 68::bigint, 0::bigint),
                (2372, 68, 1),
                (2373, 68, 2),
                (2374, 68, 3),
                (2375, 68, 4),
                (2376, 68, 5),
                (2377, 68, 6),
                (2378, 68, 7),
                (2379, 68, 8),
                (2380, 68, 9),
                (2381, 68, 10),
                (2382, 68, 11),
                (2383, 68, 12),
                (2384, 68, 13),
                (2385, 68, 14),
                (2386, 68, 15),
                (2387, 68, 16),
                (2388, 68, 17),
                (2389, 68, 18),
                (2390, 68, 19),
                (2391, 68, 20),
                (2392, 19, 23),
                (2393, 19, 24),
                (2394, 19, 25),
                (2395, 19, 26)
               ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no)) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Qty-wise Prices card rate: ids already taken: %. Pick free ids here, in the seed files and in the Qt screen.', v_clash;
    END IF;
END $$;


-- ── 1 · ui_table 68 and its columns ────────────────────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (68, 'QTY-WISE PRICES - CARD RATE', true, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2371::bigint, 68::bigint, 0::bigint, 'Unit'::text, 2.98::numeric, true::boolean, false::boolean, 0::integer),
        (2372, 68, 1, 'Rule', 3.79, true, true, 1),
        (2373, 68, 2, 'MRP', 6.42, true, true, 2),
        (2374, 68, 3, 'Stock', 2.52, true, false, 3),
        (2375, 68, 4, 'Stock avg', 4.01, true, false, 4),
        (2376, 68, 5, 'Cost w/o tax', 5.05, true, false, 5),
        (2377, 68, 6, 'Cost', 6.19, true, true, 6),
        (2378, 68, 7, 'L1 Profit %', 4.24, true, true, 7),
        (2379, 68, 8, 'L1 W/o tax', 4.24, true, true, 8),
        (2380, 68, 9, 'L1 Price', 5.74, true, true, 9),
        (2381, 68, 10, 'L2 Profit %', 4.24, true, true, 10),
        (2382, 68, 11, 'L2 W/o tax', 4.24, true, true, 11),
        (2383, 68, 12, 'L2 Price', 5.74, true, true, 12),
        (2384, 68, 13, 'L3 Profit %', 4.24, true, true, 13),
        (2385, 68, 14, 'L3 W/o tax', 4.24, true, true, 14),
        (2386, 68, 15, 'L3 Price', 5.74, true, true, 15),
        (2387, 68, 16, 'L4 Profit %', 4.24, true, true, 16),
        (2388, 68, 17, 'L4 W/o tax', 4.24, true, true, 17),
        (2389, 68, 18, 'L4 Price', 5.74, true, true, 18),
        (2390, 68, 19, 'Min', 3.79, true, true, 19),
        (2391, 68, 20, 'Changed', 8.37, true, false, 20)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'QTY-WISE PRICES - CARD RATE')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;


-- ── 2 · ui_table 19: Level · Each · With saved card · What moves it ───────
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, v.focus, v.pos, false, true, false, 'system'
  FROM (VALUES
        (2392::bigint, 19::bigint, 23::bigint, 'Level'::text, 6.32::numeric, true::boolean, false::boolean, 23::integer),
        (2393, 19, 24, 'Each', 9.49, true, false, 24),
        (2394, 19, 25, 'With saved card', 11.66, true, false, 25),
        (2395, 19, 26, 'What moves it', 29.64, true, false, 26)
       ) v(id, tbl, no, name, width, visible, focus, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl AND t.ui_tbl_name = 'ITEM QTY WISE PRICE')
   AND EXISTS (SELECT 1 FROM fixed.ui_table_columns l
                WHERE l.ui_tbl_clm_table_id = v.tbl AND l.ui_tbl_clm_is_deleted = false)
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;

SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);


-- ── 3 · plain wording rows (notes 120), catalogue 2026-11-06.1 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('ITEM_QTY_PRICE_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open Qty-wise Prices.', 'Call manager.')
    ,('ITEM_QTY_PRICE_RIGHT_CREATE', '', 'en', 'Not allowed', 'You have no right to add a qty-wise price.', 'Call manager.')
    ,('ITEM_QTY_PRICE_RIGHT_EDIT', '', 'en', 'Not allowed', 'You have no right to change a qty-wise price.', 'Call manager.')
    ,('ITEM_QTY_PRICE_RIGHT_DELETE', '', 'en', 'Not allowed', 'You have no right to remove a qty-wise price.', 'Call manager.')
    ,('ITEM_QTY_PRICE_NOTHING_TO_SAVE', '', 'en', 'Nothing to save', 'Nothing was changed on this form.', 'Change a price or a slab, then save.')
    ,('ITEM_QTY_PRICE_ITEM_MISMATCH', '', 'en', 'Something went wrong', 'The app sent rows of another item.', 'Send a photo of this to support.')
    ,('ITEM_QTY_PRICE_LEVEL_NOT_SELLING', '', 'en', 'Price level not allowed', 'A slab names a price level that is not an active selling level.', 'Pick an active level, or leave it blank for all levels.')
    ,('ITEM_QTY_PRICE_COST_NOT_PLAIN_STOCK', '', 'en', 'Cost comes from stock', 'This item keeps its stock by batch, MRP, sale price or serial, so its cost can''t be typed here.', 'Leave the cost as it is.')
    ,('ITEM_QTY_PRICE_MRP_NOT_PLAIN_STOCK', '', 'en', 'MRP can''t be typed here', 'This item''s stock is kept by MRP (or batch, sale price, serial), so its MRP belongs to the stock.', 'Leave the MRP as it is.')
    ,('ITEM_QTY_PRICE_ABOVE_MRP', '', 'en', 'Price above MRP', 'A price or a slab price is above this unit''s MRP.', 'Lower the price, or type a higher MRP.')
    ,('ITEM_QTY_PRICE_BELOW_MIN', '', 'en', 'Slab price below minimum', 'A slab gives a price below this unit''s minimum price.', 'Change the slab, or lower the Min.')
    ,('ITEM_QTY_PRICE_ZERO_OR_LESS', '', 'en', 'Slab price is zero', 'A slab takes more off than the price, so the item would sell for nothing.', 'Lower the ₹ off or the %.')
    ,('ITEM_QTY_PRICE_BELOW_COST', '', 'en', 'Slab price below cost', 'A slab gives a price below this unit''s cost, so it sells at a loss.', 'Change the slab, or check it before you save.')
    ,('ITEM_QTY_PRICE_BY_USER_PRICES_KEPT', '', 'en', 'Prices not typed', 'The cost changed on a By User unit, but its prices are still the old ones.', 'Type the new prices, or save anyway to keep them.')
    ,('ITEM_QTY_PRICE_CHAIN_HQ_ONLY', '', 'en', 'Head office only', 'A slab for all branches can only be saved by head office.', 'Pick this branch for the slab, or ask head office.')
    ,('ITEM_QTY_PRICE_OVERLAP', '', 'en', 'Slabs overlap', 'Two slabs of this unit cover the same quantity on the same days.', 'End one slab where the next starts.')
    ,('ITEM_QTY_PRICE_QTY_RANGE_INVALID', '', 'en', 'Wrong quantity range', 'The To quantity must be above the From quantity.', 'Fix the range.')
    ,('ITEM_QTY_PRICE_VALUE_REQUIRED', '', 'en', 'Value missing', 'This slab has no % off, ₹ off or fixed price.', 'Type the value.')
    ,('ITEM_QTY_PRICE_DUPLICATE', '', 'en', 'Slab already there', 'The same slab is saved already.', 'Change the range or the dates.')
    ,('ITEM_QTY_PRICE_DATE_RANGE_INVALID', '', 'en', 'Wrong dates', 'The To date is before the From date.', 'Fix the dates.')
    ,('ITEM_QTY_PRICE_UNIT_NOT_OF_ITEM', '', 'en', 'Wrong unit', 'This unit is not one of the item''s units.', 'Pick the unit again.')
    ,('ITEM_QTY_PRICE_NOT_FOUND', '', 'en', 'Slab not found', 'This slab is not there now.', 'Load the item again.')
    ,('ITEM_QTY_PRICE_ALREADY_DELETED', '', 'en', 'Slab already removed', 'This slab was removed already.', 'Load the item again.')
    ,('ITEM_QTY_PRICE_REFERENCE_NOT_FOUND', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('ITEM_QTY_PRICE_DATE_INVALID', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('ITEM_QTY_PRICE_NOT_DELETED', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('ITEM_QTY_PRICE_ID_REQUIRED', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('ITEM_QTY_PRICE_PAYLOAD_NOT_ARRAY', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('STOCK_PRICE_ABOVE_MRP', '', 'en', 'Price above MRP', 'A price is above this stock''s MRP.', 'Lower the price.')
    ,('STOCK_PRICE_BELOW_MIN', '', 'en', 'Price below minimum', 'A price is below this unit''s minimum price.', 'Raise the price, or lower the Min.')
    ,('STOCK_PRICE_BELOW_COST', '', 'en', 'Price below cost', 'A price is below its cost, so it sells at a loss.', 'Raise the price, or check it before you save.')
    ,('STOCK_PRICE_UNIT_NOT_OF_ITEM', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('STOCK_PRICE_DUPLICATE_BUCKET', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('STOCK_PRICE_CHAIN_HQ_ONLY', '', 'en', 'Head office only', 'Prices for all branches can only be saved by head office.', 'Save for this branch.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-06.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-06.1';
