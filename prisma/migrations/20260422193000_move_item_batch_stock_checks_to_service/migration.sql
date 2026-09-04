-- Remove item_batch_stock check constraints and validate them in the app layer.

ALTER TABLE "inventory"."item_batch_stock"
  DROP CONSTRAINT IF EXISTS "chk_ibs_stock_bucket",
  DROP CONSTRAINT IF EXISTS "chk_ibs_qty_nonnegative",
  DROP CONSTRAINT IF EXISTS "chk_ibs_value_nonnegative",
  DROP CONSTRAINT IF EXISTS "chk_ibs_qty_formula",
  DROP CONSTRAINT IF EXISTS "chk_ibs_free_qty_formula",
  DROP CONSTRAINT IF EXISTS "chk_ibs_dates",
  DROP CONSTRAINT IF EXISTS "chk_ibs_available_formula";
