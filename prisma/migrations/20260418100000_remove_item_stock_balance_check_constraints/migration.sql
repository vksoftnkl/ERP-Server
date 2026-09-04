-- Remove mutable quantity/value/formula checks from item_stock_balance.
-- Keep enum/domain-style checks such as tracking type and stock bucket.

ALTER TABLE "inventory"."item_stock_balance"
  DROP CONSTRAINT IF EXISTS "chk_isb_qty_nonnegative",
  DROP CONSTRAINT IF EXISTS "chk_isb_value_nonnegative",
  DROP CONSTRAINT IF EXISTS "chk_isb_qty_formula",
  DROP CONSTRAINT IF EXISTS "chk_isb_free_qty_formula",
  DROP CONSTRAINT IF EXISTS "chk_isb_available_formula";
