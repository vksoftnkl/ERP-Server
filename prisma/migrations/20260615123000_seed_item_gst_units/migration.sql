-- Seed GST Unit Quantity Code (UQC) master data.
-- Idempotent by item_gst_unit_code so manual re-runs do not duplicate rows.

INSERT INTO "inventory"."ItemGstUnits" (
    "item_gst_unit_code",
    "item_gst_unit_name"
)
SELECT data.code, data.name
FROM (VALUES
    ('BAG', 'Bags'),
    ('BAL', 'Bale'),
    ('BDL', 'Bundles'),
    ('BKL', 'Buckles'),
    ('BOU', 'Billions of Units'),
    ('BOX', 'Box'),
    ('BTL', 'Bottles'),
    ('BUN', 'Bunches'),
    ('CAN', 'Cans'),
    ('CBM', 'Cubic Meter'),
    ('CCM', 'Cubic Centimeter'),
    ('CMS', 'Centimeter'),
    ('CTN', 'Cartons'),
    ('DOZ', 'Dozen'),
    ('DRM', 'Drums'),
    ('GGR', 'Great Gross'),
    ('GMS', 'Grams'),
    ('GRS', 'Gross'),
    ('GYD', 'Gross Yards'),
    ('KGS', 'Kilograms'),
    ('KLR', 'Kiloliter'),
    ('KME', 'Kilometre'),
    ('MLT', 'Millilitre'),
    ('MTR', 'Meters'),
    ('MTS', 'Metric Tons'),
    ('NOS', 'Numbers'),
    ('PAC', 'Packs'),
    ('PCS', 'Pieces'),
    ('PRS', 'Pairs'),
    ('QTL', 'Quintal'),
    ('ROL', 'Rolls'),
    ('SET', 'Sets'),
    ('SQF', 'Square Feet'),
    ('SQM', 'Square Meters'),
    ('SQY', 'Square Yards'),
    ('TBS', 'Tablets'),
    ('TGM', 'Ten Gross'),
    ('THD', 'Thousands'),
    ('TON', 'Tonnes'),
    ('TUB', 'Tubes'),
    ('UGS', 'US Gallons'),
    ('UNT', 'Units'),
    ('YDS', 'Yards'),
    ('OTH', 'Others')
) AS data(code, name)
WHERE NOT EXISTS (
    SELECT 1
    FROM "inventory"."ItemGstUnits" existing
    WHERE existing."item_gst_unit_code" = data.code
);
