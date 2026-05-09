-- AlterTable
ALTER TABLE "stock"."physical_stock_batch_detail" ADD COLUMN "psb_psh_id" UUID;

UPDATE "stock"."physical_stock_batch_detail" AS batch_detail
SET "psb_psh_id" = detail."psd_psc_id"
FROM "stock"."physical_stock_detail" AS detail
WHERE batch_detail."psb_psd_id" = detail."psd_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "stock"."physical_stock_batch_detail"
    WHERE "psb_psh_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to backfill stock.physical_stock_batch_detail.psb_psh_id because at least one batch row has no matching detail row.';
  END IF;
END $$;

ALTER TABLE "stock"."physical_stock_batch_detail" ALTER COLUMN "psb_psh_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ix_physical_stock_batch_detail_header" ON "stock"."physical_stock_batch_detail"("psb_psh_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_header" ON "stock"."physical_stock_detail"("psd_psc_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_item" ON "stock"."physical_stock_detail"("psd_company_id", "psd_branch_id", "psd_godown_id", "psd_item_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_diff" ON "stock"."physical_stock_detail"("psd_psc_id", "psd_diff_base_qty");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_resolution" ON "stock"."physical_stock_detail"("psd_psc_id", "psd_resolution");

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_psh_id_fkey" FOREIGN KEY ("psb_psh_id") REFERENCES "stock"."physical_stock_header"("psc_id") ON DELETE RESTRICT ON UPDATE CASCADE;
