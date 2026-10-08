-- Replace batch enum columns with VARCHAR(20) columns while preserving data.

ALTER TABLE "inventory"."item_batch_master"
  DROP CONSTRAINT IF EXISTS "chk_btm_status";

ALTER TABLE "inventory"."item_batch_stock"
  DROP CONSTRAINT IF EXISTS "chk_ibs_stock_bucket";

ALTER TABLE "inventory"."item_stock_balance"
  DROP CONSTRAINT IF EXISTS "chk_isb_stock_bucket";

ALTER TABLE "inventory"."item_batch_master"
  ALTER COLUMN "btm_status" DROP DEFAULT,
  ALTER COLUMN "btm_status" TYPE VARCHAR(20) USING ("btm_status"::text),
  ALTER COLUMN "btm_status" SET DEFAULT 'ACTIVE';

ALTER TABLE "inventory"."item_batch_stock"
  ALTER COLUMN "ibs_stock_bucket" DROP DEFAULT,
  ALTER COLUMN "ibs_stock_bucket" TYPE VARCHAR(20) USING ("ibs_stock_bucket"::text),
  ALTER COLUMN "ibs_stock_bucket" SET DEFAULT 'SALEABLE';

ALTER TABLE "inventory"."item_stock_balance"
  ALTER COLUMN "isb_stock_bucket" DROP DEFAULT,
  ALTER COLUMN "isb_stock_bucket" TYPE VARCHAR(20) USING ("isb_stock_bucket"::text),
  ALTER COLUMN "isb_stock_bucket" SET DEFAULT 'SALEABLE';

ALTER TABLE "inventory"."item_batch_master"
  ADD CONSTRAINT "chk_btm_status"
  CHECK ("btm_status" IN ('ACTIVE', 'CLOSED', 'BLOCKED'));

ALTER TABLE "inventory"."item_batch_stock"
  ADD CONSTRAINT "chk_ibs_stock_bucket"
  CHECK ("ibs_stock_bucket" IN ('SALEABLE', 'DAMAGED', 'EXPIRED', 'HOLD', 'RETURN'));

ALTER TABLE "inventory"."item_stock_balance"
  ADD CONSTRAINT "chk_isb_stock_bucket"
  CHECK ("isb_stock_bucket" IN ('SALEABLE', 'DAMAGED', 'EXPIRED', 'HOLD', 'RETURN'));

DROP TYPE IF EXISTS "inventory"."ItemBatchStatus";
DROP TYPE IF EXISTS "inventory"."ItemStockBucket";
