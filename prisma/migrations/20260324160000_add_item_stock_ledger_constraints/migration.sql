-- Add supported item_stock_ledger constraints and partial indexes.
-- Note: the requested DDL referenced columns such as stl_in_base_qty,
-- stl_out_base_qty, stl_balance_avg_rate, and stl_balance_value, which do not
-- exist in the current project schema, so those checks are intentionally omitted.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_stock_effect'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_stock_effect"
      CHECK ("stl_stock_effect" IN (-1, 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_tracking_type'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_tracking_type"
      CHECK (
        "stl_tracking_type" IN (
          'NONE'::"inventory"."StockTrackingType",
          'BATCH'::"inventory"."StockTrackingType",
          'LOT'::"inventory"."StockTrackingType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_txn_type'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_txn_type"
      CHECK (
        "stl_txn_type" IN (
          'OPENING'::"inventory"."StockTxnType",
          'PURCHASE'::"inventory"."StockTxnType",
          'PURCHASE_RETURN'::"inventory"."StockTxnType",
          'SALE'::"inventory"."StockTxnType",
          'SALES_RETURN'::"inventory"."StockTxnType",
          'TRANSFER_IN'::"inventory"."StockTxnType",
          'TRANSFER_OUT'::"inventory"."StockTxnType",
          'ADJUSTMENT_IN'::"inventory"."StockTxnType",
          'ADJUSTMENT_OUT'::"inventory"."StockTxnType",
          'PRODUCTION_IN'::"inventory"."StockTxnType",
          'CONSUMPTION'::"inventory"."StockTxnType",
          'DAMAGE'::"inventory"."StockTxnType",
          'EXPIRED'::"inventory"."StockTxnType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_qty_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_qty_nonnegative"
      CHECK (
        "stl_qty" >= 0
        AND "stl_base_qty" >= 0
        AND "stl_free_qty" >= 0
        AND "stl_free_base_qty" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_qty_conversion'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_qty_conversion"
      CHECK ("stl_base_qty" = ("stl_qty" * "stl_conversion_factor"));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_free_qty_conversion'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_free_qty_conversion"
      CHECK ("stl_free_base_qty" = ("stl_free_qty" * "stl_conversion_factor"));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_batch_dates'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_batch_dates"
      CHECK (
        "stl_expiry_date" IS NULL
        OR "stl_mfg_date" IS NULL
        OR "stl_expiry_date" >= "stl_mfg_date"
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'chk_stl_values_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "chk_stl_values_nonnegative"
      CHECK (
        "stl_stock_rate" >= 0
        AND "stl_stock_value" >= 0
        AND "stl_landed_cost_rate" >= 0
        AND "stl_landed_cost_value" >= 0
        AND "stl_doc_rate_wot" >= 0
        AND "stl_doc_amount_wot" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_stock_ledger'
      AND c.conname = 'uq_stl_source_line_split'
  ) THEN
    ALTER TABLE "inventory"."item_stock_ledger"
      ADD CONSTRAINT "uq_stl_source_line_split"
      UNIQUE (
        "stl_voucher_id",
        "stl_line_no",
        "stl_split_no",
        "stl_godown_id",
        "stl_batch_id"
      );
  END IF;
END $$;

DROP INDEX IF EXISTS "inventory"."idx_stl_item";
CREATE INDEX IF NOT EXISTS "idx_stl_item"
ON "inventory"."item_stock_ledger" (
  "stl_acc_year",
  "stl_company_id",
  "stl_branch_id",
  "stl_item_id"
)
WHERE "stl_is_deleted" = false;

DROP INDEX IF EXISTS "inventory"."idx_stl_voucher";
CREATE INDEX IF NOT EXISTS "idx_stl_voucher"
ON "inventory"."item_stock_ledger" (
  "stl_acc_year",
  "stl_company_id",
  "stl_branch_id",
  "stl_voucher_id"
)
WHERE "stl_is_deleted" = false;
