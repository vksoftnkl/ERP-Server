/*
  Warnings:

  - A unique constraint covering the columns `[dev_company_id,dev_device_uid]` on the table `erp_device_master` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `uls_company_id` to the `user_login_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "fixed"."erp_device_master_dev_device_uid_key";

-- DropIndex
DROP INDEX "fixed"."idx_dev_allowed";

-- DropIndex
DROP INDEX "fixed"."idx_dev_login_check";

-- DropIndex
DROP INDEX "fixed"."idx_uls_active_session";

-- DropIndex
DROP INDEX "fixed"."idx_uls_device_date";

-- DropIndex
DROP INDEX "fixed"."idx_uls_user";

-- AlterTable
ALTER TABLE "fixed"."erp_device_master" ADD COLUMN     "dev_company_id" UUID;

-- AlterTable
ALTER TABLE "fixed"."user_login_sessions" ADD COLUMN     "uls_company_id" UUID NOT NULL;

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
CREATE INDEX "idx_dev_login_check" ON "fixed"."erp_device_master"("dev_company_id", "dev_device_uid");

-- CreateIndex
CREATE INDEX "idx_dev_allowed" ON "fixed"."erp_device_master"("dev_company_id", "dev_is_allowed", "dev_is_blocked");

-- CreateIndex
CREATE UNIQUE INDEX "uq_erp_device_company_uid" ON "fixed"."erp_device_master"("dev_company_id", "dev_device_uid");

-- CreateIndex
CREATE INDEX "idx_uls_active_session" ON "fixed"."user_login_sessions"("uls_company_id", "uls_user_id", "uls_login_on" DESC);

-- CreateIndex
CREATE INDEX "idx_uls_device_date" ON "fixed"."user_login_sessions"("uls_device_id", "uls_login_on" DESC);

-- AddForeignKey
ALTER TABLE "fixed"."erp_device_master" ADD CONSTRAINT "erp_device_master_dev_company_id_fkey" FOREIGN KEY ("dev_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."user_login_sessions" ADD CONSTRAINT "user_login_sessions_uls_company_id_fkey" FOREIGN KEY ("uls_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
