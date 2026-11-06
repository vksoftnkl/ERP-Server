-- ═══════════════════════════════════════════════════════════════════════════
--  Qty-wise Prices (menu 244): layout fixes for the Qt screen       2026-11-06
--  Plan: Shared/Prathap/inventory/plan-qty-price-card-rate-one-form.md, with
--  addendum-1 and addendum-2. Follows 20261106140000_qty_price_card_rate_form
--  and 20261106140100_qty_price_bills. Seed data only: no table, column,
--  CHECK, function or trigger. One new id: dropdown 75 (section 5).
--
--  1 · ui_table 19 "ITEM QTY WISE PRICE", column 22 "Value" is live again.
--      Qt's IqpCols::Value is 22, but the only row for 22 (id 417, an old
--      duplicate "item_unit_id") is soft deleted, so the layout had nothing to
--      place there and the screen moved Value back after Mode by hand. Row 417
--      is brought back under its own free number, as notes 137
--      (20261021110000) allows for a soft-deleted row: renamed "Value",
--      visible, focus, position 22. Positions are read as a rank, and 9-21 are
--      hidden, so Value sits right after Mode (8) on screen. Position 9 would
--      not work: Disc % already holds 9 and the first row of a position wins.
--      Reviving 417 keeps the ids as they are, so no sequence moves.
--
--  2 · ui_table 19: hide the columns the screen does not show. The slab grid
--      shows Uom · From · To · Mode · Value (5-8, 22) and the four read-only
--      columns of step 1 (23-26); the rest is edited in the panel below it
--      (IqpCols::isGridColumn). 0 and 16-21 are hidden already; 1-4 (Company,
--      Branch, Customer, Price Level) and 9-15 (Disc %, Disc Rs, Price, From
--      Date, To Date, Active, Incl Tax) are hidden here, with focus off, as
--      every hidden column of the newer tables has it. Their widths are kept
--      (a hidden column takes no room). React's 244 page takes only the Uom /
--      From Qty / To Qty headings from this table, by name and whatever the
--      visibility, so it does not change.
--
--  3 · ui_table 19: the nine visible widths add up to 100.00. 23-26 keep the
--      widths step 1 gave them (the mockup's slab grid, 1012 px). Uom, From,
--      To, Mode and Value share the remaining 42.89 in the mockup's
--      proportions (60 : 70 : 70 : 118 : 86 px): 6.37 · 7.43 · 7.43 · 12.53 ·
--      9.13. Value's width is set in section 1.
--
--  4 · ui_table 68 "QTY-WISE PRICES - CARD RATE": Unit 2.98 -> 5.00 and
--      Stock 2.52 -> 4.00 clipped "PCS · MRP 99" and "3,320"; Stock avg
--      4.01 -> 5.00 cut its "not written" line. The 4.49 comes from Changed
--      8.37 -> 3.88, the grid's last section: it stretches into the width of
--      any inactive level (Hotel is off on dev, so it shows at 18.10 %) and
--      its tooltip holds the full text. The 21 widths still add up to 100.00.
--
--  5 · dropdown 75 "QTY PRICE - SELLING LEVELS", for menu 244's Price level
--      picker only (the user, 2026-11-06: option A). Plan rule C6 / D19: a
--      slab's level is blank (all) or an ACTIVE selling level 1-4 of
--      fixed.price_levels. Dropdown 34 "PRICE LEVELS" is NOT changed: the
--      master-lookup priceLevels module runs it for every sales voucher, the
--      loyalty and promotion schemes and the customer master in Qt and React,
--      and those still list levels 5-7. 75 returns the same keys as 34 (ipl_id,
--      ipl_name) with the same two columns, so the Qt picker reads it
--      unchanged; the screen switches kPriceLevelDropdownId from 34 to 75. Its
--      name matches no master-lookup module (checked against
--      configured-dropdown.lookup.ts). Sorted by ipl_id in the SQL; the sort
--      column says the same. Id 75 is pinned (Qt asks for it by id): taken by
--      another dropdown, or the name already under another id, the migration
--      stops. The column uuids are pinned too, as for dropdown 73, so the seed
--      rows are the same rows. The insert names id 75 itself, so the sequence
--      is moved up to the highest id afterwards (74 -> 75 on dev), or the next
--      dropdown made in the UI would be handed 75.
--
--  Every statement is guarded: a row changes only while it still holds the
--  value this repo shipped, and the two width sets change only when all their
--  rows do, so the totals stay whole. A site that has re-laid a table keeps
--  its own layout. Re-runnable (a second run changes nothing). The only
--  setval is the dropdown one in section 5; no sync calls, the tables' own
--  sync triggers mark the changed rows. prisma/seed/Ui_Table_Columns.sql,
--  Dropdown_Details.sql and Dropdown_Columns.sql carry the same values.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ui_table 19: column 22 "Value" live again (id 417) ─────────────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_name              = 'Value',
       ui_tbl_clm_column_width      = 9.13,
       ui_tbl_clm_column_visibility = true,
       ui_tbl_clm_column_focus      = true,
       ui_tbl_clm_column_position   = 22,
       ui_tbl_clm_column_necessity  = false,
       ui_tbl_clm_is_active         = true,
       ui_tbl_clm_is_deleted        = false,
       ui_tbl_clm_modified_on       = now(),
       ui_tbl_clm_modified_by       = 'system'
 WHERE c.ui_tbl_clm_id = 417
   AND c.ui_tbl_clm_table_id = 19
   AND c.ui_tbl_clm_no = 22
   AND c.ui_tbl_clm_name = 'item_unit_id'
   AND c.ui_tbl_clm_is_deleted = true
   AND EXISTS (SELECT 1 FROM fixed.ui_tables t
                WHERE t.ui_tbl_id = 19 AND t.ui_tbl_name = 'ITEM QTY WISE PRICE')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns l
                    WHERE l.ui_tbl_clm_table_id = 19
                      AND l.ui_tbl_clm_no = 22
                      AND l.ui_tbl_clm_is_deleted = false);


-- ── 2 · ui_table 19: hide what the slab grid does not show ─────────────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_visibility = false,
       ui_tbl_clm_column_focus      = false,
       ui_tbl_clm_modified_on       = now(),
       ui_tbl_clm_modified_by       = 'system'
  FROM (VALUES
        (396::bigint, 1::bigint, 'Company'::text, true::boolean),
        (397, 2, 'Branch', true),
        (398, 3, 'Customer', true),
        (399, 4, 'Price Level', true),
        (404, 9, 'Disc %', true),
        (405, 10, 'Disc Rs', true),
        (406, 11, 'Price', true),
        (407, 12, 'From Date', true),
        (408, 13, 'To Date', true),
        (409, 14, 'Active', true),
        (410, 15, 'Incl Tax', false)
       ) v(id, no, name, focus)
 WHERE c.ui_tbl_clm_id = v.id
   AND c.ui_tbl_clm_table_id = 19
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_name = v.name
   AND c.ui_tbl_clm_is_deleted = false
   AND c.ui_tbl_clm_column_visibility = true
   AND c.ui_tbl_clm_column_focus = v.focus;


-- ── 3 · ui_table 19: the visible widths add up to 100.00 ───────────────────
WITH v(id, no, name, old_w, new_w) AS (
        VALUES
        (400::bigint, 5::bigint, 'Uom'::text, 4.85::numeric, 6.37::numeric),
        (401, 6, 'From Qty', 6.54, 7.43),
        (402, 7, 'To Qty', 5.83, 7.43),
        (403, 8, 'Mode', 5.45, 12.53)
     ),
     shipped AS (
        SELECT count(*) = 4 AS all_rows
          FROM fixed.ui_table_columns c
          JOIN v ON v.id = c.ui_tbl_clm_id
         WHERE c.ui_tbl_clm_table_id = 19
           AND c.ui_tbl_clm_no = v.no
           AND c.ui_tbl_clm_name = v.name
           AND c.ui_tbl_clm_is_deleted = false
           AND c.ui_tbl_clm_column_width = v.old_w
     )
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = v.new_w,
       ui_tbl_clm_modified_on  = now(),
       ui_tbl_clm_modified_by  = 'system'
  FROM v, shipped
 WHERE shipped.all_rows
   AND c.ui_tbl_clm_id = v.id
   AND c.ui_tbl_clm_table_id = 19
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_column_width = v.old_w;


-- ── 4 · ui_table 68: Unit, Stock and Stock avg wider, from Changed ────────
WITH v(id, no, name, old_w, new_w) AS (
        VALUES
        (2371::bigint, 0::bigint, 'Unit'::text, 2.98::numeric, 5.00::numeric),
        (2374, 3, 'Stock', 2.52, 4.00),
        (2375, 4, 'Stock avg', 4.01, 5.00),
        (2391, 20, 'Changed', 8.37, 3.88)
     ),
     shipped AS (
        SELECT count(*) = 4 AS all_rows
          FROM fixed.ui_table_columns c
          JOIN v ON v.id = c.ui_tbl_clm_id
         WHERE c.ui_tbl_clm_table_id = 68
           AND c.ui_tbl_clm_no = v.no
           AND c.ui_tbl_clm_name = v.name
           AND c.ui_tbl_clm_is_deleted = false
           AND c.ui_tbl_clm_column_width = v.old_w
     )
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_column_width = v.new_w,
       ui_tbl_clm_modified_on  = now(),
       ui_tbl_clm_modified_by  = 'system'
  FROM v, shipped
 WHERE shipped.all_rows
   AND c.ui_tbl_clm_id = v.id
   AND c.ui_tbl_clm_table_id = 68
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_column_width = v.old_w;


-- ── 5 · dropdown 75 "QTY PRICE - SELLING LEVELS" (menu 244 only) ──────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('dropdown %s (%s)', d.dropdown_id, d.dropdown_name), ', ') INTO v_clash
      FROM fixed.dropdown_details d
     WHERE (d.dropdown_id = 75 AND d.dropdown_name IS DISTINCT FROM 'QTY PRICE - SELLING LEVELS')
        OR (d.dropdown_id <> 75 AND d.dropdown_name = 'QTY PRICE - SELLING LEVELS');
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Qty-wise Prices selling levels: dropdown id 75 is not free: %. Pick a free id here, in Dropdown_Details.sql / Dropdown_Columns.sql and in the Qt screen (kPriceLevelDropdownId).', v_clash;
    END IF;
END $$;

INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
VALUES (75, 'QTY PRICE - SELLING LEVELS',
        'Qty-wise Prices (menu 244) Price level picker: the active selling levels 1-4 of fixed.price_levels (plan C6 / D19). Same keys as 34 PRICE LEVELS (ipl_id, ipl_name); 34 stays the list every other screen reads.',
$d$SELECT price_lvl_id AS ipl_id,
       price_lvl_name AS ipl_name
  FROM fixed.price_levels
 WHERE price_lvl_is_active = true
   AND "price_lvl_isDeleted" = false
   AND price_lvl_id BETWEEN 1 AND 4
 ORDER BY price_lvl_id$d$,
        'asc', 'ipl_id', 'ipl_name', 10, false, 0, 'Desktop', 'system')
ON CONFLICT (dropdown_id) DO NOTHING;

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no,
        dropdown_columns_name, dropdown_columns_sql_name, dropdown_columns_alias,
        dropdown_columns_data_type, dropdown_columns_width, dropdown_columns_allignment,
        dropdown_columns_visiblity, dropdown_columns_filter, dropdown_columns_created_by)
SELECT v.id, 75, v.no, v.name, v.field, NULL, 'Text', v.width, 'Left', v.visible, v.filter, 'system'
  FROM (VALUES
        ('01a1b2c0-7500-7000-8000-000000000750'::uuid, 0::integer, '#'::varchar, 'ipl_id'::text, 10.00::numeric, false::boolean, false::boolean),
        ('01a1b2c0-7500-7000-8000-000000000751', 1, 'Level Name', 'ipl_name', 100.00, true, true)
       ) v(id, no, name, field, width, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d
                WHERE d.dropdown_id = 75 AND d.dropdown_name = 'QTY PRICE - SELLING LEVELS')
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = 75)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

SELECT setval('fixed.dropdown_details_dropdown_id_seq',
              GREATEST((SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq),
                       (SELECT COALESCE(MAX(dropdown_id), 1) FROM fixed.dropdown_details)), true);
