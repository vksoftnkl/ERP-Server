-- AlterTable
ALTER TABLE "inventory"."item_ean_codes" ADD COLUMN     "ean_sl_no" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "inventory"."item_reorders" ADD COLUMN     "ir_sl_no" INTEGER NOT NULL DEFAULT 0;
