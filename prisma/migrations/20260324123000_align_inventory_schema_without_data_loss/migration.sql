-- Align the live inventory schema with the current Prisma datamodel
-- using additive and rename-only changes.

-- Normalize legacy constraint and index names after table renames.
ALTER TABLE "inventory"."item_category_master"
  RENAME CONSTRAINT "category_master_pkey" TO "item_category_master_pkey";

ALTER TABLE "inventory"."item_category_master"
  RENAME CONSTRAINT "category_master_category_parent_id_fkey" TO "item_category_master_category_parent_id_fkey";

ALTER TABLE "inventory"."item_unit_master"
  RENAME CONSTRAINT "units_pkey" TO "item_unit_master_pkey";

ALTER TABLE "inventory"."item_unit_master"
  RENAME CONSTRAINT "units_unit_base_unit_id_fkey" TO "item_unit_master_unit_base_unit_id_fkey";

ALTER INDEX "inventory"."units_unit_name_key"
  RENAME TO "item_unit_master_unit_name_key";

-- Add new pricing-scope columns without touching existing item price data.
ALTER TABLE "inventory"."item_price_master"
  ADD COLUMN IF NOT EXISTS "ipm_company_id" UUID,
  ADD COLUMN IF NOT EXISTS "ipm_branch_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'item_price_master_ipm_company_id_fkey'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "item_price_master_ipm_company_id_fkey"
      FOREIGN KEY ("ipm_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'item_price_master_ipm_branch_id_fkey'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "item_price_master_ipm_branch_id_fkey"
      FOREIGN KEY ("ipm_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'item_price_master_ipm_godown_id_fkey'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "item_price_master_ipm_godown_id_fkey"
      FOREIGN KEY ("ipm_godown_id")
      REFERENCES "inventory"."godown_locations"("gdl_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Create the new unit-conversion table.
CREATE TABLE IF NOT EXISTS "inventory"."item_unit_conversion" (
  "iuc_id" UUID NOT NULL DEFAULT uuidv7(),
  "iuc_company_id" UUID NOT NULL,
  "iuc_item_id" UUID NOT NULL,
  "iuc_unit_id" UUID NOT NULL,
  "iuc_base_unit_id" UUID NOT NULL,
  "iuc_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "iuc_unit_slno" INTEGER NOT NULL DEFAULT 0,
  "iul_unit_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "iuc_is_default_unit" BOOLEAN NOT NULL DEFAULT false,
  "iuc_is_base_unit" BOOLEAN NOT NULL DEFAULT false,
  "iuc_is_big_unit" BOOLEAN NOT NULL DEFAULT false,
  "iuc_uom_weight" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "iuc_uom_remarks" VARCHAR(250),
  "iuc_is_active" BOOLEAN NOT NULL DEFAULT true,
  "iuc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "iuc_sync_date" TIMESTAMPTZ(6),
  "iuc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "iuc_created_by" UUID,
  "iuc_updated_on" TIMESTAMPTZ(6),
  "iuc_updated_by" UUID,

  CONSTRAINT "item_unit_conversion_pkey" PRIMARY KEY ("iuc_id")
);

CREATE INDEX IF NOT EXISTS "idx_item_unit_conversion_item"
  ON "inventory"."item_unit_conversion"("iuc_item_id", "iuc_unit_slno");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'item_unit_conversion_iuc_item_id_fkey'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "item_unit_conversion_iuc_item_id_fkey"
      FOREIGN KEY ("iuc_item_id")
      REFERENCES "inventory"."item_master"("item_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'item_unit_conversion_iuc_unit_id_fkey'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "item_unit_conversion_iuc_unit_id_fkey"
      FOREIGN KEY ("iuc_unit_id")
      REFERENCES "inventory"."item_unit_master"("unit_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_unit_conversion'
      AND constraint_name = 'item_unit_conversion_iuc_base_unit_id_fkey'
  ) THEN
    ALTER TABLE "inventory"."item_unit_conversion"
      ADD CONSTRAINT "item_unit_conversion_iuc_base_unit_id_fkey"
      FOREIGN KEY ("iuc_base_unit_id")
      REFERENCES "inventory"."item_unit_master"("unit_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
