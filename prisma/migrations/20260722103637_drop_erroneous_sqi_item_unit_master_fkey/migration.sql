/*
  Warnings:

  - You are about to drop the `item_qtywise_rates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "inventory"."item_qtywise_rates" DROP CONSTRAINT "item_qtywise_rates_iqr_unit_rate_id_fkey";

-- DropForeignKey
ALTER TABLE "sales"."sale_quotation_item" DROP CONSTRAINT "fk_sqi_item_unit_id";

-- DropTable
DROP TABLE "inventory"."item_qtywise_rates";

-- CreateTable
CREATE TABLE "inventory"."item_qty_price" (
    "iqp_id" UUID NOT NULL DEFAULT uuidv7(),
    "iqp_company_id" UUID,
    "iqp_branch_id" UUID,
    "iqp_party_id" UUID,
    "iqp_price_level" INTEGER,
    "iqp_item_id" UUID NOT NULL,
    "iqp_item_unit_id" UUID NOT NULL,
    "iqp_from_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "iqp_to_qty" DECIMAL(14,3),
    "iqp_price_mode" CHAR(1) NOT NULL DEFAULT 'P',
    "iqp_disc_pct" DECIMAL(6,3),
    "iqp_flat_off" DECIMAL(14,3),
    "iqp_price" DECIMAL(14,3),
    "iqp_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "iqp_effective_from" DATE NOT NULL,
    "iqp_effective_to" DATE,
    "iqp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "iqp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "iqp_sync_date" TIMESTAMPTZ(6),
    "iqp_created_by" VARCHAR(100),
    "iqp_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iqp_modified_by" VARCHAR(100),
    "iqp_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_qty_price_pkey" PRIMARY KEY ("iqp_id")
);

-- CreateTable
CREATE TABLE "sales"."sale_agents" (
    "sa_id" UUID NOT NULL DEFAULT uuidv7(),
    "sa_company_id" UUID NOT NULL,
    "sa_branch_id" UUID,
    "sa_group_id" UUID NOT NULL,
    "sa_code" VARCHAR(60),
    "sa_name" VARCHAR(200) NOT NULL,
    "sa_alias" VARCHAR(200),
    "sa_mobile1" VARCHAR(20),
    "sa_mobile2" VARCHAR(20),
    "sa_addr1" VARCHAR(250),
    "sa_addr2" VARCHAR(250),
    "sa_city" VARCHAR(120),
    "sa_district" VARCHAR(120),
    "sa_state" VARCHAR(120),
    "sa_pincode" VARCHAR(10),
    "sa_pan_no" VARCHAR(20),
    "sa_gstin" VARCHAR(20),
    "sa_remarks" VARCHAR(500),
    "sa_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sa_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sa_sync_date" TIMESTAMPTZ(6),
    "sa_created_by" VARCHAR(100),
    "sa_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sa_modified_by" VARCHAR(100),
    "sa_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_agents_pkey" PRIMARY KEY ("sa_id")
);
