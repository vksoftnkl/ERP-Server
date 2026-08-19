-- Seed: fixed.ui_tables -- the registry of entry-screen item grids (25 rows).
--
-- Every "Quotation-item"/"Sale bill item" style grid the entry screens render is a
-- row here, and fixed.ui_table_columns hangs off it (fk_ui_tables). The client asks
-- for a grid by ui_tbl_id -- quotation.constants.ts pins ITEM_GRID_UI_TABLE_ID = 23
-- -- so the ids are written out rather than left to the sequence, and the setval at
-- the bottom keeps the sequence ahead of them.
--
-- ui_tbl_created_by is written as 'system' instead of the exporting environment's
-- user uuid, which would mean nothing in another database.
-- Regenerate with: npm run seed:export:ui-config
-- Run: psql "$DATABASE_URL" -f prisma/seed/Ui_Tables.sql
--      or: npm run seed:run -- --only=Ui_Tables.sql

BEGIN;

INSERT INTO fixed.ui_tables
    (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES
     (1::bigint, 'Item Master Grid'::text, false::boolean, 'web'::text, true::boolean, false::boolean, 'system'::varchar)
    ,(2 , 'Item reorder'                 , true , 'web'    , true , false, 'system')
    ,(3 , 'Item price list'              , false, 'web'    , true , false, 'system')
    ,(4 , 'Item Ean code'                , true , 'web'    , true , false, 'system')
    ,(5 , 'opening stock'                , true , 'web'    , true , false, 'system')
    ,(6 , 'physicalstock'                , false, 'web'    , true , false, 'system')
    ,(7 , 'Grid Master - Desktop'        , false, 'Desktop', true , false, 'system')
    ,(8 , 'Grid master'                  , true , 'web'    , false, true , 'system')
    ,(9 , 'Ui table master'              , true , 'web'    , false, true , 'system')
    ,(10, 'Nex Table Entry'              , false, 'desktop', true , false, 'system')
    ,(11, 'zsf'                          , true , NULL     , false, true , 'system')
    ,(12, 'Nex Combo Master Entry Table' , true , NULL     , true , false, 'system')
    ,(13, 'ACC LEDGER - BANK GRID'       , true , NULL     , true , false, 'system')
    ,(14, 'ITEM MASTER - UNIT CONVERSION', true , NULL     , true , false, 'system')
    ,(15, 'ITEM MASTER - ALT BARCODES'   , true , NULL     , true , false, 'system')
    ,(16, 'ITEM MASTER - REORDER'        , true , NULL     , true , false, 'system')
    ,(17, 'ITEM MASTER - PRICE'          , true , NULL     , true , false, 'system')
    ,(18, 'Quotation Item Table'         , true , 'web'    , true , false, 'system')
    ,(19, 'Item Qty wise Price'          , true , NULL     , true , false, 'system')
    ,(20, 'Item Qty Wise Price web'      , false, 'web'    , true , false, 'system')
    ,(21, 'CHARGES'                      , false, NULL     , true , false, 'system')
    ,(22, 'Sale Bill  Item Table'        , true , 'Desktop', true , false, 'system')
    ,(23, 'Quotation-item'               , true , 'web'    , true , false, 'system')
    ,(24, 'Sale Order Item Table'        , true , NULL     , true , false, 'system')
    ,(25, 'Adjustment Table'             , true , NULL     , true , false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.ui_tables', 'ui_tbl_id'),
    (SELECT GREATEST(COALESCE(MAX(ui_tbl_id), 0), 1) FROM fixed.ui_tables),
    true
);

COMMIT;
