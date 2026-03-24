-- Add item_price_master constraints and indexes for the full DDL shape.
-- These checks are guarded so the migration remains safe if some columns
-- are introduced in a staged rollout.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name = 'ipm_item_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'fk_ipm_item'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "fk_ipm_item"
      FOREIGN KEY ("ipm_item_id")
      REFERENCES "inventory"."item_master"("item_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name = 'ipm_unit_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'fk_ipm_unit'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "fk_ipm_unit"
      FOREIGN KEY ("ipm_unit_id")
      REFERENCES "inventory"."item_unit_master"("unit_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name = 'ipm_base_unit_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'fk_ipm_base_unit'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "fk_ipm_base_unit"
      FOREIGN KEY ("ipm_base_unit_id")
      REFERENCES "inventory"."item_unit_master"("unit_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name = 'ipm_godown_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND constraint_name = 'fk_ipm_godown_id'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "fk_ipm_godown_id"
      FOREIGN KEY ("ipm_godown_id")
      REFERENCES "inventory"."godown_locations"("gdl_id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name = 'ipm_to_base_factor'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_price_master'
      AND c.conname = 'chk_ipm_to_base_factor'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "chk_ipm_to_base_factor"
      CHECK ("ipm_to_base_factor" > 0)
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name = 'ipm_profit_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_price_master'
      AND c.conname = 'chk_ipm_profit_type'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "chk_ipm_profit_type"
      CHECK ("ipm_profit_type" IN ('BY_PERCENT', 'BY_AMOUNT', 'MANUAL'))
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name IN (
        'ipm_cost_price',
        'ipm_cost_wot',
        'ipm_sales_price_a',
        'ipm_sales_price_b',
        'ipm_sales_price_c',
        'ipm_sales_price_d',
        'ipm_price_a_wot',
        'ipm_price_b_wot',
        'ipm_price_c_wot',
        'ipm_price_d_wot',
        'ipm_max_price',
        'ipm_min_price',
        'ipm_disc_perc',
        'ipm_disc_qty',
        'ipm_addl_cess',
        'ipm_loading_charge',
        'ipm_freight_charge',
        'ipm_loyalty_points'
      )
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 18
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_price_master'
      AND c.conname = 'chk_ipm_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_price_master"
      ADD CONSTRAINT "chk_ipm_nonnegative"
      CHECK (
        "ipm_cost_price" >= 0
        AND "ipm_cost_wot" >= 0
        AND "ipm_sales_price_a" >= 0
        AND "ipm_sales_price_b" >= 0
        AND "ipm_sales_price_c" >= 0
        AND "ipm_sales_price_d" >= 0
        AND "ipm_price_a_wot" >= 0
        AND "ipm_price_b_wot" >= 0
        AND "ipm_price_c_wot" >= 0
        AND "ipm_price_d_wot" >= 0
        AND "ipm_max_price" >= 0
        AND "ipm_min_price" >= 0
        AND "ipm_disc_perc" >= 0
        AND "ipm_disc_qty" >= 0
        AND "ipm_addl_cess" >= 0
        AND "ipm_loading_charge" >= 0
        AND "ipm_freight_charge" >= 0
        AND "ipm_loyalty_points" >= 0
      )
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name IN (
        'ipm_company_id',
        'ipm_branch_id',
        'ipm_item_id',
        'ipm_unit_id',
        'ipm_is_deleted'
      )
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 5
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_price_master_branch"
      ON "inventory"."item_price_master" (
        "ipm_company_id",
        "ipm_branch_id",
        "ipm_item_id",
        "ipm_unit_id"
      )
      WHERE "ipm_branch_id" IS NOT NULL
        AND "ipm_is_deleted" = false
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'inventory'
      AND table_name = 'item_price_master'
      AND column_name IN ('ipm_item_id', 'ipm_unit_id')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 2
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS "idx_item_price_master_item"
      ON "inventory"."item_price_master" (
        "ipm_item_id",
        "ipm_unit_id"
      )
    ';
  END IF;
END $$;
