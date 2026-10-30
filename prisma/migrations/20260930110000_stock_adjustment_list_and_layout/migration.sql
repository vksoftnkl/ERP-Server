-- ═══════════════════════════════════════════════════════════════════════════
--  Stock Adjustment (menu 264): the list leaves out sales shadows; the
--  layouts the Qt screen registered. Notes 65, 2026-09-30.
--
--  1. grid 122  TXN MAIN LIST - STOCK ADJUSTMENT
--     `svh_voucher_type IN ('ADJUSTMENT','ISSUE','DAMAGE','EXPIRY_WRITEOFF')`
--     also matched every sale bill, challan and return: each posts its stock
--     through a SHADOW ISSUE / RECEIPT voucher linked back to it
--     (svh_link_src_module = 'SALES'), and on a live box those were most of
--     the list. The list now keeps the stock module's own documents only: no
--     link, or a STOCK one. StockAdjustmentService.kindOf refuses the same rows.
--     Done as text surgery on the stored SQL, like 20260921230000: the rest of
--     the query is left as it stands.
--
--  2. grid 122 column widths, and 3. ui_table 41 STOCK ADJUSTMENT - ITEM, as
--     the screen registered them on 192.168.0.106 through the API
--     (PUT /grid-details/column-width, the ui-table save): visible widths that
--     sum to ~100, the line grid renamed, "Dir" shown after Available, Enter
--     stopping on Item / To / Qty / Reason / Remarks, and ten hidden id columns
--     (21–30) the screen reads its line back from. 20260928210000 ships the
--     first cut; without this a fresh database gives the screen a line grid
--     with none of its hidden columns. On the box itself every statement
--     writes what is already there.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. grid 122 · no shadow vouchers ───────────────────────────────────────
UPDATE fixed.grid_details
   SET grid_sql = replace(
         grid_sql,
         $a$AND h.svh_voucher_type IN ('ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF')$a$,
         $b$AND h.svh_voucher_type IN ('ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF')
   AND COALESCE(h.svh_link_src_module, 'STOCK') = 'STOCK'$b$),
       grid_modified_on = now(),
       grid_modified_by = 'MIGRATION'
 WHERE grid_id = 122
   AND grid_sql LIKE $a$%AND h.svh_voucher_type IN ('ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF')%$a$
   AND grid_sql NOT LIKE '%svh_link_src_module%';

-- ── 2. grid 122 · the widths the screen set (visible ones sum to 100) ──────
UPDATE fixed.grid_columns c
   SET grid_column_width       = v.width,
       grid_column_modified_on = now(),
       grid_column_modified_by = 'MIGRATION'
  FROM (VALUES
        ( 7, 10.00),
        ( 8, 13.00),
        ( 9,  8.00),
        (11, 11.00),
        (12, 11.00),
        (15,  9.00),
        (17,  9.00)
       ) AS v(col_no, width)
 WHERE c.grid_id = 122
   AND c.grid_column_number = v.col_no
   AND c.grid_column_is_deleted = false
   AND c.grid_column_width IS DISTINCT FROM v.width;

-- ── 3. ui_table 41 · the line grid as the screen registered it ─────────────
-- (no, name, width, visible, position, necessity, focus). 0–20 exist since
-- 20260928210000 and are updated in place; 21–30 are added where missing.
CREATE TEMP TABLE _ui41 (no bigint, name text, width numeric, visible boolean,
                         position int, necessity boolean, focus boolean);
INSERT INTO _ui41 VALUES
        ( 0, '#',            3.8, true,   0, false, false),
        ( 1, 'Barcode',      5.5, true,   1, false, false),
        ( 2, 'Code',         7.0, false,  2, false, false),
        ( 3, 'Item',        15.0, true,   3, true,  true),
        ( 4, 'Batch / lot',  7.0, true,   4, false, false),
        ( 5, 'Mfg',          6.0, false,  5, false, false),
        ( 6, 'Expiry',       6.0, true,   6, false, false),
        ( 7, 'MRP',          5.0, true,   7, false, false),
        ( 8, 'Supplier',     7.0, false,  8, false, false),
        ( 9, 'Bucket',       6.5, true,   9, false, false),
        (10, 'To',           6.0, true,  10, false, true),
        (11, 'Available',    5.5, true,  11, false, false),
        (12, 'Qty',          5.5, true,  13, true,  true),
        (13, 'Unit',         4.0, true,  14, false, false),
        (14, 'Base qty',     6.0, false, 15, false, false),
        (15, 'Cost',         6.5, true,  16, false, false),
        (16, 'Value',        7.0, true,  17, false, false),
        (17, 'Reason',      10.0, true,  18, true,  true),
        (18, 'Remarks',      8.0, true,  19, false, true),
        (19, 'LotId',        0.0, false, 20, false, false),
        (20, 'Dir',          4.5, true,  12, false, false),
        (21, 'ItemId',       0.0, false, 21, false, false),
        (22, 'UomId',        0.0, false, 22, false, false),
        (23, 'BaseUomId',    0.0, false, 23, false, false),
        (24, 'Factor',       0.0, false, 24, false, false),
        (25, 'ReasonId',     0.0, false, 25, false, false),
        (26, 'SupplierId',   0.0, false, 26, false, false),
        (27, 'Signature',    0.0, false, 27, false, false),
        (28, 'Sale price',   0.0, false, 28, false, false),
        (29, 'Serial',       0.0, false, 29, false, false),
        (30, 'Id',           0.0, false, 30, false, false);

UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_name              = v.name,
       ui_tbl_clm_column_width      = v.width,
       ui_tbl_clm_column_visibility = v.visible,
       ui_tbl_clm_column_position   = v.position,
       ui_tbl_clm_column_necessity  = v.necessity,
       ui_tbl_clm_column_focus      = v.focus,
       ui_tbl_clm_modified_on       = now(),
       ui_tbl_clm_modified_by       = 'MIGRATION'
  FROM _ui41 v, fixed.ui_tables t
 WHERE t.ui_tbl_name = 'STOCK ADJUSTMENT - ITEM'
   AND c.ui_tbl_clm_table_id = t.ui_tbl_id
   AND c.ui_tbl_clm_no = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND (c.ui_tbl_clm_name, c.ui_tbl_clm_column_width, c.ui_tbl_clm_column_visibility,
        c.ui_tbl_clm_column_position, c.ui_tbl_clm_column_necessity, c.ui_tbl_clm_column_focus)
       IS DISTINCT FROM (v.name, v.width, v.visible, v.position, v.necessity, v.focus);

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_no, ui_tbl_clm_table_id, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_position, ui_tbl_clm_column_necessity,
        ui_tbl_clm_column_focus, ui_tbl_clm_created_by)
SELECT v.no, t.ui_tbl_id, v.name, v.width, v.visible, v.position, v.necessity, v.focus, 'MIGRATION'
  FROM _ui41 v
  JOIN fixed.ui_tables t ON t.ui_tbl_name = 'STOCK ADJUSTMENT - ITEM'
 WHERE NOT EXISTS (SELECT 1
                     FROM fixed.ui_table_columns c
                    WHERE c.ui_tbl_clm_table_id = t.ui_tbl_id
                      AND c.ui_tbl_clm_no = v.no
                      AND c.ui_tbl_clm_is_deleted = false);

DROP TABLE _ui41;

-- ── verify ─────────────────────────────────────────────────────────────────
DO $check$
DECLARE n_shadow int; n_cols int;
BEGIN
    SELECT count(*) INTO n_shadow
      FROM fixed.grid_details
     WHERE grid_id = 122 AND grid_sql NOT LIKE '%svh_link_src_module%';
    IF n_shadow > 0 THEN
        RAISE EXCEPTION 'grid 122 still lists shadow vouchers: its voucher-type line was not found to extend';
    END IF;
    SELECT count(*) INTO n_cols
      FROM fixed.ui_table_columns c JOIN fixed.ui_tables t ON t.ui_tbl_id = c.ui_tbl_clm_table_id
     WHERE t.ui_tbl_name = 'STOCK ADJUSTMENT - ITEM' AND c.ui_tbl_clm_is_deleted = false;
    IF n_cols NOT IN (0, 31) THEN
        RAISE WARNING 'ui_table 41 has % live columns, expected 31 — columns added by hand are left alone', n_cols;
    END IF;
END
$check$;
