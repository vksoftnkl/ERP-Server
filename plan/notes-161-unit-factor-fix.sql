-- =============================================================================
-- notes-161-unit-factor-fix.sql — notes 161 §1.1: unit rows saved under the
-- inverted factor rule of 99d0a468 (2026-07-27 → restored 2026-10-23, notes
-- 147 A). One-off for the dev box (.106). NOT a migration.
-- =============================================================================
--
-- THE RULE (item-unit-conversion.service.ts, normalizeItemUnitConversionFactors):
--   rows run from the biggest unit down (iuc_unit_slno); a row's iuc_unit_factor
--   is how many of IT make one of the row above; iuc_to_base_factor is the base
--   row's cumulative over this row's. Bottle (1) / PCS (10, base) → Bottle = 10.
--   A row BELOW the base has a to-base factor under 1, and that is correct.
--
-- WHAT THE DRY RUN FOUND ON .106 (2026-10-27, 367 items / 406 live rows): 17 rows.
--   A. three real items, row above the base stored as 1 / its true factor;
--   B. eleven API test items meant as BOX = 12 PCS but with PCS listed first —
--      the literal rule would make BOX 1/12 PCS, so BOX is moved first instead
--      (to-base stays 12, the 12 moves to PCS's step factor);
--   C. three E2E-COLMAP items whose only row, the base, carries to-base 6.
--   No sales line (bill / DC / DC return / return / order / quotation) and no
--   stock line used any of these rows, except OPN0006's 5 Bottle of Samsung H1
--   (posted 0.5 PCS at 1030). That voucher is cancelled and re-keyed from the
--   Opening Stock screen AFTER this runs; nothing here touches stock.
--
-- Every UPDATE is guarded on the row's current values, so a second run, or a
-- run on a database where a row was already corrected, changes nothing.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f plan/notes-161-unit-factor-fix.sql
-- =============================================================================

BEGIN;

-- A. real items: the to-base factor of the row above the base.
UPDATE inventory.item_unit_conversion c
   SET iuc_to_base_factor = v.new_tb, iuc_updated_on = now()
  FROM (VALUES
        ('01a161d8-5006-718f-a119-460512239ea9'::uuid, 0.1 , 10), -- Samsung H1           Bottle   (PCS base, 10)
        ('019da0a8-8ee9-7167-b232-ebac93926a64'::uuid, 0.1 , 10), -- Sakthi Manjal Powder BOX      (Packet base, 10)
        ('01a0f5da-3434-7d6d-a4a5-3983e69b0feb'::uuid, 0.02, 50)  -- SUGAR                Kilogram (Packet base, 50)
       ) AS v(iuc_id, old_tb, new_tb)
 WHERE c.iuc_id = v.iuc_id
   AND c.iuc_to_base_factor = v.old_tb
   AND c.iuc_unit_slno = 1
   AND NOT c.iuc_is_base_unit
   AND NOT c.iuc_is_deleted;

-- B. test items: BOX (slno 2, to-base 12) becomes row 1 with step 1, and PCS
--    (the base, slno 1) becomes row 2 with step 12. Both flips in one statement.
UPDATE inventory.item_unit_conversion c
   SET iuc_unit_slno   = CASE WHEN c.iuc_is_base_unit THEN 2  ELSE 1 END,
       iuc_unit_factor = CASE WHEN c.iuc_is_base_unit THEN 12 ELSE 1 END,
       iuc_updated_on  = now()
  FROM (VALUES
        ('01a08036-b55d-7d77-b553-c683f9a45fa9'::uuid), ('01a08036-b560-7f24-91b3-c03e86087473'::uuid), -- E2E-OPN-SALT-MTSFJP0X
        ('01a0803b-5c79-7fca-a315-c125a09f53ef'::uuid), ('01a0803b-5c7d-72e0-8bb4-67d160f6e754'::uuid), -- E2E-OPN-SALT-MTSFQ8B4
        ('01a08022-0f7b-7d24-92d5-288172bcaad5'::uuid), ('01a08022-0f85-7738-ad13-2685abc313ea'::uuid), -- TEST OPENING ITEM 02
        ('01a0808e-c490-71da-95ea-05dd23981f7c'::uuid), ('01a0808e-c493-79f9-a7f8-a4358a296442'::uuid), -- TEST OPENING ITEM 03
        ('01a08501-ae54-7773-853d-4b8361349fcf'::uuid), ('01a08501-ae56-7af7-ad5d-6014da2e115d'::uuid), -- ZZ TEST B (BATCH)
        ('01a08501-ae94-7878-b8b2-cd6b0a14d59c'::uuid), ('01a08501-ae96-7fed-8661-e72ccf04fc8d'::uuid), -- ZZ TEST BE (BATCH_EXPIRY)
        ('01a08501-aed0-70b3-88aa-11bca39917a9'::uuid), ('01a08501-aed2-721a-92ac-3c92d066d208'::uuid), -- ZZ TEST BME (FMCG_MRP)
        ('01a08501-add0-797b-9700-864dd23648c2'::uuid), ('01a08501-add4-744b-9db4-5cffe04bc16c'::uuid), -- ZZ TEST M (MRP_SELLING)
        ('01a08501-ad88-75d9-ba6a-ddecb6a9354e'::uuid), ('01a08501-ad8b-75c2-ad11-0beda372a26b'::uuid), -- ZZ TEST N (NONE)
        ('01a08501-af07-781a-b8d5-8c787a7a78cc'::uuid), ('01a08501-af09-7a30-87e8-58f10ec343b0'::uuid), -- ZZ TEST R (SERIAL)
        ('01a08501-ae11-7565-a240-3313b1798ded'::uuid), ('01a08501-ae13-7c52-b3bf-ae85bb29f462'::uuid)  -- ZZ TEST S (SP_ONLY)
       ) AS v(iuc_id)
 WHERE c.iuc_id = v.iuc_id
   AND NOT c.iuc_is_deleted
   AND (   (c.iuc_is_base_unit     AND c.iuc_unit_slno = 1 AND c.iuc_to_base_factor = 1)
        OR (NOT c.iuc_is_base_unit AND c.iuc_unit_slno = 2 AND c.iuc_to_base_factor = 12));

-- C. a base row's to-base factor is 1.
UPDATE inventory.item_unit_conversion c
   SET iuc_to_base_factor = 1, iuc_updated_on = now()
 WHERE c.iuc_id IN ('01a08b93-0c9b-72b5-8d8a-d2d5a8c9bfe0',  -- E2E-COLMAP-MTVL0XPZ PCS
                    '01a0f0d8-973b-70a9-b44e-a0f3fbccbfcd',  -- E2E-COLMAP-MUNOLLWE PCS
                    '01a0f0d9-e802-77bd-916d-4015812a8e46')  -- E2E-COLMAP-MUNONGEY PCS
   AND c.iuc_is_base_unit
   AND c.iuc_to_base_factor = 6
   AND NOT c.iuc_is_deleted;

-- Check: no live base row may carry a to-base factor other than 1.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM inventory.item_unit_conversion
                WHERE iuc_is_base_unit AND NOT iuc_is_deleted AND iuc_to_base_factor <> 1) THEN
        RAISE EXCEPTION 'a live base unit row still has iuc_to_base_factor <> 1';
    END IF;
END $$;

COMMIT;
