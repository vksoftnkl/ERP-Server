-- CreateTable
CREATE TABLE "accounts"."acc_voucher_seq" (
    "seq_id" UUID NOT NULL DEFAULT uuidv7(),
    "seq_vchr_type_id" INTEGER NOT NULL,
    "seq_company_id" UUID NOT NULL,
    "seq_branch_id" UUID NOT NULL,
    "seq_acc_year" VARCHAR(9) NOT NULL,
    "seq_device_id" UUID,
    "seq_device_code" VARCHAR(20) NOT NULL DEFAULT 'MAIN',
    "seq_period_key" VARCHAR(20) NOT NULL,
    "seq_last_no" BIGINT NOT NULL DEFAULT 0,
    "seq_voucher_prefix" VARCHAR(20),
    "seq_company_code" VARCHAR(20),
    "seq_branch_code" VARCHAR(20),
    "seq_voucher_suffix" VARCHAR(20),
    "seq_no_width" INTEGER NOT NULL DEFAULT 5,
    "seq_last_refno" VARCHAR(100),
    "seq_is_active" BOOLEAN NOT NULL DEFAULT true,
    "seq_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "seq_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq_created_by" UUID,
    "seq_modified_on" TIMESTAMPTZ,
    "seq_modified_by" UUID,

    CONSTRAINT "acc_voucher_seq_pkey" PRIMARY KEY ("seq_id")
);

-- CreateTable
CREATE TABLE "inventory"."physical_stock_batch_detail" (
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
    "psb_sync_date" TIMESTAMPTZ,
    "psb_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psb_created_by" UUID,
    "psb_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psb_modified_by" UUID,

    CONSTRAINT "physical_stock_batch_detail_pkey" PRIMARY KEY ("psb_id")
);

-- CreateTable
CREATE TABLE "inventory"."physical_stock_detail" (
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
    "psd_diff_qty" DECIMAL(18,6),
    "psd_diff_base_qty" DECIMAL(18,6),
    "psd_stock_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_stock_rate_with_tax" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psd_book_value_wot" DECIMAL(18,2),
    "psd_physical_value_wot" DECIMAL(18,2),
    "psd_diff_value_wot" DECIMAL(18,2),
    "psd_diff_value_with_tax" DECIMAL(18,2),
    "psd_reason_id" UUID,
    "psd_resolution" VARCHAR(30) NOT NULL DEFAULT 'ADJUST_LOSS_GAIN',
    "psd_notes" TEXT,
    "psd_is_posted" BOOLEAN NOT NULL DEFAULT false,
    "psd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "psd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psd_sync_date" TIMESTAMPTZ,
    "psd_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psd_created_by" UUID,
    "psd_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psd_modified_by" UUID,

    CONSTRAINT "physical_stock_detail_pkey" PRIMARY KEY ("psd_id")
);

-- CreateTable
CREATE TABLE "inventory"."physical_stock_header" (
    "psc_id" UUID NOT NULL DEFAULT uuidv7(),
    "psc_acc_year" VARCHAR(9) NOT NULL,
    "psc_company_id" UUID NOT NULL,
    "psc_branch_id" UUID NOT NULL,
    "psc_godown_id" UUID NOT NULL,
    "psc_doc_no" BIGINT NOT NULL,
    "psc_doc_refno" VARCHAR(50),
    "psc_doc_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "psc_count_type" VARCHAR(20) NOT NULL DEFAULT 'FULL',
    "psc_counted_by" UUID,
    "psc_count_started_on" TIMESTAMPTZ,
    "psc_count_completed_on" TIMESTAMPTZ,
    "psc_stock_cutoff_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_freeze_stock" BOOLEAN NOT NULL DEFAULT true,
    "psc_freeze_from" TIMESTAMPTZ,
    "psc_freeze_to" TIMESTAMPTZ,
    "psc_posting_mode" VARCHAR(30) NOT NULL DEFAULT 'ADJUST_DIFFERENCE_ONLY',
    "psc_rate_source" VARCHAR(20) NOT NULL DEFAULT 'AVG_COST',
    "psc_adjustment_voucher_id" UUID,
    "psc_total_lines" INTEGER NOT NULL DEFAULT 0,
    "psc_total_book_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "psc_total_counted_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "psc_net_variance_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "psc_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "psc_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "psc_approved_on" TIMESTAMPTZ,
    "psc_approved_by" UUID,
    "psc_posted_on" TIMESTAMPTZ,
    "psc_posted_by" UUID,
    "psc_cancelled_on" TIMESTAMPTZ,
    "psc_cancelled_by" UUID,
    "psc_cancel_reason" VARCHAR(250),
    "psc_device_type" VARCHAR(20),
    "psc_device_id" UUID,
    "psc_counter_id" VARCHAR(20),
    "psc_session_id" UUID,
    "psc_remarks" TEXT,
    "psc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "psc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psc_sync_date" TIMESTAMPTZ,
    "psc_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_created_by" UUID,
    "psc_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_modified_by" UUID,

    CONSTRAINT "physical_stock_header_pkey" PRIMARY KEY ("psc_id")
);

-- CreateTable
CREATE TABLE "inventory"."stock_adj_reason_master" (
    "sar_id" UUID NOT NULL DEFAULT uuidv7(),
    "sar_code" VARCHAR(30) NOT NULL,
    "sar_name" VARCHAR(150) NOT NULL,
    "sar_reason_kind" VARCHAR(30) NOT NULL,
    "sar_default_resolution" VARCHAR(30) NOT NULL,
    "sar_affects_accounts" BOOLEAN NOT NULL DEFAULT true,
    "sar_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sar_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sar_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sar_created_by" UUID,
    "sar_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sar_modified_by" UUID,

    CONSTRAINT "stock_adj_reason_master_pkey" PRIMARY KEY ("sar_id")
);

-- CreateIndex
CREATE INDEX "ix_physical_stock_batch_detail_parent" ON "inventory"."physical_stock_batch_detail"("psb_psd_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_batch_detail_item" ON "inventory"."physical_stock_batch_detail"("psb_company_id", "psb_branch_id", "psb_godown_id", "psb_item_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_batch_detail_batch" ON "inventory"."physical_stock_batch_detail"("psb_item_id", "psb_batch_no", "psb_mrp", "psb_barcode");

-- CreateIndex
CREATE INDEX "ix_physical_stock_batch_detail_expiry" ON "inventory"."physical_stock_batch_detail"("psb_item_id", "psb_expiry_date");

-- CreateIndex
CREATE INDEX "ix_physical_stock_batch_detail_diff" ON "inventory"."physical_stock_batch_detail"("psb_psd_id", "psb_diff_base_qty");

-- CreateIndex
CREATE UNIQUE INDEX "physical_stock_batch_detail_psb_psd_id_psb_row_no_key" ON "inventory"."physical_stock_batch_detail"("psb_psd_id", "psb_row_no");

-- CreateIndex
CREATE UNIQUE INDEX "physical_stock_batch_detail_psb_psd_id_psb_batch_id_psb_bat_key" ON "inventory"."physical_stock_batch_detail"("psb_psd_id", "psb_batch_id", "psb_batch_no", "psb_mrp", "psb_barcode", "psb_serial_no");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_header" ON "inventory"."physical_stock_detail"("psd_psc_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_item" ON "inventory"."physical_stock_detail"("psd_company_id", "psd_branch_id", "psd_godown_id", "psd_item_id");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_diff" ON "inventory"."physical_stock_detail"("psd_psc_id", "psd_diff_base_qty");

-- CreateIndex
CREATE INDEX "ix_physical_stock_detail_resolution" ON "inventory"."physical_stock_detail"("psd_psc_id", "psd_resolution");

-- CreateIndex
CREATE UNIQUE INDEX "physical_stock_detail_psd_psc_id_psd_row_no_key" ON "inventory"."physical_stock_detail"("psd_psc_id", "psd_row_no");

-- CreateIndex
CREATE UNIQUE INDEX "physical_stock_detail_psd_psc_id_psd_godown_id_psd_item_id__key" ON "inventory"."physical_stock_detail"("psd_psc_id", "psd_godown_id", "psd_item_id", "psd_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adj_reason_master_sar_code_key" ON "inventory"."stock_adj_reason_master"("sar_code");

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_seq" ADD CONSTRAINT "fk_acc_voucher_seq_voucher_type" FOREIGN KEY ("seq_vchr_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_detail" FOREIGN KEY ("psb_psd_id") REFERENCES "inventory"."physical_stock_detail"("psd_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_reason" FOREIGN KEY ("psb_reason_id") REFERENCES "inventory"."stock_adj_reason_master"("sar_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_header" FOREIGN KEY ("psd_psc_id") REFERENCES "inventory"."physical_stock_header"("psc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_reason" FOREIGN KEY ("psd_reason_id") REFERENCES "inventory"."stock_adj_reason_master"("sar_id") ON DELETE SET NULL ON UPDATE CASCADE;
