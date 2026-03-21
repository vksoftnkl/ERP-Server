/*
  Warnings:

  - You are about to drop the column `sec_company_id` on the `item_section_master` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_sec_company_id";

-- DropIndex
DROP INDEX "uq_sec_name_per_company";

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" DROP COLUMN "sec_company_id",
ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];
