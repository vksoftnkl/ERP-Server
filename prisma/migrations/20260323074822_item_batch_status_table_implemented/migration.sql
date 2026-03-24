-- CreateEnum
CREATE TYPE "inventory"."ItemBatchStatus" AS ENUM ('ACTIVE', 'CLOSED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "inventory"."ItemStockBalanceTrackingType" AS ENUM ('NONE', 'BATCH', 'LOT');

-- CreateEnum
CREATE TYPE "inventory"."ItemStockBucket" AS ENUM ('SALEABLE', 'DAMAGED', 'EXPIRED', 'HOLD', 'RETURN');

-- CreateEnum
CREATE TYPE "inventory"."StockTrackingType" AS ENUM ('NONE', 'BATCH', 'LOT');

-- CreateEnum
CREATE TYPE "inventory"."StockTxnType" AS ENUM ('OPENING', 'PURCHASE', 'PURCHASE_RETURN', 'SALE', 'SALES_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'PRODUCTION_IN', 'CONSUMPTION', 'DAMAGE', 'EXPIRED');

-- CreateTable
CREATE TABLE "inventory"."item_batch_master" (
    "btm_id" UUID NOT NULL DEFAULT uuidv7(),
    "btm_company_id" UUID NOT NULL,
    "btm_item_id" UUID NOT NULL,
    "btm_base_unit_id" UUID NOT NULL,
    "btm_batch_no" VARCHAR(100) NOT NULL,
    "btm_mfg_batch_no" VARCHAR(100),
    "btm_batch_date" DATE,
    "btm_mfg_date" DATE,
    "btm_expiry_date" DATE,
    "btm_mrp" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "btm_last_purchase_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "btm_last_sale_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "btm_barcode" VARCHAR(100),
    "btm_status" "inventory"."ItemBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "btm_closed_on" TIMESTAMPTZ(6),
    "btm_closed_reason" VARCHAR(250),
    "btm_notes" TEXT,
    "btm_row_version" BIGINT NOT NULL DEFAULT 1,
    "btm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "btm_created_by" UUID,
    "btm_updated_on" TIMESTAMPTZ(6),
    "btm_updated_by" UUID,

    CONSTRAINT "item_batch_master_pkey" PRIMARY KEY ("btm_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_stock_balance" (
    "isb_id" UUID NOT NULL DEFAULT uuidv7(),
    "isb_acc_year" VARCHAR(9) NOT NULL,
    "isb_company_id" UUID NOT NULL,
    "isb_branch_id" UUID NOT NULL,
    "isb_godown_id" UUID NOT NULL,
    "isb_item_id" UUID NOT NULL,
    "isb_unit_id" UUID NOT NULL,
    "isb_tracking_type" "inventory"."ItemStockBalanceTrackingType" NOT NULL DEFAULT 'NONE',
    "isb_stock_bucket" "inventory"."ItemStockBucket" NOT NULL DEFAULT 'SALEABLE',
    "isb_opening_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_out_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_closing_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_opening_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_free_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_free_out_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_free_closing_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_reserved_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_transit_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_available_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_opening_avg_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_avg_stock_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_opening_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isb_stock_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isb_last_in_date" DATE,
    "isb_last_out_date" DATE,
    "isb_sync_date" TIMESTAMPTZ(6),
    "isb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isb_created_by" UUID,
    "isb_updated_on" TIMESTAMPTZ(6),
    "isb_updated_by" UUID,

    CONSTRAINT "item_stock_balance_pkey" PRIMARY KEY ("isb_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_stock_ledger" (
    "stl_id" UUID NOT NULL DEFAULT uuidv7(),
    "stl_acc_year" VARCHAR(9) NOT NULL,
    "stl_company_id" UUID NOT NULL,
    "stl_branch_id" UUID NOT NULL,
    "stl_godown_id" UUID NOT NULL,
    "stl_voucher_id" UUID NOT NULL,
    "stl_voucher_date" TIMESTAMPTZ(6) NOT NULL,
    "stl_line_no" INTEGER NOT NULL DEFAULT 1,
    "stl_split_no" INTEGER NOT NULL DEFAULT 1,
    "stl_voucher_type_id" INTEGER NOT NULL,
    "stl_txn_type" "inventory"."StockTxnType" NOT NULL,
    "stl_stock_effect" SMALLINT NOT NULL,
    "stl_doc_date" DATE NOT NULL,
    "stl_posted_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stl_doc_ref_no" VARCHAR(50),
    "stl_item_id" UUID NOT NULL,
    "stl_tracking_type" "inventory"."StockTrackingType" NOT NULL DEFAULT 'NONE',
    "stl_uom_id" UUID NOT NULL,
    "stl_base_uom_id" UUID NOT NULL,
    "stl_conversion_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "stl_batch_id" UUID,
    "stl_batch_no" VARCHAR(100),
    "stl_mfg_date" DATE,
    "stl_expiry_date" DATE,
    "stl_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_free_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_stock_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_stock_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "stl_landed_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_landed_cost_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "stl_doc_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stl_doc_amount_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "stl_narration" TEXT,
    "stl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "stl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stl_synced_on" TIMESTAMPTZ(6),
    "stl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stl_created_by" UUID,

    CONSTRAINT "item_stock_ledger_pkey" PRIMARY KEY ("stl_id")
);

-- CreateIndex
CREATE INDEX "idx_btm_item" ON "inventory"."item_batch_master"("btm_company_id", "btm_item_id");

-- CreateIndex
CREATE INDEX "idx_isb_item" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_item_id");

-- CreateIndex
CREATE INDEX "idx_isb_godown" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_godown_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_isb_balance_scope" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_godown_id", "isb_item_id", "isb_unit_id", "isb_stock_bucket");

-- CreateIndex
CREATE INDEX "idx_stl_item" ON "inventory"."item_stock_ledger"("stl_acc_year", "stl_company_id", "stl_branch_id", "stl_item_id");

-- CreateIndex
CREATE INDEX "idx_stl_voucher" ON "inventory"."item_stock_ledger"("stl_acc_year", "stl_company_id", "stl_branch_id", "stl_voucher_id");
