/*
  Warnings:

  - You are about to drop the column `cgr_created_by` on the `cust_groups` table. All the data in the column will be lost.
  - You are about to drop the column `cgr_modified_by` on the `cust_groups` table. All the data in the column will be lost.
  - You are about to drop the column `cgr_sync_date` on the `cust_groups` table. All the data in the column will be lost.
  - Made the column `cgr_order` on table `cust_groups` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "sales"."idx_cgr_active";

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "sales"."cust_groups" DROP COLUMN "cgr_created_by",
DROP COLUMN "cgr_modified_by",
DROP COLUMN "cgr_sync_date",
ADD COLUMN     "cgr_company_id" INTEGER,
ALTER COLUMN "cgr_name" SET DATA TYPE VARCHAR,
ALTER COLUMN "cgr_alias" SET DATA TYPE VARCHAR,
ALTER COLUMN "cgr_order" SET NOT NULL,
ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0,
ALTER COLUMN "cgr_modified_on" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "idx_cgr_company" ON "sales"."cust_groups"("cgr_company_id");

-- CreateIndex
CREATE INDEX "idx_cgr_active" ON "sales"."cust_groups"("cgr_company_id", "cgr_is_active");

-- AddForeignKey
ALTER TABLE "sales"."cust_groups" ADD CONSTRAINT "cust_groups_cgr_company_id_fkey" FOREIGN KEY ("cgr_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
