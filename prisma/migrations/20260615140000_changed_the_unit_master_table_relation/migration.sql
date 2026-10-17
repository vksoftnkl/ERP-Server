/*
  Warnings:

  - A unique constraint covering the columns `[item_gst_unit_code]` on the table `item_gst_units` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "inventory"."item_unit_master" ALTER COLUMN "unit_code" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "item_gst_units_item_gst_unit_code_key" ON "inventory"."item_gst_units"("item_gst_unit_code");

-- AddForeignKey
ALTER TABLE "inventory"."item_unit_master" ADD CONSTRAINT "item_unit_master_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "inventory"."item_gst_units"("item_gst_unit_code") ON DELETE SET NULL ON UPDATE CASCADE;
