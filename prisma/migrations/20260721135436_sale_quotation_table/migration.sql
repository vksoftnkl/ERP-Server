/*
  Warnings:

  - You are about to drop the column `sqi_item_code` on the `sale_quotation_item` table. All the data in the column will be lost.
  - You are about to drop the column `sqi_item_name` on the `sale_quotation_item` table. All the data in the column will be lost.
  - You are about to drop the column `sqi_item_weight` on the `sale_quotation_item` table. All the data in the column will be lost.
  - You are about to drop the column `sqi_qty` on the `sale_quotation_item` table. All the data in the column will be lost.
  - You are about to drop the column `sqi_qty_converted` on the `sale_quotation_item` table. All the data in the column will be lost.
  - Made the column `sqi_item_unit_id` on table `sale_quotation_item` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "sales"."sale_quotation_item" DROP COLUMN "sqi_item_code",
DROP COLUMN "sqi_item_name",
DROP COLUMN "sqi_item_weight",
DROP COLUMN "sqi_qty",
DROP COLUMN "sqi_qty_converted",
ADD COLUMN     "sqi_qty_bill" DECIMAL(15,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sqi_qty_case" DECIMAL(15,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sqi_qty_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
ALTER COLUMN "sqi_qty_length" DROP NOT NULL,
ALTER COLUMN "sqi_item_unit_id" SET NOT NULL;
