/*
  Warnings:

  - You are about to drop the `salesman_master` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sales"."customers" DROP CONSTRAINT "customers_cus_default_salesman_fkey";

-- DropForeignKey
ALTER TABLE "sales"."sale_quotation" DROP CONSTRAINT "fk_sq_salesman";

-- DropForeignKey
ALTER TABLE "sales"."salesman_master" DROP CONSTRAINT "salesman_master_sman_group_id_fkey";

-- DropTable
DROP TABLE "sales"."salesman_master";
