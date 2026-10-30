-- Seed: fixed.price_levels -- the selling price levels offered on entry screens (7 rows).
--
-- Not to be confused with inventory.item_price_levels (Item_Price_Levels.sql): this
-- is the fixed-schema list, and the inventory one is what sales documents carry a
-- foreign key to. Both are seeded because both are read.
--
-- price_lvl_is_admin marks a level only an administrator may pick; is_active = false
-- retires a level without deleting it, so old documents still resolve their label.
--
-- Ids are explicit so a level means the same thing in every environment, and the
-- setval keeps the sequence past them. Idempotent: ON CONFLICT (price_lvl_id) DO
-- NOTHING -- an existing level keeps its locally edited name and flags.
--
-- Column names are quoted where the table uses camelCase ("price_lvl_isDeleted").
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Price_Levels.sql
--      or: npm run seed:run -- --only=Price_Levels.sql

BEGIN;

INSERT INTO fixed.price_levels
    (price_lvl_id, price_lvl_name, price_lvl_short, price_lvl_is_active, price_lvl_is_admin, "price_lvl_isDeleted", "price_lvl_createdBy")
VALUES
     (1::integer, 'Whole Sale'::varchar, 'WS'::varchar, true::boolean, true::boolean, false::boolean, 'system'::varchar)
    ,(2, 'Retail'         , 'RET' , true , true , false, 'system')
    ,(3, 'Bulk Whole Sale', 'BWH' , false, true , false, 'system')
    ,(4, 'Hotel'          , 'HOT' , false, false, false, 'system')
    ,(5, 'MRP Sale'       , 'MRP' , false, true , false, 'system')
    ,(6, 'Min.Price Sale' , 'MIN' , false, true , false, 'system')
    ,(7, 'Cost Price Sale', 'COST', false, true , false, 'system')
ON CONFLICT (price_lvl_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.price_levels', 'price_lvl_id'),
    (SELECT GREATEST(COALESCE(MAX(price_lvl_id), 0), 1) FROM fixed.price_levels),
    true
);

COMMIT;
