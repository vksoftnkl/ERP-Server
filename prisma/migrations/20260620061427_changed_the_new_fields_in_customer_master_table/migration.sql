/*
  Warnings:

  - You are about to drop the column `comp_regionalname` on the `companys` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companys" DROP COLUMN "comp_regionalname",
ADD COLUMN     "comp_region_name" TEXT;
