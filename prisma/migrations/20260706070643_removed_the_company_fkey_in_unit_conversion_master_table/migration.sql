/*
  Warnings:

  - You are about to drop the column `iuc_company_id` on the `item_unit_conversion` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "inventory"."item_unit_conversion" DROP CONSTRAINT "fk_iuc_company_id";

-- AlterTable
ALTER TABLE "inventory"."item_unit_conversion" DROP COLUMN "iuc_company_id";
