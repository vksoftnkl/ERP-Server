-- Make item_price_master.ipm_godown_id optional.
--
-- A NULL godown means the price row applies to every godown, matching the
-- existing convention on item_reorders.ir_godown_id ("NULL = global rule").
-- No rows change: every current row keeps the godown it already has.
--
-- uq_ipm_item_unit_godown (item, unit, godown) no longer exists — it was
-- dropped when the table was recreated in
-- 20260324140000_recreate_item_price_master_without_reset — so nothing is
-- weakened by relaxing this column. The partial index below is added so the
-- godown-less rows this change makes possible cannot be duplicated: Postgres
-- treats NULLs as distinct, so a plain UNIQUE over the three columns would
-- never dedupe them.

-- 1) Relax the column. The FK stays as-is: it already permits NULL.
ALTER TABLE "inventory"."item_price_master"
  ALTER COLUMN "ipm_godown_id" DROP NOT NULL;

-- 2) One global (godown-less) price row per item + unit. Scoped to live rows so
--    soft-deleted history never blocks a re-create.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_price_master_item_unit_global"
ON "inventory"."item_price_master" (
  "ipm_item_id",
  "ipm_unit_id"
)
WHERE "ipm_godown_id" IS NULL
  AND "ipm_is_deleted" = false;
