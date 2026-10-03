-- AlterTable
ALTER TABLE "sales"."sale_quotation" ALTER COLUMN "sq_created_by" SET DATA TYPE TEXT,
ALTER COLUMN "sq_modified_by" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "sales"."sale_quotation_item" ALTER COLUMN "sqi_created_by" SET DATA TYPE TEXT,
ALTER COLUMN "sqi_modified_by" SET DATA TYPE TEXT;
