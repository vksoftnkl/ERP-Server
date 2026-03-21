/*
  Warnings:

  - The `led_gst_party_reg_type` column on the `acc_ledger_master` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `led_ob_type` column on the `acc_ledger_master` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[led_company_id,led_name]` on the table `acc_ledger_master` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[led_company_id,led_tally_name]` on the table `acc_ledger_master` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `led_branch_id` to the `acc_ledger_master` table without a default value. This is not possible if the table is not empty.
  - Made the column `led_company_id` on table `acc_ledger_master` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "accounts"."LedGstPartyRegType" AS ENUM ('REGULAR', 'COMPOSITION', 'UNREGISTERED');

-- CreateEnum
CREATE TYPE "accounts"."LedObType" AS ENUM ('DR', 'CR');

-- AlterTable
ALTER TABLE "accounts"."acc_ledger_master" ADD COLUMN     "led_branch_id" UUID NOT NULL,
ADD COLUMN     "led_region_name" TEXT,
ADD COLUMN     "led_total_balance" DECIMAL NOT NULL DEFAULT 0,
ADD COLUMN     "led_total_cr" DECIMAL NOT NULL DEFAULT 0,
ADD COLUMN     "led_total_dr" DECIMAL NOT NULL DEFAULT 0,
DROP COLUMN "led_gst_party_reg_type",
ADD COLUMN     "led_gst_party_reg_type" "accounts"."LedGstPartyRegType",
DROP COLUMN "led_ob_type",
ADD COLUMN     "led_ob_type" "accounts"."LedObType" NOT NULL DEFAULT 'DR',
ALTER COLUMN "led_company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

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

-- CreateIndex
CREATE INDEX "idx_led_branch_id" ON "accounts"."acc_ledger_master"("led_branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "acc_ledger_master_led_company_id_led_name_key" ON "accounts"."acc_ledger_master"("led_company_id", "led_name");

-- CreateIndex
CREATE UNIQUE INDEX "acc_ledger_master_led_company_id_led_tally_name_key" ON "accounts"."acc_ledger_master"("led_company_id", "led_tally_name");

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_branch_id_fkey" FOREIGN KEY ("led_branch_id") REFERENCES "accounts"."branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;
