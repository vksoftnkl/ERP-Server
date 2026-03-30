/*
  Warnings:

  - You are about to drop the column `iul_unit_factor` on the `item_unit_conversion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inventory"."item_unit_conversion" DROP COLUMN "iul_unit_factor",
ADD COLUMN     "iuc_unit_factor" DECIMAL(18,6) NOT NULL DEFAULT 1;
