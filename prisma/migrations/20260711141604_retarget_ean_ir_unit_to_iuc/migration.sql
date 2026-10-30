-- Retarget item_ean_codes.ean_unit_id and item_reorders.ir_unit_id
-- from item_unit_master(unit_id) to item_unit_conversion(iuc_id).
--
-- The scalar columns keep their names but now hold an iuc_id. Existing rows
-- currently hold a unit_id, so we:
--   (1) drop the old FKs,
--   (2) seed conversion rows for (item, unit) pairs that a live EAN/reorder row
--       references but that have no conversion row yet -- only when the item
--       actually exists (item_unit_conversion has an FK to item_master),
--   (3) remove EAN rows that still cannot be mapped (they reference items that
--       do not exist in item_master -- dangling data with no valid target),
--   (4) backfill unit_id -> matching iuc_id,
--   (5) add the new FKs.

-- 1) Drop old FKs to item_unit_master
ALTER TABLE "inventory"."item_ean_codes" DROP CONSTRAINT "item_ean_codes_ean_unit_id_fkey";
ALTER TABLE "inventory"."item_reorders"  DROP CONSTRAINT "item_reorders_ir_unit_id_fkey";

-- 2) Seed missing item_unit_conversion rows (only for pairs whose item exists).
--    Per item, the lexicographically-first referenced unit becomes the base+default
--    row (unless the item already has an active base/default); remaining units
--    reference that base. Factors default to 1 (no real conversion data exists for
--    these items -- these rows exist only to preserve the referencing EAN/reorder rows).
WITH orphan_pairs AS (
  SELECT DISTINCT e.ean_item_id AS item_id, e.ean_unit_id AS unit_id
  FROM "inventory"."item_ean_codes" e
  WHERE EXISTS (SELECT 1 FROM "inventory"."item_master" im WHERE im.item_id = e.ean_item_id)
    AND NOT EXISTS (
      SELECT 1 FROM "inventory"."item_unit_conversion" c
      WHERE c.iuc_item_id = e.ean_item_id AND c.iuc_unit_id = e.ean_unit_id AND c.iuc_is_deleted = false)
  UNION
  SELECT DISTINCT r.ir_item_id, r.ir_unit_id
  FROM "inventory"."item_reorders" r
  WHERE r.ir_unit_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM "inventory"."item_master" im WHERE im.item_id = r.ir_item_id)
    AND NOT EXISTS (
      SELECT 1 FROM "inventory"."item_unit_conversion" c
      WHERE c.iuc_item_id = r.ir_item_id AND c.iuc_unit_id = r.ir_unit_id AND c.iuc_is_deleted = false)
),
ranked AS (
  SELECT item_id, unit_id,
         row_number() OVER (PARTITION BY item_id ORDER BY unit_id) AS rn,
         first_value(unit_id) OVER (PARTITION BY item_id ORDER BY unit_id) AS base_unit_id
  FROM orphan_pairs
),
item_flags AS (
  SELECT iuc_item_id,
         bool_or(iuc_is_base_unit    AND iuc_is_active AND NOT iuc_is_deleted) AS has_base,
         bool_or(iuc_is_default_unit AND iuc_is_active AND NOT iuc_is_deleted) AS has_default
  FROM "inventory"."item_unit_conversion"
  GROUP BY iuc_item_id
)
INSERT INTO "inventory"."item_unit_conversion"
  (iuc_item_id, iuc_unit_id, iuc_base_unit_id, iuc_to_base_factor, iuc_unit_slno, iuc_unit_factor,
   iuc_is_default_unit, iuc_is_base_unit, iuc_uom_remarks)
SELECT r.item_id, r.unit_id, r.base_unit_id, 1, r.rn, 1,
       (r.rn = 1 AND COALESCE(f.has_default, false) = false),
       (r.rn = 1 AND COALESCE(f.has_base, false) = false),
       'Auto-seeded during ean/ir unit_id->iuc_id FK retarget'
FROM ranked r
LEFT JOIN item_flags f ON f.iuc_item_id = r.item_id;

-- 3) Remove dangling EAN rows that still cannot be mapped to a conversion row
--    (they reference items absent from item_master, so no iuc target can exist).
DELETE FROM "inventory"."item_ean_codes" e
WHERE NOT EXISTS (
  SELECT 1 FROM "inventory"."item_unit_conversion" c
  WHERE c.iuc_item_id = e.ean_item_id AND c.iuc_unit_id = e.ean_unit_id AND c.iuc_is_deleted = false
);

-- 3b) Reorder rows are scope-nullable: if a non-null ir_unit_id cannot be mapped
--     (e.g. its item is missing), drop the unit scoping rather than the rule.
UPDATE "inventory"."item_reorders" r
SET ir_unit_id = NULL
WHERE r.ir_unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "inventory"."item_unit_conversion" c
    WHERE c.iuc_item_id = r.ir_item_id AND c.iuc_unit_id = r.ir_unit_id AND c.iuc_is_deleted = false
  );

-- 4) Backfill: replace the stored unit_id with the matching iuc_id (item + unit).
UPDATE "inventory"."item_ean_codes" e
SET ean_unit_id = c.iuc_id
FROM "inventory"."item_unit_conversion" c
WHERE c.iuc_item_id = e.ean_item_id
  AND c.iuc_unit_id = e.ean_unit_id
  AND c.iuc_is_deleted = false;

UPDATE "inventory"."item_reorders" r
SET ir_unit_id = c.iuc_id
FROM "inventory"."item_unit_conversion" c
WHERE r.ir_unit_id IS NOT NULL
  AND c.iuc_item_id = r.ir_item_id
  AND c.iuc_unit_id = r.ir_unit_id
  AND c.iuc_is_deleted = false;

-- 5) Add new FKs to item_unit_conversion
ALTER TABLE "inventory"."item_ean_codes"
  ADD CONSTRAINT "fk_ean_item_unit" FOREIGN KEY ("ean_unit_id")
  REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"."item_reorders"
  ADD CONSTRAINT "fk_ir_item_unit" FOREIGN KEY ("ir_unit_id")
  REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;
