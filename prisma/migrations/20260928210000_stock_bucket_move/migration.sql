-- ═══════════════════════════════════════════════════════════════════════════
--  notes (60): "Move to damaged" — the bucket move (adjustments plan D-A3) and
--  the screen's list grid, item grid and menu (D-A5). 2026-09-28.
--
--  1. stock_voucher_item.svi_to_bucket   a "Move stock" line names where the
--                                        SAME lot lands; the engine writes a
--                                        BUCKET_OUT / BUCKET_IN pair from it
--  2. menu 264  Stock Adjustment         ONE menu for the five kinds (user,
--                                        2026-09-28: per-kind rights later)
--  3. grid 122  TXN MAIN LIST - STOCK ADJUSTMENT   the list over stock_voucher
--  4. ui_table 41  STOCK ADJUSTMENT - ITEM         the entry screen's line grid
--
--  Nothing here touches ck_sml_txn_type or ck_sml_bucket: BUCKET_OUT,
--  BUCKET_IN and the DAMAGED bucket have been legal ledger values since
--  20260907090000. Nothing in the service used them until now.
--
--  Ids are PINNED (the client opens a menu, a grid and a layout by id), guarded
--  by name, and the sequences are moved past them. Re-runnable. The reasons the
--  move cites (MOVE_DAMAGED / MOVE_SALEABLE) are shared seed rows in
--  prisma/seed/Stock_Reason_Master.sql, not here: migrations run before seeds,
--  and the seed's NOT EXISTS guard adds the two codes on the next deploy.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. the line's destination bucket ───────────────────────────────────────
-- ONE line per move: svi_bucket is where the stock is, svi_to_bucket where it
-- goes, the quantity a magnitude as everywhere else. Only an ADJUSTMENT row
-- carries it (the service refuses it on every other kind) and a document is
-- all moves or none. NULL on every other line. On the partitioned parent, so
-- every year has it.
ALTER TABLE stock.stock_voucher_item
    ADD COLUMN IF NOT EXISTS svi_to_bucket varchar(20);

ALTER TABLE stock.stock_voucher_item DROP CONSTRAINT IF EXISTS ck_svi_to_bucket;
ALTER TABLE stock.stock_voucher_item
    ADD CONSTRAINT ck_svi_to_bucket CHECK (
        svi_to_bucket IS NULL
        OR (svi_to_bucket::text = ANY (ARRAY['SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text,
                                             'EXPIRED'::text, 'SAMPLE'::text])
            AND svi_to_bucket <> svi_bucket));

COMMENT ON COLUMN stock.stock_voucher_item.svi_to_bucket IS
    'A "Move stock" line (ADJUSTMENT): the bucket the same lot lands in. The engine writes BUCKET_OUT from svi_bucket and BUCKET_IN into this one, same godown, same quantity, same cost. NULL on every other line.';

-- ── 2. menu 264 · Stock Adjustment under &4 Stock ──────────────────────────
-- Position 6.00: after Opening Stock (4) and Physical Stock Update (5), before
-- Stock Transfer (Third Party) (7). Verbs: the six screen verbs plus POST and
-- CANCEL. No AMEND — a posted adjustment is corrected by cancel + re-enter —
-- and no OVERRIDE — the negative-stock policy is BLOCK by decision D-A1 and
-- nobody may override it. Same guarded pattern as 263 (20260928190000);
-- Menu_Master.sql carries the same row for a fresh database.
DO $$
DECLARE
  taken text;
BEGIN
  SELECT menu_name INTO taken FROM fixed.menu_master WHERE menu_id = 264;
  IF taken IS NOT NULL AND taken <> 'Stock Adjustment' THEN
    RAISE EXCEPTION '20260928210000_stock_bucket_move: menu id 264 is already "%" — the client is registered on 264; pick another id and tell the client', taken;
  END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator, menu_verbs)
SELECT 264, 4, 'Stock Adjustment', true, 6.00, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}'::text[]
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = 4)                    -- no tree yet = fresh database
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_parent = 4 AND m.menu_name = 'Stock Adjustment')
ON CONFLICT (menu_id) DO NOTHING;

-- A row that came in earlier under the default verbs (a seed) gets the eight.
UPDATE fixed.menu_master
   SET menu_verbs       = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}',
       menu_modified_on = now()
 WHERE menu_id = 264
   AND menu_name = 'Stock Adjustment'
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- ── 3. grid 122 · the list ─────────────────────────────────────────────────
-- The five kinds share svh_voucher_type IN (the four stored types); the KIND
-- column tells a re-lot and a move apart from a plain adjustment by their
-- lines, exactly as StockAdjustmentService.kindOf does. Grid params (bare
-- tokens, memory configured-grid-param-convention): icompany_id, ibranch_id,
-- iacc_year, ifrom_date, ito_date, ikind, istatus. SEND EVERY TOKEN — dates,
-- the kind and the status as '' for "no bound".
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT 122,
       'TXN MAIN LIST - STOCK ADJUSTMENT',
       'Stock adjustments, issues, damage and expiry write-offs, re-lots and bucket moves for a company / branch / year (menu 264). ikind narrows to one kind code (ADJUSTMENT, RELOT, BUCKET_MOVE, ISSUE, DAMAGE, EXPIRY_WRITEOFF); istatus to one status; '''' = all.',
       'Desktop',
       'Date', 'Descending',
       $grid$SELECT h.svh_id,
       h.svh_company_id,
       h.svh_branch_id,
       h.svh_acc_year,
       h.svh_voucher_type,
       k.kind_code,
       CASE k.kind_code
         WHEN 'ADJUSTMENT'      THEN 'Stock adjustment'
         WHEN 'RELOT'           THEN 'Re-lot'
         WHEN 'BUCKET_MOVE'     THEN 'Move stock'
         WHEN 'ISSUE'           THEN 'Stock issue'
         WHEN 'DAMAGE'          THEN 'Damage write-off'
         WHEN 'EXPIRY_WRITEOFF' THEN 'Expiry write-off'
         ELSE k.kind_code END          AS kind_name,
       h.svh_refno,
       h.svh_usr_refno,
       h.svh_doc_date,
       g.gdl_name                      AS godown_name,
       r.srm_name                      AS reason_name,
       h.svh_line_count,
       h.svh_total_qty,
       h.svh_total_value,
       h.svh_status,
       h.svh_remarks,
       h.svh_created_by,
       h.svh_created_on
  FROM stock.stock_voucher h
  CROSS JOIN LATERAL (
    SELECT CASE
             WHEN EXISTS (SELECT 1
                            FROM stock.stock_voucher_item i
                           WHERE i.svi_voucher_id = h.svh_id
                             AND i.svi_acc_year   = h.svh_acc_year
                             AND i.svi_is_deleted = false
                             AND i.svi_to_bucket IS NOT NULL)                       THEN 'BUCKET_MOVE'
             WHEN h.svh_voucher_type = 'ADJUSTMENT'
              AND EXISTS (SELECT 1
                            FROM stock.stock_voucher_item i
                            JOIN stock.stock_reason_master rm
                              ON rm.srm_id = COALESCE(i.svi_reason_id, h.svh_reason_id)
                           WHERE i.svi_voucher_id = h.svh_id
                             AND i.svi_acc_year   = h.svh_acc_year
                             AND i.svi_is_deleted = false
                             AND rm.srm_code IN ('RELOT_OUT', 'RELOT_IN'))           THEN 'RELOT'
             ELSE h.svh_voucher_type END AS kind_code
  ) k
  LEFT JOIN inventory.godown_locations g ON g.gdl_id = COALESCE(h.svh_from_godown_id, h.svh_to_godown_id)
  LEFT JOIN stock.stock_reason_master  r ON r.srm_id = h.svh_reason_id
 WHERE h.svh_company_id = icompany_id::uuid
   AND h.svh_branch_id  = ibranch_id::uuid
   AND h.svh_acc_year   = iacc_year::bpchar
   AND h.svh_voucher_type IN ('ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF')
   AND h.svh_is_deleted = false
   AND (NULLIF(ikind,   '') IS NULL OR k.kind_code  = ikind)
   AND (NULLIF(istatus, '') IS NULL OR h.svh_status = istatus)
   AND (NULLIF(ifrom_date, '') IS NULL OR h.svh_doc_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.svh_doc_date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.svh_doc_date DESC, h.svh_slno DESC NULLS LAST, h.svh_created_on DESC$grid$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'TXN MAIN LIST - STOCK ADJUSTMENT')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 122);

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, v.total, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        ( 1, '#',           8.00, 'Left',   false, false, false, 'Text',     'svh_id'),
        ( 2, 'Company',     8.00, 'Left',   false, false, false, 'Text',     'svh_company_id'),
        ( 3, 'Branch',      8.00, 'Left',   false, false, false, 'Text',     'svh_branch_id'),
        ( 4, 'Year',        5.00, 'Center', false, false, false, 'Text',     'svh_acc_year'),
        ( 5, 'Type',        8.00, 'Left',   false, false, false, 'Text',     'svh_voucher_type'),
        ( 6, 'Kind Code',   8.00, 'Left',   false, false, false, 'Text',     'kind_code'),
        ( 7, 'Kind',       11.00, 'Left',   true,  true,  false, 'Text',     'kind_name'),
        ( 8, 'Ref No',     14.00, 'Left',   true,  true,  false, 'Text',     'svh_refno'),
        ( 9, 'Their Ref',   9.00, 'Left',   true,  true,  false, 'Text',     'svh_usr_refno'),
        (10, 'Date',        8.00, 'Center', true,  true,  false, 'Date',     'svh_doc_date'),
        (11, 'Godown',     12.00, 'Left',   true,  true,  false, 'Text',     'godown_name'),
        (12, 'Reason',     12.00, 'Left',   true,  true,  false, 'Text',     'reason_name'),
        (13, 'Lines',       5.00, 'Right',  true,  false, false, 'Number',   'svh_line_count'),
        (14, 'Qty',         8.00, 'Right',  true,  false, true,  'Number',   'svh_total_qty'),
        (15, 'Value',      10.00, 'Right',  true,  false, true,  'Currency', 'svh_total_value'),
        (16, 'Status',      8.00, 'Center', true,  true,  false, 'Text',     'svh_status'),
        (17, 'Remarks',    16.00, 'Left',   true,  false, false, 'Text',     'svh_remarks'),
        (18, 'Created By',  9.00, 'Left',   false, false, false, 'Text',     'svh_created_by'),
        (19, 'Created On',  9.00, 'Center', false, false, false, 'DateTime', 'svh_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'TXN MAIN LIST - STOCK ADJUSTMENT'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

-- ── 4. ui_table 41 · the entry screen's line grid ──────────────────────────
-- One layout for the five kinds: "To bucket" is filled only on a Move stock
-- line, "Available" is what /pick-stock said the holding holds. Same pattern
-- as 39 / 40 (20260926100000).
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
SELECT 41, 'STOCK ADJUSTMENT - ITEM', true, 'Desktop', true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_name = 'STOCK ADJUSTMENT - ITEM')
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = 41);

INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_no, ui_tbl_clm_table_id, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_position, ui_tbl_clm_column_necessity,
        ui_tbl_clm_created_by)
SELECT v.no, t.ui_tbl_id, v.name, v.width, v.visible, v.no, v.necessity, 'system'
  FROM fixed.ui_tables t
 CROSS JOIN (VALUES
        ( 0, '#',            3.0, true,  false),
        ( 1, 'Barcode',      8.0, true,  false),
        ( 2, 'Code',         7.0, false, false),
        ( 3, 'Item name',   20.0, true,  true),
        ( 4, 'Batch no',     8.0, true,  false),
        ( 5, 'Mfg date',     7.0, false, false),
        ( 6, 'Expiry date',  7.0, true,  false),
        ( 7, 'MRP',          6.0, true,  false),
        ( 8, 'Supplier',    10.0, false, false),
        ( 9, 'Bucket',       7.0, true,  false),
        (10, 'To bucket',    7.0, true,  false),
        (11, 'Available',    7.0, true,  false),
        (12, 'Qty',          7.0, true,  true),
        (13, 'Uom',          5.0, true,  false),
        (14, 'Base qty',     7.0, false, false),
        (15, 'Cost',         8.0, true,  false),
        (16, 'Value',        9.0, true,  false),
        (17, 'Reason',      12.0, true,  true),
        (18, 'Remarks',     14.0, true,  false),
        (19, 'LotId',        0.0, false, false),
        (20, 'Direction',    0.0, false, false)
       ) AS v(no, name, width, visible, necessity)
 WHERE t.ui_tbl_name = 'STOCK ADJUSTMENT - ITEM'
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns c WHERE c.ui_tbl_clm_table_id = t.ui_tbl_id);

-- ── 5. keep the sequences ahead of the pinned ids ──────────────────────────
DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('fixed.menu_master', 'menu_id'),
                 (SELECT GREATEST(COALESCE(MAX(menu_id), 0), 1) FROM fixed.menu_master), true);
  PERFORM setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
                 (SELECT GREATEST(COALESCE(MAX(grid_id), 0), 1) FROM fixed.grid_details), true);
  PERFORM setval(pg_get_serial_sequence('fixed.ui_tables', 'ui_tbl_id'),
                 (SELECT GREATEST(COALESCE(MAX(ui_tbl_id), 0), 1) FROM fixed.ui_tables), true);
END $$;

-- ── After running ──────────────────────────────────────────────────────────
-- SELECT menu_id, menu_name, menu_verbs FROM fixed.menu_master WHERE menu_id = 264;
-- SELECT grid_id, grid_name FROM fixed.grid_details WHERE grid_id = 122;
-- SELECT ui_tbl_id, ui_tbl_name FROM fixed.ui_tables WHERE ui_tbl_id = 41;
