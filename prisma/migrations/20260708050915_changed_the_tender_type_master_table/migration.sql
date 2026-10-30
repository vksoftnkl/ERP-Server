-- CreateTable
CREATE TABLE "sales"."quotation_master" (
    "quotation_id" UUID NOT NULL DEFAULT uuidv7(),
    "quotation_company_id" UUID NOT NULL,
    "quotation_site_id" UUID NOT NULL,
    "quotation_financial_year" VARCHAR(9) NOT NULL,
    "quotation_no" VARCHAR(30) NOT NULL,
    "quotation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotation_expiry_date" DATE,
    "quotation_customer_ledger_id" UUID,
    "quotation_customer_name" VARCHAR(150) NOT NULL,
    "quotation_place" VARCHAR(120),
    "quotation_mobile_no" VARCHAR(20),
    "quotation_state_id" UUID,
    "quotation_gst_no" VARCHAR(15),
    "quotation_area_id" UUID,
    "quotation_salesman_id" UUID,
    "quotation_price_level_id" INTEGER NOT NULL,
    "quotation_freight_flag" BOOLEAN NOT NULL DEFAULT false,
    "quotation_loading_flag" BOOLEAN NOT NULL DEFAULT false,
    "quotation_unloading_flag" BOOLEAN NOT NULL DEFAULT false,
    "quotation_promotion_flag" BOOLEAN NOT NULL DEFAULT false,
    "quotation_loyalty_flag" BOOLEAN NOT NULL DEFAULT false,
    "quotation_sub_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_total_tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_freight_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_loading_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_unloading_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_other_charge" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_cd_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "quotation_cd_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_grand_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_remarks" VARCHAR(500),
    "quotation_status" VARCHAR(12) NOT NULL DEFAULT 'SAVED',
    "quotation_converted_so_id" UUID,
    "quotation_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "quotation_is_active" BOOLEAN NOT NULL DEFAULT true,
    "quotation_sync_date" TIMESTAMPTZ,
    "quotation_created_by" TEXT,
    "quotation_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotation_modified_by" TEXT,
    "quotation_modified_at" TIMESTAMPTZ,

    CONSTRAINT "quotation_master_pkey" PRIMARY KEY ("quotation_id")
);

-- CreateTable
CREATE TABLE "sales"."quotation_detail" (
    "quotation_detail_id" UUID NOT NULL DEFAULT uuidv7(),
    "quotation_id" UUID NOT NULL,
    "quotation_detail_line_no" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "quotation_detail_description" VARCHAR(200) NOT NULL,
    "stock_snapshot" DECIMAL(18,3),
    "quotation_detail_qty" DECIMAL(18,3) NOT NULL,
    "uom_id" UUID NOT NULL,
    "quotation_detail_rate" DECIMAL(18,4) NOT NULL,
    "quotation_detail_discount_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "quotation_detail_discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_detail_taxable_value" DECIMAL(18,2) NOT NULL,
    "quotation_detail_tax_code_id" UUID,
    "quotation_detail_gst_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "quotation_detail_cgst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_detail_sgst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_detail_igst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_detail_cess_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quotation_detail_line_total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "quotation_detail_pkey" PRIMARY KEY ("quotation_detail_id")
);

-- CreateTable
CREATE TABLE "sales"."salesman_master" (
    "sman_id" UUID NOT NULL DEFAULT uuidv7(),
    "sman_company_id" UUID,
    "sman_branch_id" UUID,
    "sman_group_id" UUID,
    "sman_code" VARCHAR(50),
    "sman_name" VARCHAR(150) NOT NULL,
    "sman_short" VARCHAR(50),
    "sman_mobile" VARCHAR(20),
    "sman_email" VARCHAR(120),
    "sman_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sman_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sman_sync_date" TIMESTAMPTZ(6),
    "sman_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sman_created_by" UUID,
    "sman_modified_on" TIMESTAMPTZ(6),
    "sman_modified_by" UUID,

    CONSTRAINT "salesman_master_pkey" PRIMARY KEY ("sman_id")
);

-- CreateIndex
CREATE INDEX "quotation_master_quotation_customer_ledger_id_idx" ON "sales"."quotation_master"("quotation_customer_ledger_id");

-- CreateIndex
CREATE INDEX "quotation_master_quotation_site_id_quotation_date_idx" ON "sales"."quotation_master"("quotation_site_id", "quotation_date");

-- CreateIndex
CREATE INDEX "quotation_master_quotation_salesman_id_quotation_status_idx" ON "sales"."quotation_master"("quotation_salesman_id", "quotation_status");

-- CreateIndex
CREATE INDEX "quotation_master_quotation_expiry_date_quotation_status_idx" ON "sales"."quotation_master"("quotation_expiry_date", "quotation_status");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_master_quotation_company_id_quotation_site_id_quo_key" ON "sales"."quotation_master"("quotation_company_id", "quotation_site_id", "quotation_financial_year", "quotation_no");

-- CreateIndex
CREATE INDEX "quotation_detail_item_id_idx" ON "sales"."quotation_detail"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_detail_quotation_id_quotation_detail_line_no_key" ON "sales"."quotation_detail"("quotation_id", "quotation_detail_line_no");

-- CreateIndex
CREATE INDEX "idx_salesman_name" ON "sales"."salesman_master"("sman_name");

-- CreateIndex
CREATE INDEX "idx_salesman_group" ON "sales"."salesman_master"("sman_group_id");

-- CreateIndex
CREATE INDEX "idx_salesman_active_deleted" ON "sales"."salesman_master"("sman_is_active", "sman_is_deleted");

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_default_salesman_fkey" FOREIGN KEY ("cus_default_salesman") REFERENCES "sales"."salesman_master"("sman_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_master" ADD CONSTRAINT "quotation_master_quotation_customer_ledger_id_fkey" FOREIGN KEY ("quotation_customer_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_master" ADD CONSTRAINT "quotation_master_quotation_state_id_fkey" FOREIGN KEY ("quotation_state_id") REFERENCES "sales"."state_master"("stm_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_master" ADD CONSTRAINT "quotation_master_quotation_area_id_fkey" FOREIGN KEY ("quotation_area_id") REFERENCES "sales"."area_master"("arm_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_master" ADD CONSTRAINT "quotation_master_quotation_salesman_id_fkey" FOREIGN KEY ("quotation_salesman_id") REFERENCES "sales"."salesman_master"("sman_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_master" ADD CONSTRAINT "quotation_master_quotation_price_level_id_fkey" FOREIGN KEY ("quotation_price_level_id") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_detail" ADD CONSTRAINT "quotation_detail_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotation_master"("quotation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_detail" ADD CONSTRAINT "quotation_detail_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_detail" ADD CONSTRAINT "quotation_detail_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."quotation_detail" ADD CONSTRAINT "quotation_detail_quotation_detail_tax_code_id_fkey" FOREIGN KEY ("quotation_detail_tax_code_id") REFERENCES "inventory"."item_tax_master"("tax_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."salesman_master" ADD CONSTRAINT "salesman_master_sman_group_id_fkey" FOREIGN KEY ("sman_group_id") REFERENCES "sales"."sale_agent_groups"("sa_grp_id") ON DELETE SET NULL ON UPDATE CASCADE;
