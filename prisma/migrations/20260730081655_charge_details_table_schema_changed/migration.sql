-- AlterTable
ALTER TABLE "sales"."sale_quotation_item" ADD COLUMN     "sqi_has_freight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sqi_rate_diff" DECIMAL(15,4) NOT NULL DEFAULT 0,
ADD COLUMN     "sqi_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0;
