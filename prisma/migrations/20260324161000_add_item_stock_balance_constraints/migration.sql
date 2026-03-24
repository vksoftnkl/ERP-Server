-- Add supported item_stock_balance constraints and reporting indexes.
-- Note: the requested DDL referenced columns such as isb_base_unit_id,
-- isb_in_transit_in_qty, and isb_in_transit_out_qty, which do not exist in the
-- current project schema. The applied checks use the actual live columns:
-- isb_unit_id and isb_transit_qty.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_tracking_type'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_tracking_type"
      CHECK (
        "isb_tracking_type" IN (
          'NONE'::"inventory"."ItemStockBalanceTrackingType",
          'BATCH'::"inventory"."ItemStockBalanceTrackingType",
          'LOT'::"inventory"."ItemStockBalanceTrackingType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_stock_bucket'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_stock_bucket"
      CHECK (
        "isb_stock_bucket" IN (
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
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_qty_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_qty_nonnegative"
      CHECK (
        "isb_opening_qty" >= 0
        AND "isb_in_qty" >= 0
        AND "isb_out_qty" >= 0
        AND "isb_closing_qty" >= 0
        AND "isb_opening_free_qty" >= 0
        AND "isb_free_in_qty" >= 0
        AND "isb_free_out_qty" >= 0
        AND "isb_free_closing_qty" >= 0
        AND "isb_reserved_qty" >= 0
        AND "isb_transit_qty" >= 0
        AND "isb_available_qty" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_value_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_value_nonnegative"
      CHECK (
        "isb_opening_avg_rate" >= 0
        AND "isb_avg_stock_rate" >= 0
        AND "isb_opening_value" >= 0
        AND "isb_stock_value" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_qty_formula'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_qty_formula"
      CHECK (
        "isb_closing_qty" = ("isb_opening_qty" + "isb_in_qty" - "isb_out_qty")
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_free_qty_formula'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_free_qty_formula"
      CHECK (
        "isb_free_closing_qty" = ("isb_opening_free_qty" + "isb_free_in_qty" - "isb_free_out_qty")
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_balance'
      AND c.conname = 'chk_isb_available_formula'
  ) THEN
    ALTER TABLE "inventory"."item_stock_balance"
      ADD CONSTRAINT "chk_isb_available_formula"
      CHECK ("isb_available_qty" = ("isb_closing_qty" - "isb_reserved_qty"));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_isb_nonzero_stock"
ON "inventory"."item_stock_balance" (
  "isb_acc_year",
  "isb_company_id",
  "isb_branch_id",
  "isb_godown_id",
  "isb_item_id"
)
WHERE (
  "isb_closing_qty" <> 0
  OR "isb_free_closing_qty" <> 0
  OR "isb_reserved_qty" <> 0
  OR "isb_transit_qty" <> 0
);
