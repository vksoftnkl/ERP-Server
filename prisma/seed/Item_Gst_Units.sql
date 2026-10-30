-- Seed: inventory.item_gst_units -- the GST UQC (Unit Quantity Code) list (44 rows).
--
-- The codes GST returns expect on invoices and returns: BAG, KGS, NOS, PCS, ... Every
-- unit in inventory.item_unit_master points at one through unit_code, which is a
-- foreign key to item_gst_unit_code -- the CODE, not the id.
--
-- That is why no id is written here: item_gst_unit_id is a plain sequence value that
-- nothing references, so each environment can allocate its own.
--
-- Idempotent: ON CONFLICT (item_gst_unit_code) DO NOTHING -- a code already present
-- keeps its name (sites do relabel a few of these).
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Item_Gst_Units.sql
--      or: npm run seed:run -- --only=Item_Gst_Units.sql

BEGIN;

INSERT INTO inventory.item_gst_units
    (item_gst_unit_code, item_gst_unit_name, item_gst_unit_created_by)
VALUES
     ('BAG'::text, 'Bags'::text, 'system'::text)
    ,('BAL', 'Bale'             , 'system')
    ,('BDL', 'Bundles'          , 'system')
    ,('BKL', 'Buckles'          , 'system')
    ,('BOU', 'Billions of Units', 'system')
    ,('BOX', 'Box'              , 'system')
    ,('BTL', 'Bottles'          , 'system')
    ,('BUN', 'Bunches'          , 'system')
    ,('CAN', 'Cans'             , 'system')
    ,('CBM', 'Cubic Meter'      , 'system')
    ,('CCM', 'Cubic Centimeter' , 'system')
    ,('CMS', 'Centimeter'       , 'system')
    ,('CTN', 'Cartons'          , 'system')
    ,('DOZ', 'Dozen'            , 'system')
    ,('DRM', 'Drums'            , 'system')
    ,('GGR', 'Great Gross'      , 'system')
    ,('GMS', 'Grams'            , 'system')
    ,('GRS', 'Gross'            , 'system')
    ,('GYD', 'Gross Yards'      , 'system')
    ,('KGS', 'Kilograms'        , 'system')
    ,('KLR', 'Kiloliter'        , 'system')
    ,('KME', 'Kilometre'        , 'system')
    ,('MLT', 'Millilitre'       , 'system')
    ,('MTR', 'Meters'           , 'system')
    ,('MTS', 'Metric Tons'      , 'system')
    ,('NOS', 'Numbers'          , 'system')
    ,('OTH', 'Others'           , 'system')
    ,('PAC', 'Packs'            , 'system')
    ,('PCS', 'Pieces'           , 'system')
    ,('PRS', 'Pairs'            , 'system')
    ,('QTL', 'Quintal'          , 'system')
    ,('ROL', 'Rolls'            , 'system')
    ,('SET', 'Sets'             , 'system')
    ,('SQF', 'Square Feet'      , 'system')
    ,('SQM', 'Square Meters'    , 'system')
    ,('SQY', 'Square Yards'     , 'system')
    ,('TBS', 'Tablets'          , 'system')
    ,('TGM', 'Ten Gross'        , 'system')
    ,('THD', 'Thousands'        , 'system')
    ,('TON', 'Tonnes'           , 'system')
    ,('TUB', 'Tubes'            , 'system')
    ,('UGS', 'US Gallons'       , 'system')
    ,('UNT', 'Units'            , 'system')
    ,('YDS', 'Yards'            , 'system')
ON CONFLICT (item_gst_unit_code) DO NOTHING;

COMMIT;
