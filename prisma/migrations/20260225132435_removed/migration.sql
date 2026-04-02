/*
  Warnings:

  - You are about to drop the column `category_default_hsn` on the `category_master` table. All the data in the column will be lost.
  - You are about to drop the column `category_default_tax_id` on the `category_master` table. All the data in the column will be lost.
  - You are about to drop the column `category_default_uom_id` on the `category_master` table. All the data in the column will be lost.
  - You are about to drop the column `category_tax_claim` on the `category_master` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "category_master" DROP COLUMN "category_default_hsn",
DROP COLUMN "category_default_tax_id",
DROP COLUMN "category_default_uom_id",
DROP COLUMN "category_tax_claim",
ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "purchase"."suppliers" ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;
