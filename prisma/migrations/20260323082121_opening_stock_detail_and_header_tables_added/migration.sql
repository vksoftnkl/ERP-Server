-- CreateEnum
CREATE TYPE "inventory"."OpeningStockDetailTrackingType" AS ENUM ('NONE', 'BATCH', 'LOT');
-- CreateEnum
CREATE TYPE "inventory"."OpeningStockDetailCessType" AS ENUM ('NONE', 'PERCENT', 'PER_UNIT');
-- CreateEnum
CREATE TYPE "inventory"."OpeningStockStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "inventory"."OpeningStockDeviceType" AS ENUM ('PC', 'MOBILE', 'WEB');
-- CreateTable
CREATE TABLE "inventory"."opening_stock_detail" (
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
    "osl_tracking_type" "inventory"."OpeningStockDetailTrackingType" NOT NULL DEFAULT 'NONE',
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
    "osl_conv_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "osl_tax_id" UUID,
    "osl_tax_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "osl_cess_type" "inventory"."OpeningStockDetailCessType" NOT NULL DEFAULT 'NONE',
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
CREATE TABLE "inventory"."opening_stock_header" (
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
    "osh_status" "inventory"."OpeningStockStatus" NOT NULL DEFAULT 'DRAFT',
    "osh_user_id" UUID NOT NULL,
    "osh_session_id" UUID,
    "osh_device_type" "inventory"."OpeningStockDeviceType" NOT NULL,
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
CREATE INDEX "idx_opening_stock_detail_opening" ON "inventory"."opening_stock_detail"("osl_company_id", "osl_branch_id", "osl_acc_year", "osl_opening_id");
-- CreateIndex
CREATE UNIQUE INDEX "uq_opening_stock_detail_voucher_line" ON "inventory"."opening_stock_detail"("osl_company_id", "osl_branch_id", "osl_acc_year", "osl_voucher_id", "osl_line_no");
-- CreateIndex
CREATE INDEX "idx_opening_stock_header_date" ON "inventory"."opening_stock_header"("osh_acc_year", "osh_company_id", "osh_branch_id", "osh_voucher_date");
-- CreateIndex
CREATE UNIQUE INDEX "uq_opening_stock_header_voucher_id" ON "inventory"."opening_stock_header"("osh_acc_year", "osh_company_id", "osh_branch_id", "osh_voucher_id");
-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail" ADD CONSTRAINT "fk_osl_opening_header" FOREIGN KEY ("osl_opening_id") REFERENCES "inventory"."opening_stock_header"("osh_id") ON DELETE RESTRICT ON UPDATE CASCADE;
