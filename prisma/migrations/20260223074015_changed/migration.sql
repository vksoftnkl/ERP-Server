/*
  Warnings:

  - The `lba_company_id` column on the `acc_ledger_bank_accounts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `led_company_id` column on the `acc_ledger_master` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `saa_company_id` column on the `acc_ship_addrs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `acc_group_company_id` column on the `account_groups` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `companys` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `comp_id` column on the `companys` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `cgr_company_id` column on the `cust_groups` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `comp_id` on the `branch_master` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `csg_company_id` on the `gsp_company_service` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `emp_company_id` on the `emp_master` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "accounts"."acc_ledger_bank_accounts" DROP CONSTRAINT "acc_ledger_bank_accounts_lba_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts"."acc_ledger_master" DROP CONSTRAINT "acc_ledger_master_led_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" DROP CONSTRAINT "acc_ship_addrs_saa_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts"."account_groups" DROP CONSTRAINT "account_groups_acc_group_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts"."branch_master" DROP CONSTRAINT "branch_master_comp_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts"."gsp_company_service" DROP CONSTRAINT "gsp_company_service_csg_company_id_fkey";

-- DropForeignKey
ALTER TABLE "sales"."cust_groups" DROP CONSTRAINT "cust_groups_cgr_company_id_fkey";

-- DropForeignKey
ALTER TABLE "sales"."emp_master" DROP CONSTRAINT "emp_master_emp_company_id_fkey";

-- AlterTable
ALTER TABLE "accounts"."acc_ledger_bank_accounts" DROP COLUMN "lba_company_id",
ADD COLUMN     "lba_company_id" UUID;

-- AlterTable
ALTER TABLE "accounts"."acc_ledger_master" DROP COLUMN "led_company_id",
ADD COLUMN     "led_company_id" UUID;

-- AlterTable
ALTER TABLE "accounts"."acc_ship_addrs" DROP COLUMN "saa_company_id",
ADD COLUMN     "saa_company_id" UUID;

-- AlterTable
ALTER TABLE "accounts"."account_groups" DROP COLUMN "acc_group_company_id",
ADD COLUMN     "acc_group_company_id" UUID;

-- AlterTable
ALTER TABLE "accounts"."branch_master" DROP COLUMN "comp_id",
ADD COLUMN     "comp_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "accounts"."companys" DROP CONSTRAINT "companys_pkey",
DROP COLUMN "comp_id",
ADD COLUMN     "comp_id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "companys_pkey" PRIMARY KEY ("comp_id");

-- AlterTable
ALTER TABLE "accounts"."gsp_company_service" DROP COLUMN "csg_company_id",
ADD COLUMN     "csg_company_id" UUID NOT NULL;

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
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0,
DROP COLUMN "cgr_company_id",
ADD COLUMN     "cgr_company_id" UUID;

-- AlterTable
ALTER TABLE "sales"."emp_master" DROP COLUMN "emp_company_id",
ADD COLUMN     "emp_company_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "idx_lba_company" ON "accounts"."acc_ledger_bank_accounts"("lba_company_id");

-- CreateIndex
CREATE INDEX "idx_led_company_id" ON "accounts"."acc_ledger_master"("led_company_id");

-- CreateIndex
CREATE INDEX "idx_saa_company" ON "accounts"."acc_ship_addrs"("saa_company_id");

-- CreateIndex
CREATE INDEX "idx_acc_group_company_id" ON "accounts"."account_groups"("acc_group_company_id");

-- CreateIndex
CREATE INDEX "idx_branch_comp_id" ON "accounts"."branch_master"("comp_id");

-- CreateIndex
CREATE INDEX "idx_gsp_company_service_company" ON "accounts"."gsp_company_service"("csg_company_id");

-- CreateIndex
CREATE INDEX "idx_cgr_company" ON "sales"."cust_groups"("cgr_company_id");

-- CreateIndex
CREATE INDEX "idx_cgr_active" ON "sales"."cust_groups"("cgr_company_id", "cgr_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_company" ON "sales"."emp_master"("emp_company_id");

-- AddForeignKey
ALTER TABLE "accounts"."account_groups" ADD CONSTRAINT "account_groups_acc_group_company_id_fkey" FOREIGN KEY ("acc_group_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_company_id_fkey" FOREIGN KEY ("led_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."branch_master" ADD CONSTRAINT "branch_master_comp_id_fkey" FOREIGN KEY ("comp_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."emp_master" ADD CONSTRAINT "emp_master_emp_company_id_fkey" FOREIGN KEY ("emp_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."gsp_company_service" ADD CONSTRAINT "gsp_company_service_csg_company_id_fkey" FOREIGN KEY ("csg_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" ADD CONSTRAINT "acc_ship_addrs_saa_company_id_fkey" FOREIGN KEY ("saa_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_bank_accounts" ADD CONSTRAINT "acc_ledger_bank_accounts_lba_company_id_fkey" FOREIGN KEY ("lba_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."cust_groups" ADD CONSTRAINT "cust_groups_cgr_company_id_fkey" FOREIGN KEY ("cgr_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
