-- Seed: inventory.item_price_levels -- the price levels sales documents point at (7 rows).
--
-- ipl_id is referenced ON DELETE RESTRICT by sales.customers, sales.sale_bill(_item),
-- sales.sale_order(_item), sales.sale_quotation(_item) and inventory.item_qty_price,
-- so the ids are written out: a customer on price level 2 has to mean the same level
-- in every environment, and item rate lookups key off it.
--
-- ipl_uname is the short code shown in grids; ipl_admin restricts the level to
-- administrators; ipl_status = false hides it from selection without breaking the
-- documents that already reference it.
--
-- ipl_created_by / ipl_modified_by are NOT NULL, so they are written as 'system'
-- rather than the exporting environment's user id.
--
-- Idempotent: ON CONFLICT (ipl_id) DO NOTHING.
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Item_Price_Levels.sql
--      or: npm run seed:run -- --only=Item_Price_Levels.sql

BEGIN;

INSERT INTO inventory.item_price_levels
    (ipl_id, ipl_name, ipl_uname, ipl_status, ipl_admin, ipl_is_deleted, ipl_created_by, ipl_modified_by)
VALUES
     (1::integer, 'WS Price'::text, 'WS'::text, true::boolean, false::boolean, false::boolean, 'system'::text, 'system'::text)
    ,(2, 'Retail Price'   , 'RET' , true , false, false, 'system', 'system')
    ,(3, 'Bulk Whole Sale', 'BWH' , false, true , false, 'system', 'system')
    ,(4, 'Hotel'          , 'HOT' , false, false, false, 'system', 'system')
    ,(5, 'MRP Sale'       , 'MRP' , true , true , false, 'system', 'system')
    ,(6, 'Min.Price Sale' , 'MIN' , true , true , false, 'system', 'system')
    ,(7, 'Cost Price Sale', 'COST', true , true , false, 'system', 'system')
ON CONFLICT (ipl_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('inventory.item_price_levels', 'ipl_id'),
    (SELECT GREATEST(COALESCE(MAX(ipl_id), 0), 1) FROM inventory.item_price_levels),
    true
);

COMMIT;
