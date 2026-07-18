-- Retarget item_price_master.ipm_unit_id from item_unit_master(unit_id)
-- to item_unit_conversion(iuc_id).
--
-- The scalar column keeps its name but now holds an iuc_id. Existing rows
-- currently hold a unit_id, so we:
--   (1) drop the old FK,
--   (2) backfill unit_id -> matching iuc_id for the same item,
--   (3) assert every row mapped,
--   (4) add the new FK.
--
-- No rows are deleted and no conversion rows are seeded: every live price row
-- already has a matching (item, unit) conversion row. Where a pair has several
-- conversion rows (soft-delete history), we pick the active one, falling back
-- to the most recently created deleted one (iuc_id is uuidv7, so time-ordered).

-- 1) Drop the old FK to item_unit_master
ALTER TABLE "inventory"."item_price_master" DROP CONSTRAINT IF EXISTS "fk_ipm_unit";

-- 2) Backfill: replace the stored unit_id with the matching iuc_id (item + unit).
UPDATE "inventory"."item_price_master" p
SET "ipm_unit_id" = m."iuc_id"
FROM (
  SELECT DISTINCT ON (c."iuc_item_id", c."iuc_unit_id")
         c."iuc_item_id", c."iuc_unit_id", c."iuc_id"
  FROM "inventory"."item_unit_conversion" c
  ORDER BY c."iuc_item_id", c."iuc_unit_id", c."iuc_is_deleted", c."iuc_id" DESC
) m
WHERE m."iuc_item_id" = p."ipm_item_id"
  AND m."iuc_unit_id" = p."ipm_unit_id";

-- 3) Assert the backfill was total. Any leftover row would otherwise fail the
--    new FK with an opaque 23503; fail loudly here instead, before anything is
--    committed (the whole migration runs in one transaction).
DO $$
DECLARE unmapped bigint;
BEGIN
  SELECT count(*) INTO unmapped
  FROM "inventory"."item_price_master" p
  WHERE NOT EXISTS (
    SELECT 1 FROM "inventory"."item_unit_conversion" c
    WHERE c."iuc_id" = p."ipm_unit_id"
  );
  IF unmapped > 0 THEN
    RAISE EXCEPTION
      'ipm_unit_id retarget aborted: % item_price_master row(s) have no item_unit_conversion match', unmapped;
  END IF;
END $$;

-- 4) Add the new FK to item_unit_conversion
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "fk_ipm_unit" FOREIGN KEY ("ipm_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;
