/*
  Warnings:

  - You are about to alter the column `log_ip` on the `audit_log` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- AlterTable
ALTER TABLE "audit"."audit_log" ALTER COLUMN "log_ip" SET DATA TYPE inet;

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "sales"."area_master" (
    "arm_id" UUID NOT NULL DEFAULT uuidv7(),
    "arm_name" TEXT NOT NULL,
    "arm_alias" TEXT,
    "arm_short" VARCHAR(50),
    "arm_city_id" UUID NOT NULL,
    "arm_sort" DECIMAL NOT NULL DEFAULT 0.0,
    "arm_distance_km" INTEGER DEFAULT 0,
    "arm_collection_days" INTEGER[],
    "arm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "arm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "arm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_master_pkey" PRIMARY KEY ("arm_id")
);

-- CreateTable
CREATE TABLE "sales"."city_master" (
    "ctm_id" UUID NOT NULL DEFAULT uuidv7(),
    "ctm_name" TEXT NOT NULL,
    "ctm_alias" TEXT,
    "ctm_short" VARCHAR(50),
    "ctm_state_id" UUID NOT NULL,
    "ctm_order" DECIMAL NOT NULL DEFAULT 0.0,
    "ctm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ctm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ctm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ctm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_master_pkey" PRIMARY KEY ("ctm_id")
);

-- CreateTable
CREATE TABLE "sales"."customers" (
    "cus_id" UUID NOT NULL DEFAULT uuidv7(),
    "cus_title" VARCHAR(5),
    "cus_short" VARCHAR(50),
    "cus_code" VARCHAR(50),
    "cus_name" VARCHAR(200),
    "cus_addr1" VARCHAR(250),
    "cus_addr2" VARCHAR(250),
    "cus_addr3" VARCHAR(250),
    "cus_city" VARCHAR(250),
    "cus_district" VARCHAR(250),
    "cus_state_name" VARCHAR(100) NOT NULL,
    "cus_country" VARCHAR(60) DEFAULT 'India',
    "cus_state_code" CHAR(2) NOT NULL,
    "cus_landmark" VARCHAR(200),
    "cus_pin" VARCHAR(10),
    "cus_tel" VARCHAR(20),
    "cus_phone1" VARCHAR(20),
    "cus_phone2" VARCHAR(20),
    "cus_whatsapp_no" VARCHAR(20),
    "cus_email" VARCHAR(120),
    "cus_aadhar_no" VARCHAR(12),
    "cus_contact_person" VARCHAR(150),
    "cus_distance_km" INTEGER,
    "cus_credit_allowed" BOOLEAN NOT NULL DEFAULT false,
    "cus_credit_bill_limit" INTEGER NOT NULL DEFAULT 0,
    "cus_credit_amt_limit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cus_credit_days" INTEGER NOT NULL DEFAULT 0,
    "cus_debit_balance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cus_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "cus_debit_grace_days" INTEGER NOT NULL DEFAULT 0,
    "cus_enable_sms" BOOLEAN NOT NULL DEFAULT false,
    "cus_overdue_sms" BOOLEAN NOT NULL DEFAULT false,
    "cus_overdue_billing" BOOLEAN NOT NULL DEFAULT false,
    "cus_allow_promotion" BOOLEAN NOT NULL DEFAULT false,
    "cus_allow_loyalty" BOOLEAN NOT NULL DEFAULT false,
    "cus_allow_discount" BOOLEAN NOT NULL DEFAULT true,
    "cus_sort_order" INTEGER NOT NULL DEFAULT 0,
    "cus_region_name" VARCHAR(200),
    "cus_region_addr1" VARCHAR(250),
    "cus_region_addr2" VARCHAR(250),
    "cus_region_addr3" VARCHAR(250),
    "cus_region_city" VARCHAR(250),
    "cus_region_district" VARCHAR(250),
    "cus_region_state_name" VARCHAR(100),
    "cus_region_country" VARCHAR(60) DEFAULT 'India',
    "cus_birth_date" DATE,
    "cus_marriage_date" DATE,
    "cus_transport_name" VARCHAR(200),
    "cus_freight_charge" BOOLEAN NOT NULL DEFAULT false,
    "cus_loading_charge" BOOLEAN NOT NULL DEFAULT false,
    "cus_unloading_charge" BOOLEAN NOT NULL DEFAULT false,
    "cus_gst_no" VARCHAR(15),
    "cus_pan_no" VARCHAR(10),
    "cus_gst_type" VARCHAR(30),
    "cus_ecommerce_gstin" VARCHAR(15),
    "cus_tcs_applicable" BOOLEAN NOT NULL DEFAULT false,
    "cus_itcoll_exempted" BOOLEAN NOT NULL DEFAULT false,
    "cus_itcoll_type" VARCHAR(30),
    "cus_geo_location" VARCHAR(200),
    "sup_collection_days" INTEGER[],
    "cus_default_salesman" UUID,
    "cus_price_level_id" INTEGER NOT NULL,
    "cus_billed_date" DATE,
    "cus_billed_count" INTEGER NOT NULL DEFAULT 0,
    "cus_notes" VARCHAR(250),
    "cus_branch_id" UUID,
    "cus_area_id" UUID NOT NULL,
    "cus_group_id" UUID NOT NULL,
    "cus_is_active" BOOLEAN NOT NULL DEFAULT true,
    "cus_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "cus_sync_date" TIMESTAMPTZ,
    "cus_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cus_created_by" VARCHAR(100),
    "cus_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cus_modified_by" VARCHAR(100),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("cus_id")
);

-- CreateTable
CREATE TABLE "sales"."cust_groups" (
    "cgr_id" UUID NOT NULL DEFAULT uuidv7(),
    "cgr_branch_id" UUID,
    "cgr_name" TEXT NOT NULL,
    "cgr_alias" TEXT,
    "cgr_short" VARCHAR(50),
    "cgr_narration" VARCHAR(250),
    "cgr_order" DECIMAL DEFAULT 0.0,
    "cgr_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "cgr_collection_days" INTEGER[],
    "cgr_debit_allowed" BOOLEAN NOT NULL DEFAULT false,
    "cgr_debit_days" INTEGER NOT NULL DEFAULT 0,
    "cgr_debit_limit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cgr_bills_limit" INTEGER NOT NULL DEFAULT 0,
    "cgr_overdue_billing" BOOLEAN NOT NULL DEFAULT false,
    "cgr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "cgr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "cgr_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cgr_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cust_groups_pkey" PRIMARY KEY ("cgr_id")
);

-- CreateTable
CREATE TABLE "sales"."state_master" (
    "stm_id" UUID NOT NULL DEFAULT uuidv7(),
    "stm_name" TEXT NOT NULL,
    "stm_alias" TEXT,
    "stm_short" VARCHAR(20),
    "stm_order" DECIMAL NOT NULL DEFAULT 0.0,
    "stm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "stm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stm_created_by" VARCHAR(100),
    "stm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stm_modified_by" VARCHAR(100),

    CONSTRAINT "state_master_pkey" PRIMARY KEY ("stm_id")
);

-- CreateIndex
CREATE INDEX "idx_arm_city" ON "sales"."area_master"("arm_city_id");

-- CreateIndex
CREATE INDEX "idx_arm_active" ON "sales"."area_master"("arm_is_active");

-- CreateIndex
CREATE INDEX "idx_ctm_state" ON "sales"."city_master"("ctm_state_id");

-- CreateIndex
CREATE INDEX "idx_ctm_active" ON "sales"."city_master"("ctm_is_active");

-- CreateIndex
CREATE INDEX "idx_cus_area" ON "sales"."customers"("cus_area_id");

-- CreateIndex
CREATE INDEX "idx_cus_phone1" ON "sales"."customers"("cus_phone1");

-- CreateIndex
CREATE INDEX "idx_cus_gst_no" ON "sales"."customers"("cus_gst_no");

-- CreateIndex
CREATE INDEX "idx_cus_active" ON "sales"."customers"("cus_is_active");

-- CreateIndex
CREATE INDEX "idx_cgr_active" ON "sales"."cust_groups"("cgr_is_active");

-- CreateIndex
CREATE INDEX "idx_stm_active" ON "sales"."state_master"("stm_is_active");

-- AddForeignKey
ALTER TABLE "sales"."area_master" ADD CONSTRAINT "area_master_arm_city_id_fkey" FOREIGN KEY ("arm_city_id") REFERENCES "sales"."city_master"("ctm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."city_master" ADD CONSTRAINT "city_master_ctm_state_id_fkey" FOREIGN KEY ("ctm_state_id") REFERENCES "sales"."state_master"("stm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_area_id_fkey" FOREIGN KEY ("cus_area_id") REFERENCES "sales"."area_master"("arm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_group_id_fkey" FOREIGN KEY ("cus_group_id") REFERENCES "sales"."cust_groups"("cgr_id") ON DELETE RESTRICT ON UPDATE CASCADE;
