-- Remove CHECK constraints from item_unit_conversion table
-- These constraints are now enforced at the application layer in ItemUnitConversionService

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_unit_conversion'
      AND c.conname = 'chk_iuc_to_base_factor'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      DROP CONSTRAINT "chk_iuc_to_base_factor";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_unit_conversion'
      AND c.conname = 'chk_iuc_uom_weight'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      DROP CONSTRAINT "chk_iuc_uom_weight";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_unit_conversion'
      AND c.conname = 'chk_iuc_base_row'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      DROP CONSTRAINT "chk_iuc_base_row";
  END IF;
END $$;
