-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "accounts";

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "accounts"."account_groups" (
    "acc_group_id" UUID NOT NULL DEFAULT uuidv7(),
    "acc_group_company_id" INTEGER,
    "acc_group_name" VARCHAR(150) NOT NULL,
    "acc_group_alias" VARCHAR(100),
    "acc_group_short" VARCHAR(50),
    "acc_group_description" VARCHAR(250),
    "acc_group_tally_name" VARCHAR(150),
    "acc_group_primary_name" VARCHAR(150),
    "acc_group_nature" VARCHAR(20),
    "acc_group_parent_id" UUID,
    "acc_group_sort" INTEGER,
    "acc_group_child_ids" UUID[],
    "acc_group_type_code" CHAR(2) NOT NULL,
    "acc_group_is_default" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_behave_as_subledger" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_net_debit_credit" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_used_for_calculation" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_affects_gross_profit" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_is_active" BOOLEAN NOT NULL DEFAULT true,
    "acc_group_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_sync_date" TIMESTAMPTZ,
    "acc_group_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acc_group_created_by" VARCHAR(100),
    "acc_group_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acc_group_modified_by" VARCHAR(100),

    CONSTRAINT "account_groups_pkey" PRIMARY KEY ("acc_group_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_ledger_master" (
    "led_id" UUID NOT NULL DEFAULT uuidv7(),
    "led_company_id" INTEGER,
    "led_group_id" UUID NOT NULL,
    "led_name" VARCHAR(200) NOT NULL,
    "led_alias" VARCHAR(100),
    "led_short" VARCHAR(50),
    "led_tally_name" VARCHAR(200),
    "led_tally_group_name" VARCHAR(150),
    "led_tally_guid" VARCHAR(64),
    "led_category" VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    "led_is_bill_by_bill" BOOLEAN NOT NULL DEFAULT false,
    "led_is_cost_center_req" BOOLEAN NOT NULL DEFAULT false,
    "led_is_interest_applicable" BOOLEAN NOT NULL DEFAULT false,
    "led_interest_rate" DECIMAL,
    "led_contact_person" VARCHAR(150),
    "led_email" VARCHAR(150),
    "led_tel" VARCHAR(20),
    "led_phone1" VARCHAR(20),
    "led_phone2" VARCHAR(20),
    "led_whatsapp_no" VARCHAR(20),
    "led_addr1" VARCHAR(200),
    "led_addr2" VARCHAR(200),
    "led_addr3" VARCHAR(200),
    "led_city" VARCHAR(100),
    "led_district" VARCHAR(100),
    "led_state_name" VARCHAR(100),
    "led_state_code" CHAR(2),
    "led_pin" VARCHAR(10),
    "led_country" VARCHAR(60) DEFAULT 'India',
    "led_region_addr1" VARCHAR(200),
    "led_region_addr2" VARCHAR(200),
    "led_region_addr3" VARCHAR(200),
    "led_region_city" VARCHAR(100),
    "led_region_district" VARCHAR(100),
    "led_region_state_name" VARCHAR(100),
    "led_region_country" VARCHAR(60) DEFAULT 'India',
    "led_gst_party_reg_type" VARCHAR(30),
    "led_gstin_no" VARCHAR(15),
    "led_pan_no" VARCHAR(10),
    "led_aadhar_no" VARCHAR(20),
    "led_ecommerce_gstin" VARCHAR(15),
    "led_is_sez" BOOLEAN NOT NULL DEFAULT false,
    "led_cheque_name" VARCHAR(80),
    "led_bank_name" VARCHAR(120),
    "led_bank_branch" VARCHAR(120),
    "led_bank_ac_no" VARCHAR(40),
    "led_bank_ifsc" VARCHAR(15),
    "led_upi_id" VARCHAR(80),
    "led_ob_amount" DECIMAL NOT NULL DEFAULT 0,
    "led_ob_type" CHAR(2) NOT NULL DEFAULT 'DR',
    "led_ob_as_on" DATE,
    "led_is_active" BOOLEAN NOT NULL DEFAULT true,
    "led_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "led_allow_edit" BOOLEAN NOT NULL DEFAULT false,
    "led_is_entry" BOOLEAN NOT NULL DEFAULT false,
    "led_allow_sms" BOOLEAN NOT NULL DEFAULT false,
    "led_remarks" VARCHAR(250),
    "led_sync_date" TIMESTAMPTZ,
    "led_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "led_created_by" VARCHAR(100),
    "led_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "led_modified_by" VARCHAR(100),

    CONSTRAINT "acc_ledger_master_pkey" PRIMARY KEY ("led_id")
);

-- CreateTable
CREATE TABLE "accounts"."branch_master" (
    "br_id" SERIAL NOT NULL,
    "comp_id" INTEGER NOT NULL,
    "br_code" VARCHAR(20),
    "br_name" VARCHAR(150) NOT NULL,
    "br_mailing_name" VARCHAR(150),
    "br_alias" VARCHAR(100),
    "br_short" VARCHAR(50),
    "br_type" VARCHAR(30),
    "br_is_default" BOOLEAN NOT NULL DEFAULT false,
    "br_is_active" BOOLEAN NOT NULL DEFAULT true,
    "br_addr1" TEXT,
    "br_addr2" TEXT,
    "br_addr3" TEXT,
    "br_city" VARCHAR(100),
    "br_district" VARCHAR(100),
    "br_state" VARCHAR(100),
    "br_state_code" CHAR(2) NOT NULL,
    "br_pin" VARCHAR(10),
    "br_country" VARCHAR(60) NOT NULL DEFAULT 'India',
    "br_landmark" VARCHAR(150),
    "br_region_addr1" TEXT,
    "br_region_addr2" TEXT,
    "br_region_addr3" TEXT,
    "br_region_city" VARCHAR(100),
    "br_region_district" VARCHAR(100),
    "br_region_state" TEXT,
    "br_region_country" VARCHAR(60),
    "br_contact_person" VARCHAR(150),
    "br_tel" VARCHAR(20),
    "br_phone" VARCHAR(20),
    "br_mail" VARCHAR(150),
    "br_bill_prefix" VARCHAR(20),
    "br_invoice_series_prefix" VARCHAR(20),
    "br_bill_greeting" VARCHAR(300),
    "br_terms" TEXT,
    "br_rounding_mode" VARCHAR(20),
    "br_rounding_value" DECIMAL,
    "br_default_godown_id" UUID,
    "br_pos_type" VARCHAR(20),
    "br_allow_negative_stock" BOOLEAN NOT NULL DEFAULT true,
    "br_sms_applicable" BOOLEAN NOT NULL DEFAULT false,
    "br_bank_id" UUID,
    "br_fssai_no" VARCHAR(20),
    "br_fssai_license_type" VARCHAR(20),
    "br_fssai_valid_upto" DATE,
    "br_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "br_sync_date" TIMESTAMPTZ,
    "br_created_on" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "br_created_by" VARCHAR(100),
    "br_modified_on" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "br_modified_by" VARCHAR(100),

    CONSTRAINT "branch_master_pkey" PRIMARY KEY ("br_id")
);

-- CreateTable
CREATE TABLE "accounts"."companys" (
    "comp_id" SERIAL NOT NULL,
    "comp_code" VARCHAR(20),
    "comp_name" TEXT NOT NULL,
    "comp_short" TEXT,
    "comp_legal_name" TEXT,
    "comp_gstin_no" VARCHAR(15),
    "comp_gst_reg_type" VARCHAR(30),
    "comp_pan_no" VARCHAR(10),
    "comp_fssai_no" VARCHAR(20),
    "comp_addr1" TEXT,
    "comp_addr2" TEXT,
    "comp_addr3" TEXT,
    "comp_city" VARCHAR(100),
    "comp_district" VARCHAR(100),
    "comp_state" TEXT,
    "comp_state_code" CHAR(2) NOT NULL,
    "comp_pin" INTEGER,
    "comp_country" VARCHAR(60) NOT NULL DEFAULT 'India',
    "comp_region_addr1" TEXT,
    "comp_region_addr2" TEXT,
    "comp_region_addr3" TEXT,
    "comp_region_city" VARCHAR(100),
    "comp_region_district" VARCHAR(100),
    "comp_region_state" TEXT,
    "comp_region_country" VARCHAR(60),
    "comp_tel" VARCHAR(20),
    "comp_phone" VARCHAR(20),
    "comp_mail" VARCHAR(150),
    "comp_support_email" VARCHAR(150),
    "comp_support_phone" VARCHAR(20),
    "comp_website_name" VARCHAR(200),
    "comp_fin_year_from" DATE,
    "comp_fin_year_to" DATE,
    "comp_books_begin_from" DATE,
    "comp_gst_applicable" BOOLEAN NOT NULL DEFAULT true,
    "comp_tcs_applicable" BOOLEAN NOT NULL DEFAULT false,
    "comp_sms_applicable" BOOLEAN NOT NULL DEFAULT false,
    "comp_einvoice_applicable" BOOLEAN NOT NULL DEFAULT false,
    "comp_eway_applicable" BOOLEAN NOT NULL DEFAULT false,
    "comp_eway_date" DATE,
    "comp_eway_inter_limit" DECIMAL,
    "comp_eway_intra_apl" BOOLEAN NOT NULL DEFAULT false,
    "comp_eway_intra_limit" DECIMAL NOT NULL DEFAULT 0,
    "comp_einvoice_date" DATE,
    "comp_einvoice_incl_eway" BOOLEAN,
    "comp_stylesheet_id" INTEGER NOT NULL,
    "comp_bank_id" UUID,
    "comp_price_fixing" VARCHAR(50),
    "comp_prefix_code" VARCHAR(20),
    "comp_bill_greeting" TEXT,
    "comp_negstk_apl" BOOLEAN NOT NULL DEFAULT true,
    "comp_default" BOOLEAN NOT NULL DEFAULT false,
    "comp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "comp_currency_code" CHAR(3) NOT NULL DEFAULT 'INR',
    "comp_currency_symbol" VARCHAR(10),
    "comp_locale_code" VARCHAR(10) NOT NULL DEFAULT 'en-IN',
    "comp_remarks" TEXT DEFAULT '',
    "comp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "comp_sync_date" TIMESTAMPTZ,
    "comp_created_on" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comp_created_by" VARCHAR(100),
    "comp_modified_on" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comp_modified_by" VARCHAR(100),

    CONSTRAINT "companys_pkey" PRIMARY KEY ("comp_id")
);

-- CreateTable
CREATE TABLE "accounts"."company_group_master" (
    "cog_group_id" UUID NOT NULL DEFAULT uuidv7(),
    "cog_group_name" VARCHAR(80) NOT NULL,
    "cog_company_ids" UUID[],
    "cog_is_active" BOOLEAN NOT NULL DEFAULT true,
    "cog_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "cog_sync_date" TIMESTAMPTZ,
    "cog_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cog_created_by" VARCHAR(100),
    "cog_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cog_modified_by" VARCHAR(100),

    CONSTRAINT "company_group_master_pkey" PRIMARY KEY ("cog_group_id")
);

-- CreateTable
CREATE TABLE "accounts"."employee_designations" (
    "ed_id" UUID NOT NULL DEFAULT uuidv7(),
    "ed_name" VARCHAR(150) NOT NULL,
    "ed_code" VARCHAR(50),
    "ed_is_default" BOOLEAN NOT NULL DEFAULT false,
    "ed_remarks" VARCHAR(250),
    "ed_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ed_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ed_sync_date" TIMESTAMPTZ,
    "ed_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ed_created_by" VARCHAR(100),
    "ed_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ed_modified_by" VARCHAR(100),

    CONSTRAINT "employee_designations_pkey" PRIMARY KEY ("ed_id")
);

-- CreateTable
CREATE TABLE "sales"."emp_master" (
    "emp_id" UUID NOT NULL DEFAULT uuidv7(),
    "emp_company_id" INTEGER NOT NULL,
    "emp_branch_id" UUID,
    "emp_code" VARCHAR(60),
    "emp_name" VARCHAR(200) NOT NULL,
    "emp_alias" VARCHAR(200),
    "emp_mobile1" VARCHAR(20),
    "emp_mobile2" VARCHAR(20),
    "emp_email" VARCHAR(150),
    "emp_addr1" VARCHAR(250),
    "emp_addr2" VARCHAR(250),
    "emp_addr3" VARCHAR(250),
    "emp_city" VARCHAR(120),
    "emp_district" VARCHAR(120),
    "emp_state" VARCHAR(120),
    "emp_pincode" VARCHAR(10),
    "emp_gender" VARCHAR(10),
    "emp_marital_status" VARCHAR(20),
    "emp_blood_group" VARCHAR(10),
    "emp_dob" DATE,
    "emp_department_id" UUID,
    "emp_designation_id" UUID,
    "emp_employment_type" VARCHAR(20),
    "emp_status" VARCHAR(20),
    "emp_joined_on" DATE,
    "emp_probation_end_on" DATE,
    "emp_confirmation_on" DATE,
    "emp_left_on" DATE,
    "emp_shift_id" UUID,
    "emp_att_constraint_id" UUID,
    "emp_holiday_group_id" UUID,
    "emp_overtime_allowed" BOOLEAN NOT NULL DEFAULT false,
    "emp_has_commission" BOOLEAN NOT NULL DEFAULT false,
    "emp_commission_type" VARCHAR(20),
    "emp_commission_value" DECIMAL(12,3),
    "emp_salary_type" VARCHAR(10) NOT NULL,
    "emp_salary_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "emp_bata_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "emp_km_bata_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "emp_pan_no" VARCHAR(20),
    "emp_aadhar_no" VARCHAR(20),
    "emp_pf_no" VARCHAR(30),
    "emp_esi_no" VARCHAR(30),
    "emp_loan_ledger_id" UUID,
    "emp_photo_url" TEXT,
    "emp_photo" BYTEA,
    "emp_remarks" VARCHAR(500),
    "emp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "emp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "emp_sync_date" TIMESTAMPTZ,
    "emp_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emp_created_by" VARCHAR(100),
    "emp_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emp_modified_by" VARCHAR(100),

    CONSTRAINT "emp_master_pkey" PRIMARY KEY ("emp_id")
);

-- CreateTable
CREATE TABLE "accounts"."gsp_company_service" (
    "csg_company_service_id" UUID NOT NULL DEFAULT uuidv7(),
    "csg_company_id" INTEGER NOT NULL,
    "csg_gsp_provider_id" UUID NOT NULL,
    "csg_service_type" VARCHAR(20) NOT NULL,
    "csg_euser_name" TEXT NOT NULL,
    "csg_euser_password" TEXT NOT NULL,
    "csg_auth_token" TEXT,
    "csg_auth_token_valid_till" TIMESTAMPTZ,
    "csg_is_active" BOOLEAN NOT NULL DEFAULT true,
    "csg_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "csg_sync_date" TIMESTAMPTZ,
    "csg_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "csg_created_by" VARCHAR(100),
    "csg_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "csg_modified_by" VARCHAR(100),

    CONSTRAINT "gsp_company_service_pkey" PRIMARY KEY ("csg_company_service_id")
);

-- CreateTable
CREATE TABLE "accounts"."gsp_provider_master" (
    "gsp_provider_id" UUID NOT NULL DEFAULT uuidv7(),
    "gsp_provider_code" VARCHAR(50) NOT NULL,
    "gsp_provider_name" VARCHAR(150) NOT NULL,
    "gsp_base_url" TEXT NOT NULL,
    "gsp_route" TEXT NOT NULL,
    "gsp_ip_address" INET NOT NULL,
    "gsp_user_name" TEXT NOT NULL,
    "gsp_user_password" TEXT NOT NULL,
    "gsp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gsp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gsp_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gsp_created_by" VARCHAR(100),
    "gsp_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gsp_modified_by" VARCHAR(100),

    CONSTRAINT "gsp_provider_master_pkey" PRIMARY KEY ("gsp_provider_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_ship_addrs" (
    "saa_id" UUID NOT NULL DEFAULT uuidv7(),
    "saa_company_id" INTEGER,
    "saa_ledger_id" UUID NOT NULL,
    "saa_addr_type" VARCHAR(20) NOT NULL DEFAULT 'SHIP_TO',
    "saa_is_default" BOOLEAN NOT NULL DEFAULT false,
    "saa_sort" INTEGER NOT NULL DEFAULT 0,
    "saa_trdnm" VARCHAR(200),
    "saa_contact_name" VARCHAR(150),
    "saa_addr1" VARCHAR(250),
    "saa_addr2" VARCHAR(250),
    "saa_addr3" VARCHAR(250),
    "saa_loc" VARCHAR(200),
    "saa_pin" VARCHAR(10),
    "saa_state_code" CHAR(2),
    "saa_state_name" VARCHAR(100),
    "saa_distance_km" INTEGER,
    "saa_phone" VARCHAR(20),
    "saa_email" VARCHAR(120),
    "saa_gstin" VARCHAR(15),
    "saa_pan" VARCHAR(10),
    "saa_sync_date" TIMESTAMPTZ(6),
    "saa_is_active" BOOLEAN NOT NULL DEFAULT true,
    "saa_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "saa_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saa_created_by" VARCHAR(100),
    "saa_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saa_modified_by" VARCHAR(100),
    "saa_remarks" VARCHAR(250),

    CONSTRAINT "acc_ship_addrs_pkey" PRIMARY KEY ("saa_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_ledger_bank_accounts" (
    "lba_id" UUID NOT NULL DEFAULT uuidv7(),
    "lba_company_id" INTEGER,
    "lba_ledger_id" UUID NOT NULL,
    "lba_account_holder" VARCHAR(200) NOT NULL,
    "lba_bank_name" VARCHAR(200) NOT NULL,
    "lba_branch_name" VARCHAR(200),
    "lba_account_no" VARCHAR(50) NOT NULL,
    "lba_ifsc_code" VARCHAR(11),
    "lba_micr_code" VARCHAR(15),
    "lba_account_type" VARCHAR(20),
    "lba_upi_id" VARCHAR(100),
    "lba_cheque_name" VARCHAR(200),
    "lba_is_default" BOOLEAN NOT NULL DEFAULT false,
    "lba_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lba_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lba_sync_date" TIMESTAMPTZ,
    "lba_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lba_created_by" VARCHAR(100),
    "lba_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lba_modified_by" VARCHAR(100),
    "lba_remarks" VARCHAR(250),

    CONSTRAINT "acc_ledger_bank_accounts_pkey" PRIMARY KEY ("lba_id")
);

-- CreateTable
CREATE TABLE "accounts"."tender_master" (
    "tnd_id" UUID NOT NULL DEFAULT uuidv7(),
    "tnd_type_id" UUID NOT NULL,
    "tnd_name" TEXT NOT NULL,
    "tnd_ledger_id" UUID NOT NULL,
    "tnd_min_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tnd_max_amount" DECIMAL(14,2),
    "tnd_display_position" INTEGER NOT NULL DEFAULT 0,
    "tnd_surcharge_perc" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "tnd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tnd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tnd_remarks" TEXT,
    "tnd_edit_surcharge" BOOLEAN NOT NULL DEFAULT false,
    "tnd_edit_ledger" BOOLEAN NOT NULL DEFAULT false,
    "tnd_sync_date" TIMESTAMPTZ,
    "tnd_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tnd_created_by" VARCHAR(100),
    "tnd_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tnd_modified_by" VARCHAR(100),

    CONSTRAINT "tender_master_pkey" PRIMARY KEY ("tnd_id")
);

-- CreateTable
CREATE TABLE "accounts"."tender_type_master" (
    "ttm_type_id" UUID NOT NULL DEFAULT uuidv7(),
    "ttm_type_name" TEXT NOT NULL,
    "ttm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ttm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ttm_sync_date" TIMESTAMPTZ,
    "ttm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttm_created_by" VARCHAR(100),
    "ttm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttm_modified_by" VARCHAR(100),

    CONSTRAINT "tender_type_master_pkey" PRIMARY KEY ("ttm_type_id")
);

-- CreateIndex
CREATE INDEX "idx_acc_group_company_id" ON "accounts"."account_groups"("acc_group_company_id");

-- CreateIndex
CREATE INDEX "idx_acc_group_parent_id" ON "accounts"."account_groups"("acc_group_parent_id");

-- CreateIndex
CREATE INDEX "idx_acc_group_type_code" ON "accounts"."account_groups"("acc_group_type_code");

-- CreateIndex
CREATE INDEX "idx_led_company_id" ON "accounts"."acc_ledger_master"("led_company_id");

-- CreateIndex
CREATE INDEX "idx_led_group_id" ON "accounts"."acc_ledger_master"("led_group_id");

-- CreateIndex
CREATE INDEX "idx_led_active" ON "accounts"."acc_ledger_master"("led_is_active");

-- CreateIndex
CREATE INDEX "idx_led_gstin" ON "accounts"."acc_ledger_master"("led_gstin_no");

-- CreateIndex
CREATE UNIQUE INDEX "branch_master_br_code_key" ON "accounts"."branch_master"("br_code");

-- CreateIndex
CREATE INDEX "idx_branch_comp_id" ON "accounts"."branch_master"("comp_id");

-- CreateIndex
CREATE INDEX "idx_branch_state_code" ON "accounts"."branch_master"("br_state_code");

-- CreateIndex
CREATE UNIQUE INDEX "companys_comp_code_key" ON "accounts"."companys"("comp_code");

-- CreateIndex
CREATE UNIQUE INDEX "companys_comp_name_key" ON "accounts"."companys"("comp_name");

-- CreateIndex
CREATE UNIQUE INDEX "companys_comp_gstin_no_key" ON "accounts"."companys"("comp_gstin_no");

-- CreateIndex
CREATE INDEX "idx_cog_group_active" ON "accounts"."company_group_master"("cog_is_active");

-- CreateIndex
CREATE INDEX "idx_ed_active" ON "accounts"."employee_designations"("ed_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_company" ON "sales"."emp_master"("emp_company_id");

-- CreateIndex
CREATE INDEX "idx_emp_active" ON "sales"."emp_master"("emp_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_department" ON "sales"."emp_master"("emp_department_id");

-- CreateIndex
CREATE INDEX "idx_emp_designation" ON "sales"."emp_master"("emp_designation_id");

-- CreateIndex
CREATE INDEX "idx_gsp_company_service_company" ON "accounts"."gsp_company_service"("csg_company_id");

-- CreateIndex
CREATE INDEX "idx_gsp_company_service_service" ON "accounts"."gsp_company_service"("csg_service_type");

-- CreateIndex
CREATE INDEX "idx_gsp_company_service_active" ON "accounts"."gsp_company_service"("csg_is_active");

-- CreateIndex
CREATE INDEX "idx_gsp_provider_active" ON "accounts"."gsp_provider_master"("gsp_is_active");

-- CreateIndex
CREATE INDEX "idx_saa_company" ON "accounts"."acc_ship_addrs"("saa_company_id");

-- CreateIndex
CREATE INDEX "idx_saa_ledger" ON "accounts"."acc_ship_addrs"("saa_ledger_id");

-- CreateIndex
CREATE INDEX "idx_saa_ledger_default" ON "accounts"."acc_ship_addrs"("saa_ledger_id", "saa_is_default");

-- CreateIndex
CREATE INDEX "idx_lba_ledger" ON "accounts"."acc_ledger_bank_accounts"("lba_ledger_id");

-- CreateIndex
CREATE INDEX "idx_lba_company" ON "accounts"."acc_ledger_bank_accounts"("lba_company_id");

-- CreateIndex
CREATE INDEX "idx_tnd_master_type" ON "accounts"."tender_master"("tnd_type_id");

-- CreateIndex
CREATE INDEX "idx_tnd_master_ledger" ON "accounts"."tender_master"("tnd_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tnd_master_position" ON "accounts"."tender_master"("tnd_display_position");

-- CreateIndex
CREATE INDEX "idx_ttm_type_active" ON "accounts"."tender_type_master"("ttm_is_active");

-- AddForeignKey
ALTER TABLE "accounts"."account_groups" ADD CONSTRAINT "account_groups_acc_group_parent_id_fkey" FOREIGN KEY ("acc_group_parent_id") REFERENCES "accounts"."account_groups"("acc_group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."account_groups" ADD CONSTRAINT "account_groups_acc_group_company_id_fkey" FOREIGN KEY ("acc_group_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_company_id_fkey" FOREIGN KEY ("led_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_group_id_fkey" FOREIGN KEY ("led_group_id") REFERENCES "accounts"."account_groups"("acc_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."branch_master" ADD CONSTRAINT "branch_master_comp_id_fkey" FOREIGN KEY ("comp_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."emp_master" ADD CONSTRAINT "emp_master_emp_company_id_fkey" FOREIGN KEY ("emp_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."emp_master" ADD CONSTRAINT "emp_master_emp_designation_id_fkey" FOREIGN KEY ("emp_designation_id") REFERENCES "accounts"."employee_designations"("ed_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."gsp_company_service" ADD CONSTRAINT "gsp_company_service_csg_company_id_fkey" FOREIGN KEY ("csg_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" ADD CONSTRAINT "acc_ship_addrs_saa_company_id_fkey" FOREIGN KEY ("saa_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" ADD CONSTRAINT "acc_ship_addrs_saa_ledger_id_fkey" FOREIGN KEY ("saa_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_bank_accounts" ADD CONSTRAINT "acc_ledger_bank_accounts_lba_company_id_fkey" FOREIGN KEY ("lba_company_id") REFERENCES "accounts"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_bank_accounts" ADD CONSTRAINT "acc_ledger_bank_accounts_lba_ledger_id_fkey" FOREIGN KEY ("lba_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."tender_master" ADD CONSTRAINT "tender_master_tnd_type_id_fkey" FOREIGN KEY ("tnd_type_id") REFERENCES "accounts"."tender_type_master"("ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."tender_master" ADD CONSTRAINT "tender_master_tnd_ledger_id_fkey" FOREIGN KEY ("tnd_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;
