-- Repair inventory table-name drift without dropping data.
-- This reconciles historical migration names with the live schema.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'inventory'
      AND table_name = 'units'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_master'
  ) THEN
    ALTER TABLE "inventory"."units" RENAME TO "item_unit_master";
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'inventory'
      AND table_name = 'Item_units_master'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_master'
  ) THEN
    ALTER TABLE "inventory"."Item_units_master" RENAME TO "item_unit_master";
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'inventory'
      AND table_name = 'category_master'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'inventory'
      AND table_name = 'item_category_master'
  ) THEN
    ALTER TABLE "inventory"."category_master" RENAME TO "item_category_master";
  END IF;
END $$;
