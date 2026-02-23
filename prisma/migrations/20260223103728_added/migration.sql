/*
  Warnings:

  - The primary key for the `branch_master` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `br_id` column on the `branch_master` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `item_company_id` to the `item_master` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accounts"."branch_master" DROP CONSTRAINT "branch_master_pkey",
DROP COLUMN "br_id",
ADD COLUMN     "br_id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "branch_master_pkey" PRIMARY KEY ("br_id");

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_master" ADD COLUMN     "item_company_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "purchase"."suppliers" ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_item_company_id_fkey" FOREIGN KEY ("item_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
