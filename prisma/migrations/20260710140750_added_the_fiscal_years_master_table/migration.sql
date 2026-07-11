/*
  Warnings:

  - You are about to drop the `cust_item_rates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "cust_item_rates";

-- CreateTable
CREATE TABLE "sales"."cust_item_rates" (
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

-- CreateIndex
CREATE INDEX "idx_csr_customer" ON "sales"."cust_item_rates"("csr_customer_id");

-- CreateIndex
CREATE INDEX "idx_csr_unit_rate" ON "sales"."cust_item_rates"("csr_unit_rate_id");

-- CreateIndex
CREATE INDEX "idx_csr_branch" ON "sales"."cust_item_rates"("csr_branch_id");

-- CreateIndex
CREATE INDEX "idx_csr_active_deleted" ON "sales"."cust_item_rates"("csr_is_deleted", "csr_is_active");
