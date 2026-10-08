/*
  Warnings:

  - The `br_pin` column on the `branch_master` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "branch_master" ADD COLUMN     "br_gst_reg_type" VARCHAR(30),
ADD COLUMN     "br_gstin_no" VARCHAR(15),
ADD COLUMN     "br_pan_no" VARCHAR(10),
ADD COLUMN     "br_region_name" TEXT,
DROP COLUMN "br_pin",
ADD COLUMN     "br_pin" INTEGER;

-- AlterTable
ALTER TABLE "companys" ADD COLUMN     "comp_tds_applicable" TEXT;
