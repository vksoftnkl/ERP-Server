ALTER TABLE "inventory"."item_stock_balance"
  DROP CONSTRAINT IF EXISTS "chk_isb_available_formula";

UPDATE "inventory"."item_stock_balance"
SET "isb_available_qty" = ("isb_closing_qty" + "isb_free_closing_qty" - "isb_reserved_qty")
WHERE "isb_available_qty" IS DISTINCT FROM ("isb_closing_qty" + "isb_free_closing_qty" - "isb_reserved_qty");

ALTER TABLE "inventory"."item_stock_balance"
  ADD CONSTRAINT "chk_isb_available_formula"
  CHECK (
    "isb_available_qty" = ("isb_closing_qty" + "isb_free_closing_qty" - "isb_reserved_qty")
  );

ALTER TABLE "inventory"."item_batch_stock"
  DROP CONSTRAINT IF EXISTS "chk_ibs_available_formula";

UPDATE "inventory"."item_batch_stock"
SET "ibs_available_qty" = ("ibs_closing_qty" + "ibs_free_closing_qty" - "ibs_reserved_qty")
WHERE "ibs_available_qty" IS DISTINCT FROM ("ibs_closing_qty" + "ibs_free_closing_qty" - "ibs_reserved_qty");

ALTER TABLE "inventory"."item_batch_stock"
  ADD CONSTRAINT "chk_ibs_available_formula"
  CHECK (
    "ibs_available_qty" = ("ibs_closing_qty" + "ibs_free_closing_qty" - "ibs_reserved_qty")
  );
