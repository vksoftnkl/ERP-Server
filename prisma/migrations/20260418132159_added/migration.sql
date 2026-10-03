-- AlterTable
ALTER TABLE "inventory"."item_stock_balance" ADD COLUMN     "isb_avg_stock_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN     "isb_opening_avg_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN     "isb_opening_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isb_stock_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0;
