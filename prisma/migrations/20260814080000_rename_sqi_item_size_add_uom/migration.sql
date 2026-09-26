-- Align the quotation line's free-text dimension with sale_order_item /
-- sale_bill_item, which both use <prefix>_size + <prefix>_size_uom. The rename
-- preserves existing data; a DROP+ADD would not.
--
-- sale_quotation_item is LIST-partitioned by sqi_acc_year (20260810130000).
-- RENAME COLUMN / ADD COLUMN on the partitioned parent propagate to every
-- partition, so no per-partition DDL is needed.

-- AlterTable
ALTER TABLE "sales"."sale_quotation_item" RENAME COLUMN "sqi_item_size" TO "sqi_size";

-- AlterTable
ALTER TABLE "sales"."sale_quotation_item" ADD COLUMN     "sqi_size_uom" VARCHAR(20);
