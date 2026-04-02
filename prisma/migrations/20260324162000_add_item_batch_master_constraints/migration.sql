-- Add supported item_batch_master constraints and indexes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_master'
      AND c.conname = 'chk_btm_batch_no_not_blank'
  ) THEN
    ALTER TABLE "inventory"."item_batch_master"
      ADD CONSTRAINT "chk_btm_batch_no_not_blank"
      CHECK (char_length(trim("btm_batch_no")) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_master'
      AND c.conname = 'chk_btm_status'
  ) THEN
    ALTER TABLE "inventory"."item_batch_master"
      ADD CONSTRAINT "chk_btm_status"
      CHECK (
        "btm_status" IN (
          'ACTIVE'::"inventory"."ItemBatchStatus",
          'CLOSED'::"inventory"."ItemBatchStatus",
          'BLOCKED'::"inventory"."ItemBatchStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_master'
      AND c.conname = 'chk_btm_rates_nonnegative'
  ) THEN
    ALTER TABLE "inventory"."item_batch_master"
      ADD CONSTRAINT "chk_btm_rates_nonnegative"
      CHECK (
        "btm_mrp" >= 0
        AND "btm_last_purchase_rate_wot" >= 0
        AND "btm_last_sale_rate_wot" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'inventory'
      AND t.relname = 'item_batch_master'
      AND c.conname = 'chk_btm_dates'
  ) THEN
    ALTER TABLE "inventory"."item_batch_master"
      ADD CONSTRAINT "chk_btm_dates"
      CHECK (
        "btm_mfg_date" IS NULL
        OR "btm_expiry_date" IS NULL
        OR "btm_expiry_date" >= "btm_mfg_date"
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_btm_company_item_batchno"
ON "inventory"."item_batch_master" (
  "btm_company_id",
  "btm_item_id",
  lower(trim("btm_batch_no"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_btm_company_barcode"
ON "inventory"."item_batch_master" (
  "btm_company_id",
  "btm_barcode"
)
WHERE "btm_barcode" IS NOT NULL
  AND char_length(trim("btm_barcode")) > 0;

CREATE INDEX IF NOT EXISTS "idx_btm_expiry"
ON "inventory"."item_batch_master" (
  "btm_company_id",
  "btm_expiry_date"
)
WHERE "btm_expiry_date" IS NOT NULL;
