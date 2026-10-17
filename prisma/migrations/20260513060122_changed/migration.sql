/*
  Warnings:

  - You are about to drop the `opening_stock_detail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opening_stock_header` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_base_uom_price";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_branch";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_company";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_godown";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_item";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_opening_header";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_unit";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_detail" DROP CONSTRAINT "fk_osl_voucher_header";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_header" DROP CONSTRAINT "fk_osh_branch";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_header" DROP CONSTRAINT "fk_osh_company";

-- DropForeignKey
ALTER TABLE "inventory"."opening_stock_header" DROP CONSTRAINT "fk_osh_voucher_header";

-- DropTable
DROP TABLE "inventory"."opening_stock_detail";

-- DropTable
DROP TABLE "inventory"."opening_stock_header";

-- CreateTable
CREATE TABLE "stock"."opening_stock_detail" (
    "osl_id" UUID NOT NULL DEFAULT uuidv7(),
    "osl_voucher_id" UUID NOT NULL,
    "osl_opening_id" UUID NOT NULL,
    "osl_line_no" INTEGER NOT NULL,
    "osl_acc_year" VARCHAR(9) NOT NULL,
    "osl_company_id" UUID NOT NULL,
    "osl_branch_id" UUID NOT NULL,
    "osl_item_id" UUID NOT NULL,
    "osl_unit_id" UUID NOT NULL,
    "osl_base_uom_id" UUID,
    "osl_godown_id" UUID NOT NULL,
    "osl_tracking_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "osl_batch_id" UUID,
    "osl_barcode" VARCHAR(100),
    "osl_batch_no" VARCHAR(100),
    "osl_mfg_batch_no" VARCHAR(100),
    "osl_batch_date" DATE,
    "osl_mfg_date" DATE,
    "osl_expiry_date" DATE,
    "osl_serial_no" VARCHAR(100),
    "osl_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_free_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_conv_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "osl_tax_id" UUID,
    "osl_tax_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_cess_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "osl_cess_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_cess_per_unit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_stock_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "osl_stock_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "osl_mrp_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_min_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_a" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_b" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_c" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_d" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_a_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_b_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_c_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_sale_rate_d_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osl_markup_perc_a" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_markup_perc_b" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_markup_perc_c" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_markup_perc_d" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_remarks" TEXT,
    "osl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "osl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "osl_sync_date" TIMESTAMPTZ(6),
    "osl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "osl_created_by" UUID,
    "osl_updated_on" TIMESTAMPTZ(6),
    "osl_updated_by" UUID,

    CONSTRAINT "opening_stock_detail_pkey" PRIMARY KEY ("osl_id")
);

-- CreateTable
CREATE TABLE "stock"."opening_stock_header" (
    "osh_id" UUID NOT NULL DEFAULT uuidv7(),
    "osh_voucher_id" UUID NOT NULL,
    "osh_acc_year" VARCHAR(9) NOT NULL,
    "osh_company_id" UUID NOT NULL,
    "osh_branch_id" UUID NOT NULL,
    "osh_voucher_no" BIGINT NOT NULL,
    "osh_voucher_date" DATE NOT NULL,
    "osh_ref_no" VARCHAR(50),
    "osh_narration" TEXT,
    "osh_total_lines" INTEGER NOT NULL DEFAULT 0,
    "osh_total_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "osh_total_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "osh_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "osh_user_id" UUID NOT NULL,
    "osh_session_id" UUID,
    "osh_device_type" VARCHAR(20) NOT NULL,
    "osh_device_id" UUID,
    "osh_counter_id" VARCHAR(20),
    "osh_is_active" BOOLEAN NOT NULL DEFAULT true,
    "osh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "osh_sync_date" TIMESTAMPTZ(6),
    "osh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "osh_created_by" UUID,
    "osh_updated_on" TIMESTAMPTZ(6),
    "osh_updated_by" UUID,

    CONSTRAINT "opening_stock_header_pkey" PRIMARY KEY ("osh_id")
);

-- CreateIndex
CREATE INDEX "idx_opening_stock_detail_opening" ON "stock"."opening_stock_detail"("osl_company_id", "osl_branch_id", "osl_acc_year", "osl_opening_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_opening_stock_detail_voucher_line" ON "stock"."opening_stock_detail"("osl_company_id", "osl_branch_id", "osl_acc_year", "osl_voucher_id", "osl_line_no");

-- CreateIndex
CREATE INDEX "idx_opening_stock_header_date" ON "stock"."opening_stock_header"("osh_acc_year", "osh_company_id", "osh_branch_id", "osh_voucher_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_opening_stock_header_voucher_id" ON "stock"."opening_stock_header"("osh_acc_year", "osh_company_id", "osh_branch_id", "osh_voucher_id");

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_voucher_header" FOREIGN KEY ("osl_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_company" FOREIGN KEY ("osl_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_branch" FOREIGN KEY ("osl_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_item" FOREIGN KEY ("osl_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_unit" FOREIGN KEY ("osl_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_base_uom_price" FOREIGN KEY ("osl_base_uom_id") REFERENCES "inventory"."item_price_master"("ipm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_godown" FOREIGN KEY ("osl_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_detail" ADD CONSTRAINT "fk_osl_opening_header" FOREIGN KEY ("osl_opening_id") REFERENCES "stock"."opening_stock_header"("osh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_header" ADD CONSTRAINT "fk_osh_voucher_header" FOREIGN KEY ("osh_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_header" ADD CONSTRAINT "fk_osh_company" FOREIGN KEY ("osh_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."opening_stock_header" ADD CONSTRAINT "fk_osh_branch" FOREIGN KEY ("osh_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;
