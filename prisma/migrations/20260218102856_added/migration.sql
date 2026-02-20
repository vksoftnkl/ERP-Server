-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "cust_item_rates" (
    "csr_id" UUID NOT NULL DEFAULT uuidv7(),
    "csr_branch_id" UUID,
    "csr_customer_id" UUID NOT NULL,
    "csr_unit_rate_id" UUID NOT NULL,
    "csr_rate_type" VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    "csr_item_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "csr_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "csr_disc_qty" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "csr_price_level" CHAR(1),
    "csr_valid_from" DATE,
    "csr_valid_to" DATE,
    "csr_priority" INTEGER NOT NULL DEFAULT 0,
    "csr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "csr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "csr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "csr_created_by" VARCHAR(100),
    "csr_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "csr_modified_by" VARCHAR(100),
    "csr_uploaded_at" TIMESTAMPTZ(6),
    "csr_uploaded_by" VARCHAR(100),
    "csr_remarks" VARCHAR(250),

    CONSTRAINT "cust_item_rates_pkey" PRIMARY KEY ("csr_id")
);

-- CreateTable
CREATE TABLE "item_ean_codes" (
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

-- CreateIndex
CREATE INDEX "idx_csr_customer" ON "cust_item_rates"("csr_customer_id");

-- CreateIndex
CREATE INDEX "idx_csr_unit_rate" ON "cust_item_rates"("csr_unit_rate_id");

-- CreateIndex
CREATE INDEX "idx_csr_branch" ON "cust_item_rates"("csr_branch_id");

-- CreateIndex
CREATE INDEX "idx_csr_active_deleted" ON "cust_item_rates"("csr_is_deleted", "csr_is_active");

-- CreateIndex
CREATE INDEX "idx_ean_code" ON "item_ean_codes"("ean_code");

-- CreateIndex
CREATE INDEX "idx_ean_item" ON "item_ean_codes"("ean_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ean_code" ON "item_ean_codes"("ean_code");

-- AddForeignKey
ALTER TABLE "item_ean_codes" ADD CONSTRAINT "item_ean_codes_ean_unit_id_fkey" FOREIGN KEY ("ean_unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;
