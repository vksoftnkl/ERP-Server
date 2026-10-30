/*
  Warnings:

  - You are about to drop the column `soi_cancel_remarks` on the `sale_order_item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sales"."sale_order_item" DROP COLUMN "soi_cancel_remarks",
ADD COLUMN     "soi_cancel_reason" VARCHAR(250);
