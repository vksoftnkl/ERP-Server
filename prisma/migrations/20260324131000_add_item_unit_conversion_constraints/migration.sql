-- Add item_unit_conversion constraints and indexes for the full DDL shape.
-- This migration is forward-only and guarded to avoid checksum drift.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'item_unit_conversion_iuc_item_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'fk_iuc_item_id'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      RENAME CONSTRAINT "item_unit_conversion_iuc_item_id_fkey" TO "fk_iuc_item_id";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'fk_iuc_item_id'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "fk_iuc_item_id"
      FOREIGN KEY ("iuc_item_id")
      REFERENCES "inventory"."item_master"("item_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'item_unit_conversion_iuc_unit_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'fk_iuc_unit_id'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      RENAME CONSTRAINT "item_unit_conversion_iuc_unit_id_fkey" TO "fk_iuc_unit_id";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'fk_iuc_unit_id'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "fk_iuc_unit_id"
      FOREIGN KEY ("iuc_unit_id")
      REFERENCES "inventory"."item_unit_master"("unit_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'item_unit_conversion_iuc_base_unit_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'fk_iuc_base_unit_id'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      RENAME CONSTRAINT "item_unit_conversion_iuc_base_unit_id_fkey" TO "fk_iuc_base_unit_id";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'fk_iuc_base_unit_id'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "fk_iuc_base_unit_id"
      FOREIGN KEY ("iuc_base_unit_id")
      REFERENCES "inventory"."item_unit_master"("unit_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_unit_conversion'
      AND c.conname = 'chk_iuc_to_base_factor'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "chk_iuc_to_base_factor"
      CHECK ("iuc_to_base_factor" > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_unit_conversion'
      AND c.conname = 'chk_iuc_uom_weight'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "chk_iuc_uom_weight"
      CHECK ("iuc_uom_weight" >= 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_unit_conversion'
      AND c.conname = 'chk_iuc_base_row'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "chk_iuc_base_row"
      CHECK (
        ("iuc_is_base_unit" = true AND "iuc_unit_id" = "iuc_base_unit_id" AND "iuc_to_base_factor" = 1)
        OR
        ("iuc_is_base_unit" = false AND "iuc_to_base_factor" > 0)
      )
      NOT VALID;
  END IF;

  EXECUTE '
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_unit_conversion"
    ON "inventory"."item_unit_conversion" (
      "iuc_item_id",
      "iuc_unit_id"
    )
    WHERE "iuc_is_deleted" = false
  ';

  EXECUTE '
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_unit_conversion_default"
    ON "inventory"."item_unit_conversion" (
      "iuc_item_id"
    )
    WHERE "iuc_is_default_unit" = true
      AND "iuc_is_active" = true
      AND "iuc_is_deleted" = false
  ';

  EXECUTE '
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_unit_conversion_base"
    ON "inventory"."item_unit_conversion" (
      "iuc_item_id"
    )
    WHERE "iuc_is_base_unit" = true
      AND "iuc_is_active" = true
      AND "iuc_is_deleted" = false
  ';

  EXECUTE '
    CREATE INDEX IF NOT EXISTS "idx_item_unit_conversion_item"
    ON "inventory"."item_unit_conversion" (
      "iuc_item_id",
      "iuc_unit_slno"
    )
  ';
END $$;
