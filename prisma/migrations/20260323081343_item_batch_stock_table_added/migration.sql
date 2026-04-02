-- CreateTable
CREATE TABLE "inventory"."item_batch_stock" (
    "ibs_id" UUID NOT NULL DEFAULT uuidv7(),
    "ibs_acc_year" VARCHAR(9) NOT NULL,
    "ibs_company_id" UUID NOT NULL,
    "ibs_branch_id" UUID NOT NULL,
    "ibs_godown_id" UUID NOT NULL,
    "ibs_item_id" UUID NOT NULL,
    "ibs_unit_id" UUID NOT NULL,
    "ibs_batch_id" UUID NOT NULL,
    "ibs_batch_no" VARCHAR(100),
    "ibs_serial_no" VARCHAR(100),
    "ibs_mfg_date" DATE,
    "ibs_expiry_date" DATE,
    "ibs_mrp" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_stock_bucket" "inventory"."ItemStockBucket" NOT NULL DEFAULT 'SALEABLE',
    "ibs_opening_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_out_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_closing_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_opening_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_free_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_free_out_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_free_closing_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_reserved_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_available_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_opening_avg_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_avg_stock_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ibs_opening_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ibs_stock_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ibs_last_in_date" DATE,
    "ibs_last_out_date" DATE,
    "ibs_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ibs_is_deleted" BOOLEAN NOT NULL DEFAULT true,
    "ibs_row_version" BIGINT NOT NULL DEFAULT 1,
    "ibs_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ibs_created_by" UUID,
    "ibs_updated_on" TIMESTAMPTZ(6),
    "ibs_updated_by" UUID,

    CONSTRAINT "item_batch_stock_pkey" PRIMARY KEY ("ibs_id")
);

-- CreateIndex
CREATE INDEX "idx_ibs_item" ON "inventory"."item_batch_stock"("ibs_acc_year", "ibs_company_id", "ibs_branch_id", "ibs_item_id");

-- CreateIndex
CREATE INDEX "idx_ibs_batch" ON "inventory"."item_batch_stock"("ibs_acc_year", "ibs_company_id", "ibs_branch_id", "ibs_godown_id", "ibs_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ibs_scope" ON "inventory"."item_batch_stock"("ibs_acc_year", "ibs_company_id", "ibs_branch_id", "ibs_godown_id", "ibs_item_id", "ibs_batch_id", "ibs_stock_bucket");

-- AddForeignKey
ALTER TABLE "inventory"."item_batch_stock" ADD CONSTRAINT "fk_ibs_batch" FOREIGN KEY ("ibs_batch_id") REFERENCES "inventory"."item_batch_master"("btm_id") ON DELETE RESTRICT ON UPDATE CASCADE;
