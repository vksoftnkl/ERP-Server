-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fixed";

-- CreateEnum
CREATE TYPE "fixed"."AvtDrcrType" AS ENUM ('DR', 'CR', 'BOTH');

-- CreateEnum
CREATE TYPE "fixed"."AvtTallyReservedVch" AS ENUM ('CONTRA', 'PAYMENT', 'RECEIPT', 'JOURNAL', 'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REVERSING_JOURNAL', 'MEMORANDUM', 'DELIVERY_NOTE', 'RECEIPT_NOTE', 'SALES_ORDER', 'PURCHASE_ORDER', 'STOCK_JOURNAL', 'PHYSICAL_STOCK');

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "fixed"."avt_voucher_type_master" (
    "avt_id" UUID NOT NULL DEFAULT uuidv7(),
    "avt_short" VARCHAR(30) NOT NULL,
    "avt_desc" VARCHAR(150) NOT NULL,
    "avt_drcr" "fixed"."AvtDrcrType" NOT NULL DEFAULT 'BOTH',
    "avt_print_enabled" BOOLEAN NOT NULL DEFAULT true,
    "avt_print_style" UUID,
    "avt_sort_order" INTEGER NOT NULL DEFAULT 0,
    "avt_tally_name" VARCHAR(150) NOT NULL,
    "avt_tally_reserved_type" "fixed"."AvtTallyReservedVch",
    "avt_is_active" BOOLEAN NOT NULL DEFAULT true,
    "avt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "avt_sync_date" TIMESTAMPTZ,
    "avt_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avt_created_by" VARCHAR(100),
    "avt_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avt_modified_by" VARCHAR(100),

    CONSTRAINT "avt_voucher_type_master_pkey" PRIMARY KEY ("avt_id")
);

-- CreateTable
CREATE TABLE "fixed"."bank_master" (
    "bnk_id" UUID NOT NULL DEFAULT uuidv7(),
    "bnk_name" VARCHAR(200) NOT NULL,
    "bnk_short_name" VARCHAR(80),
    "bnk_alias" VARCHAR(120),
    "bnk_rbi_code" VARCHAR(30),
    "bnk_iban_supported" BOOLEAN NOT NULL DEFAULT false,
    "bnk_is_active" BOOLEAN NOT NULL DEFAULT true,
    "bnk_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "bnk_sync_date" TIMESTAMPTZ,
    "bnk_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bnk_created_by" VARCHAR(100),
    "bnk_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bnk_modified_by" VARCHAR(100),

    CONSTRAINT "bank_master_pkey" PRIMARY KEY ("bnk_id")
);

-- CreateTable
CREATE TABLE "fixed"."erp_device_master" (
    "dev_id" UUID NOT NULL DEFAULT uuidv7(),
    "dev_branch_id" UUID,
    "dev_user_id" UUID,
    "dev_device_uid" VARCHAR(120) NOT NULL,
    "dev_device_name" VARCHAR(120),
    "dev_device_type" VARCHAR(30) NOT NULL,
    "dev_platform" VARCHAR(30),
    "dev_os_version" VARCHAR(40),
    "dev_app_version" VARCHAR(40),
    "dev_serial_no" VARCHAR(120),
    "dev_imei" VARCHAR(30),
    "dev_mac_address" VARCHAR(50),
    "dev_product_key" TEXT,
    "dev_is_allowed" BOOLEAN NOT NULL DEFAULT false,
    "dev_is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "dev_allow_reason" VARCHAR(250),
    "dev_block_reason" VARCHAR(250),
    "dev_last_seen_on" TIMESTAMPTZ,
    "dev_last_ip" INET,
    "dev_last_login_on" TIMESTAMPTZ,
    "dev_is_active" BOOLEAN NOT NULL DEFAULT true,
    "dev_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "dev_sync_date" TIMESTAMPTZ,
    "dev_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dev_created_by" VARCHAR(100),
    "dev_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dev_modified_by" VARCHAR(100),

    CONSTRAINT "erp_device_master_pkey" PRIMARY KEY ("dev_id")
);

-- CreateTable
CREATE TABLE "fixed"."state_codes" (
    "state_code" CHAR(2) NOT NULL,
    "state_name" VARCHAR(100) NOT NULL,
    "state_ut" BOOLEAN NOT NULL DEFAULT false,
    "tin_code" VARCHAR(2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "state_sync_date" TIMESTAMPTZ,
    "created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    "modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" VARCHAR(100),

    CONSTRAINT "state_codes_pkey" PRIMARY KEY ("state_code")
);

-- CreateTable
CREATE TABLE "fixed"."user_login_sessions" (
    "uls_id" UUID NOT NULL DEFAULT uuidv7(),
    "uls_branch_id" UUID NOT NULL,
    "uls_user_id" UUID NOT NULL,
    "uls_device_id" UUID,
    "uls_session_id" UUID,
    "uls_session_token" VARCHAR(200),
    "uls_refresh_token_id" VARCHAR(200),
    "uls_login_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uls_logout_on" TIMESTAMPTZ,
    "uls_logout_type" VARCHAR(20),
    "uls_login_status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "uls_fail_reason" VARCHAR(250),
    "uls_ip_address" INET,
    "uls_user_agent" TEXT,
    "uls_app_version" VARCHAR(40),
    "uls_is_active_session" BOOLEAN NOT NULL DEFAULT true,
    "uls_is_active" BOOLEAN NOT NULL DEFAULT true,
    "uls_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "uls_sync_date" TIMESTAMPTZ,
    "uls_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uls_created_by" VARCHAR(100),
    "uls_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uls_modified_by" VARCHAR(100),

    CONSTRAINT "user_login_sessions_pkey" PRIMARY KEY ("uls_id")
);

-- CreateIndex
CREATE INDEX "idx_avt_active" ON "fixed"."avt_voucher_type_master"("avt_is_active");

-- CreateIndex
CREATE INDEX "idx_avt_sort" ON "fixed"."avt_voucher_type_master"("avt_sort_order");

-- CreateIndex
CREATE INDEX "idx_bnk_active" ON "fixed"."bank_master"("bnk_is_active");

-- CreateIndex
CREATE INDEX "idx_dev_login_check" ON "fixed"."erp_device_master"("dev_device_uid");

-- CreateIndex
CREATE INDEX "idx_dev_allowed" ON "fixed"."erp_device_master"("dev_is_allowed", "dev_is_blocked");

-- CreateIndex
CREATE UNIQUE INDEX "erp_device_master_dev_device_uid_key" ON "fixed"."erp_device_master"("dev_device_uid");

-- CreateIndex
CREATE INDEX "idx_state_codes_active" ON "fixed"."state_codes"("is_active");

-- CreateIndex
CREATE INDEX "idx_state_codes_name" ON "fixed"."state_codes"("state_name");

-- CreateIndex
CREATE INDEX "idx_uls_user" ON "fixed"."user_login_sessions"("uls_user_id");

-- CreateIndex
CREATE INDEX "idx_uls_active_session" ON "fixed"."user_login_sessions"("uls_is_active_session");

-- CreateIndex
CREATE INDEX "idx_uls_device_date" ON "fixed"."user_login_sessions"("uls_device_id");
