/*
  Warnings:

  - You are about to drop the column `item_inclusive_of_tax` on the `item_master` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inventory"."item_master" DROP COLUMN "item_inclusive_of_tax",
ADD COLUMN     "item_incl_tax" BOOLEAN NOT NULL DEFAULT true;
