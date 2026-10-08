/*
  Warnings:

  - The `comp_stylesheet_id` column on the `companys` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "companys" DROP COLUMN "comp_stylesheet_id",
ADD COLUMN     "comp_stylesheet_id" INTEGER;
