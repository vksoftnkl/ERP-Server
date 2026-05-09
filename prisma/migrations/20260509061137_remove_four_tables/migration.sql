/*
  Warnings:

  - You are about to drop the `physical_stock_batch_detail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physical_stock_detail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physical_stock_header` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_adj_reason_master` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "stock";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_base_unit";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_branch";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_company";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_detail";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_godown";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_item";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_reason";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" DROP CONSTRAINT "fk_physical_stock_batch_detail_unit";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_base_unit";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_branch";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_company";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_godown";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_header";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_item";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_reason";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_detail" DROP CONSTRAINT "fk_physical_stock_detail_unit";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_header" DROP CONSTRAINT "fk_physical_stock_header_branch";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_header" DROP CONSTRAINT "fk_physical_stock_header_company";

-- DropForeignKey
ALTER TABLE "inventory"."physical_stock_header" DROP CONSTRAINT "fk_physical_stock_header_godown";

-- DropTable
DROP TABLE "inventory"."physical_stock_batch_detail";

-- DropTable
DROP TABLE "inventory"."physical_stock_detail";

-- DropTable
DROP TABLE "inventory"."physical_stock_header";

-- DropTable
DROP TABLE "inventory"."stock_adj_reason_master";

-- CreateTable
CREATE TABLE "stock"."physical_stock_batch_detail" (
    "psb_id" UUID NOT NULL DEFAULT uuidv7(),
    "psb_psd_id" UUID NOT NULL,
    "psb_row_no" INTEGER NOT NULL DEFAULT 1,
    "psb_acc_year" VARCHAR(9) NOT NULL,
    "psb_company_id" UUID NOT NULL,
    "psb_branch_id" UUID NOT NULL,
    "psb_godown_id" UUID NOT NULL,
    "psb_item_id" UUID NOT NULL,
    "psb_unit_id" UUID NOT NULL,
    "psb_base_unit_id" UUID NOT NULL,
    "psb_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "psb_batch_id" UUID,
    "psb_batch_no" VARCHAR(100),
    "psb_mfg_batch_no" VARCHAR(100),
    "psb_batch_date" DATE,
    "psb_mfg_date" DATE,
    "psb_expiry_date" DATE,
    "psb_mrp" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_barcode" VARCHAR(100),
    "psb_serial_no" VARCHAR(100),
    "psb_book_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_book_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_physical_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_physical_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_diff_qty" DECIMAL(18,6),
    "psb_diff_base_qty" DECIMAL(18,6),
    "psb_stock_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_stock_rate_with_tax" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psb_book_value_wot" DECIMAL(18,2),
    "psb_physical_value_wot" DECIMAL(18,2),
    "psb_diff_value_wot" DECIMAL(18,2),
    "psb_diff_value_with_tax" DECIMAL(18,2),
    "psb_reason_id" UUID,
    "psb_resolution" VARCHAR(30) NOT NULL DEFAULT 'ADJUST_LOSS_GAIN',
    "psb_notes" TEXT,
    "psb_is_posted" BOOLEAN NOT NULL DEFAULT false,
    "psb_is_active" BOOLEAN NOT NULL DEFAULT true,
    "psb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psb_sync_date" TIMESTAMPTZ(6),
    "psb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psb_created_by" UUID,
    "psb_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psb_modified_by" UUID,

    CONSTRAINT "physical_stock_batch_detail_pkey" PRIMARY KEY ("psb_id")
);

-- CreateTable
CREATE TABLE "stock"."physical_stock_detail" (
    "psd_id" UUID NOT NULL DEFAULT uuidv7(),
    "psd_psc_id" UUID NOT NULL,
    "psd_row_no" INTEGER NOT NULL DEFAULT 1,
    "psd_acc_year" VARCHAR(9) NOT NULL,
    "psd_company_id" UUID NOT NULL,
    "psd_branch_id" UUID NOT NULL,
    "psd_godown_id" UUID NOT NULL,
    "psd_item_id" UUID NOT NULL,
    "psd_unit_id" UUID NOT NULL,
    "psd_base_unit_id" UUID NOT NULL,
    "psd_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "psd_barcode" VARCHAR(100),
    "psd_mrp" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_tracking_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "psd_book_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_book_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_physical_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_physical_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_diff_qty" DECIMAL(18,6) NOT NULL,
    "psd_diff_base_qty" DECIMAL(18,6) NOT NULL,
    "psd_stock_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_stock_rate_with_tax" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_book_value_wot" DECIMAL(18,2) NOT NULL,
    "psd_physical_value_wot" DECIMAL(18,2) NOT NULL,
    "psd_diff_value_wot" DECIMAL(18,2) NOT NULL,
    "psd_diff_value_with_tax" DECIMAL(18,2) NOT NULL,
    "psd_reason_id" UUID,
    "psd_resolution" VARCHAR(30) NOT NULL DEFAULT 'ADJUST_LOSS_GAIN',
    "psd_notes" TEXT,
    "psd_is_posted" BOOLEAN NOT NULL DEFAULT false,
    "psd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "psd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psd_sync_date" TIMESTAMPTZ(6),
    "psd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psd_created_by" UUID,
    "psd_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psd_modified_by" UUID,

    CONSTRAINT "physical_stock_detail_pkey" PRIMARY KEY ("psd_id")
);

-- CreateTable
CREATE TABLE "stock"."physical_stock_header" (
    "psc_id" UUID NOT NULL DEFAULT uuidv7(),
    "psc_acc_year" VARCHAR(9) NOT NULL,
    "psc_company_id" UUID NOT NULL,
    "psc_branch_id" UUID NOT NULL,
    "psc_godown_id" UUID NOT NULL,
    "psc_doc_no" BIGINT NOT NULL,
    "psc_doc_refno" VARCHAR(50),
    "psc_doc_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_count_type" VARCHAR(20) NOT NULL DEFAULT 'FULL',
    "psc_counted_by" UUID,
    "psc_count_started_on" TIMESTAMPTZ(6),
    "psc_count_completed_on" TIMESTAMPTZ(6),
    "psc_stock_cutoff_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_freeze_stock" BOOLEAN NOT NULL DEFAULT true,
    "psc_freeze_from" TIMESTAMPTZ(6),
    "psc_freeze_to" TIMESTAMPTZ(6),
    "psc_posting_mode" VARCHAR(30) NOT NULL DEFAULT 'ADJUST_DIFFERENCE_ONLY',
    "psc_rate_source" VARCHAR(20) NOT NULL DEFAULT 'AVG_COST',
    "psc_adjustment_voucher_id" UUID,
    "psc_total_lines" INTEGER NOT NULL DEFAULT 0,
    "psc_total_book_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "psc_total_counted_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "psc_net_variance_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "psc_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "psc_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "psc_approved_on" TIMESTAMPTZ(6),
    "psc_approved_by" UUID,
    "psc_posted_on" TIMESTAMPTZ(6),
    "psc_posted_by" UUID,
    "psc_cancelled_on" TIMESTAMPTZ(6),
    "psc_cancelled_by" UUID,
    "psc_cancel_reason" VARCHAR(250),
    "psc_device_type" VARCHAR(20),
    "psc_device_id" UUID,
    "psc_counter_id" VARCHAR(20),
    "psc_session_id" UUID,
    "psc_remarks" TEXT,
    "psc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "psc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psc_sync_date" TIMESTAMPTZ(6),
    "psc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_created_by" UUID NOT NULL,
    "psc_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_modified_by" UUID,

    CONSTRAINT "physical_stock_header_pkey" PRIMARY KEY ("psc_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_physical_stock_detail_psc_row" ON "stock"."physical_stock_detail"("psd_psc_id", "psd_row_no");

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_psd_id_fkey" FOREIGN KEY ("psb_psd_id") REFERENCES "stock"."physical_stock_detail"("psd_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_company_id_fkey" FOREIGN KEY ("psb_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_branch_id_fkey" FOREIGN KEY ("psb_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_godown_id_fkey" FOREIGN KEY ("psb_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_item_id_fkey" FOREIGN KEY ("psb_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_unit_id_fkey" FOREIGN KEY ("psb_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_base_unit_id_fkey" FOREIGN KEY ("psb_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_batch_detail" ADD CONSTRAINT "physical_stock_batch_detail_psb_batch_id_fkey" FOREIGN KEY ("psb_batch_id") REFERENCES "inventory"."item_batch_master"("btm_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_psc_id_fkey" FOREIGN KEY ("psd_psc_id") REFERENCES "stock"."physical_stock_header"("psc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_company_id_fkey" FOREIGN KEY ("psd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_branch_id_fkey" FOREIGN KEY ("psd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_godown_id_fkey" FOREIGN KEY ("psd_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_item_id_fkey" FOREIGN KEY ("psd_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_unit_id_fkey" FOREIGN KEY ("psd_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_base_unit_id_fkey" FOREIGN KEY ("psd_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_detail" ADD CONSTRAINT "physical_stock_detail_psd_reason_id_fkey" FOREIGN KEY ("psd_reason_id") REFERENCES "fixed"."stock_adj_reasons"("sar_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_header" ADD CONSTRAINT "physical_stock_header_psc_company_id_fkey" FOREIGN KEY ("psc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_header" ADD CONSTRAINT "physical_stock_header_psc_branch_id_fkey" FOREIGN KEY ("psc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock"."physical_stock_header" ADD CONSTRAINT "physical_stock_header_psc_godown_id_fkey" FOREIGN KEY ("psc_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
