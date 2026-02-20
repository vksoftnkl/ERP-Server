-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "item_master" (
    "item_id" UUID NOT NULL DEFAULT uuidv7(),
    "item_branch_id" UUID,
    "item_code" VARCHAR(50),
    "item_sku" VARCHAR(60),
    "item_name_en" VARCHAR(200) NOT NULL,
    "item_name_ta" VARCHAR(200),
    "item_alias" VARCHAR(200),
    "item_stock_type" VARCHAR(20) NOT NULL DEFAULT 'FG',
    "item_default_barcode" VARCHAR(200),
    "item_group_id" UUID NOT NULL,
    "item_category_id" UUID,
    "item_brand_id" UUID,
    "item_section_id" UUID,
    "item_company_category_id" UUID,
    "item_mfgr_id" UUID,
    "item_supplier_id" UUID,
    "item_base_unit_id" UUID NOT NULL,
    "item_is_service" BOOLEAN NOT NULL DEFAULT false,
    "item_is_batch_based" BOOLEAN NOT NULL DEFAULT false,
    "item_is_expiry_item" BOOLEAN NOT NULL DEFAULT false,
    "item_expiry_days" INTEGER,
    "item_intimate_before_days" INTEGER,
    "item_allow_sales" BOOLEAN NOT NULL DEFAULT true,
    "item_allow_sales_return" BOOLEAN NOT NULL DEFAULT true,
    "item_allow_purchase" BOOLEAN NOT NULL DEFAULT true,
    "item_allow_po" BOOLEAN NOT NULL DEFAULT true,
    "item_allow_so" BOOLEAN NOT NULL DEFAULT true,
    "item_allow_neg_stock" BOOLEAN NOT NULL DEFAULT true,
    "item_allow_negative_so" BOOLEAN NOT NULL DEFAULT true,
    "item_price_list" BOOLEAN NOT NULL DEFAULT false,
    "item_weigh_scale" BOOLEAN NOT NULL DEFAULT false,
    "item_retail_item" BOOLEAN NOT NULL DEFAULT true,
    "item_is_kit" BOOLEAN NOT NULL DEFAULT false,
    "item_auto_break" BOOLEAN NOT NULL DEFAULT false,
    "item_auto_make" BOOLEAN NOT NULL DEFAULT false,
    "item_allow_loyalty" BOOLEAN NOT NULL DEFAULT false,
    "item_allow_promo" BOOLEAN NOT NULL DEFAULT false,
    "item_has_offer" BOOLEAN NOT NULL DEFAULT false,
    "item_damagable_product" BOOLEAN NOT NULL DEFAULT false,
    "item_is_demand" BOOLEAN NOT NULL DEFAULT false,
    "item_allow_loading" BOOLEAN NOT NULL DEFAULT false,
    "item_allow_freight" BOOLEAN NOT NULL DEFAULT false,
    "item_random_stock" BOOLEAN NOT NULL DEFAULT false,
    "item_barcode_sticker" BOOLEAN NOT NULL DEFAULT false,
    "item_barcode_sticker_id" UUID,
    "item_default_tax_id" UUID,
    "item_hsn_code" VARCHAR(10),
    "item_batch_config" INTEGER NOT NULL DEFAULT 0,
    "item_sort_order" INTEGER,
    "item_photo" BYTEA,
    "item_image_url" TEXT,
    "item_notes" VARCHAR(250),
    "item_storage_location" VARCHAR(250),
    "item_packing_item_ids" UUID[],
    "item_is_active" BOOLEAN NOT NULL DEFAULT true,
    "item_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "item_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_created_by" VARCHAR(100),
    "item_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_modified_by" VARCHAR(100),

    CONSTRAINT "item_master_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "item_price_master" (
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
CREATE TABLE "item_qtywise_rates" (
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
CREATE TABLE "item_reorders" (
    "ir_id" UUID NOT NULL DEFAULT uuidv7(),
    "ir_branch_id" UUID,
    "ir_item_id" UUID NOT NULL,
    "ir_unit_id" UUID NOT NULL,
    "ir_godown_id" UUID,
    "ir_min_level" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ir_max_level" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ir_reorder_level" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ir_reorder_qty" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ir_lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "ir_review_cycle_days" INTEGER NOT NULL DEFAULT 0,
    "ir_reorder_days" INTEGER NOT NULL DEFAULT 0,
    "ir_expiry_buffer_days" INTEGER NOT NULL DEFAULT 0,
    "ir_reorder_type" VARCHAR(20) NOT NULL DEFAULT 'MIN_MAX',
    "ir_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ir_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ir_remarks" VARCHAR(250),
    "ir_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ir_created_by" VARCHAR(100),
    "ir_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ir_modified_by" VARCHAR(100),

    CONSTRAINT "item_reorders_pkey" PRIMARY KEY ("ir_id")
);

-- CreateTable
CREATE TABLE "item_tax_history" (
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

-- CreateTable
CREATE TABLE "item_tax_master" (
    "tax_id" UUID NOT NULL DEFAULT uuidv7(),
    "tax_name" VARCHAR(100) NOT NULL,
    "tax_code" VARCHAR(30),
    "tax_taxability_type" VARCHAR(30) NOT NULL DEFAULT 'TAXABLE',
    "tax_is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "tax_cgst_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_sgst_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_igst_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_cgst_pur_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_sgst_pur_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_igst_pur_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_cess_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "tax_cess_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_cess_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "tax_cess_pur_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_cess_pur_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "tax_gst_rate_total" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_sales_ledger_id" UUID,
    "tax_sales_return_ledger_id" UUID,
    "tax_purchase_ledger_id" UUID,
    "tax_purchase_return_ledger_id" UUID,
    "tax_cgst_output_ledger_id" UUID,
    "tax_sgst_output_ledger_id" UUID,
    "tax_igst_output_ledger_id" UUID,
    "tax_cess_output_ledger_id" UUID,
    "tax_cgst_input_ledger_id" UUID,
    "tax_sgst_input_ledger_id" UUID,
    "tax_igst_input_ledger_id" UUID,
    "tax_cess_input_ledger_id" UUID,
    "tax_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tax_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tax_sync_date" TIMESTAMPTZ(6),
    "tax_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tax_created_by" VARCHAR(100),
    "tax_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tax_modified_by" VARCHAR(100),

    CONSTRAINT "item_tax_master_pkey" PRIMARY KEY ("tax_id")
);

-- CreateIndex
CREATE INDEX "idx_item_group" ON "item_master"("item_group_id");

-- CreateIndex
CREATE INDEX "idx_item_name_en" ON "item_master"("item_name_en");

-- CreateIndex
CREATE INDEX "idx_item_barcode" ON "item_master"("item_default_barcode");

-- CreateIndex
CREATE UNIQUE INDEX "uq_item_name_en_global" ON "item_master"("item_name_en");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ipm_item_unit_godown" ON "item_price_master"("ipm_item_id", "ipm_unit_id", "ipm_godown_id");

-- CreateIndex
CREATE INDEX "idx_iqr_unit_rate" ON "item_qtywise_rates"("iqr_unit_rate_id");

-- CreateIndex
CREATE INDEX "idx_iqr_branch" ON "item_qtywise_rates"("iqr_branch_id");

-- CreateIndex
CREATE INDEX "idx_iqr_active_deleted" ON "item_qtywise_rates"("iqr_is_deleted", "iqr_is_active");

-- CreateIndex
CREATE INDEX "idx_ir_item" ON "item_reorders"("ir_item_id");

-- CreateIndex
CREATE INDEX "idx_ir_unit" ON "item_reorders"("ir_unit_id");

-- CreateIndex
CREATE INDEX "idx_ir_godown" ON "item_reorders"("ir_godown_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ir_item_unit_godown" ON "item_reorders"("ir_item_id", "ir_unit_id", "ir_godown_id");

-- CreateIndex
CREATE INDEX "idx_ith_item_dates" ON "item_tax_history"("ith_item_id", "ith_effective_from", "ith_effective_to");

-- CreateIndex
CREATE INDEX "idx_tax_active" ON "item_tax_master"("tax_is_active");

-- CreateIndex
CREATE INDEX "idx_tax_rate_total" ON "item_tax_master"("tax_gst_rate_total");

-- CreateIndex
CREATE INDEX "idx_tax_sales_ledger" ON "item_tax_master"("tax_sales_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tax_cgst_out" ON "item_tax_master"("tax_cgst_output_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tax_sgst_out" ON "item_tax_master"("tax_sgst_output_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tax_igst_out" ON "item_tax_master"("tax_igst_output_ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tax_name_global" ON "item_tax_master"("tax_name");

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_item_group_id_fkey" FOREIGN KEY ("item_group_id") REFERENCES "item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_item_base_unit_id_fkey" FOREIGN KEY ("item_base_unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_item_default_tax_id_fkey" FOREIGN KEY ("item_default_tax_id") REFERENCES "item_tax_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_price_master" ADD CONSTRAINT "item_price_master_ipm_item_id_fkey" FOREIGN KEY ("ipm_item_id") REFERENCES "item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_price_master" ADD CONSTRAINT "item_price_master_ipm_unit_id_fkey" FOREIGN KEY ("ipm_unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_qtywise_rates" ADD CONSTRAINT "item_qtywise_rates_iqr_unit_rate_id_fkey" FOREIGN KEY ("iqr_unit_rate_id") REFERENCES "item_price_master"("ipm_unit_rate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_reorders" ADD CONSTRAINT "item_reorders_ir_item_id_fkey" FOREIGN KEY ("ir_item_id") REFERENCES "item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_reorders" ADD CONSTRAINT "item_reorders_ir_unit_id_fkey" FOREIGN KEY ("ir_unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tax_history" ADD CONSTRAINT "item_tax_history_ith_item_id_fkey" FOREIGN KEY ("ith_item_id") REFERENCES "item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tax_history" ADD CONSTRAINT "item_tax_history_ith_tax_id_fkey" FOREIGN KEY ("ith_tax_id") REFERENCES "item_tax_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;
