/*
  Warnings:

  - You are about to drop the `item_ean_codes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_price_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_qtywise_rates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_tax_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "item_ean_codes" DROP CONSTRAINT "item_ean_codes_ean_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "item_price_master" DROP CONSTRAINT "item_price_master_ipm_item_id_fkey";

-- DropForeignKey
ALTER TABLE "item_price_master" DROP CONSTRAINT "item_price_master_ipm_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "item_qtywise_rates" DROP CONSTRAINT "item_qtywise_rates_iqr_unit_rate_id_fkey";

-- DropForeignKey
ALTER TABLE "item_tax_history" DROP CONSTRAINT "item_tax_history_ith_item_id_fkey";

-- DropForeignKey
ALTER TABLE "item_tax_history" DROP CONSTRAINT "item_tax_history_ith_tax_id_fkey";

-- AlterTable
ALTER TABLE "inventory"."category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."item_master" ADD COLUMN     "item_cust_group" UUID;

-- AlterTable
ALTER TABLE "inventory"."item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "user_code" SET DEFAULT 'us' || nextval('user_code_seq');

-- AlterTable
ALTER TABLE "purchase"."suppliers" ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;

-- DropTable
DROP TABLE "item_ean_codes";

-- DropTable
DROP TABLE "item_price_master";

-- DropTable
DROP TABLE "item_qtywise_rates";

-- DropTable
DROP TABLE "item_tax_history";

-- CreateTable
CREATE TABLE "inventory"."item_ean_codes" (
    "ean_id" UUID NOT NULL DEFAULT uuidv7(),
    "ean_item_id" UUID NOT NULL,
    "ean_unit_id" UUID NOT NULL,
    "ean_code" VARCHAR(64) NOT NULL,
    "ean_godown_id" UUID,
    "ean_is_default" BOOLEAN NOT NULL DEFAULT false,
    "ean_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ean_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ean_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ean_created_by" VARCHAR(100),
    "ean_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ean_modified_by" VARCHAR(100),
    "ean_remarks" VARCHAR(250),

    CONSTRAINT "item_ean_codes_pkey" PRIMARY KEY ("ean_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_price_master" (
    "ipm_unit_rate_id" UUID NOT NULL DEFAULT uuidv7(),
    "ipm_item_id" UUID NOT NULL,
    "ipm_unit_id" UUID NOT NULL,
    "ipm_godown_id" UUID,
    "ipm_unit_slno" INTEGER NOT NULL DEFAULT 0,
    "ipm_conversion_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "ipm_cost_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_cost_wot" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_sales_price_a" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_sales_price_b" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_sales_price_c" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_sales_price_d" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_a_wot" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_b_wot" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_c_wot" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_d_wot" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_a_margin" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_b_margin" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_c_margin" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_price_d_margin" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_max_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_min_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "ipm_disc_qty" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_addl_cess" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_profit_type" VARCHAR(20) NOT NULL,
    "ipm_round_off" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ipm_big_unit" BOOLEAN NOT NULL DEFAULT false,
    "ipm_uom_weight" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_loading_charge" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_freight_charge" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ipm_remarks" VARCHAR(250),
    "ipm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ipm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipm_created_by" VARCHAR(100),
    "ipm_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipm_modified_by" VARCHAR(100),

    CONSTRAINT "item_price_master_pkey" PRIMARY KEY ("ipm_unit_rate_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_qtywise_rates" (
    "iqr_id" UUID NOT NULL DEFAULT uuidv7(),
    "iqr_branch_id" UUID,
    "iqr_unit_rate_id" UUID NOT NULL,
    "iqr_price_level" INTEGER NOT NULL,
    "iqr_start_qty" DECIMAL(15,4) NOT NULL,
    "iqr_end_qty" DECIMAL(15,4),
    "iqr_each_qty" DECIMAL(15,4) NOT NULL,
    "iqr_sales_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "iqr_price_wot" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "iqr_price_margin" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "iqr_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "iqr_disc_qty" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "iqr_valid_from" DATE,
    "iqr_valid_to" DATE,
    "iqr_priority" INTEGER NOT NULL DEFAULT 0,
    "iqr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "iqr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "iqr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iqr_created_by" VARCHAR(100),
    "iqr_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iqr_modified_by" VARCHAR(100),
    "iqr_remarks" VARCHAR(250),

    CONSTRAINT "item_qtywise_rates_pkey" PRIMARY KEY ("iqr_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_tax_history" (
    "ith_id" UUID NOT NULL DEFAULT uuidv7(),
    "ith_item_id" UUID NOT NULL,
    "ith_tax_id" UUID NOT NULL,
    "ith_effective_from" DATE NOT NULL,
    "ith_effective_to" DATE,
    "ith_reason" VARCHAR(250),
    "ith_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ith_created_by" VARCHAR(100),

    CONSTRAINT "item_tax_history_pkey" PRIMARY KEY ("ith_id")
);

-- CreateIndex
CREATE INDEX "idx_ean_code" ON "inventory"."item_ean_codes"("ean_code");

-- CreateIndex
CREATE INDEX "idx_ean_item" ON "inventory"."item_ean_codes"("ean_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ean_code" ON "inventory"."item_ean_codes"("ean_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ipm_item_unit_godown" ON "inventory"."item_price_master"("ipm_item_id", "ipm_unit_id", "ipm_godown_id");

-- CreateIndex
CREATE INDEX "idx_iqr_unit_rate" ON "inventory"."item_qtywise_rates"("iqr_unit_rate_id");

-- CreateIndex
CREATE INDEX "idx_iqr_branch" ON "inventory"."item_qtywise_rates"("iqr_branch_id");

-- CreateIndex
CREATE INDEX "idx_iqr_active_deleted" ON "inventory"."item_qtywise_rates"("iqr_is_deleted", "iqr_is_active");

-- CreateIndex
CREATE INDEX "idx_ith_item_dates" ON "inventory"."item_tax_history"("ith_item_id", "ith_effective_from", "ith_effective_to");

-- AddForeignKey
ALTER TABLE "inventory"."item_ean_codes" ADD CONSTRAINT "item_ean_codes_ean_unit_id_fkey" FOREIGN KEY ("ean_unit_id") REFERENCES "inventory"."units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "item_price_master_ipm_item_id_fkey" FOREIGN KEY ("ipm_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "item_price_master_ipm_unit_id_fkey" FOREIGN KEY ("ipm_unit_id") REFERENCES "inventory"."units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qtywise_rates" ADD CONSTRAINT "item_qtywise_rates_iqr_unit_rate_id_fkey" FOREIGN KEY ("iqr_unit_rate_id") REFERENCES "inventory"."item_price_master"("ipm_unit_rate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_tax_history" ADD CONSTRAINT "item_tax_history_ith_item_id_fkey" FOREIGN KEY ("ith_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_tax_history" ADD CONSTRAINT "item_tax_history_ith_tax_id_fkey" FOREIGN KEY ("ith_tax_id") REFERENCES "inventory"."item_tax_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;
