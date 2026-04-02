-- Add supported item_batch_stock constraints and filtered indexes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'inventory'
      AND table_name = 'item_batch_stock'
      AND constraint_name = 'fk_ibs_batch'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "fk_ibs_batch"
      FOREIGN KEY ("ibs_batch_id")
      REFERENCES "inventory"."item_batch_master"("btm_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_stock_bucket'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_stock_bucket"
      CHECK (
        "ibs_stock_bucket" IN (
          'SALEABLE'::"inventory"."ItemStockBucket",
          'DAMAGED'::"inventory"."ItemStockBucket",
          'EXPIRED'::"inventory"."ItemStockBucket",
          'HOLD'::"inventory"."ItemStockBucket",
          'RETURN'::"inventory"."ItemStockBucket"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_qty_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_qty_nonnegative"
      CHECK (
        "ibs_opening_qty" >= 0
        AND "ibs_in_qty" >= 0
        AND "ibs_out_qty" >= 0
        AND "ibs_closing_qty" >= 0
        AND "ibs_opening_free_qty" >= 0
        AND "ibs_free_in_qty" >= 0
        AND "ibs_free_out_qty" >= 0
        AND "ibs_free_closing_qty" >= 0
        AND "ibs_reserved_qty" >= 0
        AND "ibs_available_qty" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_value_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_value_nonnegative"
      CHECK (
        "ibs_opening_avg_rate" >= 0
        AND "ibs_avg_stock_rate" >= 0
        AND "ibs_opening_value" >= 0
        AND "ibs_stock_value" >= 0
        AND "ibs_mrp" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_qty_formula'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_qty_formula"
      CHECK (
        "ibs_closing_qty" = ("ibs_opening_qty" + "ibs_in_qty" - "ibs_out_qty")
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_free_qty_formula'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_free_qty_formula"
      CHECK (
        "ibs_free_closing_qty" = ("ibs_opening_free_qty" + "ibs_free_in_qty" - "ibs_free_out_qty")
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_available_formula'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_available_formula"
      CHECK ("ibs_available_qty" = ("ibs_closing_qty" - "ibs_reserved_qty"));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_stock'
      AND c.conname = 'chk_ibs_dates'
  ) THEN
    ALTER TABLE "inventory"."item_batch_stock"
      ADD CONSTRAINT "chk_ibs_dates"
      CHECK (
        "ibs_mfg_date" IS NULL
        OR "ibs_expiry_date" IS NULL
        OR "ibs_expiry_date" >= "ibs_mfg_date"
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ibs_expiry"
ON "inventory"."item_batch_stock" (
  "ibs_acc_year",
  "ibs_company_id",
  "ibs_branch_id",
  "ibs_expiry_date"
)
WHERE "ibs_expiry_date" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ibs_nonzero_stock"
ON "inventory"."item_batch_stock" (
  "ibs_acc_year",
  "ibs_company_id",
  "ibs_branch_id",
  "ibs_godown_id",
  "ibs_item_id",
  "ibs_batch_id"
)
WHERE (
  "ibs_closing_qty" <> 0
  OR "ibs_free_closing_qty" <> 0
  OR "ibs_reserved_qty" <> 0
);
