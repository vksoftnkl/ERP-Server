-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "accounts";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fixed";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "purchase";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "stock";

-- CreateEnum
CREATE TYPE "accounts"."VoucherDocDetailTaxability" AS ENUM ('TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST', 'MIXED');

-- CreateEnum
CREATE TYPE "accounts"."VoucherDocDetailSupplyNature" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- CreateEnum
CREATE TYPE "accounts"."GdeStatus" AS ENUM ('NA', 'PENDING', 'GENERATED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "accounts"."GdwStatus" AS ENUM ('NA', 'PENDING', 'GENERATED', 'FAILED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "accounts"."GdwTransportMode" AS ENUM ('ROAD', 'RAIL', 'AIR', 'SHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdwVehicleType" AS ENUM ('REGULAR', 'ODC', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdrSourceModule" AS ENUM ('SALES', 'PURCHASE', 'INVENTORY', 'ACCOUNTS', 'SERVICE', 'JOBWORK', 'POS', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdrTranNature" AS ENUM ('SALE', 'SALES_RETURN', 'PURCHASE', 'PURCHASE_RETURN', 'STOCK_TRANSFER', 'DELIVERY_CHALLAN', 'JOBWORK_SEND', 'JOBWORK_RECEIVE', 'DEBIT_NOTE', 'CREDIT_NOTE', 'EXPORT', 'IMPORT', 'ADVANCE', 'ADV_ADJUSTMENT', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdrDocFlow" AS ENUM ('OUTWARD', 'INWARD', 'INTERNAL');

-- CreateEnum
CREATE TYPE "accounts"."GdrDocType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'BILL_OF_SUPPLY', 'DELIVERY_CHALLAN', 'CHALLAN', 'ADVANCE', 'ADV_ADJUSTMENT', 'EXPORT_DOC', 'IMPORT_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdrDocStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "accounts"."GdrSupplyClass" AS ENUM ('GOODS', 'SERVICES', 'MIXED');

-- CreateEnum
CREATE TYPE "accounts"."GdrTaxability" AS ENUM ('TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST', 'MIXED');

-- CreateEnum
CREATE TYPE "accounts"."GdrSupplyNature" AS ENUM ('INTRA_STATE', 'INTER_STATE', 'IMPORT', 'EXPORT', 'SEZ', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdrPartyType" AS ENUM ('CUSTOMER', 'VENDOR', 'BRANCH', 'JOBWORKER', 'TRANSPORTER', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."VoucherCategory" AS ENUM ('ACCOUNTING', 'INVENTORY', 'BOTH');

-- CreateEnum
CREATE TYPE "accounts"."VoucherNature" AS ENUM ('SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'DEBIT_NOTE', 'CREDIT_NOTE', 'STOCK_JOURNAL');

-- CreateEnum
CREATE TYPE "accounts"."VoucherNumberingMode" AS ENUM ('AUTO', 'MANUAL', 'AUTO_MANUAL');

-- CreateEnum
CREATE TYPE "accounts"."VoucherResetFreq" AS ENUM ('NEVER', 'DAILY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "audit"."audit_log_action" AS ENUM ('insert', 'update', 'approve', 'cancel');

-- CreateEnum
CREATE TYPE "audit"."audit_screen_type" AS ENUM ('master', 'transaction', 'settings', 'other');

-- CreateTable
CREATE TABLE "accounts"."acc_bill_adjustment" (
    "abj_id" UUID NOT NULL DEFAULT uuidv7(),
    "abj_company_id" UUID NOT NULL,
    "abj_branch_id" UUID NOT NULL,
    "abj_tenant_id" UUID,
    "abj_acc_year" CHAR(9) NOT NULL,
    "abj_bill_id" UUID NOT NULL,
    "abj_bill_acc_year" CHAR(9) NOT NULL,
    "abj_party_id" UUID NOT NULL,
    "abj_row_no" INTEGER NOT NULL DEFAULT 1,
    "abj_against_bill_id" UUID,
    "abj_against_bill_acc_year" CHAR(9),
    "abj_voucher_id" UUID,
    "abj_voucher_acc_year" CHAR(9),
    "abj_voucher_line_id" UUID,
    "abj_adj_type" VARCHAR(20) NOT NULL,
    "abj_adj_date" DATE NOT NULL,
    "abj_dr_cr" CHAR(2) NOT NULL,
    "abj_amount" DECIMAL(18,2) NOT NULL,
    "abj_settlement_mode" VARCHAR(20),
    "abj_settlement_ledger_id" UUID,
    "abj_tender_id" UUID,
    "abj_tender_acc_year" CHAR(9),
    "abj_cheque_id" UUID,
    "abj_cheque_acc_year" CHAR(9),
    "abj_is_post_dated" BOOLEAN NOT NULL DEFAULT false,
    "abj_reversal_of_id" UUID,
    "abj_reversal_reason" VARCHAR(250),
    "abj_remarks" VARCHAR(250),
    "abj_approved_by" UUID,
    "abj_user_id" UUID NOT NULL,
    "abj_session_id" UUID,
    "abj_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "abj_sync_date" TIMESTAMPTZ(6),
    "abj_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abj_created_by" VARCHAR(50),
    "abj_modified_on" TIMESTAMPTZ(6),
    "abj_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_bill_adjustment" PRIMARY KEY ("abj_id","abj_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_bill_balance" (
    "abl_id" UUID NOT NULL DEFAULT uuidv7(),
    "abl_company_id" UUID NOT NULL,
    "abl_branch_id" UUID NOT NULL,
    "abl_tenant_id" UUID,
    "abl_acc_year" CHAR(9) NOT NULL,
    "abl_party_id" UUID NOT NULL,
    "abl_salesman_id" UUID,
    "abl_agent_id" UUID,
    "abl_bill_type" VARCHAR(20) NOT NULL,
    "abl_src_module" VARCHAR(20),
    "abl_src_doc_type" VARCHAR(30),
    "abl_src_doc_id" UUID,
    "abl_src_acc_year" CHAR(9),
    "abl_parent_bill_id" UUID,
    "abl_parent_acc_year" CHAR(9),
    "abl_voucher_id" UUID,
    "abl_voucher_line_id" UUID,
    "abl_voucher_type_id" INTEGER,
    "abl_voucher_no" BIGINT,
    "abl_voucher_date" DATE,
    "abl_voucher_refno" VARCHAR(50),
    "abl_doc_refno" VARCHAR(100) NOT NULL,
    "abl_doc_date" DATE NOT NULL,
    "abl_due_date" DATE,
    "abl_credit_days" SMALLINT NOT NULL DEFAULT 0,
    "abl_grace_days" SMALLINT NOT NULL DEFAULT 0,
    "abl_dr_cr" CHAR(2) NOT NULL,
    "abl_narration" TEXT,
    "abl_bill_amount" DECIMAL(18,2) NOT NULL,
    "abl_alloc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abl_disc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abl_writeoff_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abl_tcs_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "abl_pending_amount" DECIMAL(18,2),
    "abl_status" VARCHAR(10),
    "abl_settled_on" DATE,
    "abl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "abl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "abl_sync_date" TIMESTAMPTZ(6),
    "abl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abl_created_by" VARCHAR(50),
    "abl_modified_on" TIMESTAMPTZ(6),
    "abl_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_bill_balance" PRIMARY KEY ("abl_id","abl_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_cheque_book" (
    "acb_id" UUID NOT NULL DEFAULT uuidv7(),
    "acb_company_id" UUID NOT NULL,
    "acb_branch_id" UUID,
    "acb_bank_ledger_id" UUID NOT NULL,
    "acb_book_no" VARCHAR(30) NOT NULL,
    "acb_leaf_from" BIGINT NOT NULL,
    "acb_leaf_to" BIGINT NOT NULL,
    "acb_next_leaf" BIGINT NOT NULL,
    "acb_leaf_width" SMALLINT NOT NULL DEFAULT 6,
    "acb_format" VARCHAR(30),
    "acb_status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "acb_closed_on" TIMESTAMPTZ(6),
    "acb_close_reason" VARCHAR(250),
    "acb_remarks" VARCHAR(250),
    "acb_is_active" BOOLEAN NOT NULL DEFAULT true,
    "acb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "acb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acb_created_by" VARCHAR(50),
    "acb_modified_on" TIMESTAMPTZ(6),
    "acb_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_cheque_book" PRIMARY KEY ("acb_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_group_master" (
    "acc_group_id" UUID NOT NULL DEFAULT uuidv7(),
    "acc_group_company_id" UUID,
    "acc_group_name" VARCHAR(150) NOT NULL,
    "acc_group_alias" VARCHAR(100),
    "acc_group_short" VARCHAR(50),
    "acc_group_description" VARCHAR(250),
    "acc_group_tally_name" VARCHAR(150),
    "acc_group_primary_name" VARCHAR(150),
    "acc_group_nature" VARCHAR(20),
    "acc_ledger_profile" VARCHAR(16) NOT NULL DEFAULT 'General',
    "acc_group_tally_guid" VARCHAR(64),
    "acc_group_tally_master_id" BIGINT,
    "acc_group_tally_alter_id" BIGINT,
    "acc_group_parent_id" UUID,
    "acc_group_sort" INTEGER,
    "acc_group_type" VARCHAR(20) NOT NULL,
    "acc_group_is_default" BOOLEAN NOT NULL DEFAULT false,
    "acc_group_is_reserved" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "acc_group_master_pkey" PRIMARY KEY ("acc_group_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_ledger_map" (
    "alm_id" UUID NOT NULL DEFAULT uuidv7(),
    "alm_company_id" UUID,
    "alm_branch_id" UUID,
    "alm_role" VARCHAR(30) NOT NULL,
    "alm_supply_nature" VARCHAR(5),
    "alm_ledger_id" UUID NOT NULL,
    "alm_remarks" VARCHAR(250),
    "alm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "alm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "alm_sync_date" TIMESTAMPTZ(6),
    "alm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alm_created_by" VARCHAR(50),
    "alm_modified_on" TIMESTAMPTZ(6),
    "alm_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_ledger_map" PRIMARY KEY ("alm_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_ledger_master" (
    "led_id" UUID NOT NULL DEFAULT uuidv7(),
    "led_company_id" UUID,
    "led_branch_id" UUID,
    "led_group_id" UUID NOT NULL,
    "led_name" VARCHAR(200) NOT NULL,
    "led_alias" VARCHAR(100),
    "led_short" VARCHAR(50),
    "led_tally_name" VARCHAR(200),
    "led_tally_group_name" VARCHAR(150),
    "led_tally_guid" VARCHAR(64),
    "led_tally_master_id" BIGINT,
    "led_tally_alter_id" BIGINT,
    "led_category" VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    "led_ledger_type" VARCHAR(20),
    "led_mailing_name" VARCHAR(200),
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
    "led_region_name" TEXT,
    "led_region_addr1" VARCHAR(200),
    "led_region_addr2" VARCHAR(200),
    "led_region_addr3" VARCHAR(200),
    "led_region_city" VARCHAR(100),
    "led_region_district" VARCHAR(100),
    "led_region_state_name" VARCHAR(100),
    "led_region_country" VARCHAR(60) DEFAULT 'India',
    "led_gst_party_reg_type" VARCHAR(20),
    "led_gstin_no" VARCHAR(15),
    "led_pan_no" VARCHAR(10),
    "led_aadhar_no" VARCHAR(20),
    "led_ecommerce_gstin" VARCHAR(15),
    "led_is_sez" BOOLEAN NOT NULL DEFAULT false,
    "led_type_of_supply" VARCHAR(10),
    "led_hsn_sac" VARCHAR(10),
    "led_tax_id" UUID,
    "led_gst_party_type" VARCHAR(30),
    "led_tan_no" VARCHAR(10),
    "led_cin" VARCHAR(21),
    "led_udyam_no" VARCHAR(25),
    "led_msme_type" VARCHAR(10),
    "led_gst_duty_head" VARCHAR(20),
    "led_rounding_method" VARCHAR(15),
    "led_rounding_limit" DECIMAL,
    "led_is_tds_applicable" BOOLEAN NOT NULL DEFAULT false,
    "led_tds_deductee_type" VARCHAR(16),
    "led_tds_nature_of_payment" VARCHAR(16),
    "led_is_tcs_applicable" BOOLEAN NOT NULL DEFAULT false,
    "led_itc_eligibility" VARCHAR(20),
    "led_is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "led_ob_amount" DECIMAL NOT NULL DEFAULT 0,
    "led_ob_type" VARCHAR(2) NOT NULL DEFAULT 'DR',
    "led_ob_as_on" DATE,
    "led_total_dr" DECIMAL NOT NULL DEFAULT 0,
    "led_total_cr" DECIMAL NOT NULL DEFAULT 0,
    "led_total_balance" DECIMAL NOT NULL DEFAULT 0,
    "led_sort_order" INTEGER,
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
CREATE TABLE "accounts"."acc_ledger_role" (
    "alr_role" VARCHAR(30) NOT NULL,
    "alr_label" VARCHAR(60) NOT NULL,
    "alr_group" VARCHAR(20) NOT NULL,
    "alr_want_type" VARCHAR(20),
    "alr_want_duty" VARCHAR(20),
    "alr_want_nature" VARCHAR(20),
    "alr_by_supply" BOOLEAN NOT NULL DEFAULT false,
    "alr_by_rate" BOOLEAN NOT NULL DEFAULT false,
    "alr_sort_order" SMALLINT NOT NULL DEFAULT 0,
    "alr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "alr_remarks" VARCHAR(250),
    "alr_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_acc_ledger_role" PRIMARY KEY ("alr_role")
);

-- CreateTable
CREATE TABLE "accounts"."acc_opening_balance" (
    "op_id" UUID NOT NULL DEFAULT uuidv7(),
    "op_company_id" UUID NOT NULL,
    "op_branch_id" UUID,
    "op_acc_year" CHAR(9) NOT NULL,
    "op_ledger_id" UUID NOT NULL,
    "op_tenant_id" UUID,
    "op_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "op_dr_cr" CHAR(1) NOT NULL,
    "op_source" VARCHAR(20) NOT NULL DEFAULT 'CARRY_FORWARD',
    "op_is_stale" BOOLEAN NOT NULL DEFAULT false,
    "op_stale_since" TIMESTAMPTZ(6),
    "op_stale_reason" VARCHAR(30),
    "op_stale_ref_id" UUID,
    "op_stale_ref_acc_year" CHAR(9),
    "op_generated_at" TIMESTAMPTZ(6),
    "op_generated_by" VARCHAR(50),
    "op_remarks" TEXT,
    "op_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "op_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "op_created_by" VARCHAR(50),
    "op_modified_at" TIMESTAMPTZ(6),
    "op_modified_by" VARCHAR(50),
    "op_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_acc_opening" PRIMARY KEY ("op_id","op_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_opening_run" (
    "aor_id" UUID NOT NULL DEFAULT uuidv7(),
    "aor_company_id" UUID NOT NULL,
    "aor_branch_id" UUID,
    "aor_from_acc_year" CHAR(9) NOT NULL,
    "aor_to_acc_year" CHAR(9) NOT NULL,
    "aor_run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aor_run_by" VARCHAR(50),
    "aor_created" INTEGER NOT NULL DEFAULT 0,
    "aor_updated" INTEGER NOT NULL DEFAULT 0,
    "aor_skipped_manual" INTEGER NOT NULL DEFAULT 0,
    "aor_total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "aor_total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "aor_difference" DECIMAL(18,2) NOT NULL DEFAULT (aor_total_debit - aor_total_credit),
    "aor_overwrite_manual" BOOLEAN NOT NULL DEFAULT false,
    "aor_remarks" VARCHAR(500),
    "aor_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_acc_opening_run" PRIMARY KEY ("aor_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_party_tax_certificate" (
    "ptc_id" UUID NOT NULL DEFAULT uuidv7(),
    "ptc_company_id" UUID NOT NULL,
    "ptc_party_id" UUID NOT NULL,
    "ptc_kind" VARCHAR(20) NOT NULL,
    "ptc_number" VARCHAR(50),
    "ptc_rate_perc" DECIMAL(6,3),
    "ptc_limit_amount" DECIMAL(18,2),
    "ptc_issued_on" DATE,
    "ptc_valid_from" DATE NOT NULL,
    "ptc_valid_to" DATE,
    "ptc_verified_on" DATE,
    "ptc_verified_by" VARCHAR(50),
    "ptc_file_ref" VARCHAR(250),
    "ptc_remarks" VARCHAR(250),
    "ptc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ptc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ptc_sync_date" TIMESTAMPTZ(6),
    "ptc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ptc_created_by" VARCHAR(50),
    "ptc_modified_on" TIMESTAMPTZ(6),
    "ptc_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_party_tax_certificate" PRIMARY KEY ("ptc_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_pdc_register" (
    "apd_id" UUID NOT NULL DEFAULT uuidv7(),
    "apd_company_id" UUID NOT NULL,
    "apd_branch_id" UUID NOT NULL,
    "apd_tenant_id" UUID,
    "apd_acc_year" CHAR(9) NOT NULL,
    "apd_tra_type" CHAR(1) NOT NULL,
    "apd_party_id" UUID NOT NULL,
    "apd_salesman_id" UUID,
    "apd_instrument_type" VARCHAR(20) NOT NULL DEFAULT 'CHEQUE',
    "apd_instrument_no" VARCHAR(30) NOT NULL,
    "apd_instrument_date" DATE NOT NULL,
    "apd_amount" DECIMAL(18,2) NOT NULL,
    "apd_bank_name" VARCHAR(100),
    "apd_bank_branch" VARCHAR(100),
    "apd_ifsc" VARCHAR(11),
    "apd_micr" VARCHAR(9),
    "apd_drawer_name" VARCHAR(150),
    "apd_received_on" DATE NOT NULL,
    "apd_bank_ledger_id" UUID,
    "apd_posting_mode" VARCHAR(15) NOT NULL DEFAULT 'ON_CLEARING',
    "apd_voucher_id" UUID,
    "apd_voucher_acc_year" CHAR(9),
    "apd_tender_id" UUID,
    "apd_status" VARCHAR(15) NOT NULL DEFAULT 'HELD',
    "apd_status_on" TIMESTAMPTZ(6),
    "apd_status_by" VARCHAR(50),
    "apd_present_count" INTEGER NOT NULL DEFAULT 0,
    "apd_deposit_date" DATE,
    "apd_deposit_slip_no" VARCHAR(50),
    "apd_clear_date" DATE,
    "apd_clear_voucher_id" UUID,
    "apd_clear_acc_year" CHAR(9),
    "apd_bounce_date" DATE,
    "apd_bounce_reason" VARCHAR(150),
    "apd_bounce_charges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "apd_bounce_voucher_id" UUID,
    "apd_bounce_acc_year" CHAR(9),
    "apd_charge_voucher_id" UUID,
    "apd_charge_acc_year" CHAR(9),
    "apd_replaced_by_id" UUID,
    "apd_replaced_by_acc_year" CHAR(9),
    "apd_cancel_date" DATE,
    "apd_cancel_reason" VARCHAR(250),
    "apd_amended_into_revision" INTEGER,
    "apd_remarks" TEXT,
    "apd_cheque_book_id" UUID,
    "apd_favouring" VARCHAR(150),
    "apd_ac_payee" BOOLEAN NOT NULL DEFAULT true,
    "apd_printed_on" TIMESTAMPTZ(6),
    "apd_print_count" INTEGER NOT NULL DEFAULT 0,
    "apd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "apd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "apd_sync_date" TIMESTAMPTZ(6),
    "apd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apd_created_by" VARCHAR(50),
    "apd_modified_on" TIMESTAMPTZ(6),
    "apd_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_pdc_register" PRIMARY KEY ("apd_id","apd_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_settlement_import" (
    "asi_id" UUID NOT NULL DEFAULT uuidv7(),
    "asi_company_id" UUID NOT NULL,
    "asi_branch_id" UUID NOT NULL,
    "asi_tenant_id" UUID,
    "asi_acc_year" CHAR(9) NOT NULL,
    "asi_source" VARCHAR(12) NOT NULL,
    "asi_provider" VARCHAR(60) NOT NULL,
    "asi_tender_id" UUID,
    "asi_file_name" VARCHAR(250) NOT NULL,
    "asi_file_hash" VARCHAR(64) NOT NULL,
    "asi_payout_ref" VARCHAR(60),
    "asi_payout_date" DATE NOT NULL,
    "asi_period_from" DATE,
    "asi_period_to" DATE,
    "asi_line_count" INTEGER NOT NULL DEFAULT 0,
    "asi_total_gross" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asi_total_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asi_total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asi_total_net" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asi_status" VARCHAR(10) NOT NULL DEFAULT 'IMPORTED',
    "asi_bank_ledger_id" UUID,
    "asi_voucher_id" UUID,
    "asi_voucher_acc_year" CHAR(9),
    "asi_imported_by" UUID NOT NULL,
    "asi_imported_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asi_posted_by" UUID,
    "asi_posted_on" TIMESTAMPTZ(6),
    "asi_void_reason" VARCHAR(250),
    "asi_notes" VARCHAR(500),
    "asi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "asi_sync_date" TIMESTAMPTZ(6),
    "asi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asi_created_by" VARCHAR(50),
    "asi_modified_on" TIMESTAMPTZ(6),
    "asi_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_settlement_import" PRIMARY KEY ("asi_id","asi_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_settlement_line" (
    "asl_id" UUID NOT NULL DEFAULT uuidv7(),
    "asl_acc_year" CHAR(9) NOT NULL,
    "asl_import_id" UUID NOT NULL,
    "asl_row_no" INTEGER NOT NULL,
    "asl_kind" VARCHAR(12) NOT NULL,
    "asl_txn_on" TIMESTAMPTZ(6),
    "asl_terminal_id" VARCHAR(40),
    "asl_vpa" VARCHAR(100),
    "asl_tender_id" UUID,
    "asl_ref_no" VARCHAR(60),
    "asl_auth_code" VARCHAR(20),
    "asl_card_last4" CHAR(4),
    "asl_payer" VARCHAR(150),
    "asl_gross_amount" DECIMAL(15,2) NOT NULL,
    "asl_fee_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asl_tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asl_net_amount" DECIMAL(15,2) NOT NULL,
    "asl_match_status" VARCHAR(10) NOT NULL DEFAULT 'UNMATCHED',
    "asl_match_rule" VARCHAR(12),
    "asl_td_id" UUID,
    "asl_td_acc_year" CHAR(9),
    "asl_amount_diff" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asl_matched_by" UUID,
    "asl_matched_on" TIMESTAMPTZ(6),
    "asl_resolution" VARCHAR(12),
    "asl_reason_id" UUID,
    "asl_approval_id" UUID,
    "asl_resolution_voucher_id" UUID,
    "asl_resolution_acc_year" CHAR(9),
    "asl_tvr_id" UUID,
    "asl_tvr_acc_year" CHAR(9),
    "asl_raw" JSONB,
    "asl_notes" VARCHAR(500),
    "asl_sync_date" TIMESTAMPTZ(6),
    "asl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asl_modified_on" TIMESTAMPTZ(6),

    CONSTRAINT "pk_acc_settlement_line" PRIMARY KEY ("asl_id","asl_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_tcs_register" (
    "atc_id" UUID NOT NULL DEFAULT uuidv7(),
    "atc_company_id" UUID NOT NULL,
    "atc_branch_id" UUID NOT NULL,
    "atc_tenant_id" UUID,
    "atc_acc_year" CHAR(9) NOT NULL,
    "atc_quarter" CHAR(2) NOT NULL,
    "atc_party_id" UUID NOT NULL,
    "atc_pan" VARCHAR(10),
    "atc_party_name" VARCHAR(150) NOT NULL,
    "atc_section" VARCHAR(20) NOT NULL,
    "atc_rate" DECIMAL(6,3) NOT NULL,
    "atc_rate_source" VARCHAR(20) NOT NULL,
    "atc_base_amount" DECIMAL(18,2) NOT NULL,
    "atc_tax_amount" DECIMAL(18,2) NOT NULL,
    "atc_voucher_id" UUID,
    "atc_voucher_acc_year" CHAR(9),
    "atc_doc_refno" VARCHAR(50),
    "atc_doc_date" DATE NOT NULL,
    "atc_bill_id" UUID,
    "atc_bill_acc_year" CHAR(9),
    "atc_reversal_of_id" UUID,
    "atc_challan_no" VARCHAR(30),
    "atc_challan_date" DATE,
    "atc_challan_bsr" VARCHAR(7),
    "atc_certificate_no" VARCHAR(30),
    "atc_certificate_date" DATE,
    "atc_remarks" VARCHAR(250),
    "atc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "atc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "atc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atc_created_by" VARCHAR(50),
    "atc_modified_on" TIMESTAMPTZ(6),
    "atc_modified_by" VARCHAR(50),
    "atc_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "acc_tcs_register_pkey" PRIMARY KEY ("atc_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_tds_register" (
    "atd_id" UUID NOT NULL DEFAULT uuidv7(),
    "atd_company_id" UUID NOT NULL,
    "atd_branch_id" UUID NOT NULL,
    "atd_tenant_id" UUID,
    "atd_acc_year" CHAR(9) NOT NULL,
    "atd_quarter" CHAR(2) NOT NULL,
    "atd_direction" VARCHAR(10) NOT NULL,
    "atd_party_id" UUID NOT NULL,
    "atd_pan" VARCHAR(10),
    "atd_party_name" VARCHAR(150) NOT NULL,
    "atd_deductee_type" VARCHAR(20),
    "atd_section" VARCHAR(20) NOT NULL,
    "atd_rate" DECIMAL(6,3) NOT NULL,
    "atd_rate_source" VARCHAR(20) NOT NULL,
    "atd_base_amount" DECIMAL(18,2) NOT NULL,
    "atd_tax_amount" DECIMAL(18,2) NOT NULL,
    "atd_voucher_id" UUID,
    "atd_voucher_acc_year" CHAR(9),
    "atd_doc_refno" VARCHAR(50),
    "atd_doc_date" DATE NOT NULL,
    "atd_bill_id" UUID,
    "atd_bill_acc_year" CHAR(9),
    "atd_reversal_of_id" UUID,
    "atd_challan_no" VARCHAR(30),
    "atd_challan_date" DATE,
    "atd_challan_bsr" VARCHAR(7),
    "atd_certificate_no" VARCHAR(30),
    "atd_certificate_date" DATE,
    "atd_remarks" VARCHAR(250),
    "atd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "atd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "atd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atd_created_by" VARCHAR(50),
    "atd_modified_on" TIMESTAMPTZ(6),
    "atd_modified_by" VARCHAR(50),
    "atd_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "acc_tds_register_pkey" PRIMARY KEY ("atd_id")
);

-- CreateTable
CREATE TABLE "accounts"."tds_rates" (
    "tdr_id" UUID NOT NULL DEFAULT uuidv7(),
    "tdr_company_id" UUID,
    "tdr_section" VARCHAR(16) NOT NULL,
    "tdr_section_name" VARCHAR(120) NOT NULL,
    "tdr_deductee_type" VARCHAR(16) NOT NULL,
    "tdr_rate" DECIMAL(6,3) NOT NULL,
    "tdr_no_pan_rate" DECIMAL(6,3) NOT NULL DEFAULT 20,
    "tdr_threshold_single" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tdr_threshold_annual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tdr_effective_from" DATE NOT NULL,
    "tdr_effective_to" DATE,
    "tdr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tdr_remarks" VARCHAR(250),
    "tdr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tdr_sync_date" TIMESTAMPTZ(6),
    "tdr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tdr_created_by" VARCHAR(50),
    "tdr_modified_on" TIMESTAMPTZ(6),
    "tdr_modified_by" VARCHAR(50),

    CONSTRAINT "tds_rates_pkey" PRIMARY KEY ("tdr_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_temp_credit" (
    "atc_id" UUID NOT NULL DEFAULT uuidv7(),
    "atc_company_id" UUID NOT NULL,
    "atc_branch_id" UUID NOT NULL,
    "atc_tenant_id" UUID,
    "atc_acc_year" CHAR(9) NOT NULL,
    "atc_party_id" UUID NOT NULL,
    "atc_src_doc_type" VARCHAR(30) NOT NULL DEFAULT 'SALE_BILL',
    "atc_src_doc_id" UUID NOT NULL,
    "atc_bill_refno" VARCHAR(100),
    "atc_bill_date" DATE NOT NULL,
    "atc_bill_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "atc_abl_id" UUID NOT NULL,
    "atc_abl_acc_year" CHAR(9) NOT NULL,
    "atc_tender_id" UUID,
    "atc_tender_acc_year" CHAR(9),
    "atc_name" VARCHAR(200) NOT NULL,
    "atc_mobile" VARCHAR(20) NOT NULL,
    "atc_place" VARCHAR(100),
    "atc_addr" VARCHAR(250),
    "atc_id_ref" VARCHAR(50),
    "atc_days" INTEGER NOT NULL DEFAULT 0,
    "atc_due_date" DATE NOT NULL,
    "atc_credit_amount" DECIMAL(15,2) NOT NULL,
    "atc_balance_amount" DECIMAL(15,2) NOT NULL,
    "atc_status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "atc_settled_on" DATE,
    "atc_last_receipt_id" UUID,
    "atc_promise_date" DATE,
    "atc_followup_on" TIMESTAMPTZ(6),
    "atc_followup_by" UUID,
    "atc_reminder_sent_on" TIMESTAMPTZ(6),
    "atc_remarks" VARCHAR(500),
    "atc_user_id" UUID,
    "atc_counter_id" UUID,
    "atc_session_id" UUID,
    "atc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "atc_sync_date" TIMESTAMPTZ(6),
    "atc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atc_created_by" VARCHAR(50),
    "atc_modified_on" TIMESTAMPTZ(6),
    "atc_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_temp_credit" PRIMARY KEY ("atc_id","atc_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_tender_detail" (
    "td_id" UUID NOT NULL DEFAULT uuidv7(),
    "td_company_id" UUID NOT NULL,
    "td_branch_id" UUID NOT NULL,
    "td_tenant_id" UUID,
    "td_acc_year" CHAR(9) NOT NULL,
    "td_src_module" VARCHAR(20) NOT NULL,
    "td_src_doc_type" VARCHAR(30) NOT NULL,
    "td_src_doc_id" UUID NOT NULL,
    "td_row_no" INTEGER NOT NULL,
    "td_doc_date" DATE NOT NULL,
    "td_party_ledger_id" UUID NOT NULL,
    "td_voucher_id" UUID,
    "td_tender_id" UUID NOT NULL,
    "td_tender_type_id" INTEGER NOT NULL,
    "td_tender_ledger_id" UUID NOT NULL,
    "td_dr_cr" CHAR(2) NOT NULL,
    "td_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "td_surcharge_perc" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "td_surcharge_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "td_surcharge_ledger_id" UUID,
    "td_total_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "td_received_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "td_change_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "td_units_used" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "td_conversion_rate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "td_ref_no" VARCHAR(100),
    "td_auth_code" VARCHAR(50),
    "td_card_last4" VARCHAR(4),
    "td_bank_name" VARCHAR(150),
    "td_payer_vpa" VARCHAR(100),
    "td_instrument_date" DATE,
    "td_is_pdc" BOOLEAN NOT NULL DEFAULT false,
    "td_settle_status" VARCHAR(20) NOT NULL DEFAULT 'NA',
    "td_settle_ledger_id" UUID,
    "td_expected_settle_on" DATE,
    "td_settled_on" DATE,
    "td_settle_amount" DECIMAL(18,2),
    "td_mdr_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "td_settle_ref_no" VARCHAR(100),
    "td_settle_voucher_id" UUID,
    "td_session_id" UUID,
    "td_device_id" VARCHAR(250),
    "td_user_id" UUID NOT NULL,
    "td_notes" VARCHAR(250),
    "td_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "td_sync_date" TIMESTAMPTZ,
    "td_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "td_created_by" VARCHAR(50) NOT NULL,
    "td_modified_on" TIMESTAMPTZ,
    "td_modified_by" VARCHAR(50),
    "td_is_voided" BOOLEAN NOT NULL DEFAULT false,
    "td_void_reason" VARCHAR(30),
    "td_voided_on" TIMESTAMPTZ(6),
    "td_voided_by" UUID,
    "td_replaces_id" UUID,
    "td_beneficiary_name" VARCHAR(150),
    "td_beneficiary_account_no" VARCHAR(34),
    "td_beneficiary_ifsc" VARCHAR(11),

    CONSTRAINT "pk_acc_tender_detail" PRIMARY KEY ("td_id","td_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_tender_master" (
    "tnd_id" UUID NOT NULL DEFAULT uuidv7(),
    "tnd_company_id" UUID NOT NULL,
    "tnd_branch_id" UUID,
    "tnd_type_id" INTEGER NOT NULL,
    "tnd_name" VARCHAR(100) NOT NULL,
    "tnd_short_name" VARCHAR(30) NOT NULL,
    "tnd_ledger_id" UUID,
    "tnd_settlement_ledger_id" UUID,
    "tnd_settlement_days" SMALLINT NOT NULL DEFAULT 0,
    "tnd_bank_account_id" UUID,
    "tnd_min_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tnd_max_amount" DECIMAL(14,2),
    "tnd_daily_limit" DECIMAL(14,2),
    "tnd_surcharge_perc" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "tnd_surcharge_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tnd_surcharge_ledger_id" UUID,
    "tnd_edit_surcharge" BOOLEAN NOT NULL DEFAULT false,
    "tnd_edit_ledger" BOOLEAN NOT NULL DEFAULT false,
    "tnd_upi_vpa" VARCHAR(100),
    "tnd_upi_qr_payload" TEXT,
    "tnd_merchant_id" VARCHAR(50),
    "tnd_terminal_id" VARCHAR(50),
    "tnd_conversion_rate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "tnd_needs_ref" BOOLEAN,
    "tnd_allow_change" BOOLEAN,
    "tnd_allow_in_return" BOOLEAN,
    "tnd_open_cash_drawer" BOOLEAN NOT NULL DEFAULT false,
    "tnd_is_default" BOOLEAN NOT NULL DEFAULT false,
    "tnd_display_position" INTEGER NOT NULL DEFAULT 0,
    "tnd_hotkey" VARCHAR(10),
    "tnd_colour" VARCHAR(9),
    "tnd_effective_from" DATE,
    "tnd_effective_to" DATE,
    "tnd_remarks" VARCHAR(250),
    "tnd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tnd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tnd_sync_date" TIMESTAMPTZ,
    "tnd_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tnd_created_by" VARCHAR(50),
    "tnd_modified_on" TIMESTAMPTZ,
    "tnd_modified_by" VARCHAR(50),
    "tnd_statement_format" JSONB,

    CONSTRAINT "pk_acc_tender_master" PRIMARY KEY ("tnd_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_tender_types" (
    "ttm_type_id" INTEGER NOT NULL,
    "ttm_type_name" VARCHAR(50) NOT NULL,
    "ttm_display_name" VARCHAR(50) NOT NULL,
    "ttm_is_cash" BOOLEAN NOT NULL DEFAULT false,
    "ttm_needs_ref" BOOLEAN NOT NULL DEFAULT false,
    "ttm_ref_label" VARCHAR(30),
    "ttm_sale_only" BOOLEAN NOT NULL DEFAULT false,
    "ttm_allow_change" BOOLEAN NOT NULL DEFAULT false,
    "ttm_allow_in_return" BOOLEAN NOT NULL DEFAULT true,
    "ttm_display_order" INTEGER NOT NULL DEFAULT 0,
    "ttm_close_mode" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "ttm_handover" BOOLEAN NOT NULL DEFAULT false,
    "ttm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ttm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ttm_sync_date" TIMESTAMPTZ,
    "ttm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttm_created_by" VARCHAR(50),
    "ttm_modified_on" TIMESTAMPTZ,
    "ttm_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_tender_types" PRIMARY KEY ("ttm_type_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_doc_detail" (
    "vtx_id" UUID NOT NULL DEFAULT uuidv7(),
    "vtx_gdr_id" UUID NOT NULL,
    "vtx_voucher_id" UUID NOT NULL,
    "vtx_row_no" INTEGER NOT NULL,
    "vtx_acc_year" VARCHAR(9) NOT NULL,
    "vtx_company_id" UUID NOT NULL,
    "vtx_branch_id" UUID NOT NULL,
    "vtx_taxability" "accounts"."VoucherDocDetailTaxability" NOT NULL DEFAULT 'TAXABLE',
    "vtx_supply_nature" "accounts"."VoucherDocDetailSupplyNature" NOT NULL,
    "vtx_item_id" UUID,
    "vtx_item_code" VARCHAR(50),
    "vtx_item_name" VARCHAR(200),
    "vtx_item_description" VARCHAR(250),
    "vtx_hsn_code" VARCHAR(20),
    "vtx_tally_hsn_source" VARCHAR(20),
    "vtx_unit_id" UUID,
    "vtx_item_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "vtx_item_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vtx_item_discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_is_service" BOOLEAN NOT NULL DEFAULT false,
    "vtx_taxable_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_total_tax_rate" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "vtx_tax_id" UUID,
    "vtx_cgst_rate" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "vtx_sgst_rate" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "vtx_igst_rate" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "vtx_cess_rate" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "vtx_cgst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_sgst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_igst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_cess_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_total_tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_other_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_total_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_bill_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vtx_taxable_ledger_id" UUID,
    "vtx_cgst_ledger_id" UUID,
    "vtx_sgst_ledger_id" UUID,
    "vtx_igst_ledger_id" UUID,
    "vtx_cess_ledger_id" UUID,
    "vtx_itc_eligibility" VARCHAR(16),
    "vtx_is_active" BOOLEAN NOT NULL DEFAULT true,
    "vtx_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "vtx_sync_date" TIMESTAMPTZ(6),
    "vtx_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vtx_created_by" UUID,
    "vtx_updated_on" TIMESTAMPTZ(6),
    "vtx_updated_by" UUID,

    CONSTRAINT "pk_acc_voucher_doc_detail" PRIMARY KEY ("vtx_id","vtx_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_doc_einvoice" (
    "gde_id" UUID NOT NULL DEFAULT uuidv7(),
    "gde_gdr_id" UUID NOT NULL,
    "gde_voucher_id" UUID NOT NULL,
    "gde_acc_year" VARCHAR(9) NOT NULL,
    "gde_company_id" UUID NOT NULL,
    "gde_branch_id" UUID NOT NULL,
    "gde_status" "accounts"."GdeStatus" NOT NULL DEFAULT 'NA',
    "gde_irn" VARCHAR(200),
    "gde_ack_no" VARCHAR(100),
    "gde_ack_on" TIMESTAMPTZ(6),
    "gde_qrcode" TEXT,
    "gde_signed_invoice" TEXT,
    "gde_signed_qrcode" TEXT,
    "gde_cancel_reason" VARCHAR(200),
    "gde_cancelled_on" TIMESTAMPTZ(6),
    "gde_last_error_code" VARCHAR(50),
    "gde_last_message" VARCHAR(500),
    "gde_gcc_id" UUID,
    "gde_gpv_code" VARCHAR(20),
    "gde_irp_code" VARCHAR(10),
    "gde_next_attempt_on" TIMESTAMPTZ(6),
    "gde_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gde_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gde_sync_date" TIMESTAMPTZ(6),
    "gde_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gde_created_by" UUID,
    "gde_modified_on" TIMESTAMPTZ(6),
    "gde_modified_by" UUID,
    "gde_tenant_id" UUID,
    "gde_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "gde_last_attempt_on" TIMESTAMPTZ(6),
    "gde_request_payload" JSONB,
    "gde_response_payload" JSONB,

    CONSTRAINT "pk_acc_voucher_doc_einvoice" PRIMARY KEY ("gde_id","gde_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_doc_ewaybill" (
    "gdw_id" UUID NOT NULL DEFAULT uuidv7(),
    "gdw_gdr_id" UUID NOT NULL,
    "gdw_voucher_id" UUID NOT NULL,
    "gdw_acc_year" VARCHAR(9) NOT NULL,
    "gdw_company_id" UUID NOT NULL,
    "gdw_branch_id" UUID NOT NULL,
    "gdw_status" "accounts"."GdwStatus" NOT NULL DEFAULT 'NA',
    "gdw_no" VARCHAR(100),
    "gdw_generated_on" TIMESTAMPTZ(6),
    "gdw_valid_upto" TIMESTAMPTZ(6),
    "gdw_cancel_reason" VARCHAR(200),
    "gdw_cancelled_on" TIMESTAMPTZ(6),
    "gdw_vehicle_no" VARCHAR(20),
    "gdw_transport_mode" "accounts"."GdwTransportMode",
    "gdw_transporter_id" VARCHAR(15),
    "gdw_transporter_name" VARCHAR(150),
    "gdw_distance_km" INTEGER,
    "gdw_doc_no" VARCHAR(50),
    "gdw_doc_date" DATE,
    "gdw_vehicle_type" "accounts"."GdwVehicleType",
    "gdw_transaction_type" VARCHAR(30),
    "gdw_sub_supply_type" VARCHAR(50),
    "gdw_last_error_code" VARCHAR(50),
    "gdw_last_message" VARCHAR(500),
    "gdw_gcc_id" UUID,
    "gdw_gpv_code" VARCHAR(20),
    "gdw_generated_via" VARCHAR(20),
    "gdw_next_attempt_on" TIMESTAMPTZ(6),
    "gdw_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gdw_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gdw_sync_date" TIMESTAMPTZ(6),
    "gdw_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdw_created_by" UUID,
    "gdw_modified_on" TIMESTAMPTZ(6),
    "gdw_modified_by" UUID,
    "gdw_tenant_id" UUID,
    "gdw_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "gdw_last_attempt_on" TIMESTAMPTZ(6),
    "gdw_request_payload" JSONB,
    "gdw_response_payload" JSONB,
    "gdw_transport_doc_no" VARCHAR(50),
    "gdw_transport_doc_date" DATE,
    "gdw_vehicle_id" UUID,
    "gdw_extended_upto" TIMESTAMPTZ(6),

    CONSTRAINT "pk_acc_voucher_doc_ewaybill" PRIMARY KEY ("gdw_id","gdw_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_doc_register" (
    "gdr_id" UUID NOT NULL DEFAULT uuidv7(),
    "gdr_source_module" "accounts"."GdrSourceModule" NOT NULL,
    "gdr_tran_nature" "accounts"."GdrTranNature" NOT NULL,
    "gdr_doc_flow" "accounts"."GdrDocFlow" NOT NULL,
    "gdr_doc_sign" SMALLINT NOT NULL DEFAULT 1,
    "gdr_source_doc_id" UUID NOT NULL,
    "gdr_acc_year" VARCHAR(9) NOT NULL,
    "gdr_company_id" UUID NOT NULL,
    "gdr_branch_id" UUID NOT NULL,
    "gdr_voucher_type_id" INTEGER NOT NULL,
    "gdr_voucher_id" UUID NOT NULL,
    "gdr_voucher_no" BIGINT NOT NULL,
    "gdr_voucher_date" DATE NOT NULL,
    "gdr_voucher_refno" VARCHAR(50),
    "gdr_doc_type" "accounts"."GdrDocType" NOT NULL,
    "gdr_doc_no" VARCHAR(50) NOT NULL,
    "gdr_doc_date" DATE NOT NULL,
    "gdr_doc_ref_no" VARCHAR(50),
    "gdr_doc_status" "accounts"."GdrDocStatus" NOT NULL DEFAULT 'POSTED',
    "gdr_doc_cancel_reason" VARCHAR(200),
    "gdr_doc_canceled_on" TIMESTAMPTZ(6),
    "gdr_doc_note_no" VARCHAR(50),
    "gdr_doc_note_date" DATE,
    "gdr_doc_note_reason" VARCHAR(150),
    "gdr_supply_class" "accounts"."GdrSupplyClass",
    "gdr_taxability" "accounts"."GdrTaxability" NOT NULL DEFAULT 'TAXABLE',
    "gdr_supply_nature" "accounts"."GdrSupplyNature",
    "gdr_place_of_supply_code" CHAR(2),
    "gdr_place_of_supply_name" VARCHAR(100),
    "gdr_is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "gdr_is_einvoice_applicable" BOOLEAN NOT NULL DEFAULT false,
    "gdr_is_ewaybill_applicable" BOOLEAN NOT NULL DEFAULT false,
    "gdr_party_type" "accounts"."GdrPartyType" NOT NULL DEFAULT 'OTHER',
    "gdr_party_id" UUID NOT NULL,
    "gdr_party_name" VARCHAR(200),
    "gdr_party_addr1" VARCHAR(200),
    "gdr_party_addr2" VARCHAR(200),
    "gdr_party_addr3" VARCHAR(200),
    "gdr_party_location" VARCHAR(100),
    "gdr_party_pin" VARCHAR(10),
    "gdr_party_state_code" CHAR(2),
    "gdr_party_state_name" VARCHAR(100),
    "gdr_party_gst_type" VARCHAR(30),
    "gdr_party_gstin" VARCHAR(15),
    "gdr_party_ecom_gstin" VARCHAR(15),
    "gdr_gross_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_discount_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_taxable_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_cgst_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_sgst_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_igst_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_cess_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_state_cess_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_tcs_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_other_charge" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_round_off" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_bill_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gdr_remarks" VARCHAR(500),
    "gdr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gdr_igst_on_intra" BOOLEAN NOT NULL DEFAULT false,
    "gdr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gdr_sync_date" TIMESTAMPTZ(6),
    "gdr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdr_created_by" UUID,
    "gdr_updated_on" TIMESTAMPTZ(6),
    "gdr_updated_by" UUID,

    CONSTRAINT "pk_acc_voucher_doc_register" PRIMARY KEY ("gdr_id","gdr_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_header" (
    "avh_voucher_id" UUID NOT NULL DEFAULT uuidv7(),
    "avh_company_id" UUID NOT NULL,
    "avh_branch_id" UUID NOT NULL,
    "avh_tenant_id" UUID,
    "avh_acc_year" CHAR(9) NOT NULL,
    "avh_voucher_type_id" INTEGER NOT NULL,
    "avh_voucher_no" BIGINT,
    "avh_voucher_slno" BIGINT,
    "avh_voucher_refno" VARCHAR(50),
    "avh_voucher_date" DATE NOT NULL,
    "avh_src_module" VARCHAR(20),
    "avh_src_doc_type" VARCHAR(30),
    "avh_src_doc_id" UUID,
    "avh_usr_refno" VARCHAR(100),
    "avh_doc_refno" VARCHAR(100),
    "avh_doc_date" DATE,
    "avh_doc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_adjust_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_round_off" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_party_id" UUID,
    "avh_opposite_ledger_id" UUID,
    "avh_employee_id" UUID[],
    "avh_remarks" TEXT,
    "avh_draft_lines" JSONB,
    "avh_against_voucher_id" UUID,
    "avh_against_acc_year" CHAR(9),
    "avh_reversal_voucher_id" UUID,
    "avh_reversal_acc_year" CHAR(9),
    "avh_voucher_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "avh_status_on" TIMESTAMPTZ(6),
    "avh_status_by" UUID,
    "avh_posted_on" TIMESTAMPTZ(6),
    "avh_cancel_reason" VARCHAR(250),
    "avh_revision_no" INTEGER NOT NULL DEFAULT 0,
    "avh_user_id" UUID NOT NULL,
    "avh_session_id" UUID,
    "avh_device_type" VARCHAR(20),
    "avh_device_id" TEXT,
    "avh_print_count" INTEGER NOT NULL DEFAULT 0,
    "avh_whatsapp_status" VARCHAR(10) NOT NULL DEFAULT 'NA',
    "avh_sms_status" VARCHAR(10) NOT NULL DEFAULT 'NA',
    "avh_tally_export_status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "avh_tally_exported_on" TIMESTAMPTZ(6),
    "avh_tally_guid" VARCHAR(100),
    "avh_tally_error_msg" TEXT,
    "avh_is_active" BOOLEAN NOT NULL DEFAULT true,
    "avh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "avh_sync_date" TIMESTAMPTZ(6),
    "avh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avh_created_by" VARCHAR(50),
    "avh_modified_on" TIMESTAMPTZ(6),
    "avh_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_voucher_header" PRIMARY KEY ("avh_voucher_id","avh_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_vouchers" (
    "av_id" UUID NOT NULL DEFAULT uuidv7(),
    "av_voucher_id" UUID NOT NULL,
    "av_company_id" UUID NOT NULL,
    "av_branch_id" UUID NOT NULL,
    "av_tenant_id" UUID,
    "av_acc_year" CHAR(9) NOT NULL,
    "av_voucher_type_id" INTEGER NOT NULL,
    "av_voucher_no" BIGINT NOT NULL,
    "av_row_no" INTEGER NOT NULL,
    "av_voucher_date" DATE NOT NULL,
    "av_voucher_refno" VARCHAR(50),
    "av_doc_date" DATE,
    "av_doc_refno" VARCHAR(100),
    "av_doc_id" UUID,
    "av_doc_acc_year" CHAR(9),
    "av_dr_cr" CHAR(2) NOT NULL,
    "av_ledger_id" UUID NOT NULL,
    "av_opp_ledger_id" UUID,
    "av_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "av_signed_amount" DECIMAL(18,2),
    "av_cost_centre_id" UUID,
    "av_role" VARCHAR(30),
    "av_remarks" TEXT,
    "av_session_id" UUID,
    "av_user_id" UUID NOT NULL,
    "av_recon_date" DATE,
    "av_recon_refno" VARCHAR(50),
    "av_is_reconciled" BOOLEAN,
    "av_is_active" BOOLEAN NOT NULL DEFAULT true,
    "av_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "av_sync_date" TIMESTAMPTZ(6),
    "av_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "av_created_by" TEXT,
    "av_modified_on" TIMESTAMPTZ(6),
    "av_modified_by" TEXT,

    CONSTRAINT "pk_acc_vouchers" PRIMARY KEY ("av_id","av_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_seq" (
    "seq_id" UUID NOT NULL DEFAULT uuidv7(),
    "seq_vchr_type_id" INTEGER NOT NULL,
    "seq_company_id" UUID NOT NULL,
    "seq_branch_id" UUID NOT NULL,
    "seq_acc_year" VARCHAR(9) NOT NULL,
    "seq_device_id" UUID,
    "seq_device_code" VARCHAR(20) NOT NULL DEFAULT 'MAIN',
    "seq_period_key" VARCHAR(20) NOT NULL,
    "seq_last_no" BIGINT NOT NULL DEFAULT 0,
    "seq_voucher_prefix" VARCHAR(60),
    "seq_company_code" VARCHAR(20),
    "seq_branch_code" VARCHAR(20),
    "seq_voucher_suffix" VARCHAR(20),
    "seq_no_width" INTEGER NOT NULL DEFAULT 5,
    "seq_last_refno" VARCHAR(100),
    "seq_is_active" BOOLEAN NOT NULL DEFAULT true,
    "seq_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "seq_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq_created_by" UUID,
    "seq_modified_on" TIMESTAMPTZ,
    "seq_modified_by" UUID,
    "seq_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "acc_voucher_seq_pkey" PRIMARY KEY ("seq_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_types" (
    "vchr_type_id" SERIAL NOT NULL,
    "vchr_type_code" VARCHAR(20) NOT NULL,
    "vchr_type_name" VARCHAR(100) NOT NULL,
    "vchr_type_short" VARCHAR(30),
    "vchr_category" "accounts"."VoucherCategory" NOT NULL DEFAULT 'ACCOUNTING',
    "vchr_nature" "accounts"."VoucherNature" NOT NULL,
    "vchr_numbering_mode" "accounts"."VoucherNumberingMode" NOT NULL DEFAULT 'AUTO',
    "vchr_no_prefix" VARCHAR(20),
    "vchr_no_suffix" VARCHAR(20),
    "vchr_no_width" INTEGER NOT NULL DEFAULT 5,
    "vchr_reset_freq" "accounts"."VoucherResetFreq" NOT NULL DEFAULT 'YEARLY',
    "vchr_allow_manual_no" BOOLEAN NOT NULL DEFAULT false,
    "vchr_affects_accounts" BOOLEAN NOT NULL DEFAULT true,
    "vchr_affects_inventory" BOOLEAN NOT NULL DEFAULT false,
    "vchr_is_cash_voucher" BOOLEAN NOT NULL DEFAULT false,
    "vchr_is_bank_voucher" BOOLEAN NOT NULL DEFAULT false,
    "vchr_print_title" VARCHAR(100),
    "vchr_sort_order" INTEGER NOT NULL DEFAULT 0,
    "vchr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "vchr_tally_export_enabled" BOOLEAN NOT NULL DEFAULT true,
    "vchr_tally_voucher_type_name" VARCHAR(100),
    "vchr_tally_base_voucher_type" VARCHAR(50),
    "vchr_party_mode" VARCHAR(4) NOT NULL DEFAULT 'NONE',
    "vchr_party_side" VARCHAR(3) NOT NULL DEFAULT 'ANY',
    "vchr_billwise_mode" VARCHAR(8) NOT NULL DEFAULT 'OFF',
    "vchr_raise_bill_type" VARCHAR(20),
    "vchr_dr_groups" UUID[] DEFAULT ARRAY[]::UUID[],
    "vchr_cr_groups" UUID[] DEFAULT ARRAY[]::UUID[],
    "vchr_gst_register" VARCHAR(10),
    "vchr_gst_side" VARCHAR(6),
    "vchr_tds_mode" VARCHAR(8) NOT NULL DEFAULT 'OFF',
    "vchr_menu_id" INTEGER,
    "vchr_in_register" BOOLEAN NOT NULL DEFAULT false,
    "vchr_instruments" BOOLEAN NOT NULL DEFAULT false,
    "vchr_sync_date" TIMESTAMPTZ(6),
    "vchr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vchr_created_by" VARCHAR(100),
    "vchr_updated_on" TIMESTAMPTZ(6),
    "vchr_updated_by" VARCHAR(100),

    CONSTRAINT "acc_voucher_types_pkey" PRIMARY KEY ("vchr_type_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_ship_addrs" (
    "saa_id" UUID NOT NULL DEFAULT uuidv7(),
    "saa_company_id" UUID,
    "saa_branch_id" UUID,
    "saa_ledger_id" UUID NOT NULL,
    "saa_addr_type" VARCHAR(20) NOT NULL DEFAULT 'SHIP_TO',
    "saa_is_default" BOOLEAN NOT NULL DEFAULT false,
    "saa_sort" INTEGER NOT NULL DEFAULT 0,
    "saa_trade_name" VARCHAR(200),
    "saa_contact_name" VARCHAR(150),
    "saa_addr1" VARCHAR(250),
    "saa_addr2" VARCHAR(250),
    "saa_addr3" VARCHAR(250),
    "saa_location" VARCHAR(200),
    "saa_pin" VARCHAR(10),
    "saa_state_code" CHAR(2),
    "saa_state_name" VARCHAR(100),
    "saa_country_code" CHAR(2) NOT NULL DEFAULT 'IN',
    "saa_distance_km" INTEGER,
    "saa_phone" VARCHAR(20),
    "saa_email" VARCHAR(120),
    "saa_gstin" VARCHAR(15) NOT NULL,
    "saa_synced_on" TIMESTAMPTZ(6),
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
    "lba_company_id" UUID,
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
CREATE TABLE "accounts"."till_approval" (
    "tap_id" UUID NOT NULL DEFAULT uuidv7(),
    "tap_company_id" UUID NOT NULL,
    "tap_branch_id" UUID NOT NULL,
    "tap_tenant_id" UUID,
    "tap_acc_year" CHAR(9) NOT NULL,
    "tap_event_code" VARCHAR(30) NOT NULL,
    "tap_session_id" UUID,
    "tap_counter_id" UUID,
    "tap_src_doc_type" VARCHAR(30),
    "tap_src_doc_id" UUID,
    "tap_src_refno" VARCHAR(100),
    "tap_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tap_count_in_session" INTEGER NOT NULL DEFAULT 0,
    "tap_rule_id" UUID,
    "tap_rule_snapshot" JSONB,
    "tap_required_role" VARCHAR(20) NOT NULL,
    "tap_two_person" BOOLEAN NOT NULL DEFAULT false,
    "tap_self_allowed" BOOLEAN NOT NULL DEFAULT false,
    "tap_channel" VARCHAR(8) NOT NULL DEFAULT 'COUNTER',
    "tap_requested_by" UUID NOT NULL,
    "tap_requested_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tap_reason_id" UUID,
    "tap_request_note" VARCHAR(500),
    "tap_status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "tap_decided_by" UUID,
    "tap_decided_on" TIMESTAMPTZ(6),
    "tap_decided_device_id" UUID,
    "tap_decision_note" VARCHAR(500),
    "tap_second_by" UUID,
    "tap_second_on" TIMESTAMPTZ(6),
    "tap_expires_on" TIMESTAMPTZ(6),
    "tap_device_id" UUID,
    "tap_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tap_sync_date" TIMESTAMPTZ(6),
    "tap_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tap_modified_on" TIMESTAMPTZ(6),

    CONSTRAINT "pk_till_approval" PRIMARY KEY ("tap_id","tap_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_approval_authority" (
    "taa_id" UUID NOT NULL DEFAULT uuidv7(),
    "taa_user_id" UUID NOT NULL,
    "taa_company_id" UUID,
    "taa_branch_id" UUID,
    "taa_role" VARCHAR(20) NOT NULL,
    "taa_event_code" VARCHAR(30),
    "taa_max_amount" DECIMAL(15,2),
    "taa_can_remote" BOOLEAN NOT NULL DEFAULT false,
    "taa_valid_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "taa_valid_to" DATE,
    "taa_remarks" VARCHAR(250),
    "taa_is_active" BOOLEAN NOT NULL DEFAULT true,
    "taa_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "taa_sync_date" TIMESTAMPTZ(6),
    "taa_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taa_created_by" VARCHAR(50),
    "taa_modified_on" TIMESTAMPTZ(6),
    "taa_modified_by" VARCHAR(50),

    CONSTRAINT "pk_till_approval_authority" PRIMARY KEY ("taa_id")
);

-- CreateTable
CREATE TABLE "accounts"."till_approval_rule" (
    "tar_id" UUID NOT NULL DEFAULT uuidv7(),
    "tar_company_id" UUID,
    "tar_branch_id" UUID,
    "tar_event_code" VARCHAR(30) NOT NULL,
    "tar_mode" VARCHAR(12) NOT NULL,
    "tar_threshold_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tar_threshold_count" INTEGER NOT NULL DEFAULT 0,
    "tar_threshold_percent" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tar_channel" VARCHAR(12) NOT NULL DEFAULT 'EITHER',
    "tar_min_role" VARCHAR(20) NOT NULL DEFAULT 'SUPERVISOR',
    "tar_two_person" BOOLEAN NOT NULL DEFAULT false,
    "tar_allow_self" BOOLEAN NOT NULL DEFAULT false,
    "tar_blocks_till" BOOLEAN NOT NULL DEFAULT true,
    "tar_expire_minutes" INTEGER NOT NULL DEFAULT 0,
    "tar_effective_from" DATE NOT NULL DEFAULT '2000-01-01'::date,
    "tar_remarks" VARCHAR(250),
    "tar_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tar_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tar_sync_date" TIMESTAMPTZ(6),
    "tar_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tar_created_by" VARCHAR(50),
    "tar_modified_on" TIMESTAMPTZ(6),
    "tar_modified_by" VARCHAR(50),

    CONSTRAINT "pk_till_approval_rule" PRIMARY KEY ("tar_id")
);

-- CreateTable
CREATE TABLE "accounts"."till_business_day" (
    "tbd_id" UUID NOT NULL DEFAULT uuidv7(),
    "tbd_company_id" UUID NOT NULL,
    "tbd_branch_id" UUID NOT NULL,
    "tbd_tenant_id" UUID,
    "tbd_acc_year" CHAR(9) NOT NULL,
    "tbd_business_date" DATE NOT NULL,
    "tbd_status" VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    "tbd_opened_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tbd_opened_by" UUID NOT NULL,
    "tbd_closing_on" TIMESTAMPTZ(6),
    "tbd_closed_on" TIMESTAMPTZ(6),
    "tbd_closed_by" UUID,
    "tbd_z_no" INTEGER,
    "tbd_reopen_count" INTEGER NOT NULL DEFAULT 0,
    "tbd_session_count" INTEGER NOT NULL DEFAULT 0,
    "tbd_bill_count" INTEGER NOT NULL DEFAULT 0,
    "tbd_net_sales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_cash_expected" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_cash_counted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_noncash_variance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_safe_opening" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_safe_expected" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_safe_counted" DECIMAL(15,2),
    "tbd_remitted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tbd_exception_count" INTEGER NOT NULL DEFAULT 0,
    "tbd_close_approval_id" UUID,
    "tbd_print_count" SMALLINT NOT NULL DEFAULT 0,
    "tbd_notes" VARCHAR(500),
    "tbd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tbd_sync_date" TIMESTAMPTZ(6),
    "tbd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tbd_created_by" VARCHAR(50),
    "tbd_modified_on" TIMESTAMPTZ(6),
    "tbd_modified_by" VARCHAR(50),
    "tbd_cash_variance" DECIMAL(15,2),

    CONSTRAINT "pk_till_business_day" PRIMARY KEY ("tbd_id","tbd_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_cash_movement" (
    "tcm_id" UUID NOT NULL DEFAULT uuidv7(),
    "tcm_company_id" UUID NOT NULL,
    "tcm_branch_id" UUID NOT NULL,
    "tcm_tenant_id" UUID,
    "tcm_acc_year" CHAR(9) NOT NULL,
    "tcm_kind" VARCHAR(16) NOT NULL,
    "tcm_doc_no" VARCHAR(40) NOT NULL,
    "tcm_doc_date" DATE NOT NULL,
    "tcm_day_id" UUID NOT NULL,
    "tcm_session_id" UUID,
    "tcm_safe_id" UUID,
    "tcm_to_safe_id" UUID,
    "tcm_amount" DECIMAL(15,2) NOT NULL,
    "tcm_ledger_id" UUID,
    "tcm_reason_id" UUID,
    "tcm_ref_no" VARCHAR(50),
    "tcm_ref_date" DATE,
    "tcm_party_name" VARCHAR(150),
    "tcm_count_id" UUID,
    "tcm_bag_no" VARCHAR(30),
    "tcm_seal_no" VARCHAR(30),
    "tcm_cit_agency" VARCHAR(100),
    "tcm_done_by" UUID NOT NULL,
    "tcm_witness_by" UUID,
    "tcm_approval_id" UUID,
    "tcm_voucher_id" UUID,
    "tcm_voucher_acc_year" CHAR(9),
    "tcm_status" VARCHAR(8) NOT NULL DEFAULT 'POSTED',
    "tcm_void_reason_id" UUID,
    "tcm_voided_on" TIMESTAMPTZ(6),
    "tcm_voided_by" UUID,
    "tcm_void_approval_id" UUID,
    "tcm_print_count" SMALLINT NOT NULL DEFAULT 0,
    "tcm_device_id" UUID,
    "tcm_notes" VARCHAR(500),
    "tcm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tcm_sync_date" TIMESTAMPTZ(6),
    "tcm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tcm_created_by" VARCHAR(50),
    "tcm_modified_on" TIMESTAMPTZ(6),
    "tcm_modified_by" VARCHAR(50),
    "tcm_witness_verified_on" TIMESTAMPTZ(6),
    "tcm_receipt_status" VARCHAR(10),
    "tcm_received_by" UUID,
    "tcm_received_on" TIMESTAMPTZ(6),
    "tcm_received_amount" DECIMAL(15,2),
    "tcm_receive_count_id" UUID,
    "tcm_receive_voucher_id" UUID,
    "tcm_receive_voucher_acc_year" CHAR(9),
    "tcm_remit_mode" VARCHAR(12),
    "tcm_remit_status" VARCHAR(10),
    "tcm_bank_date" DATE,
    "tcm_bank_ref" VARCHAR(50),
    "tcm_bank_amount" DECIMAL(15,2),
    "tcm_confirmed_by" UUID,
    "tcm_confirmed_on" TIMESTAMPTZ(6),
    "tcm_confirm_voucher_id" UUID,
    "tcm_confirm_voucher_acc_year" CHAR(9),

    CONSTRAINT "pk_till_cash_movement" PRIMARY KEY ("tcm_id","tcm_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_count" (
    "tct_id" UUID NOT NULL DEFAULT uuidv7(),
    "tct_company_id" UUID NOT NULL,
    "tct_branch_id" UUID NOT NULL,
    "tct_tenant_id" UUID,
    "tct_acc_year" CHAR(9) NOT NULL,
    "tct_kind" VARCHAR(12) NOT NULL,
    "tct_session_id" UUID,
    "tct_safe_id" UUID,
    "tct_movement_id" UUID,
    "tct_attempt_no" SMALLINT NOT NULL DEFAULT 1,
    "tct_is_final" BOOLEAN NOT NULL DEFAULT false,
    "tct_is_blind" BOOLEAN NOT NULL DEFAULT false,
    "tct_counted_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tct_counted_by" UUID NOT NULL,
    "tct_witness_by" UUID,
    "tct_device_id" UUID,
    "tct_total_counted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tct_expected" DECIMAL(15,2),
    "tct_notes" VARCHAR(500),
    "tct_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tct_sync_date" TIMESTAMPTZ(6),
    "tct_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tct_created_by" VARCHAR(50),
    "tct_day_id" UUID,

    CONSTRAINT "pk_till_count" PRIMARY KEY ("tct_id","tct_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_counter" (
    "tcn_id" UUID NOT NULL DEFAULT uuidv7(),
    "tcn_company_id" UUID NOT NULL,
    "tcn_branch_id" UUID NOT NULL,
    "tcn_code" VARCHAR(20) NOT NULL,
    "tcn_name" VARCHAR(100) NOT NULL,
    "tcn_kind" VARCHAR(20) NOT NULL DEFAULT 'POS',
    "tcn_drawer_mode" VARCHAR(10) NOT NULL DEFAULT 'DRAWER',
    "tcn_device_id" UUID,
    "tcn_safe_id" UUID,
    "tcn_default_float" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tcn_cash_alert_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tcn_cash_block_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tcn_z_last_no" INTEGER NOT NULL DEFAULT 0,
    "tcn_requires_session" BOOLEAN NOT NULL DEFAULT true,
    "tcn_sort_order" INTEGER NOT NULL DEFAULT 0,
    "tcn_remarks" VARCHAR(250),
    "tcn_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tcn_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tcn_sync_date" TIMESTAMPTZ(6),
    "tcn_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tcn_created_by" VARCHAR(50),
    "tcn_modified_on" TIMESTAMPTZ(6),
    "tcn_modified_by" VARCHAR(50),

    CONSTRAINT "pk_till_counter" PRIMARY KEY ("tcn_id")
);

-- CreateTable
CREATE TABLE "accounts"."till_count_line" (
    "tcl_id" UUID NOT NULL DEFAULT uuidv7(),
    "tcl_acc_year" CHAR(9) NOT NULL,
    "tcl_count_id" UUID NOT NULL,
    "tcl_row_no" INTEGER NOT NULL,
    "tcl_tender_type_id" INTEGER NOT NULL,
    "tcl_tender_id" UUID,
    "tcl_denomination_id" UUID,
    "tcl_face_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tcl_qty" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "tcl_entered_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tcl_batch_ref" VARCHAR(50),
    "tcl_amount" DECIMAL(15,2),
    "tcl_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_till_count_line" PRIMARY KEY ("tcl_id","tcl_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_denomination" (
    "tdn_id" UUID NOT NULL DEFAULT uuidv7(),
    "tdn_company_id" UUID,
    "tdn_currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "tdn_value" DECIMAL(12,2) NOT NULL,
    "tdn_kind" VARCHAR(5) NOT NULL,
    "tdn_label" VARCHAR(20) NOT NULL,
    "tdn_bundle_qty" INTEGER NOT NULL DEFAULT 0,
    "tdn_sort_order" INTEGER NOT NULL DEFAULT 0,
    "tdn_valid_to" DATE,
    "tdn_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tdn_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tdn_sync_date" TIMESTAMPTZ(6),
    "tdn_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tdn_created_by" VARCHAR(50),
    "tdn_modified_on" TIMESTAMPTZ(6),
    "tdn_modified_by" VARCHAR(50),

    CONSTRAINT "pk_till_denomination" PRIMARY KEY ("tdn_id")
);

-- CreateTable
CREATE TABLE "accounts"."till_event" (
    "tev_id" UUID NOT NULL DEFAULT uuidv7(),
    "tev_company_id" UUID NOT NULL,
    "tev_branch_id" UUID NOT NULL,
    "tev_acc_year" CHAR(9) NOT NULL,
    "tev_event_code" VARCHAR(30) NOT NULL,
    "tev_event_on" TIMESTAMPTZ(6) NOT NULL,
    "tev_session_id" UUID,
    "tev_day_id" UUID,
    "tev_counter_id" UUID,
    "tev_device_id" UUID,
    "tev_user_id" UUID,
    "tev_src_doc_type" VARCHAR(30),
    "tev_src_doc_id" UUID,
    "tev_src_refno" VARCHAR(100),
    "tev_amount" DECIMAL(15,2),
    "tev_reason_id" UUID,
    "tev_approval_id" UUID,
    "tev_client_seq" BIGINT,
    "tev_payload" JSONB,
    "tev_sync_date" TIMESTAMPTZ(6),
    "tev_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_till_event" PRIMARY KEY ("tev_id","tev_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_reason" (
    "trs_id" UUID NOT NULL DEFAULT uuidv7(),
    "trs_company_id" UUID,
    "trs_category" VARCHAR(20) NOT NULL,
    "trs_code" VARCHAR(30) NOT NULL,
    "trs_name" VARCHAR(100) NOT NULL,
    "trs_ledger_id" UUID,
    "trs_needs_note" BOOLEAN NOT NULL DEFAULT false,
    "trs_needs_ref" BOOLEAN NOT NULL DEFAULT false,
    "trs_max_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "trs_sort_order" INTEGER NOT NULL DEFAULT 0,
    "trs_is_active" BOOLEAN NOT NULL DEFAULT true,
    "trs_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "trs_sync_date" TIMESTAMPTZ(6),
    "trs_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trs_created_by" VARCHAR(50),
    "trs_modified_on" TIMESTAMPTZ(6),
    "trs_modified_by" VARCHAR(50),

    CONSTRAINT "pk_till_reason" PRIMARY KEY ("trs_id")
);

-- CreateTable
CREATE TABLE "accounts"."till_safe" (
    "tsf_id" UUID NOT NULL DEFAULT uuidv7(),
    "tsf_company_id" UUID NOT NULL,
    "tsf_branch_id" UUID NOT NULL,
    "tsf_code" VARCHAR(20) NOT NULL,
    "tsf_name" VARCHAR(100) NOT NULL,
    "tsf_ledger_id" UUID NOT NULL,
    "tsf_insured_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tsf_is_default" BOOLEAN NOT NULL DEFAULT false,
    "tsf_remarks" VARCHAR(250),
    "tsf_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tsf_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tsf_sync_date" TIMESTAMPTZ(6),
    "tsf_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsf_created_by" VARCHAR(50),
    "tsf_modified_on" TIMESTAMPTZ(6),
    "tsf_modified_by" VARCHAR(50),
    "tsf_is_drop_safe" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pk_till_safe" PRIMARY KEY ("tsf_id")
);

-- CreateTable
CREATE TABLE "accounts"."till_session" (
    "tss_id" UUID NOT NULL DEFAULT uuidv7(),
    "tss_company_id" UUID NOT NULL,
    "tss_branch_id" UUID NOT NULL,
    "tss_tenant_id" UUID,
    "tss_acc_year" CHAR(9) NOT NULL,
    "tss_day_id" UUID NOT NULL,
    "tss_business_date" DATE NOT NULL,
    "tss_counter_id" UUID NOT NULL,
    "tss_device_id" UUID NOT NULL,
    "tss_operator_id" UUID NOT NULL,
    "tss_session_no" VARCHAR(30) NOT NULL,
    "tss_day_seq" INTEGER NOT NULL,
    "tss_status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "tss_opened_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tss_float_mode" VARCHAR(8) NOT NULL,
    "tss_prev_session_id" UUID,
    "tss_float_issued" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_float_counted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_open_count_id" UUID,
    "tss_float_approval_id" UUID,
    "tss_suspend_count" INTEGER NOT NULL DEFAULT 0,
    "tss_suspended_on" TIMESTAMPTZ(6),
    "tss_billing_ended_on" TIMESTAMPTZ(6),
    "tss_count_mode" VARCHAR(6),
    "tss_count_place" VARCHAR(12),
    "tss_close_count_id" UUID,
    "tss_count_attempts" SMALLINT NOT NULL DEFAULT 0,
    "tss_recounts_granted" SMALLINT NOT NULL DEFAULT 0,
    "tss_counted_on" TIMESTAMPTZ(6),
    "tss_counted_by" UUID,
    "tss_witness_by" UUID,
    "tss_closed_on" TIMESTAMPTZ(6),
    "tss_closed_by" UUID,
    "tss_close_approval_id" UUID,
    "tss_force_closed" BOOLEAN NOT NULL DEFAULT false,
    "tss_force_reason_id" UUID,
    "tss_reopen_count" SMALLINT NOT NULL DEFAULT 0,
    "tss_z_no" INTEGER,
    "tss_bill_count" INTEGER NOT NULL DEFAULT 0,
    "tss_return_count" INTEGER NOT NULL DEFAULT 0,
    "tss_receipt_count" INTEGER NOT NULL DEFAULT 0,
    "tss_no_sale_count" INTEGER NOT NULL DEFAULT 0,
    "tss_void_count" INTEGER NOT NULL DEFAULT 0,
    "tss_void_line_count" INTEGER NOT NULL DEFAULT 0,
    "tss_net_sales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_cash_expected" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_cash_counted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_noncash_expected" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_noncash_counted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_handed_over" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_float_left" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tss_variance_status" VARCHAR(16) NOT NULL DEFAULT 'NONE',
    "tss_print_count" SMALLINT NOT NULL DEFAULT 0,
    "tss_notes" VARCHAR(500),
    "tss_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tss_sync_date" TIMESTAMPTZ(6),
    "tss_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tss_created_by" VARCHAR(50),
    "tss_modified_on" TIMESTAMPTZ(6),
    "tss_modified_by" VARCHAR(50),
    "tss_float_variance" DECIMAL(15,2),
    "tss_cash_variance" DECIMAL(15,2),
    "tss_noncash_variance" DECIMAL(15,2),
    "tss_payment_count" INTEGER NOT NULL DEFAULT 0,
    "tss_expense_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pk_till_session" PRIMARY KEY ("tss_id","tss_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_session_review" (
    "tsr_id" UUID NOT NULL DEFAULT uuidv7(),
    "tsr_company_id" UUID NOT NULL,
    "tsr_branch_id" UUID NOT NULL,
    "tsr_acc_year" CHAR(9) NOT NULL,
    "tsr_session_id" UUID,
    "tsr_day_id" UUID,
    "tsr_outcome" VARCHAR(16) NOT NULL,
    "tsr_reviewed_by" UUID NOT NULL,
    "tsr_reviewed_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsr_note" VARCHAR(1000),
    "tsr_ref_voucher_id" UUID,
    "tsr_ref_voucher_acc_year" CHAR(9),
    "tsr_sync_date" TIMESTAMPTZ(6),
    "tsr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_till_session_review" PRIMARY KEY ("tsr_id","tsr_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_variance" (
    "tvr_id" UUID NOT NULL DEFAULT uuidv7(),
    "tvr_company_id" UUID NOT NULL,
    "tvr_branch_id" UUID NOT NULL,
    "tvr_tenant_id" UUID,
    "tvr_acc_year" CHAR(9) NOT NULL,
    "tvr_session_id" UUID,
    "tvr_stage" VARCHAR(8) NOT NULL DEFAULT 'CLOSE',
    "tvr_tender_type_id" INTEGER NOT NULL,
    "tvr_tender_id" UUID,
    "tvr_open_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_sales_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_refund_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_receipt_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_moved_in" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_moved_out" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_txn_count" INTEGER NOT NULL DEFAULT 0,
    "tvr_expected" DECIMAL(15,2) NOT NULL,
    "tvr_counted" DECIMAL(15,2) NOT NULL,
    "tvr_slip_count" INTEGER,
    "tvr_tolerance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_treatment" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "tvr_reason_id" UUID,
    "tvr_recovery_ledger_id" UUID,
    "tvr_approval_id" UUID,
    "tvr_voucher_id" UUID,
    "tvr_voucher_acc_year" CHAR(9),
    "tvr_status" VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    "tvr_reverses_id" UUID,
    "tvr_decided_by" UUID,
    "tvr_decided_on" TIMESTAMPTZ(6),
    "tvr_notes" VARCHAR(500),
    "tvr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tvr_sync_date" TIMESTAMPTZ(6),
    "tvr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tvr_created_by" VARCHAR(50),
    "tvr_modified_on" TIMESTAMPTZ(6),
    "tvr_modified_by" VARCHAR(50),
    "tvr_variance" DECIMAL(15,2),
    "tvr_payment_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_expense_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvr_rows" JSONB,
    "tvr_movement_id" UUID,
    "tvr_safe_id" UUID,
    "tvr_count_id" UUID,

    CONSTRAINT "pk_till_variance" PRIMARY KEY ("tvr_id","tvr_acc_year")
);

-- CreateTable
CREATE TABLE "accounts"."till_void" (
    "tvd_id" UUID NOT NULL DEFAULT uuidv7(),
    "tvd_company_id" UUID NOT NULL,
    "tvd_branch_id" UUID NOT NULL,
    "tvd_tenant_id" UUID,
    "tvd_acc_year" CHAR(9) NOT NULL,
    "tvd_src_doc_type" VARCHAR(30) NOT NULL DEFAULT 'SALE_BILL',
    "tvd_src_doc_id" UUID NOT NULL,
    "tvd_src_doc_refno" VARCHAR(100),
    "tvd_session_id" UUID NOT NULL,
    "tvd_device_id" UUID,
    "tvd_cashier_id" UUID NOT NULL,
    "tvd_voided_by" UUID NOT NULL,
    "tvd_voided_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tvd_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvd_cash_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tvd_reason_id" UUID NOT NULL,
    "tvd_note" VARCHAR(250),
    "tvd_posted_on" TIMESTAMPTZ(6),
    "tvd_minutes_after_post" INTEGER NOT NULL DEFAULT 0,
    "tvd_was_printed" BOOLEAN NOT NULL DEFAULT false,
    "tvd_print_count" INTEGER NOT NULL DEFAULT 0,
    "tvd_last_printed_on" TIMESTAMPTZ(6),
    "tvd_print_failed" BOOLEAN NOT NULL DEFAULT false,
    "tvd_session_void_no" INTEGER NOT NULL DEFAULT 1,
    "tvd_approval_id" UUID,
    "tvd_reversal_voucher_id" UUID,
    "tvd_reversal_acc_year" CHAR(9),
    "tvd_sync_date" TIMESTAMPTZ(6),
    "tvd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tvd_created_by" VARCHAR(50),

    CONSTRAINT "pk_till_void" PRIMARY KEY ("tvd_id","tvd_acc_year")
);

-- CreateTable
CREATE TABLE "audit"."audit_log" (
    "log_id" UUID NOT NULL DEFAULT uuidv7(),
    "log_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "log_action" "audit"."audit_log_action" NOT NULL,
    "log_screen_id" INTEGER NOT NULL,
    "log_table_name" TEXT NOT NULL,
    "log_pk" TEXT,
    "log_entity_id" UUID,
    "log_display_name" TEXT,
    "log_original_record" JSONB,
    "log_modified_record" JSONB,
    "log_changed_fields" JSONB,
    "log_user_id" UUID,
    "log_branch_id" UUID,
    "log_device_name" TEXT,
    "log_ip" TEXT,
    "log_app_name" TEXT,
    "log_notes" TEXT,
    "log_rev_no" SMALLINT,
    "log_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "audit"."audit_screen" (
    "screen_id" SERIAL NOT NULL,
    "screen_name" TEXT NOT NULL,
    "screen_type" "audit"."audit_screen_type" NOT NULL DEFAULT 'other',
    "screen_status" BOOLEAN NOT NULL DEFAULT true,
    "screen_module" TEXT,
    "screen_audit_sql" TEXT,
    "screen_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screen_created_by" UUID,
    "screen_modified_on" TIMESTAMPTZ(6),
    "screen_modified_by" UUID,
    "screen_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "audit_screen_pkey" PRIMARY KEY ("screen_id")
);

-- CreateTable
CREATE TABLE "audit"."user_login_sessions" (
    "uls_id" UUID NOT NULL DEFAULT uuidv7(),
    "uls_company_id" UUID,
    "uls_branch_id" UUID,
    "uls_user_id" UUID NOT NULL,
    "uls_device_id" UUID,
    "uls_session_id" UUID,
    "uls_session_token" VARCHAR(200),
    "uls_refresh_token_id" VARCHAR(200),
    "uls_login_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uls_logout_on" TIMESTAMPTZ(6),
    "uls_logout_type" VARCHAR(20),
    "uls_login_status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "uls_fail_reason" VARCHAR(250),
    "uls_ip_address" INET,
    "uls_user_agent" TEXT,
    "uls_app_version" VARCHAR(40),
    "uls_is_active_session" BOOLEAN NOT NULL DEFAULT true,
    "uls_is_active" BOOLEAN NOT NULL DEFAULT true,
    "uls_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "uls_sync_date" TIMESTAMPTZ(6),
    "uls_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uls_created_by" VARCHAR(100),
    "uls_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uls_modified_by" VARCHAR(100),

    CONSTRAINT "user_login_sessions_pkey" PRIMARY KEY ("uls_id")
);

-- CreateTable
CREATE TABLE "fixed"."dropdown_columns" (
    "dropdown_columns_id" UUID NOT NULL DEFAULT uuidv7(),
    "dropdown_columns_dropdown_id" INTEGER NOT NULL,
    "dropdown_columns_no" INTEGER NOT NULL,
    "dropdown_columns_data_type" VARCHAR(50) NOT NULL,
    "dropdown_columns_name" VARCHAR(200) NOT NULL,
    "dropdown_columns_alias" VARCHAR(200),
    "dropdown_columns_width" DECIMAL(12,2),
    "dropdown_columns_visiblity" BOOLEAN NOT NULL DEFAULT true,
    "dropdown_columns_allignment" VARCHAR(30),
    "dropdown_columns_filter" BOOLEAN NOT NULL DEFAULT false,
    "dropdown_columns_sql_name" TEXT,
    "dropdown_columns_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dropdown_columns_modified_on" TIMESTAMPTZ(6),
    "dropdown_columns_created_by" TEXT,
    "dropdown_columns_modified_by" TEXT,
    "dropdown_columns_sync_on" TIMESTAMPTZ(6),

    CONSTRAINT "dropdown_columns_pkey" PRIMARY KEY ("dropdown_columns_id")
);

-- CreateTable
CREATE TABLE "fixed"."dropdown_details" (
    "dropdown_id" SERIAL NOT NULL,
    "dropdown_name" VARCHAR(200) NOT NULL,
    "dropdown_description" TEXT,
    "dropdown_sql" TEXT NOT NULL,
    "dropdown_sort_order" VARCHAR(20),
    "dropdown_sort_column" VARCHAR(100),
    "dropdown_completion" TEXT,
    "dropdown_sql_regional" TEXT,
    "dropdown_max_visible_items" INTEGER NOT NULL DEFAULT 10,
    "dropdown_show_header" BOOLEAN NOT NULL DEFAULT true,
    "dropdown_width" INTEGER,
    "dropdown_device_type" TEXT,
    "dropdown_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dropdown_modified_on" TIMESTAMPTZ(6),
    "dropdown_created_by" TEXT,
    "dropdown_modified_by" TEXT,
    "dropdown_sync_on" TIMESTAMPTZ(6),

    CONSTRAINT "dropdown_details_pkey" PRIMARY KEY ("dropdown_id")
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
CREATE TABLE "fixed"."device_master" (
    "dev_id" UUID NOT NULL DEFAULT uuidv7(),
    "dev_company_id" UUID,
    "dev_branch_id" UUID,
    "dev_user_id" UUID,
    "dev_device_uid" VARCHAR(120) NOT NULL,
    "dev_device_name" VARCHAR(120),
    "dev_device_type" VARCHAR(30) NOT NULL DEFAULT 'Desktop',
    "dev_platform" VARCHAR(30),
    "dev_mac_address" VARCHAR(50),
    "dev_is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "dev_block_reason" VARCHAR(250),
    "dev_last_ip" TEXT,
    "dev_last_login" TIMESTAMPTZ(6),
    "dev_is_active" BOOLEAN NOT NULL DEFAULT true,
    "dev_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "dev_sync_date" TIMESTAMPTZ(6),
    "dev_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dev_created_by" UUID,
    "dev_modified_on" TIMESTAMPTZ(6),
    "dev_modified_by" UUID,
    "dev_code" VARCHAR(10),

    CONSTRAINT "device_master_pkey" PRIMARY KEY ("dev_id")
);

-- CreateTable
CREATE TABLE "fixed"."error_message" (
    "erm_id" UUID NOT NULL DEFAULT uuidv7(),
    "erm_code" VARCHAR(60) NOT NULL,
    "erm_variant" VARCHAR(60) NOT NULL DEFAULT '',
    "erm_lang" VARCHAR(10) NOT NULL DEFAULT 'en',
    "erm_title" VARCHAR(60) NOT NULL,
    "erm_line" VARCHAR(200) NOT NULL,
    "erm_todo" VARCHAR(200) NOT NULL,
    "erm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "erm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erm_modified_on" TIMESTAMPTZ(6),
    "erm_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_error_message" PRIMARY KEY ("erm_id")
);

-- CreateTable
CREATE TABLE "fixed"."error_message_catalogue" (
    "emc_id" SMALLINT NOT NULL DEFAULT 1,
    "emc_version" VARCHAR(40) NOT NULL,
    "emc_row_count" INTEGER NOT NULL DEFAULT 0,
    "emc_loaded_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emc_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_error_message_catalogue" PRIMARY KEY ("emc_id")
);

-- CreateTable
CREATE TABLE "fixed"."form_section" (
    "section_id" SERIAL NOT NULL,
    "section_menu_id" INTEGER NOT NULL,
    "section_name" TEXT NOT NULL,
    "section_gui_name" TEXT NOT NULL,
    "section_position" INTEGER NOT NULL DEFAULT 0,
    "section_visibility" BOOLEAN NOT NULL DEFAULT true,
    "section_platform" VARCHAR(255) NOT NULL,
    "section_sync_date" TIMESTAMP(3),
    "section_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "section_created_by" TEXT,
    "section_updated_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "section_updated_by" TEXT,

    CONSTRAINT "form_section_pkey" PRIMARY KEY ("section_id")
);

-- CreateTable
CREATE TABLE "fixed"."form_field" (
    "field_id" SERIAL NOT NULL,
    "field_section_id" INTEGER NOT NULL,
    "field_name" VARCHAR(255) NOT NULL,
    "field_gui_name" VARCHAR(255),
    "field_secondary_text" VARCHAR(255),
    "field_position" INTEGER NOT NULL DEFAULT 0,
    "field_visibility" BOOLEAN NOT NULL DEFAULT true,
    "field_sync_date" TIMESTAMP(3),
    "field_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_created_by" TEXT,
    "field_updated_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_updated_by" TEXT,

    CONSTRAINT "form_field_pkey" PRIMARY KEY ("field_id")
);

-- CreateTable
CREATE TABLE "fixed"."grid_columns" (
    "grid_column_id" UUID NOT NULL DEFAULT uuidv7(),
    "grid_id" BIGINT NOT NULL,
    "grid_column_number" INTEGER NOT NULL,
    "grid_column_name" TEXT NOT NULL,
    "grid_column_width" DECIMAL(12,2),
    "grid_column_alignment" TEXT,
    "grid_column_visibility" BOOLEAN NOT NULL DEFAULT true,
    "grid_column_filter" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_condition" TEXT,
    "grid_column_condition_color" TEXT,
    "grid_column_group" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_total" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_data_type" TEXT,
    "grid_column_color" TEXT,
    "grid_column_notes" TEXT,
    "grid_column_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_position" DECIMAL(12,2),
    "grid_column_px" TEXT,
    "grid_column_sql_field_name" TEXT,
    "grid_column_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grid_column_created_by" TEXT,
    "grid_column_modified_on" TIMESTAMPTZ(6),
    "grid_column_modified_by" TEXT,
    "grid_column_sync_on" TIMESTAMPTZ(6),

    CONSTRAINT "grid_columns_pkey" PRIMARY KEY ("grid_column_id")
);

-- CreateTable
CREATE TABLE "fixed"."grid_details" (
    "grid_id" BIGSERIAL NOT NULL,
    "grid_name" TEXT NOT NULL,
    "grid_description" TEXT,
    "grid_sort_column" TEXT,
    "grid_sort_order" TEXT,
    "grid_device_type" TEXT,
    "grid_sql" TEXT,
    "grid_status" BOOLEAN NOT NULL DEFAULT true,
    "grid_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "grid_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grid_created_by" TEXT,
    "grid_modified_on" TIMESTAMPTZ(6),
    "grid_modified_by" TEXT,
    "grid_sync_on" TIMESTAMPTZ(6),

    CONSTRAINT "grid_details_pkey" PRIMARY KEY ("grid_id")
);

-- CreateTable
CREATE TABLE "fixed"."hsn_master" (
    "hsn_id" SERIAL NOT NULL,
    "hsn_code" VARCHAR(50) NOT NULL,
    "hsn_name" VARCHAR(200) NOT NULL,
    "hsn_description" TEXT,
    "hsn_is_service" BOOLEAN NOT NULL DEFAULT false,
    "hsn_uqc" VARCHAR(10),
    "hsn_is_active" BOOLEAN NOT NULL DEFAULT true,
    "hsn_rate_of_tax" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "hsn_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "hsn_master_pkey" PRIMARY KEY ("hsn_id")
);

-- CreateTable
CREATE TABLE "fixed"."menu_master" (
    "menu_id" SERIAL NOT NULL,
    "menu_parent" INTEGER,
    "menu_name" VARCHAR(200) NOT NULL,
    "menu_alias" VARCHAR(200),
    "menu_visiblity" BOOLEAN NOT NULL DEFAULT true,
    "menu_position" DECIMAL(12,2),
    "menu_icon_location_desktop" TEXT,
    "menu_icon_location_web" TEXT,
    "menu_icon_location_mobile" TEXT,
    "menu_separator" BOOLEAN NOT NULL DEFAULT false,
    "menu_is_active" BOOLEAN NOT NULL DEFAULT true,
    "menu_verbs" TEXT[] DEFAULT ARRAY['VIEW', 'CREATE', 'EDIT', 'DELETE', 'PRINT', 'EXPORT']::TEXT[],
    "menu_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "menu_modified_on" TIMESTAMPTZ(6),
    "menu_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "menu_master_pkey" PRIMARY KEY ("menu_id")
);

-- CreateTable
CREATE TABLE "fixed"."price_levels" (
    "price_lvl_id" SERIAL NOT NULL,
    "price_lvl_name" VARCHAR(200) NOT NULL,
    "price_lvl_short" VARCHAR(50),
    "price_lvl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "price_lvl_is_admin" BOOLEAN NOT NULL DEFAULT false,
    "price_lvl_isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "price_lvl_SyncDate" TIMESTAMPTZ,
    "price_lvl_createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price_lvl_createdBy" VARCHAR(100),
    "price_lvl_modifiedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price_lvl_modifiedBy" VARCHAR(100),

    CONSTRAINT "price_levels_pkey" PRIMARY KEY ("price_lvl_id")
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
CREATE TABLE "fixed"."stock_adj_reasons" (
    "sar_id" UUID NOT NULL DEFAULT uuidv7(),
    "sar_code" VARCHAR(30) NOT NULL,
    "sar_name" VARCHAR(150) NOT NULL,
    "sar_reason_kind" VARCHAR(30) NOT NULL,
    "sar_default_resolution" VARCHAR(30) NOT NULL,
    "sar_affects_accounts" BOOLEAN NOT NULL DEFAULT true,
    "sar_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sar_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sar_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sar_created_by" UUID,
    "sar_modified_on" TIMESTAMPTZ,
    "sar_modified_by" UUID,
    "sar_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "stock_adj_reasons_pkey" PRIMARY KEY ("sar_id")
);

-- CreateTable
CREATE TABLE "fixed"."ui_tables" (
    "ui_tbl_id" BIGSERIAL NOT NULL,
    "ui_tbl_name" TEXT,
    "ui_tbl_editable" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ui_tbl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_sync_date" TIMESTAMPTZ(6),
    "ui_tbl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_created_by" VARCHAR(100),
    "ui_tbl_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_modified_by" VARCHAR(100),
    "ui_tbl_device_type" TEXT,
    "ui_tbl_sync_on" TIMESTAMPTZ(6),

    CONSTRAINT "ui_tables_pkey" PRIMARY KEY ("ui_tbl_id")
);

-- CreateTable
CREATE TABLE "fixed"."ui_table_columns" (
    "ui_tbl_clm_id" BIGSERIAL NOT NULL,
    "ui_tbl_clm_no" BIGINT,
    "ui_tbl_clm_table_id" BIGINT,
    "ui_tbl_clm_name" TEXT,
    "ui_tbl_clm_column_width" DECIMAL DEFAULT 100,
    "ui_tbl_clm_column_visibility" BOOLEAN DEFAULT true,
    "ui_tbl_clm_column_focus" BOOLEAN DEFAULT false,
    "ui_tbl_clm_column_position" INTEGER NOT NULL DEFAULT 0,
    "ui_tbl_clm_column_necessity" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_clm_next_column" INTEGER,
    "ui_tbl_clm_previous_column" INTEGER,
    "ui_tbl_clm_px" TEXT,
    "ui_tbl_clm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ui_tbl_clm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_clm_sync_date" TIMESTAMPTZ(6),
    "ui_tbl_clm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_clm_created_by" VARCHAR(100),
    "ui_tbl_clm_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_clm_modified_by" VARCHAR(100),

    CONSTRAINT "ui_table_columns_pkey" PRIMARY KEY ("ui_tbl_clm_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_category_master" (
    "category_id" UUID NOT NULL DEFAULT uuidv7(),
    "category_name" VARCHAR(150) NOT NULL,
    "category_alias" VARCHAR(100),
    "category_short" VARCHAR(50),
    "category_description" VARCHAR(250),
    "category_parent_id" UUID,
    "category_sort" INTEGER,
    "category_level" INTEGER,
    "category_path_ids_cache" UUID[] DEFAULT ARRAY[]::UUID[],
    "category_tax_claim" BOOLEAN,
    "category_default_tax_id" UUID,
    "category_default_hsn" VARCHAR(20),
    "category_default_uom_id" UUID,
    "category_photo" BYTEA,
    "category_photo_url" TEXT,
    "category_is_active" BOOLEAN NOT NULL DEFAULT true,
    "category_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "category_sync_date" TIMESTAMPTZ(6),
    "category_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_created_by" VARCHAR(100),
    "category_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_modified_by" VARCHAR(100),

    CONSTRAINT "item_category_master_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "inventory"."godown_locations" (
    "gdl_id" UUID NOT NULL DEFAULT uuidv7(),
    "gdl_branch_id" UUID NOT NULL,
    "gdl_name" VARCHAR(200) NOT NULL,
    "gdl_short" VARCHAR(50),
    "gdl_code" VARCHAR(30),
    "gdl_type" VARCHAR(20) NOT NULL DEFAULT 'BIN',
    "gdl_parent_id" UUID,
    "gdl_sort" INTEGER NOT NULL DEFAULT 0,
    "gdl_level" INTEGER NOT NULL DEFAULT 0,
    "gdl_path_ids_cache" UUID[] DEFAULT ARRAY[]::UUID[],
    "gdl_del_sheet" BOOLEAN NOT NULL DEFAULT false,
    "gdl_split_stock" BOOLEAN NOT NULL DEFAULT false,
    "gdl_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "gdl_volume" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gdl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gdl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gdl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdl_created_by" VARCHAR(100),
    "gdl_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdl_modified_by" VARCHAR(100),
    "gdl_remarks" VARCHAR(250),
    "gdl_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "godown_locations_pkey" PRIMARY KEY ("gdl_id")
);

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
    "btm_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "btm_closed_on" TIMESTAMPTZ(6),
    "btm_closed_reason" VARCHAR(250),
    "btm_notes" TEXT,
    "btm_row_version" BIGINT NOT NULL DEFAULT 1,
    "btm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "btm_created_by" UUID,
    "btm_updated_on" TIMESTAMPTZ(6),
    "btm_updated_by" UUID,
    "btm_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "item_batch_master_pkey" PRIMARY KEY ("btm_id")
);

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
    "ibs_stock_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
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
    "ibs_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "item_batch_stock_pkey" PRIMARY KEY ("ibs_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_brand_master" (
    "brand_id" UUID NOT NULL DEFAULT uuidv7(),
    "brand_name" VARCHAR(150) NOT NULL,
    "brand_alias" VARCHAR(150),
    "brand_short" VARCHAR(50),
    "brand_description" VARCHAR(250),
    "brand_photo" BYTEA,
    "brand_photo_url" TEXT,
    "brand_parent_id" UUID,
    "brand_sort" INTEGER,
    "brand_level" INTEGER,
    "brand_path_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "brand_is_active" BOOLEAN NOT NULL DEFAULT true,
    "brand_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "brand_sync_date" TIMESTAMPTZ(6),
    "brand_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_created_by" VARCHAR(100),
    "brand_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_modified_by" VARCHAR(100),

    CONSTRAINT "item_brand_master_pkey" PRIMARY KEY ("brand_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_colour_master" (
    "icl_id" UUID NOT NULL DEFAULT uuidv7(),
    "icl_company_id" UUID,
    "icl_code" VARCHAR(20),
    "icl_name" VARCHAR(50) NOT NULL,
    "icl_sort" INTEGER NOT NULL DEFAULT 0,
    "icl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "icl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "icl_sync_date" TIMESTAMPTZ(6),
    "icl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "icl_created_by" VARCHAR(100),
    "icl_modified_on" TIMESTAMPTZ(6),
    "icl_modified_by" VARCHAR(100),

    CONSTRAINT "pk_item_colour_master" PRIMARY KEY ("icl_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_ean_codes" (
    "ean_id" UUID NOT NULL DEFAULT uuidv7(),
    "ean_item_id" UUID NOT NULL,
    "ean_uc_unit_id" UUID NOT NULL,
    "ean_code" VARCHAR(64) NOT NULL,
    "ean_sl_no" INTEGER NOT NULL DEFAULT 0,
    "ean_is_default" BOOLEAN NOT NULL DEFAULT false,
    "ean_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ean_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ean_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ean_created_by" VARCHAR(100),
    "ean_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ean_modified_by" VARCHAR(100),
    "ean_remarks" VARCHAR(250),
    "ean_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "item_ean_codes_pkey" PRIMARY KEY ("ean_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_group_master" (
    "itg_id" UUID NOT NULL DEFAULT uuidv7(),
    "itg_name" VARCHAR(150) NOT NULL,
    "itg_alias" VARCHAR(100),
    "itg_short" VARCHAR(50),
    "itg_description" VARCHAR(250),
    "itg_parent_id" UUID,
    "itg_sort" INTEGER,
    "itg_level" INTEGER,
    "itg_path_ids_cache" UUID[] DEFAULT ARRAY[]::UUID[],
    "itg_tax_claim" BOOLEAN,
    "itg_default_tax_id" UUID,
    "itg_default_hsn" VARCHAR(20),
    "itg_default_uom_id" UUID,
    "itg_track_preset_id" UUID,
    "itg_photo" BYTEA,
    "itg_photo_url" TEXT,
    "itg_is_active" BOOLEAN NOT NULL DEFAULT true,
    "itg_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "itg_sync_date" TIMESTAMPTZ(6),
    "itg_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itg_created_by" VARCHAR(100),
    "itg_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itg_modified_by" VARCHAR(100),

    CONSTRAINT "item_group_master_pkey" PRIMARY KEY ("itg_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_gst_units" (
    "item_gst_unit_id" SERIAL NOT NULL,
    "item_gst_unit_code" TEXT,
    "item_gst_unit_name" TEXT,
    "item_gst_unit_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_gst_unit_created_by" TEXT,
    "item_gst_unit_modified_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_gst_unit_modified_by" TEXT,
    "item_gst_unit_sync_date" TIMESTAMP(3),

    CONSTRAINT "item_gst_units_pkey" PRIMARY KEY ("item_gst_unit_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_master" (
    "item_id" UUID NOT NULL DEFAULT uuidv7(),
    "item_company_id" UUID,
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
    "item_purchase_uom_id" UUID,
    "item_min_shelf_life_pct" DECIMAL(5,2),
    "item_itc_class" VARCHAR(15),
    "item_shortage_pct" DECIMAL(5,2),
    "item_default_markup_pct" DECIMAL(7,3),
    "item_cust_group" UUID,
    "item_base_unit_id" UUID,
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
    "item_track_preset_id" UUID,
    "item_sort_order" INTEGER,
    "item_photo" BYTEA,
    "item_image_url" TEXT,
    "item_notes" VARCHAR(250),
    "item_storage_location" VARCHAR(250),
    "item_packing_item_ids" UUID[],
    "item_incl_tax" BOOLEAN NOT NULL DEFAULT true,
    "item_tally_name" VARCHAR(200),
    "item_tally_guid" VARCHAR(64),
    "item_tally_master_id" BIGINT,
    "item_tally_alter_id" BIGINT,
    "item_is_active" BOOLEAN NOT NULL DEFAULT true,
    "item_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "item_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_created_by" VARCHAR(100),
    "item_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_modified_by" VARCHAR(100),
    "item_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "item_master_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_price_change_log" (
    "ipcl_id" UUID NOT NULL DEFAULT uuidv7(),
    "ipcl_changed_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipcl_change_set_id" UUID NOT NULL,
    "ipcl_price_table" VARCHAR(4) NOT NULL,
    "ipcl_row_id" UUID NOT NULL,
    "ipcl_action" VARCHAR(10) NOT NULL,
    "ipcl_source" VARCHAR(30) NOT NULL,
    "ipcl_menu_id" INTEGER,
    "ipcl_company_id" UUID,
    "ipcl_branch_id" UUID,
    "ipcl_item_id" UUID NOT NULL,
    "ipcl_unit_id" UUID,
    "ipcl_godown_id" UUID,
    "ipcl_party_id" UUID,
    "ipcl_price_level" SMALLINT,
    "ipcl_bucket_mrp" DECIMAL(18,2),
    "ipcl_bucket_sp" DECIMAL(18,2),
    "ipcl_effective_from" DATE,
    "ipcl_effective_to" DATE,
    "ipcl_item_code" VARCHAR(60),
    "ipcl_item_name" VARCHAR(250),
    "ipcl_unit_name" VARCHAR(60),
    "ipcl_branch_name" VARCHAR(120),
    "ipcl_godown_name" VARCHAR(120),
    "ipcl_party_name" VARCHAR(250),
    "ipcl_user_id" UUID,
    "ipcl_user_name" VARCHAR(150),
    "ipcl_device_id" UUID,
    "ipcl_device_name" VARCHAR(150),
    "ipcl_ip" VARCHAR(60),
    "ipcl_app" VARCHAR(30),
    "ipcl_reason" VARCHAR(500),
    "ipcl_sync_date" TIMESTAMPTZ(6),
    "ipcl_before" JSONB,
    "ipcl_after" JSONB,
    "ipcl_changed" TEXT[],
    "ipcl_old_price_a" DECIMAL,
    "ipcl_new_price_a" DECIMAL,
    "ipcl_old_mrp" DECIMAL,
    "ipcl_new_mrp" DECIMAL,
    "ipcl_old_cost" DECIMAL,
    "ipcl_new_cost" DECIMAL,
    "ipcl_old_slab_price" DECIMAL,
    "ipcl_new_slab_price" DECIMAL,
    "ipcl_slab_from_qty" DECIMAL,
    "ipcl_slab_to_qty" DECIMAL,

    CONSTRAINT "item_price_change_log_pkey" PRIMARY KEY ("ipcl_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_price_levels" (
    "ipl_id" SERIAL NOT NULL,
    "ipl_name" TEXT NOT NULL,
    "ipl_uname" TEXT NOT NULL,
    "ipl_status" BOOLEAN NOT NULL DEFAULT true,
    "ipl_admin" BOOLEAN NOT NULL DEFAULT false,
    "ipl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ipl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipl_sync_date" TIMESTAMPTZ(6),
    "ipl_created_by" TEXT NOT NULL,
    "ipl_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipl_modified_by" TEXT NOT NULL,

    CONSTRAINT "item_price_levels_pkey" PRIMARY KEY ("ipl_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_price_master" (
    "ipm_id" UUID NOT NULL DEFAULT uuidv7(),
    "ipm_company_id" UUID,
    "ipm_branch_id" UUID,
    "ipm_item_id" UUID NOT NULL,
    "ipm_uc_unit_id" UUID NOT NULL,
    "ipm_godown_id" UUID,
    "ipm_sl_no" INTEGER NOT NULL DEFAULT 0,
    "ipm_cost_price" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_cost_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_sales_price_a" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_sales_price_b" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_sales_price_c" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_sales_price_d" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_price_a_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_price_b_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_price_c_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_price_d_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_price_a_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "ipm_price_b_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "ipm_price_c_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "ipm_price_d_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "ipm_max_price" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_min_price" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_disc_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "ipm_disc_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_addl_cess" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_profit_type" VARCHAR(20) NOT NULL DEFAULT 'By User',
    "ipm_round_off" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ipm_loading_charge" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_freight_charge" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "ipm_loyalty_points" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "ipm_uom_remarks" VARCHAR(250),
    "ipm_cost_remarks" VARCHAR(250),
    "ipm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ipm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ipm_sync_date" TIMESTAMPTZ(6),
    "ipm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipm_created_by" UUID,
    "ipm_updated_on" TIMESTAMPTZ(6),
    "ipm_updated_by" UUID,
    "ipm_bucket_mrp" DECIMAL(18,6),
    "ipm_bucket_sp" DECIMAL(18,6),
    "ipm_key_mrp" DECIMAL(18,6),
    "ipm_key_sp" DECIMAL(18,6),
    "ipm_effective_from" DATE NOT NULL DEFAULT '1900-01-01'::date,
    "ipm_effective_to" DATE NOT NULL DEFAULT '9999-12-31'::date,

    CONSTRAINT "item_price_master_pkey" PRIMARY KEY ("ipm_id")
);

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
CREATE TABLE "inventory"."item_reorders" (
    "ir_id" UUID NOT NULL DEFAULT uuidv7(),
    "ir_branch_id" UUID,
    "ir_item_id" UUID NOT NULL,
    "ir_uc_unit_id" UUID,
    "ir_godown_id" UUID,
    "ir_sl_no" INTEGER NOT NULL DEFAULT 0,
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
    "ir_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "item_reorders_pkey" PRIMARY KEY ("ir_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_section_master" (
    "sec_id" UUID NOT NULL DEFAULT uuidv7(),
    "sec_name" VARCHAR(150) NOT NULL,
    "sec_alias" VARCHAR(100),
    "sec_short" VARCHAR(50),
    "sec_description" VARCHAR(250),
    "sec_parent_id" UUID,
    "sec_sort" INTEGER,
    "sec_level" INTEGER,
    "sec_path_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "sec_position" INTEGER,
    "sec_color_code" VARCHAR(20),
    "sec_icon" VARCHAR(100),
    "sec_photo" BYTEA,
    "sec_photo_url" TEXT,
    "sec_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sec_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sec_sync_date" TIMESTAMPTZ(6),
    "sec_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sec_created_by" VARCHAR(100),
    "sec_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sec_modified_by" VARCHAR(100),

    CONSTRAINT "item_section_master_pkey" PRIMARY KEY ("sec_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_size_master" (
    "isz_id" UUID NOT NULL DEFAULT uuidv7(),
    "isz_company_id" UUID,
    "isz_code" VARCHAR(20),
    "isz_name" VARCHAR(50) NOT NULL,
    "isz_size_set" VARCHAR(20),
    "isz_sort" INTEGER NOT NULL DEFAULT 0,
    "isz_is_active" BOOLEAN NOT NULL DEFAULT true,
    "isz_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "isz_sync_date" TIMESTAMPTZ(6),
    "isz_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isz_created_by" VARCHAR(100),
    "isz_modified_on" TIMESTAMPTZ(6),
    "isz_modified_by" VARCHAR(100),

    CONSTRAINT "pk_item_size_master" PRIMARY KEY ("isz_id")
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
    "isb_tracking_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "isb_stock_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
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
    "isb_opening_avg_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_avg_stock_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isb_opening_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isb_stock_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
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
    "stl_txn_type" VARCHAR(30) NOT NULL,
    "stl_stock_effect" SMALLINT NOT NULL,
    "stl_doc_date" DATE NOT NULL,
    "stl_posted_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stl_doc_ref_no" VARCHAR(50),
    "stl_item_id" UUID NOT NULL,
    "stl_tracking_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
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

-- CreateTable
CREATE TABLE "inventory"."item_tax_history" (
    "ith_id" UUID NOT NULL DEFAULT uuidv7(),
    "ith_item_id" UUID NOT NULL,
    "ith_tax_id" UUID NOT NULL,
    "ith_effective_from" DATE NOT NULL,
    "ith_effective_to" DATE,
    "ith_reason" VARCHAR(250),
    "ith_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ith_created_by" VARCHAR(100),
    "ith_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "item_tax_history_pkey" PRIMARY KEY ("ith_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_tax_master" (
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

-- CreateTable
CREATE TABLE "inventory"."item_unit_conversion" (
    "iuc_id" UUID NOT NULL DEFAULT uuidv7(),
    "iuc_item_id" UUID NOT NULL,
    "iuc_unit_id" UUID NOT NULL,
    "iuc_base_unit_id" UUID NOT NULL,
    "iuc_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "iuc_unit_slno" INTEGER NOT NULL DEFAULT 0,
    "iuc_unit_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "iuc_is_default_unit" BOOLEAN NOT NULL DEFAULT false,
    "iuc_is_base_unit" BOOLEAN NOT NULL DEFAULT false,
    "iuc_is_big_unit" BOOLEAN NOT NULL DEFAULT false,
    "iuc_uom_weight" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "iuc_uom_remarks" VARCHAR(250),
    "iuc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "iuc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "iuc_sync_date" TIMESTAMPTZ(6),
    "iuc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iuc_created_by" UUID,
    "iuc_updated_on" TIMESTAMPTZ(6),
    "iuc_updated_by" UUID,

    CONSTRAINT "item_unit_conversion_pkey" PRIMARY KEY ("iuc_id")
);

-- CreateTable
CREATE TABLE "inventory"."item_unit_master" (
    "unit_id" UUID NOT NULL DEFAULT uuidv7(),
    "unit_name" VARCHAR(50) NOT NULL,
    "unit_alias" VARCHAR(50),
    "unit_code" TEXT,
    "unit_description" VARCHAR(100),
    "unit_decimal_count" INTEGER NOT NULL DEFAULT 0,
    "unit_weight" DECIMAL,
    "unit_loading" DECIMAL,
    "unit_unloading" DECIMAL,
    "unit_attach_charge" DECIMAL,
    "unit_is_pack_unit" BOOLEAN NOT NULL DEFAULT false,
    "unit_base_unit_id" UUID,
    "unit_conversion" DECIMAL,
    "unit_is_active" BOOLEAN NOT NULL DEFAULT true,
    "unit_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "unit_tally_name" VARCHAR(100),
    "unit_tally_guid" VARCHAR(64),
    "unit_tally_master_id" BIGINT,
    "unit_tally_alter_id" BIGINT,
    "unit_sync_date" TIMESTAMPTZ(6),
    "unit_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_created_by" VARCHAR(100),
    "unit_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_modified_by" VARCHAR(100),
    "unit_uqc" CHAR(3),

    CONSTRAINT "item_unit_master_pkey" PRIMARY KEY ("unit_id")
);

-- CreateTable
CREATE TABLE "inventory"."tax_rate_master" (
    "tax_id" UUID NOT NULL DEFAULT uuidv7(),
    "tax_name" VARCHAR(100) NOT NULL,
    "tax_code" VARCHAR(30),
    "tax_sort_order" SMALLINT NOT NULL DEFAULT 0,
    "tax_taxability" VARCHAR(15) NOT NULL DEFAULT 'TAXABLE',
    "tax_is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "tax_rate_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_cgst_perc" DECIMAL(7,3),
    "tax_sgst_perc" DECIMAL(7,3),
    "tax_igst_perc" DECIMAL(7,3),
    "tax_cess_basis" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "tax_cess_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "tax_acess_basis" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "tax_acess_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tax_acess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "tax_supersedes_id" UUID,
    "tax_value_threshold" DECIMAL(14,2),
    "tax_above_tax_id" UUID,
    "tax_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tax_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tax_sync_date" TIMESTAMPTZ(6),
    "tax_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tax_created_by" VARCHAR(50),
    "tax_modified_on" TIMESTAMPTZ(6),
    "tax_modified_by" VARCHAR(50),

    CONSTRAINT "pk_tax_rate_master" PRIMARY KEY ("tax_id")
);

-- CreateTable
CREATE TABLE "inventory"."tax_rate_ledger" (
    "trl_id" UUID NOT NULL DEFAULT uuidv7(),
    "trl_tax_id" UUID NOT NULL,
    "trl_role" VARCHAR(30) NOT NULL,
    "trl_supply_nature" VARCHAR(5),
    "trl_ledger_id" UUID NOT NULL,
    "trl_remarks" VARCHAR(250),
    "trl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "trl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "trl_sync_date" TIMESTAMPTZ(6),
    "trl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trl_created_by" VARCHAR(50),
    "trl_modified_on" TIMESTAMPTZ(6),
    "trl_modified_by" VARCHAR(50),

    CONSTRAINT "pk_tax_rate_ledger" PRIMARY KEY ("trl_id")
);

-- CreateTable
CREATE TABLE "app_setting_def" (
    "asd_id" UUID NOT NULL DEFAULT uuidv7(),
    "asd_key" VARCHAR(80) NOT NULL,
    "asd_module" VARCHAR(30) NOT NULL,
    "asd_group" VARCHAR(40) NOT NULL DEFAULT 'General',
    "asd_data_type" VARCHAR(10) NOT NULL,
    "asd_default_value" TEXT,
    "asd_allowed_values" JSONB,
    "asd_min_value" DECIMAL(18,6),
    "asd_max_value" DECIMAL(18,6),
    "asd_max_scope" VARCHAR(10) NOT NULL DEFAULT 'COMPANY',
    "asd_label" VARCHAR(120) NOT NULL,
    "asd_description" TEXT,
    "asd_sort_order" SMALLINT NOT NULL DEFAULT 0,
    "asd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "asd_needs_relogin" BOOLEAN NOT NULL DEFAULT false,
    "asd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "asd_sync_date" TIMESTAMPTZ(6),
    "asd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asd_created_by" VARCHAR(50) NOT NULL,
    "asd_modified_on" TIMESTAMPTZ(6),
    "asd_modified_by" VARCHAR(50),

    CONSTRAINT "app_setting_def_pkey" PRIMARY KEY ("asd_id")
);

-- CreateTable
CREATE TABLE "app_setting_value" (
    "asv_id" UUID NOT NULL DEFAULT uuidv7(),
    "asv_setting_key" VARCHAR(80) NOT NULL,
    "asv_scope" VARCHAR(10) NOT NULL,
    "asv_company_id" UUID,
    "asv_branch_id" UUID,
    "asv_device_id" UUID,
    "asv_user_id" UUID,
    "asv_value" TEXT,
    "asv_remarks" VARCHAR(250),
    "asv_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "asv_sync_date" TIMESTAMPTZ(6),
    "asv_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asv_created_by" VARCHAR(50) NOT NULL,
    "asv_modified_on" TIMESTAMPTZ(6),
    "asv_modified_by" VARCHAR(50),

    CONSTRAINT "app_setting_value_pkey" PRIMARY KEY ("asv_id")
);

-- CreateTable
CREATE TABLE "app_theme_master" (
    "thm_id" SERIAL NOT NULL,
    "thm_name" VARCHAR(100) NOT NULL,
    "thm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "thm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "thm_base" VARCHAR(5) NOT NULL DEFAULT 'LIGHT',
    "thm_tokens" JSONB NOT NULL DEFAULT '{}',
    "thm_is_default" BOOLEAN NOT NULL DEFAULT false,
    "thm_remarks" VARCHAR(250),
    "thm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thm_created_by" VARCHAR(100),
    "thm_modified_on" TIMESTAMPTZ(6),
    "thm_modified_by" VARCHAR(100),
    "thm_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "app_theme_master_pkey" PRIMARY KEY ("thm_id")
);

-- CreateTable
CREATE TABLE "app_theme_template" (
    "tpl_id" SERIAL NOT NULL,
    "tpl_name" VARCHAR(100) NOT NULL,
    "tpl_qss" TEXT NOT NULL,
    "tpl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "tpl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tpl_remarks" VARCHAR(250),
    "tpl_sync_date" TIMESTAMPTZ(6),
    "tpl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tpl_created_by" VARCHAR(100),
    "tpl_modified_on" TIMESTAMPTZ(6),
    "tpl_modified_by" VARCHAR(100),

    CONSTRAINT "app_theme_template_pkey" PRIMARY KEY ("tpl_id")
);

-- CreateTable
CREATE TABLE "batches_prefix" (
    "id" UUID NOT NULL,
    "prefix_used" TEXT,
    "sync_date" TIMESTAMPTZ(0),
    "created_by" VARCHAR(100),
    "created_on" TIMESTAMPTZ(0),
    "modified_by" VARCHAR(100),
    "modified_on" TIMESTAMPTZ(0),

    CONSTRAINT "batches_prefix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_master" (
    "br_id" UUID NOT NULL DEFAULT uuidv7(),
    "br_comp_id" UUID NOT NULL,
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
    "br_pin" INTEGER,
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
    "br_region_name" TEXT,
    "br_gstin_no" VARCHAR(15),
    "br_gst_reg_type" VARCHAR(30),
    "br_pan_no" VARCHAR(10),

    CONSTRAINT "branch_master_pkey" PRIMARY KEY ("br_id")
);

-- CreateTable
CREATE TABLE "charge_master" (
    "chg_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chg_name" VARCHAR(100) NOT NULL,
    "chg_code" VARCHAR(50),
    "chg_module" CHAR(1) NOT NULL,
    "chg_role" VARCHAR(15),
    "chg_method" VARCHAR(10) NOT NULL,
    "chg_type" VARCHAR(10) NOT NULL DEFAULT 'ADD',
    "chg_apply_on" VARCHAR(10) NOT NULL,
    "chg_default_rate" DECIMAL(14,4) DEFAULT 0,
    "chg_landing_cost" BOOLEAN NOT NULL DEFAULT false,
    "chg_cost_alloc" VARCHAR(10),
    "chg_ledger_code" UUID NOT NULL,
    "chg_tax_apl" BOOLEAN NOT NULL DEFAULT false,
    "chg_before_tax" BOOLEAN NOT NULL DEFAULT false,
    "chg_tax_id" UUID,
    "chg_sep_post" BOOLEAN NOT NULL DEFAULT false,
    "chg_on_bill" BOOLEAN NOT NULL DEFAULT true,
    "chg_man_party" BOOLEAN NOT NULL DEFAULT false,
    "chg_disp_order" INTEGER DEFAULT 0,
    "chg_auto_apply" BOOLEAN NOT NULL DEFAULT false,
    "chg_is_active" BOOLEAN NOT NULL DEFAULT true,
    "chg_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "chg_sync_date" TIMESTAMPTZ,
    "chg_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chg_created_by" UUID,
    "chg_modified_on" TIMESTAMPTZ,
    "chg_modified_by" UUID,

    CONSTRAINT "charge_master_pkey" PRIMARY KEY ("chg_id")
);

-- CreateTable
CREATE TABLE "companys" (
    "comp_id" UUID NOT NULL DEFAULT uuidv7(),
    "comp_code" VARCHAR(20),
    "comp_name" TEXT NOT NULL,
    "comp_short" TEXT,
    "comp_legal_name" TEXT,
    "comp_gstin_no" VARCHAR(15),
    "comp_gst_reg_type" VARCHAR(30),
    "comp_pan_no" VARCHAR(10),
    "comp_fssai_no" VARCHAR(20),
    "comp_drug_license_no" TEXT,
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
    "comp_aato_class" VARCHAR(10) NOT NULL DEFAULT 'LE_5CR',
    "comp_dc_purposes" VARCHAR(20)[] DEFAULT ARRAY['SUPPLY', 'APPROVAL', 'JOB_WORK', 'OTHER']::VARCHAR(20)[],
    "comp_eway_applicable" BOOLEAN NOT NULL DEFAULT false,
    "comp_eway_date" DATE,
    "comp_eway_inter_limit" DECIMAL,
    "comp_eway_intra_apl" BOOLEAN NOT NULL DEFAULT false,
    "comp_eway_intra_limit" DECIMAL NOT NULL DEFAULT 0,
    "comp_einvoice_date" DATE,
    "comp_einvoice_incl_eway" BOOLEAN,
    "comp_stylesheet_id" INTEGER,
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
    "comp_tan_no" TEXT,
    "comp_cin_no" TEXT,
    "comp_region_name" TEXT,
    "comp_books_lock_date" DATE,
    "comp_authorize_signature" TEXT,
    "comp_tds_applicable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "companys_pkey" PRIMARY KEY ("comp_id")
);

-- CreateTable
CREATE TABLE "company_aato" (
    "caa_id" UUID NOT NULL DEFAULT uuidv7(),
    "caa_company_id" UUID NOT NULL,
    "caa_fin_year" CHAR(9) NOT NULL,
    "caa_aato_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "caa_source" VARCHAR(10) NOT NULL DEFAULT 'COMPUTED',
    "caa_declared_by" VARCHAR(50),
    "caa_declared_on" DATE,
    "caa_remarks" VARCHAR(250),
    "caa_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "caa_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caa_created_by" VARCHAR(50),
    "caa_modified_on" TIMESTAMPTZ(6),
    "caa_modified_by" VARCHAR(50),
    "caa_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_company_aato" PRIMARY KEY ("caa_id")
);

-- CreateTable
CREATE TABLE "company_group_master" (
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
CREATE TABLE "db_table_master" (
    "dtm_id" SERIAL NOT NULL,
    "dtm_schema" VARCHAR(63) NOT NULL,
    "dtm_table" VARCHAR(63) NOT NULL,
    "dtm_parent_id" INTEGER,
    "dtm_name" VARCHAR(200) NOT NULL,
    "dtm_kind" VARCHAR(20) NOT NULL,
    "dtm_module" VARCHAR(30),
    "dtm_col_prefix" VARCHAR(30),
    "dtm_menu_id" INTEGER,
    "dtm_write_mode" VARCHAR(12) NOT NULL DEFAULT 'EDITABLE',
    "dtm_retention_days" INTEGER,
    "dtm_description" TEXT,
    "dtm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "dtm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dtm_modified_on" TIMESTAMPTZ(6),
    "dtm_sync_date" TIMESTAMPTZ(6),
    "dtm_sync_col" VARCHAR(63),

    CONSTRAINT "pk_db_table_master" PRIMARY KEY ("dtm_id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "fy_id" UUID NOT NULL DEFAULT uuidv7(),
    "comp_id" UUID NOT NULL,
    "fy_year_name" CHAR(9) NOT NULL,
    "fy_begin_date" DATE NOT NULL,
    "fy_end_date" DATE NOT NULL,
    "fy_books_begin_date" DATE,
    "fy_status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "fy_is_current" BOOLEAN NOT NULL DEFAULT false,
    "fy_lock_date" DATE,
    "fy_closed_at" TIMESTAMPTZ(6),
    "fy_closed_by" UUID,
    "fy_is_carried_forward" BOOLEAN NOT NULL DEFAULT false,
    "fy_carried_forward_at" TIMESTAMPTZ(6),
    "fy_prev_fy_id" UUID,
    "fy_detached" BOOLEAN NOT NULL DEFAULT false,
    "fy_remarks" VARCHAR(500),
    "tally_guid" VARCHAR(64),
    "tally_master_id" BIGINT,
    "tally_alter_id" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "fy_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pkey_fiscal_years" PRIMARY KEY ("fy_id")
);

-- CreateTable
CREATE TABLE "gst_api_log" (
    "gal_id" UUID NOT NULL DEFAULT uuidv7(),
    "gal_company_id" UUID NOT NULL,
    "gal_branch_id" UUID,
    "gal_tenant_id" UUID,
    "gal_acc_year" CHAR(9) NOT NULL,
    "gal_gcc_id" UUID,
    "gal_gpv_id" UUID,
    "gal_service" VARCHAR(20) NOT NULL,
    "gal_action" VARCHAR(30) NOT NULL,
    "gal_environment" VARCHAR(10) NOT NULL,
    "gal_src_module" VARCHAR(20),
    "gal_src_doc_type" VARCHAR(30),
    "gal_src_doc_id" UUID,
    "gal_gdr_id" UUID,
    "gal_idempotency_key" VARCHAR(100),
    "gal_attempt_no" SMALLINT NOT NULL DEFAULT 1,
    "gal_request_url" TEXT,
    "gal_request_headers" JSONB,
    "gal_request_payload" JSONB,
    "gal_http_status" SMALLINT,
    "gal_response_payload" JSONB,
    "gal_provider_code" VARCHAR(50),
    "gal_our_code" VARCHAR(30),
    "gal_is_success" BOOLEAN NOT NULL,
    "gal_message" VARCHAR(500),
    "gal_started_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gal_finished_on" TIMESTAMPTZ(6),
    "gal_duration_ms" INTEGER,
    "gal_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gal_sync_date" TIMESTAMPTZ(6),
    "gal_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gal_created_by" VARCHAR(50),

    CONSTRAINT "pk_gst_api_log" PRIMARY KEY ("gal_id","gal_acc_year")
);

-- CreateTable
CREATE TABLE "gst_auth_session" (
    "gas_id" UUID NOT NULL DEFAULT uuidv7(),
    "gas_gcc_id" UUID NOT NULL,
    "gas_auth_token_enc" TEXT NOT NULL,
    "gas_session_key_enc" TEXT,
    "gas_refresh_token_enc" TEXT,
    "gas_key_version" SMALLINT NOT NULL DEFAULT 1,
    "gas_token_type" VARCHAR(20) NOT NULL DEFAULT 'AuthToken',
    "gas_issued_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gas_expires_on" TIMESTAMPTZ(6) NOT NULL,
    "gas_expiry_raw" VARCHAR(40),
    "gas_lock_by" UUID,
    "gas_lock_on" TIMESTAMPTZ(6),
    "gas_lock_upto" TIMESTAMPTZ(6),
    "gas_token_version" INTEGER NOT NULL DEFAULT 0,
    "gas_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gas_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gas_sync_date" TIMESTAMPTZ(6),
    "gas_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gas_created_by" VARCHAR(50) NOT NULL,

    CONSTRAINT "pk_gst_auth_session" PRIMARY KEY ("gas_id")
);

-- CreateTable
CREATE TABLE "gst_company_credential" (
    "gcc_id" UUID NOT NULL DEFAULT uuidv7(),
    "gcc_company_id" UUID NOT NULL,
    "gcc_branch_id" UUID,
    "gcc_gpv_id" UUID NOT NULL,
    "gcc_service" VARCHAR(20),
    "gcc_environment" VARCHAR(10) NOT NULL,
    "gcc_priority" SMALLINT NOT NULL DEFAULT 1,
    "gcc_login_id" TEXT NOT NULL,
    "gcc_password_enc" TEXT NOT NULL,
    "gcc_client_id_enc" TEXT,
    "gcc_client_secret_enc" TEXT,
    "gcc_app_key_enc" TEXT,
    "gcc_public_key_ref" VARCHAR(100),
    "gcc_key_version" SMALLINT NOT NULL DEFAULT 1,
    "gcc_whitelisted_ips" INET[],
    "gcc_valid_from" DATE,
    "gcc_valid_upto" DATE,
    "gcc_password_changed_on" TIMESTAMPTZ(6),
    "gcc_last_verified_on" TIMESTAMPTZ(6),
    "gcc_last_error_message" VARCHAR(500),
    "gcc_remarks" VARCHAR(500),
    "gcc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gcc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gcc_sync_date" TIMESTAMPTZ(6),
    "gcc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gcc_created_by" VARCHAR(50) NOT NULL,
    "gcc_modified_on" TIMESTAMPTZ(6),
    "gcc_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_company_credential" PRIMARY KEY ("gcc_id")
);

-- CreateTable
CREATE TABLE "gst_provider" (
    "gpv_id" UUID NOT NULL DEFAULT uuidv7(),
    "gpv_code" VARCHAR(20) NOT NULL,
    "gpv_name" VARCHAR(150) NOT NULL,
    "gpv_portal_url" TEXT,
    "gpv_support_email" VARCHAR(120),
    "gpv_support_phone" VARCHAR(20),
    "gpv_timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "gpv_max_retries" SMALLINT NOT NULL DEFAULT 2,
    "gpv_rate_limit_per_min" SMALLINT,
    "gpv_remarks" VARCHAR(500),
    "gpv_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gpv_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gpv_sync_date" TIMESTAMPTZ(6),
    "gpv_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gpv_created_by" VARCHAR(50) NOT NULL,
    "gpv_modified_on" TIMESTAMPTZ(6),
    "gpv_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_provider" PRIMARY KEY ("gpv_id")
);

-- CreateTable
CREATE TABLE "gst_provider_account" (
    "gpa_id" UUID NOT NULL DEFAULT uuidv7(),
    "gpa_gpv_id" UUID NOT NULL,
    "gpa_environment" VARCHAR(10) NOT NULL,
    "gpa_service" VARCHAR(20),
    "gpa_account_ref" VARCHAR(100),
    "gpa_client_id_enc" TEXT,
    "gpa_client_secret_enc" TEXT,
    "gpa_api_key_enc" TEXT,
    "gpa_key_version" SMALLINT NOT NULL DEFAULT 1,
    "gpa_valid_from" DATE,
    "gpa_valid_upto" DATE,
    "gpa_credit_balance" DECIMAL(14,2),
    "gpa_balance_checked_on" TIMESTAMPTZ(6),
    "gpa_last_verified_on" TIMESTAMPTZ(6),
    "gpa_remarks" VARCHAR(500),
    "gpa_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gpa_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gpa_sync_date" TIMESTAMPTZ(6),
    "gpa_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gpa_created_by" VARCHAR(50) NOT NULL,
    "gpa_modified_on" TIMESTAMPTZ(6),
    "gpa_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_provider_account" PRIMARY KEY ("gpa_id")
);

-- CreateTable
CREATE TABLE "gst_provider_endpoint" (
    "gpe_id" UUID NOT NULL DEFAULT uuidv7(),
    "gpe_gps_id" UUID NOT NULL,
    "gpe_action" VARCHAR(30) NOT NULL,
    "gpe_http_method" VARCHAR(6) NOT NULL DEFAULT 'POST',
    "gpe_path_template" TEXT NOT NULL,
    "gpe_query_template" TEXT,
    "gpe_content_type" VARCHAR(60) NOT NULL DEFAULT 'application/json',
    "gpe_headers" JSONB,
    "gpe_request_wrapper" VARCHAR(30),
    "gpe_redact_paths" JSONB,
    "gpe_response_root_path" TEXT,
    "gpe_success_path" TEXT,
    "gpe_success_value" VARCHAR(20),
    "gpe_error_code_path" TEXT,
    "gpe_error_message_path" TEXT,
    "gpe_timeout_ms" INTEGER,
    "gpe_max_retries" SMALLINT,
    "gpe_is_idempotent" BOOLEAN NOT NULL DEFAULT false,
    "gpe_remarks" VARCHAR(500),
    "gpe_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gpe_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gpe_sync_date" TIMESTAMPTZ(6),
    "gpe_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gpe_created_by" VARCHAR(50) NOT NULL,
    "gpe_modified_on" TIMESTAMPTZ(6),
    "gpe_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_provider_endpoint" PRIMARY KEY ("gpe_id")
);

-- CreateTable
CREATE TABLE "gst_provider_error_map" (
    "gem_id" UUID NOT NULL DEFAULT uuidv7(),
    "gem_gpv_id" UUID NOT NULL,
    "gem_service" VARCHAR(20),
    "gem_their_code" VARCHAR(50) NOT NULL,
    "gem_our_code" VARCHAR(30) NOT NULL,
    "gem_message" VARCHAR(500),
    "gem_treat_as" VARCHAR(10) NOT NULL DEFAULT 'ERROR',
    "gem_extract_path" TEXT,
    "gem_canonical_field" VARCHAR(60),
    "gem_is_retryable" BOOLEAN NOT NULL DEFAULT false,
    "gem_retry_after_seconds" INTEGER,
    "gem_should_reauth" BOOLEAN NOT NULL DEFAULT false,
    "gem_recovery_action" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "gem_severity" VARCHAR(10) NOT NULL DEFAULT 'ERROR',
    "gem_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gem_sync_date" TIMESTAMPTZ(6),
    "gem_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gem_created_by" VARCHAR(50) NOT NULL,
    "gem_modified_on" TIMESTAMPTZ(6),
    "gem_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_provider_error_map" PRIMARY KEY ("gem_id")
);

-- CreateTable
CREATE TABLE "gst_provider_field_map" (
    "gfm_id" UUID NOT NULL DEFAULT uuidv7(),
    "gfm_gpe_id" UUID NOT NULL,
    "gfm_direction" VARCHAR(10) NOT NULL,
    "gfm_our_field" VARCHAR(60) NOT NULL,
    "gfm_their_path" TEXT NOT NULL,
    "gfm_data_type" VARCHAR(10) NOT NULL DEFAULT 'TEXT',
    "gfm_transform" VARCHAR(30) NOT NULL DEFAULT 'NONE',
    "gfm_format_mask" VARCHAR(40),
    "gfm_is_required" BOOLEAN NOT NULL DEFAULT false,
    "gfm_default_value" TEXT,
    "gfm_target_column" VARCHAR(64),
    "gfm_sort_order" SMALLINT NOT NULL DEFAULT 0,
    "gfm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gfm_sync_date" TIMESTAMPTZ(6),
    "gfm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gfm_created_by" VARCHAR(50) NOT NULL,
    "gfm_modified_on" TIMESTAMPTZ(6),
    "gfm_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_provider_field_map" PRIMARY KEY ("gfm_id")
);

-- CreateTable
CREATE TABLE "gst_provider_service" (
    "gps_id" UUID NOT NULL DEFAULT uuidv7(),
    "gps_gpv_id" UUID NOT NULL,
    "gps_service" VARCHAR(20) NOT NULL,
    "gps_environment" VARCHAR(10) NOT NULL,
    "gps_base_url" TEXT NOT NULL,
    "gps_fallback_urls" TEXT[],
    "gps_auth_scheme" VARCHAR(20) NOT NULL,
    "gps_token_ttl_minutes" SMALLINT NOT NULL DEFAULT 360,
    "gps_refresh_margin_minutes" SMALLINT NOT NULL DEFAULT 15,
    "gps_payload_encryption" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "gps_timeout_ms" INTEGER,
    "gps_max_retries" SMALLINT,
    "gps_remarks" VARCHAR(500),
    "gps_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gps_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gps_sync_date" TIMESTAMPTZ(6),
    "gps_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gps_created_by" VARCHAR(50) NOT NULL,
    "gps_modified_on" TIMESTAMPTZ(6),
    "gps_modified_by" VARCHAR(50),

    CONSTRAINT "pk_gst_provider_service" PRIMARY KEY ("gps_id")
);

-- CreateTable
CREATE TABLE "printer_profile" (
    "prf_id" UUID NOT NULL DEFAULT uuidv7(),
    "prf_company_id" UUID NOT NULL,
    "prf_branch_id" UUID,
    "prf_device_id" UUID,
    "prf_code" VARCHAR(40) NOT NULL,
    "prf_name" VARCHAR(120) NOT NULL,
    "prf_conn_kind" VARCHAR(15) NOT NULL DEFAULT 'CUPS',
    "prf_queue_name" VARCHAR(120),
    "prf_host" VARCHAR(120),
    "prf_port" INTEGER,
    "prf_emulation" VARCHAR(20) NOT NULL DEFAULT 'ESCPOS',
    "prf_codepage" VARCHAR(20),
    "prf_paper_code" VARCHAR(20) NOT NULL DEFAULT 'A4',
    "prf_width_mm" DECIMAL(8,2),
    "prf_height_mm" DECIMAL(8,2),
    "prf_columns" SMALLINT,
    "prf_dpi" SMALLINT,
    "prf_supports_cut" BOOLEAN NOT NULL DEFAULT false,
    "prf_supports_drawer" BOOLEAN NOT NULL DEFAULT false,
    "prf_supports_color" BOOLEAN NOT NULL DEFAULT false,
    "prf_init_sequence" TEXT,
    "prf_cut_sequence" TEXT,
    "prf_sort_order" SMALLINT NOT NULL DEFAULT 100,
    "prf_remarks" VARCHAR(250),
    "prf_is_active" BOOLEAN NOT NULL DEFAULT true,
    "prf_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "prf_sync_date" TIMESTAMPTZ(6),
    "prf_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prf_created_by" UUID,
    "prf_modified_on" TIMESTAMPTZ(6),
    "prf_modified_by" UUID,

    CONSTRAINT "pk_printer_profile" PRIMARY KEY ("prf_id")
);

-- CreateTable
CREATE TABLE "print_log" (
    "plg_id" UUID NOT NULL DEFAULT uuidv7(),
    "plg_acc_year" CHAR(9) NOT NULL,
    "plg_company_id" UUID NOT NULL,
    "plg_branch_id" UUID,
    "plg_device_id" UUID,
    "plg_src_module" VARCHAR(20) NOT NULL DEFAULT 'SALES',
    "plg_src_doc_type" VARCHAR(40) NOT NULL,
    "plg_src_doc_id" UUID,
    "plg_src_acc_year" CHAR(9),
    "plg_purpose_id" UUID NOT NULL,
    "plg_template_id" UUID NOT NULL,
    "plg_version_id" UUID NOT NULL,
    "plg_printer_id" UUID,
    "plg_output_mode" VARCHAR(15) NOT NULL DEFAULT 'PRINT',
    "plg_copy_no" SMALLINT NOT NULL DEFAULT 1,
    "plg_copy_label" VARCHAR(20),
    "plg_lang" VARCHAR(5),
    "plg_params" JSONB,
    "plg_status" VARCHAR(15) NOT NULL DEFAULT 'SUCCESS',
    "plg_error" TEXT,
    "plg_page_count" SMALLINT,
    "plg_byte_count" INTEGER,
    "plg_duration_ms" INTEGER,
    "plg_printed_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plg_printed_by" UUID,
    "plg_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_print_log" PRIMARY KEY ("plg_id","plg_acc_year")
);

-- CreateTable
CREATE TABLE "print_purpose" (
    "ppo_id" UUID NOT NULL DEFAULT uuidv7(),
    "ppo_company_id" UUID,
    "ppo_code" VARCHAR(40) NOT NULL,
    "ppo_name" VARCHAR(120) NOT NULL,
    "ppo_src_module" VARCHAR(20) NOT NULL DEFAULT 'SALES',
    "ppo_doc_type" VARCHAR(40) NOT NULL,
    "ppo_copy_count" SMALLINT NOT NULL DEFAULT 1,
    "ppo_copy_labels" VARCHAR(120),
    "ppo_allow_reprint" BOOLEAN NOT NULL DEFAULT true,
    "ppo_sort_order" SMALLINT NOT NULL DEFAULT 100,
    "ppo_notes" TEXT,
    "ppo_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ppo_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ppo_sync_date" TIMESTAMPTZ(6),
    "ppo_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ppo_created_by" UUID,
    "ppo_modified_on" TIMESTAMPTZ(6),
    "ppo_modified_by" UUID,

    CONSTRAINT "pk_print_purpose" PRIMARY KEY ("ppo_id")
);

-- CreateTable
CREATE TABLE "print_share_link" (
    "psl_id" UUID NOT NULL DEFAULT uuidv7(),
    "psl_token" VARCHAR(43) NOT NULL,
    "psl_version_id" UUID NOT NULL,
    "psl_doc_id" UUID NOT NULL,
    "psl_company_id" UUID NOT NULL,
    "psl_branch_id" UUID,
    "psl_acc_year" CHAR(9) NOT NULL,
    "psl_device_id" UUID,
    "psl_filename" VARCHAR(80) NOT NULL,
    "psl_expires_on" TIMESTAMPTZ(6) NOT NULL,
    "psl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psl_created_by" UUID,
    "psl_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "print_share_link_pkey" PRIMARY KEY ("psl_id")
);

-- CreateTable
CREATE TABLE "print_template" (
    "ptl_id" UUID NOT NULL DEFAULT uuidv7(),
    "ptl_company_id" UUID,
    "ptl_purpose_id" UUID NOT NULL,
    "ptl_code" VARCHAR(60) NOT NULL,
    "ptl_name" VARCHAR(120) NOT NULL,
    "ptl_description" TEXT,
    "ptl_published_rev_id" UUID,
    "ptl_forked_from_id" UUID,
    "ptl_forked_from_rev" INTEGER,
    "ptl_sort_order" SMALLINT NOT NULL DEFAULT 100,
    "ptl_company_key" UUID,
    "ptl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ptl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ptl_sync_date" TIMESTAMPTZ(6),
    "ptl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ptl_created_by" UUID,
    "ptl_modified_on" TIMESTAMPTZ(6),
    "ptl_modified_by" UUID,

    CONSTRAINT "pk_print_template" PRIMARY KEY ("ptl_id")
);

-- CreateTable
CREATE TABLE "print_template_assignment" (
    "pta_id" UUID NOT NULL DEFAULT uuidv7(),
    "pta_company_id" UUID,
    "pta_branch_id" UUID,
    "pta_device_id" UUID,
    "pta_purpose_id" UUID NOT NULL,
    "pta_template_id" UUID NOT NULL,
    "pta_template_company_key" UUID NOT NULL,
    "pta_output_mode" VARCHAR(15) NOT NULL DEFAULT 'PRINT',
    "pta_printer_id" UUID,
    "pta_printer_name" VARCHAR(150),
    "pta_copies" SMALLINT,
    "pta_specificity" SMALLINT,
    "pta_remarks" VARCHAR(250),
    "pta_is_active" BOOLEAN NOT NULL DEFAULT true,
    "pta_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pta_sync_date" TIMESTAMPTZ(6),
    "pta_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pta_created_by" UUID,
    "pta_modified_on" TIMESTAMPTZ(6),
    "pta_modified_by" UUID,

    CONSTRAINT "pk_print_template_assignment" PRIMARY KEY ("pta_id")
);

-- CreateTable
CREATE TABLE "print_template_dataset" (
    "ptd_id" UUID NOT NULL DEFAULT uuidv7(),
    "ptd_version_id" UUID NOT NULL,
    "ptd_role" VARCHAR(10) NOT NULL DEFAULT 'DETAIL',
    "ptd_dataset_no" SMALLINT NOT NULL,
    "ptd_sort_order" SMALLINT NOT NULL DEFAULT 0,
    "ptd_name" VARCHAR(40) NOT NULL,
    "ptd_label" VARCHAR(120),
    "ptd_source_kind" VARCHAR(10) NOT NULL DEFAULT 'PROVIDER',
    "ptd_provider_code" VARCHAR(80),
    "ptd_sql" TEXT,
    "ptd_sql_norm" TEXT,
    "ptd_parent_no" SMALLINT,
    "ptd_link_fields" VARCHAR(200),
    "ptd_row_limit" INTEGER NOT NULL DEFAULT 5000,
    "ptd_timeout_ms" INTEGER NOT NULL DEFAULT 15000,
    "ptd_remarks" VARCHAR(250),
    "ptd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ptd_sync_date" TIMESTAMPTZ(6),
    "ptd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ptd_created_by" UUID,
    "ptd_modified_on" TIMESTAMPTZ(6),
    "ptd_modified_by" UUID,

    CONSTRAINT "pk_print_template_dataset" PRIMARY KEY ("ptd_id")
);

-- CreateTable
CREATE TABLE "print_template_version" (
    "ptv_id" UUID NOT NULL DEFAULT uuidv7(),
    "ptv_template_id" UUID NOT NULL,
    "ptv_rev_no" INTEGER NOT NULL,
    "ptv_status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "ptv_engine" VARCHAR(20) NOT NULL DEFAULT 'JSON_BANDS',
    "ptv_body" TEXT NOT NULL,
    "ptv_schema_ver" INTEGER NOT NULL DEFAULT 1,
    "ptv_paper_code" VARCHAR(20) NOT NULL DEFAULT 'A4',
    "ptv_orientation" VARCHAR(10) NOT NULL DEFAULT 'PORTRAIT',
    "ptv_width_mm" DECIMAL(8,2),
    "ptv_height_mm" DECIMAL(8,2),
    "ptv_margin_top_mm" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "ptv_margin_bottom_mm" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "ptv_margin_left_mm" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "ptv_margin_right_mm" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "ptv_columns" SMALLINT,
    "ptv_lang" VARCHAR(5) NOT NULL DEFAULT 'en-IN',
    "ptv_font_family" VARCHAR(80),
    "ptv_params" JSONB,
    "ptv_note" VARCHAR(250),
    "ptv_approved_on" TIMESTAMPTZ(6),
    "ptv_approved_by" UUID,
    "ptv_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ptv_sync_date" TIMESTAMPTZ(6),
    "ptv_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ptv_created_by" UUID,
    "ptv_modified_on" TIMESTAMPTZ(6),
    "ptv_modified_by" UUID,

    CONSTRAINT "pk_print_template_version" PRIMARY KEY ("ptv_id")
);

-- CreateTable
CREATE TABLE "_erp_seed_history" (
    "seed_name" TEXT NOT NULL,
    "seed_kind" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "last_status" TEXT NOT NULL,
    "last_error" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "first_run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_erp_seed_history_pkey" PRIMARY KEY ("seed_name")
);

-- CreateTable
CREATE TABLE "statutory_limits" (
    "stl_id" UUID NOT NULL DEFAULT uuidv7(),
    "stl_company_id" UUID,
    "stl_code" VARCHAR(40) NOT NULL,
    "stl_law" VARCHAR(10) NOT NULL,
    "stl_section" VARCHAR(40),
    "stl_label" VARCHAR(200) NOT NULL,
    "stl_value_type" VARCHAR(10) NOT NULL,
    "stl_value" DECIMAL(18,4),
    "stl_value_text" VARCHAR(100),
    "stl_applies_to" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "stl_aato_class" VARCHAR(10),
    "stl_effective_from" DATE NOT NULL,
    "stl_effective_to" DATE,
    "stl_enforce" VARCHAR(10) NOT NULL DEFAULT 'WARN',
    "stl_source_ref" VARCHAR(250),
    "stl_remarks" VARCHAR(250),
    "stl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "stl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stl_sync_date" TIMESTAMPTZ(6),
    "stl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stl_created_by" VARCHAR(50),
    "stl_modified_on" TIMESTAMPTZ(6),
    "stl_modified_by" VARCHAR(50),

    CONSTRAINT "pk_statutory_limits" PRIMARY KEY ("stl_id")
);

-- CreateTable
CREATE TABLE "sync_deleted_rows" (
    "sdr_id" BIGSERIAL NOT NULL,
    "sdr_schema" VARCHAR(63) NOT NULL,
    "sdr_table" VARCHAR(63) NOT NULL,
    "sdr_pk" JSONB NOT NULL,
    "sdr_deleted_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdr_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "pk_sync_deleted_rows" PRIMARY KEY ("sdr_id")
);

-- CreateTable
CREATE TABLE "txn_charge_detail" (
    "cd_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cd_doc_type" VARCHAR(30) NOT NULL,
    "cd_doc_id" UUID NOT NULL,
    "cd_slno" INTEGER,
    "cd_comp_id" UUID NOT NULL,
    "cd_branch_id" UUID NOT NULL,
    "cd_acc_year" CHAR(9) NOT NULL,
    "cd_voucher_no" BIGINT,
    "cd_chg_id" UUID NOT NULL,
    "cd_chg_name" VARCHAR(100),
    "cd_role" VARCHAR(15),
    "cd_method" VARCHAR(10),
    "cd_type" VARCHAR(10) NOT NULL DEFAULT 'ADD',
    "cd_apply_on" VARCHAR(10),
    "cd_ledger_code" UUID NOT NULL,
    "cd_landing_cost" BOOLEAN NOT NULL DEFAULT false,
    "cd_cost_alloc" VARCHAR(10),
    "cd_before_tax" BOOLEAN NOT NULL DEFAULT false,
    "cd_tax_apl" BOOLEAN NOT NULL DEFAULT false,
    "cd_sep_post" BOOLEAN NOT NULL DEFAULT false,
    "cd_on_bill" BOOLEAN NOT NULL DEFAULT true,
    "cd_party_id" UUID,
    "cd_unit" VARCHAR(15),
    "cd_qty_val" DECIMAL(18,4),
    "cd_weight" DECIMAL(18,4),
    "cd_rate" DECIMAL(17,4),
    "cd_amount" DECIMAL(17,4),
    "cd_tax_code" UUID,
    "cd_hsn" VARCHAR(15),
    "cd_tax_perc" DECIMAL(9,4),
    "cd_tax_amt" DECIMAL(17,4),
    "cd_sgst_perc" DECIMAL(9,4),
    "cd_sgst_amt" DECIMAL(17,4),
    "cd_cgst_perc" DECIMAL(9,4),
    "cd_cgst_amt" DECIMAL(17,4),
    "cd_igst_perc" DECIMAL(9,4),
    "cd_igst_amt" DECIMAL(17,4),
    "cd_cess_perc" DECIMAL(9,4),
    "cd_cess_amt" DECIMAL(17,4),
    "cd_net_amt" DECIMAL(17,4),
    "cd_remarks" VARCHAR(255),
    "cd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "cd_src_cd_id" UUID,
    "cd_src_acc_year" CHAR(9),
    "cd_carry_basis" VARCHAR(10),
    "cd_carried_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "cd_sync_date" TIMESTAMPTZ,
    "cd_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cd_created_by" TEXT,
    "cd_modified_on" TIMESTAMPTZ,
    "cd_modified_by" TEXT,

    CONSTRAINT "pk_txn_charge_detail" PRIMARY KEY ("cd_id","cd_acc_year")
);

-- CreateTable
CREATE TABLE "txn_transport_detail" (
    "ttd_id" UUID NOT NULL DEFAULT uuidv7(),
    "ttd_company_id" UUID NOT NULL,
    "ttd_branch_id" UUID NOT NULL,
    "ttd_tenant_id" UUID,
    "ttd_acc_year" CHAR(9) NOT NULL,
    "ttd_doc_type" VARCHAR(30) NOT NULL,
    "ttd_doc_id" UUID NOT NULL,
    "ttd_doc_refno" VARCHAR(100),
    "ttd_direction" VARCHAR(10) NOT NULL,
    "ttd_from_godown_id" UUID,
    "ttd_from_branch_id" UUID,
    "ttd_from_addr_id" UUID,
    "ttd_from_name" VARCHAR(200),
    "ttd_from_addr" VARCHAR(500),
    "ttd_from_place" VARCHAR(100),
    "ttd_from_pin" VARCHAR(10),
    "ttd_from_phone" VARCHAR(20),
    "ttd_from_stcd" CHAR(2),
    "ttd_from_gstin" VARCHAR(15),
    "ttd_to_godown_id" UUID,
    "ttd_to_branch_id" UUID,
    "ttd_to_addr_id" UUID,
    "ttd_to_name" VARCHAR(200),
    "ttd_to_addr" VARCHAR(500),
    "ttd_to_place" VARCHAR(100),
    "ttd_to_pin" VARCHAR(10),
    "ttd_to_phone" VARCHAR(20),
    "ttd_to_stcd" CHAR(2),
    "ttd_to_gstin" VARCHAR(15),
    "ttd_transport_mode" VARCHAR(10),
    "ttd_transporter_id" UUID,
    "ttd_transporter_name" VARCHAR(200),
    "ttd_transporter_gstin" VARCHAR(15),
    "ttd_lr_no" VARCHAR(50),
    "ttd_lr_date" DATE,
    "ttd_distance_km" INTEGER,
    "ttd_remarks" VARCHAR(250),
    "ttd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ttd_sync_date" TIMESTAMPTZ(6),
    "ttd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttd_created_by" VARCHAR(50) NOT NULL,
    "ttd_modified_on" TIMESTAMPTZ(6),
    "ttd_modified_by" VARCHAR(50),

    CONSTRAINT "pk_txn_transport_detail" PRIMARY KEY ("ttd_id","ttd_acc_year")
);

-- CreateTable
CREATE TABLE "transporter_master" (
    "trn_id" UUID NOT NULL DEFAULT uuidv7(),
    "trn_company_id" UUID,
    "trn_code" VARCHAR(30),
    "trn_name" VARCHAR(200) NOT NULL,
    "trn_gstin" VARCHAR(15),
    "trn_is_enrolment_id" BOOLEAN NOT NULL DEFAULT false,
    "trn_mode" VARCHAR(10) NOT NULL DEFAULT 'ROAD',
    "trn_ledger_id" UUID,
    "trn_phone" VARCHAR(20),
    "trn_email" VARCHAR(150),
    "trn_addr" VARCHAR(500),
    "trn_place" VARCHAR(100),
    "trn_pin" VARCHAR(10),
    "trn_state_code" CHAR(2),
    "trn_remarks" VARCHAR(250),
    "trn_is_active" BOOLEAN NOT NULL DEFAULT true,
    "trn_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "trn_sync_date" TIMESTAMPTZ(6),
    "trn_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trn_created_by" VARCHAR(50),
    "trn_modified_on" TIMESTAMPTZ(6),
    "trn_modified_by" VARCHAR(50),

    CONSTRAINT "pk_transporter_master" PRIMARY KEY ("trn_id")
);

-- CreateTable
CREATE TABLE "txn_hold" (
    "txh_id" UUID NOT NULL DEFAULT uuidv7(),
    "txh_company_id" UUID NOT NULL,
    "txh_branch_id" UUID NOT NULL,
    "txh_tenant_id" UUID,
    "txh_acc_year" CHAR(9) NOT NULL,
    "txh_kind" VARCHAR(15) NOT NULL DEFAULT 'HOLD',
    "txh_src_module" VARCHAR(20) NOT NULL,
    "txh_doc_type" VARCHAR(30) NOT NULL,
    "txh_hold_no" VARCHAR(30),
    "txh_hold_slno" INTEGER,
    "txh_hold_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txh_device_id" UUID NOT NULL,
    "txh_counter_id" UUID,
    "txh_session_id" UUID,
    "txh_held_by" UUID NOT NULL,
    "txh_party_type" VARCHAR(15),
    "txh_party_id" UUID,
    "txh_party_name" VARCHAR(150),
    "txh_party_mobile" VARCHAR(20),
    "txh_staff_id" UUID,
    "txh_ref_label" VARCHAR(50),
    "txh_item_count" INTEGER NOT NULL DEFAULT 0,
    "txh_total_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "txh_net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "txh_payload" JSONB NOT NULL,
    "txh_payload_version" SMALLINT NOT NULL DEFAULT 1,
    "txh_revision" INTEGER NOT NULL DEFAULT 1,
    "txh_status" VARCHAR(15) NOT NULL DEFAULT 'HELD',
    "txh_hold_reason" VARCHAR(100),
    "txh_remarks" VARCHAR(500),
    "txh_expires_on" TIMESTAMPTZ(6),
    "txh_locked_by" UUID,
    "txh_locked_device_id" UUID,
    "txh_locked_on" TIMESTAMPTZ(6),
    "txh_lock_expires_on" TIMESTAMPTZ(6),
    "txh_lock_token" UUID,
    "txh_resumed_by" UUID,
    "txh_resumed_on" TIMESTAMPTZ(6),
    "txh_resume_count" INTEGER NOT NULL DEFAULT 0,
    "txh_converted_doc_id" UUID,
    "txh_converted_acc_year" CHAR(9),
    "txh_converted_refno" VARCHAR(100),
    "txh_converted_on" TIMESTAMPTZ(6),
    "txh_converted_by" UUID,
    "txh_is_stock_reserved" BOOLEAN NOT NULL DEFAULT false,
    "txh_print_count" SMALLINT NOT NULL DEFAULT 0,
    "txh_last_printed_on" TIMESTAMPTZ(6),
    "txh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "txh_sync_date" TIMESTAMPTZ(6),
    "txh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txh_created_by" VARCHAR(50) NOT NULL,
    "txh_modified_on" TIMESTAMPTZ(6),
    "txh_modified_by" VARCHAR(50),

    CONSTRAINT "pk_txn_hold" PRIMARY KEY ("txh_id","txh_acc_year")
);

-- CreateTable
CREATE TABLE "txn_status_log" (
    "tsl_id" UUID NOT NULL DEFAULT uuidv7(),
    "tsl_company_id" UUID NOT NULL,
    "tsl_branch_id" UUID NOT NULL,
    "tsl_tenant_id" UUID,
    "tsl_acc_year" CHAR(9) NOT NULL,
    "tsl_src_module" VARCHAR(20) NOT NULL,
    "tsl_src_doc_type" VARCHAR(30) NOT NULL,
    "tsl_src_doc_id" UUID NOT NULL,
    "tsl_src_doc_refno" VARCHAR(100),
    "tsl_seq_no" INTEGER NOT NULL,
    "tsl_event" VARCHAR(30) NOT NULL,
    "tsl_from_status" VARCHAR(20),
    "tsl_to_status" VARCHAR(20) NOT NULL,
    "tsl_changed_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsl_changed_by" UUID NOT NULL,
    "tsl_remarks" VARCHAR(500),
    "tsl_device_id" UUID,
    "tsl_session_id" UUID,
    "tsl_notify_channel" VARCHAR(20),
    "tsl_notified_on" TIMESTAMPTZ(6),
    "tsl_notify_ref" VARCHAR(100),
    "tsl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tsl_sync_date" TIMESTAMPTZ(6),
    "tsl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tsl_created_by" VARCHAR(50) NOT NULL,

    CONSTRAINT "pk_txn_status_log" PRIMARY KEY ("tsl_id","tsl_acc_year")
);

-- CreateTable
CREATE TABLE "user_master" (
    "usr_id" UUID NOT NULL DEFAULT uuidv7(),
    "usr_company_id" UUID,
    "usr_branch_id" UUID,
    "usr_employee_id" UUID,
    "usr_login_name" VARCHAR(50) NOT NULL,
    "usr_display_name" VARCHAR(100) NOT NULL,
    "usr_full_name" VARCHAR(150),
    "usr_mobile_no" VARCHAR(20),
    "usr_email" VARCHAR(150),
    "usr_avatar_url" VARCHAR(500),
    "usr_timezone" VARCHAR(60) NOT NULL DEFAULT 'UTC',
    "usr_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "usr_password_hash" TEXT NOT NULL,
    "usr_pin_hash" TEXT,
    "usr_must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "usr_password_expires_on" TIMESTAMPTZ,
    "usr_password_changed_on" TIMESTAMPTZ,
    "usr_type" TEXT DEFAULT 'USER',
    "usr_edit_date" BOOLEAN NOT NULL DEFAULT false,
    "usr_edit_entry" BOOLEAN NOT NULL DEFAULT false,
    "usr_edit_rate" BOOLEAN NOT NULL DEFAULT false,
    "usr_desktop_login" BOOLEAN NOT NULL DEFAULT true,
    "usr_web_login" BOOLEAN NOT NULL DEFAULT true,
    "usr_mobile_login" BOOLEAN NOT NULL DEFAULT false,
    "usr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "usr_is_locked" BOOLEAN NOT NULL DEFAULT false,
    "usr_failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "usr_last_failed_login_on" TIMESTAMPTZ,
    "usr_locked_on" TIMESTAMPTZ,
    "usr_locked_by" UUID,
    "usr_last_login_on" TIMESTAMPTZ,
    "usr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "usr_notes" TEXT,
    "usr_sync_date" TIMESTAMPTZ,
    "usr_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usr_created_by" UUID,
    "usr_modified_on" TIMESTAMPTZ,
    "usr_modified_by" UUID,

    CONSTRAINT "user_master_pkey" PRIMARY KEY ("usr_id")
);

-- CreateTable
CREATE TABLE "user_menus" (
    "um_id" UUID NOT NULL DEFAULT uuidv7(),
    "um_user_id" UUID NOT NULL,
    "um_menu_id" INTEGER NOT NULL,
    "um_can_view" BOOLEAN NOT NULL DEFAULT true,
    "um_can_create" BOOLEAN NOT NULL DEFAULT false,
    "um_can_edit" BOOLEAN NOT NULL DEFAULT false,
    "um_can_delete" BOOLEAN NOT NULL DEFAULT false,
    "um_can_print" BOOLEAN NOT NULL DEFAULT false,
    "um_can_export" BOOLEAN NOT NULL DEFAULT false,
    "um_can_post" BOOLEAN NOT NULL DEFAULT false,
    "um_can_cancel" BOOLEAN NOT NULL DEFAULT false,
    "um_can_amend" BOOLEAN NOT NULL DEFAULT false,
    "um_can_override" BOOLEAN NOT NULL DEFAULT false,
    "um_can_retender" BOOLEAN NOT NULL DEFAULT false,
    "um_visibility" BOOLEAN NOT NULL DEFAULT true,
    "um_is_favourite" BOOLEAN NOT NULL DEFAULT false,
    "um_is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "um_sort_order" INTEGER NOT NULL DEFAULT 0,
    "um_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "um_sync_date" TIMESTAMPTZ,
    "um_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um_created_by" UUID NOT NULL,
    "um_modified_on" TIMESTAMPTZ,
    "um_modified_by" UUID,

    CONSTRAINT "user_menus_pkey" PRIMARY KEY ("um_id")
);

-- CreateTable
CREATE TABLE "vehicle_master" (
    "veh_id" UUID NOT NULL DEFAULT uuidv7(),
    "veh_company_id" UUID,
    "veh_branch_id" UUID,
    "veh_vehicle_no" VARCHAR(20) NOT NULL,
    "veh_type" VARCHAR(10) NOT NULL DEFAULT 'REGULAR',
    "veh_description" VARCHAR(150),
    "veh_capacity_kg" DECIMAL(12,3),
    "veh_is_own" BOOLEAN NOT NULL DEFAULT true,
    "veh_transporter_id" UUID,
    "veh_driver_id" UUID,
    "veh_is_active" BOOLEAN NOT NULL DEFAULT true,
    "veh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "veh_sync_date" TIMESTAMPTZ(6),
    "veh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veh_created_by" VARCHAR(50),
    "veh_modified_on" TIMESTAMPTZ(6),
    "veh_modified_by" VARCHAR(50),

    CONSTRAINT "pk_vehicle_master" PRIMARY KEY ("veh_id")
);

-- CreateTable
CREATE TABLE "purchase"."pur_supplier_item" (
    "psi_id" UUID NOT NULL,
    "psi_company_id" UUID,
    "psi_supplier_id" UUID NOT NULL,
    "psi_item_id" UUID NOT NULL,
    "psi_supplier_item_code" VARCHAR(60),
    "psi_supplier_barcode" VARCHAR(60),
    "psi_buy_uom_id" UUID,
    "psi_pack_qty" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "psi_moq" DECIMAL(18,6),
    "psi_lead_days" SMALLINT,
    "psi_is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "psi_scheme_buy_qty" DECIMAL(18,3),
    "psi_scheme_free_qty" DECIMAL(18,3),
    "psi_source" VARCHAR(10) NOT NULL DEFAULT 'TYPED',
    "psi_is_active" BOOLEAN NOT NULL DEFAULT true,
    "psi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psi_sync_date" TIMESTAMPTZ(6),
    "psi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psi_created_by" VARCHAR(50) NOT NULL,
    "psi_modified_on" TIMESTAMPTZ(6),
    "psi_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_supplier_item" PRIMARY KEY ("psi_id")
);

-- CreateTable
CREATE TABLE "purchase"."pur_agent" (
    "pag_id" UUID NOT NULL,
    "pag_company_id" UUID,
    "pag_branch_id" UUID,
    "pag_group_id" UUID,
    "pag_code" VARCHAR(30),
    "pag_name" VARCHAR(150) NOT NULL,
    "pag_alias" VARCHAR(150),
    "pag_mobile1" VARCHAR(20),
    "pag_mobile2" VARCHAR(20),
    "pag_addr1" VARCHAR(200),
    "pag_addr2" VARCHAR(200),
    "pag_city" VARCHAR(100),
    "pag_district" VARCHAR(100),
    "pag_state" VARCHAR(100),
    "pag_pincode" VARCHAR(10),
    "pag_pan_no" VARCHAR(10),
    "pag_gstin" VARCHAR(15),
    "pag_default_comm_pct" DECIMAL(9,4),
    "pag_remarks" VARCHAR(250),
    "pag_is_active" BOOLEAN NOT NULL DEFAULT true,
    "pag_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pag_sync_date" TIMESTAMPTZ(6),
    "pag_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pag_created_by" VARCHAR(50) NOT NULL,
    "pag_modified_on" TIMESTAMPTZ(6),
    "pag_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_agent" PRIMARY KEY ("pag_id")
);

-- CreateTable
CREATE TABLE "purchase"."pur_terms" (
    "pte_id" UUID NOT NULL DEFAULT uuidv7(),
    "pte_company_id" UUID,
    "pte_code" VARCHAR(30) NOT NULL,
    "pte_name" VARCHAR(100) NOT NULL,
    "pte_terms_text" TEXT NOT NULL,
    "pte_sort" INTEGER NOT NULL DEFAULT 0,
    "pte_is_active" BOOLEAN NOT NULL DEFAULT true,
    "pte_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pte_sync_date" TIMESTAMPTZ(6),
    "pte_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pte_created_by" VARCHAR(50) NOT NULL,
    "pte_modified_on" TIMESTAMPTZ(6),
    "pte_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_terms" PRIMARY KEY ("pte_id")
);

-- CreateTable
CREATE TABLE "purchase"."pur_order" (
    "po_id" UUID NOT NULL DEFAULT uuidv7(),
    "po_company_id" UUID NOT NULL,
    "po_branch_id" UUID NOT NULL,
    "po_tenant_id" UUID,
    "po_acc_year" CHAR(9) NOT NULL,
    "po_device_id" UUID NOT NULL,
    "po_session_id" UUID,
    "po_slno" BIGINT NOT NULL,
    "po_refno" VARCHAR(40) NOT NULL,
    "po_doc_date" DATE NOT NULL,
    "po_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "po_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "po_supplier_id" UUID NOT NULL,
    "po_expected_date" DATE,
    "po_deliver_godown_id" UUID,
    "po_agent_id" UUID,
    "po_contact" VARCHAR(150),
    "po_credit_days" SMALLINT,
    "po_terms_text" TEXT,
    "po_approval_status" VARCHAR(15) NOT NULL DEFAULT 'NOT_REQUIRED',
    "po_is_short_closed" BOOLEAN NOT NULL DEFAULT false,
    "po_short_close_reason" VARCHAR(250),
    "po_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "po_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "po_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "po_charges_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "po_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "po_remarks" VARCHAR(500),
    "po_revision_no" INTEGER NOT NULL DEFAULT 1,
    "po_print_count" INTEGER NOT NULL DEFAULT 0,
    "po_posted_voucher_id" UUID,
    "po_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "po_sync_date" TIMESTAMPTZ(6),
    "po_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "po_created_by" VARCHAR(50) NOT NULL,
    "po_modified_on" TIMESTAMPTZ(6),
    "po_modified_by" VARCHAR(50),
    "po_terms_id" UUID,

    CONSTRAINT "pk_pur_order" PRIMARY KEY ("po_id","po_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_order_item" (
    "poi_id" UUID NOT NULL DEFAULT uuidv7(),
    "poi_po_id" UUID NOT NULL,
    "poi_company_id" UUID NOT NULL,
    "poi_branch_id" UUID NOT NULL,
    "poi_acc_year" CHAR(9) NOT NULL,
    "poi_line_no" INTEGER NOT NULL,
    "poi_item_id" UUID NOT NULL,
    "poi_uom_id" UUID NOT NULL,
    "poi_base_uom_id" UUID NOT NULL,
    "poi_to_base_factor" DECIMAL(18,9) NOT NULL DEFAULT 1,
    "poi_hsn_code" VARCHAR(8),
    "poi_weight" DECIMAL(15,3),
    "poi_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_disc_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "poi_disc_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_sch_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "poi_sch_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_extra_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_chrg_before_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_chrg_after_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_tax_id" UUID,
    "poi_gst_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "poi_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_cess_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "poi_cess_per_unit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_total_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "poi_mrp" DECIMAL(15,2),
    "poi_expected_sell" DECIMAL(15,2),
    "poi_model" VARCHAR(60),
    "poi_size_id" UUID,
    "poi_colour_id" UUID,
    "poi_short_closed_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "poi_short_close_reason" VARCHAR(250),
    "poi_remarks" VARCHAR(250),
    "poi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "poi_sync_date" TIMESTAMPTZ(6),
    "poi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poi_created_by" VARCHAR(50) NOT NULL,
    "poi_modified_on" TIMESTAMPTZ(6),
    "poi_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_order_item" PRIMARY KEY ("poi_id","poi_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_grn" (
    "grn_id" UUID NOT NULL DEFAULT uuidv7(),
    "grn_company_id" UUID NOT NULL,
    "grn_branch_id" UUID NOT NULL,
    "grn_tenant_id" UUID,
    "grn_acc_year" CHAR(9) NOT NULL,
    "grn_device_id" UUID NOT NULL,
    "grn_session_id" UUID,
    "grn_slno" BIGINT NOT NULL,
    "grn_refno" VARCHAR(40) NOT NULL,
    "grn_doc_date" DATE NOT NULL,
    "grn_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grn_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "grn_supplier_id" UUID,
    "grn_godown_id" UUID NOT NULL,
    "grn_challan_no" VARCHAR(60),
    "grn_challan_date" DATE,
    "grn_supplier_inv_no" VARCHAR(60),
    "grn_received_at" TIMESTAMPTZ(6) NOT NULL,
    "grn_received_by" UUID[],
    "grn_supervisor_id" UUID,
    "grn_vehicle_no" VARCHAR(20),
    "grn_driver_name" VARCHAR(100),
    "grn_ewb_no" VARCHAR(15),
    "grn_ewb_date" DATE,
    "grn_packages_sent" INTEGER,
    "grn_packages_received" INTEGER,
    "grn_provisional_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grn_offbill_charges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grn_remarks" VARCHAR(500),
    "grn_revision_no" INTEGER NOT NULL DEFAULT 1,
    "grn_print_count" INTEGER NOT NULL DEFAULT 0,
    "grn_posted_voucher_id" UUID,
    "grn_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "grn_sync_date" TIMESTAMPTZ(6),
    "grn_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grn_created_by" VARCHAR(50) NOT NULL,
    "grn_modified_on" TIMESTAMPTZ(6),
    "grn_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_grn" PRIMARY KEY ("grn_id","grn_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_grn_item" (
    "gri_id" UUID NOT NULL DEFAULT uuidv7(),
    "gri_grn_id" UUID NOT NULL,
    "gri_company_id" UUID NOT NULL,
    "gri_branch_id" UUID NOT NULL,
    "gri_acc_year" CHAR(9) NOT NULL,
    "gri_line_no" INTEGER NOT NULL,
    "gri_item_id" UUID NOT NULL,
    "gri_uom_id" UUID NOT NULL,
    "gri_base_uom_id" UUID NOT NULL,
    "gri_to_base_factor" DECIMAL(18,9) NOT NULL DEFAULT 1,
    "gri_hsn_code" VARCHAR(8),
    "gri_weight" DECIMAL(15,3),
    "gri_src_doc_type" VARCHAR(20),
    "gri_src_doc_id" UUID,
    "gri_src_doc_year" CHAR(9),
    "gri_src_item_id" UUID,
    "gri_src_doc_line_no" INTEGER,
    "gri_src_doc_refno" VARCHAR(40),
    "gri_challan_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "gri_received_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "gri_damaged_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "gri_damage_reason_id" UUID,
    "gri_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "gri_excess_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "gri_excess_action" VARCHAR(15),
    "gri_provisional_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "gri_offbill_share" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gri_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gri_mrp" DECIMAL(15,2),
    "gri_sell_a" DECIMAL(15,2),
    "gri_sell_b" DECIMAL(15,2),
    "gri_sell_c" DECIMAL(15,2),
    "gri_sell_d" DECIMAL(15,2),
    "gri_price_update_result" VARCHAR(12),
    "gri_remarks" VARCHAR(250),
    "gri_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gri_sync_date" TIMESTAMPTZ(6),
    "gri_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gri_created_by" VARCHAR(50) NOT NULL,
    "gri_modified_on" TIMESTAMPTZ(6),
    "gri_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_grn_item" PRIMARY KEY ("gri_id","gri_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_invoice" (
    "pi_id" UUID NOT NULL DEFAULT uuidv7(),
    "pi_company_id" UUID NOT NULL,
    "pi_branch_id" UUID NOT NULL,
    "pi_tenant_id" UUID,
    "pi_acc_year" CHAR(9) NOT NULL,
    "pi_device_id" UUID NOT NULL,
    "pi_session_id" UUID,
    "pi_slno" BIGINT NOT NULL,
    "pi_refno" VARCHAR(40) NOT NULL,
    "pi_doc_date" DATE NOT NULL,
    "pi_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pi_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "pi_supplier_id" UUID NOT NULL,
    "pi_supplier_gstin" VARCHAR(15),
    "pi_supplier_gst_type" VARCHAR(20),
    "pi_supplier_inv_no" VARCHAR(60) NOT NULL,
    "pi_supplier_inv_date" DATE NOT NULL,
    "pi_goods_received_on" DATE,
    "pi_source_kind" VARCHAR(15) NOT NULL DEFAULT 'DIRECT',
    "pi_sister_company_id" UUID,
    "pi_godown_id" UUID NOT NULL,
    "pi_invoice_amount_printed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_mode" VARCHAR(10) NOT NULL DEFAULT 'CREDIT',
    "pi_credit_days" SMALLINT,
    "pi_due_date" DATE,
    "pi_msme_due_date" DATE,
    "pi_agent_id" UUID,
    "pi_pos_stcd" CHAR(2),
    "pi_is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "pi_ewb_no" VARCHAR(15),
    "pi_ewb_date" DATE,
    "pi_irn" VARCHAR(64),
    "pi_ack_no" VARCHAR(20),
    "pi_payment_hold" BOOLEAN NOT NULL DEFAULT false,
    "pi_hold_reason" VARCHAR(250),
    "pi_hold_released_by" VARCHAR(50),
    "pi_hold_released_on" TIMESTAMPTZ(6),
    "pi_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_charges_on_bill" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_tcs_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_net_payable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_offbill_charges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_short_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_itc_eligible_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_itc_pending_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_itc_ineligible_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pi_policy" JSONB,
    "pi_remarks" VARCHAR(500),
    "pi_revision_no" INTEGER NOT NULL DEFAULT 1,
    "pi_print_count" INTEGER NOT NULL DEFAULT 0,
    "pi_posted_voucher_id" UUID,
    "pi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pi_sync_date" TIMESTAMPTZ(6),
    "pi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pi_created_by" VARCHAR(50) NOT NULL,
    "pi_modified_on" TIMESTAMPTZ(6),
    "pi_modified_by" VARCHAR(50),
    "pi_vehicle_no" VARCHAR(20),
    "pi_driver_name" VARCHAR(100),

    CONSTRAINT "pk_pur_invoice" PRIMARY KEY ("pi_id","pi_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_invoice_item" (
    "pii_id" UUID NOT NULL DEFAULT uuidv7(),
    "pii_pi_id" UUID NOT NULL,
    "pii_company_id" UUID NOT NULL,
    "pii_branch_id" UUID NOT NULL,
    "pii_acc_year" CHAR(9) NOT NULL,
    "pii_line_no" INTEGER NOT NULL,
    "pii_item_id" UUID NOT NULL,
    "pii_uom_id" UUID NOT NULL,
    "pii_base_uom_id" UUID NOT NULL,
    "pii_to_base_factor" DECIMAL(18,9) NOT NULL DEFAULT 1,
    "pii_hsn_code" VARCHAR(10),
    "pii_weight" DECIMAL(15,3),
    "pii_src_doc_type" VARCHAR(20),
    "pii_src_doc_id" UUID,
    "pii_src_doc_year" CHAR(9),
    "pii_src_item_id" UUID,
    "pii_src_doc_line_no" INTEGER,
    "pii_src_doc_refno" VARCHAR(40),
    "pii_billed_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_received_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_damaged_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_short_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_absorbed_short_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_excess_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_excess_action" VARCHAR(15),
    "pii_rejected_at_grn_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_disc_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pii_disc_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_sch_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pii_sch_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_extra_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_chrg_before_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_chrg_after_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_tax_id" UUID,
    "pii_gst_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pii_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_cess_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pii_cess_per_unit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_total_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_itc_eligible_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_itc_pending_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_itc_ineligible_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pii_itc_class" VARCHAR(15),
    "pii_landed_cost_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_markup_a_pct" DECIMAL(9,4),
    "pii_markup_b_pct" DECIMAL(9,4),
    "pii_markup_c_pct" DECIMAL(9,4),
    "pii_markup_d_pct" DECIMAL(9,4),
    "pii_sell_a" DECIMAL(15,2),
    "pii_sell_b" DECIMAL(15,2),
    "pii_sell_c" DECIMAL(15,2),
    "pii_sell_d" DECIMAL(15,2),
    "pii_mrp" DECIMAL(15,2),
    "pii_old_prices" JSONB,
    "pii_price_update_result" VARCHAR(12),
    "pii_remarks" VARCHAR(250),
    "pii_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pii_sync_date" TIMESTAMPTZ(6),
    "pii_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pii_created_by" VARCHAR(50) NOT NULL,
    "pii_modified_on" TIMESTAMPTZ(6),
    "pii_modified_by" VARCHAR(50),
    "pii_min_price" DECIMAL(15,2),
    "pii_wastage_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_wastage_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pii_src_qty" DECIMAL(18,6),
    "pii_src_rate" DECIMAL(18,6),

    CONSTRAINT "pk_pur_invoice_item" PRIMARY KEY ("pii_id","pii_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_item_alloc" (
    "pia_id" UUID NOT NULL DEFAULT uuidv7(),
    "pia_company_id" UUID NOT NULL,
    "pia_branch_id" UUID NOT NULL,
    "pia_acc_year" CHAR(9) NOT NULL,
    "pia_doc_type" VARCHAR(20) NOT NULL,
    "pia_doc_id" UUID NOT NULL,
    "pia_line_id" UUID NOT NULL,
    "pia_row_no" INTEGER NOT NULL,
    "pia_bill_line_no" INTEGER,
    "pia_godown_id" UUID NOT NULL,
    "pia_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "pia_batch_no" VARCHAR(100),
    "pia_mfg_date" DATE,
    "pia_expiry_date" DATE,
    "pia_mrp" DECIMAL(15,2),
    "pia_sale_price" DECIMAL(15,2),
    "pia_size_id" UUID,
    "pia_colour_id" UUID,
    "pia_model" VARCHAR(60),
    "pia_serial_no" VARCHAR(100),
    "pia_warranty_to" DATE,
    "pia_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pia_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pia_barcode" VARCHAR(60),
    "pia_lot_id" UUID,
    "pia_svi_id" UUID,
    "pia_svi_acc_year" CHAR(9),
    "pia_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pia_sync_date" TIMESTAMPTZ(6),
    "pia_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pia_created_by" VARCHAR(50) NOT NULL,
    "pia_modified_on" TIMESTAMPTZ(6),
    "pia_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_item_alloc" PRIMARY KEY ("pia_id","pia_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_shortage" (
    "psh_id" UUID NOT NULL DEFAULT uuidv7(),
    "psh_company_id" UUID NOT NULL,
    "psh_branch_id" UUID NOT NULL,
    "psh_acc_year" CHAR(9) NOT NULL,
    "psh_supplier_id" UUID NOT NULL,
    "psh_item_id" UUID NOT NULL,
    "psh_src_doc_type" VARCHAR(20) NOT NULL,
    "psh_src_doc_id" UUID NOT NULL,
    "psh_src_doc_year" CHAR(9) NOT NULL,
    "psh_src_item_id" UUID NOT NULL,
    "psh_src_doc_refno" VARCHAR(40),
    "psh_bill_doc_id" UUID,
    "psh_bill_doc_year" CHAR(9),
    "psh_bill_item_id" UUID,
    "psh_reason" VARCHAR(15) NOT NULL,
    "psh_qty_base" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psh_value" DECIMAL(15,2),
    "psh_gst_pending" DECIMAL(15,2),
    "psh_origin_cost_rate" DECIMAL(18,6),
    "psh_remarks" VARCHAR(250),
    "psh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psh_sync_date" TIMESTAMPTZ(6),
    "psh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psh_created_by" VARCHAR(50) NOT NULL,
    "psh_modified_on" TIMESTAMPTZ(6),
    "psh_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_shortage" PRIMARY KEY ("psh_id","psh_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_shortage_close" (
    "psc_id" UUID NOT NULL DEFAULT uuidv7(),
    "psc_company_id" UUID NOT NULL,
    "psc_branch_id" UUID NOT NULL,
    "psc_acc_year" CHAR(9) NOT NULL,
    "psc_shortage_id" UUID NOT NULL,
    "psc_shortage_acc_year" CHAR(9) NOT NULL,
    "psc_kind" VARCHAR(15) NOT NULL,
    "psc_qty_base" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psc_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "psc_party_id" UUID,
    "psc_cn_no" VARCHAR(60),
    "psc_cn_date" DATE,
    "psc_reason" VARCHAR(250),
    "psc_voucher_id" UUID,
    "psc_reversal_of_id" UUID,
    "psc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psc_sync_date" TIMESTAMPTZ(6),
    "psc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psc_created_by" VARCHAR(50) NOT NULL,
    "psc_modified_on" TIMESTAMPTZ(6),
    "psc_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_shortage_close" PRIMARY KEY ("psc_id","psc_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_shortage_receipt" (
    "psr_id" UUID NOT NULL DEFAULT uuidv7(),
    "psr_company_id" UUID NOT NULL,
    "psr_branch_id" UUID NOT NULL,
    "psr_tenant_id" UUID,
    "psr_acc_year" CHAR(9) NOT NULL,
    "psr_device_id" UUID NOT NULL,
    "psr_session_id" UUID,
    "psr_slno" BIGINT NOT NULL,
    "psr_refno" VARCHAR(40) NOT NULL,
    "psr_doc_date" DATE NOT NULL,
    "psr_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psr_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "psr_supplier_id" UUID NOT NULL,
    "psr_godown_id" UUID NOT NULL,
    "psr_received_at" TIMESTAMPTZ(6) NOT NULL,
    "psr_challan_no" VARCHAR(60),
    "psr_received_by" UUID[],
    "psr_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "psr_remarks" VARCHAR(500),
    "psr_revision_no" INTEGER NOT NULL DEFAULT 1,
    "psr_print_count" INTEGER NOT NULL DEFAULT 0,
    "psr_posted_voucher_id" UUID,
    "psr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psr_sync_date" TIMESTAMPTZ(6),
    "psr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psr_created_by" VARCHAR(50) NOT NULL,
    "psr_modified_on" TIMESTAMPTZ(6),
    "psr_modified_by" VARCHAR(50),
    "psr_supervisor_id" UUID,

    CONSTRAINT "pk_pur_shortage_receipt" PRIMARY KEY ("psr_id","psr_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_shortage_receipt_item" (
    "psri_id" UUID NOT NULL DEFAULT uuidv7(),
    "psri_psr_id" UUID NOT NULL,
    "psri_company_id" UUID NOT NULL,
    "psri_branch_id" UUID NOT NULL,
    "psri_acc_year" CHAR(9) NOT NULL,
    "psri_line_no" INTEGER NOT NULL,
    "psri_shortage_id" UUID NOT NULL,
    "psri_shortage_acc_year" CHAR(9) NOT NULL,
    "psri_item_id" UUID NOT NULL,
    "psri_uom_id" UUID NOT NULL,
    "psri_base_uom_id" UUID NOT NULL,
    "psri_to_base_factor" DECIMAL(18,9) NOT NULL DEFAULT 1,
    "psri_hsn_code" VARCHAR(8),
    "psri_weight" DECIMAL(15,3),
    "psri_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psri_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "psri_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "psri_gst_released" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "psri_remarks" VARCHAR(250),
    "psri_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "psri_sync_date" TIMESTAMPTZ(6),
    "psri_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psri_created_by" VARCHAR(50) NOT NULL,
    "psri_modified_on" TIMESTAMPTZ(6),
    "psri_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_shortage_receipt_item" PRIMARY KEY ("psri_id","psri_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_return" (
    "pr_id" UUID NOT NULL DEFAULT uuidv7(),
    "pr_company_id" UUID NOT NULL,
    "pr_branch_id" UUID NOT NULL,
    "pr_tenant_id" UUID,
    "pr_acc_year" CHAR(9) NOT NULL,
    "pr_device_id" UUID NOT NULL,
    "pr_session_id" UUID,
    "pr_slno" BIGINT NOT NULL,
    "pr_refno" VARCHAR(40) NOT NULL,
    "pr_doc_date" DATE NOT NULL,
    "pr_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pr_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "pr_kind" VARCHAR(20) NOT NULL DEFAULT 'AGAINST_INVOICE',
    "pr_src_doc_id" UUID NOT NULL,
    "pr_src_acc_year" CHAR(9) NOT NULL,
    "pr_supplier_id" UUID NOT NULL,
    "pr_godown_id" UUID,
    "pr_settlement" VARCHAR(10) NOT NULL DEFAULT 'ADJUST',
    "pr_pos_stcd" CHAR(2),
    "pr_supplier_cn_no" VARCHAR(60),
    "pr_supplier_cn_date" DATE,
    "pr_ewb_no" VARCHAR(15),
    "pr_ewb_date" DATE,
    "pr_vehicle_no" VARCHAR(20),
    "pr_driver_name" VARCHAR(100),
    "pr_our_ref" VARCHAR(60),
    "pr_return_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pr_claim_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pr_itc_reversed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pr_replace_qty_base" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pr_remarks" VARCHAR(500),
    "pr_revision_no" INTEGER NOT NULL DEFAULT 1,
    "pr_print_count" INTEGER NOT NULL DEFAULT 0,
    "pr_posted_voucher_id" UUID,
    "pr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pr_sync_date" TIMESTAMPTZ(6),
    "pr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pr_created_by" VARCHAR(50) NOT NULL,
    "pr_modified_on" TIMESTAMPTZ(6),
    "pr_modified_by" VARCHAR(50),
    "pr_memo_ref" VARCHAR(60),

    CONSTRAINT "pk_pur_return" PRIMARY KEY ("pr_id","pr_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_return_item" (
    "pri_id" UUID NOT NULL DEFAULT uuidv7(),
    "pri_pr_id" UUID NOT NULL,
    "pri_company_id" UUID NOT NULL,
    "pri_branch_id" UUID NOT NULL,
    "pri_acc_year" CHAR(9) NOT NULL,
    "pri_line_no" INTEGER NOT NULL,
    "pri_item_id" UUID NOT NULL,
    "pri_uom_id" UUID NOT NULL,
    "pri_base_uom_id" UUID NOT NULL,
    "pri_to_base_factor" DECIMAL(18,9) NOT NULL DEFAULT 1,
    "pri_hsn_code" VARCHAR(8),
    "pri_weight" DECIMAL(15,3),
    "pri_src_doc_type" VARCHAR(20),
    "pri_src_doc_id" UUID,
    "pri_src_doc_year" CHAR(9),
    "pri_src_item_id" UUID,
    "pri_src_doc_line_no" INTEGER,
    "pri_src_doc_refno" VARCHAR(40),
    "pri_outcome" VARCHAR(20) NOT NULL,
    "pri_reason_id" UUID,
    "pri_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pri_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pri_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pri_disc_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pri_disc_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pri_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_sch_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pri_sch_per_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pri_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_extra_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_chrg_before_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_chrg_after_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_tax_id" UUID,
    "pri_gst_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pri_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_cess_pct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "pri_cess_per_unit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pri_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_total_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_lot_cost_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pri_itc_reversed_in_books" BOOLEAN NOT NULL DEFAULT true,
    "pri_supplier_cn_status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "pri_claim_against" VARCHAR(12),
    "pri_claim_party_id" UUID,
    "pri_remarks" VARCHAR(250),
    "pri_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pri_sync_date" TIMESTAMPTZ(6),
    "pri_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pri_created_by" VARCHAR(50) NOT NULL,
    "pri_modified_on" TIMESTAMPTZ(6),
    "pri_modified_by" VARCHAR(50),

    CONSTRAINT "pk_pur_return_item" PRIMARY KEY ("pri_id","pri_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_claim_settlement" (
    "pcs_id" UUID NOT NULL DEFAULT uuidv7(),
    "pcs_company_id" UUID NOT NULL,
    "pcs_branch_id" UUID NOT NULL,
    "pcs_acc_year" CHAR(9) NOT NULL,
    "pcs_device_id" UUID,
    "pcs_return_item_id" UUID,
    "pcs_return_item_acc_year" CHAR(9),
    "pcs_action" VARCHAR(15) NOT NULL,
    "pcs_received_as" VARCHAR(10),
    "pcs_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pcs_gst_reavailed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pcs_cn_no" VARCHAR(60),
    "pcs_cn_date" DATE,
    "pcs_reason" VARCHAR(250),
    "pcs_doc_date" DATE NOT NULL,
    "pcs_voucher_id" UUID,
    "pcs_reversal_of_id" UUID,
    "pcs_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pcs_sync_date" TIMESTAMPTZ(6),
    "pcs_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pcs_created_by" VARCHAR(50) NOT NULL,
    "pcs_modified_on" TIMESTAMPTZ(6),
    "pcs_modified_by" VARCHAR(50),
    "pcs_shortage_close_id" UUID,
    "pcs_shortage_close_acc_year" CHAR(9),

    CONSTRAINT "pk_pur_claim_settlement" PRIMARY KEY ("pcs_id","pcs_acc_year")
);

-- CreateTable
CREATE TABLE "txn_attachment" (
    "tat_id" UUID NOT NULL DEFAULT uuidv7(),
    "tat_company_id" UUID NOT NULL,
    "tat_branch_id" UUID NOT NULL,
    "tat_acc_year" CHAR(9) NOT NULL,
    "tat_src_module" VARCHAR(15) NOT NULL,
    "tat_src_doc_type" VARCHAR(30) NOT NULL,
    "tat_src_doc_id" UUID NOT NULL,
    "tat_page_no" SMALLINT NOT NULL DEFAULT 1,
    "tat_file_name" VARCHAR(200) NOT NULL,
    "tat_mime_type" VARCHAR(60) NOT NULL,
    "tat_size_bytes" INTEGER NOT NULL,
    "tat_sha256" CHAR(64) NOT NULL,
    "tat_content" BYTEA NOT NULL,
    "tat_caption" VARCHAR(200),
    "tat_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "tat_sync_date" TIMESTAMPTZ(6),
    "tat_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tat_created_by" VARCHAR(50) NOT NULL,
    "tat_modified_on" TIMESTAMPTZ(6),
    "tat_modified_by" VARCHAR(50),

    CONSTRAINT "pk_txn_attachment" PRIMARY KEY ("tat_id","tat_acc_year")
);

-- CreateTable
CREATE TABLE "purchase"."pur_rcm_notified_hsn" (
    "rnh_id" UUID NOT NULL DEFAULT uuidv7(),
    "rnh_company_id" UUID,
    "rnh_hsn_prefix" VARCHAR(8) NOT NULL,
    "rnh_description" VARCHAR(200) NOT NULL,
    "rnh_notification" VARCHAR(60),
    "rnh_effective_from" DATE NOT NULL,
    "rnh_effective_to" DATE,
    "rnh_is_active" BOOLEAN NOT NULL DEFAULT true,
    "rnh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rnh_created_by" VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',

    CONSTRAINT "pk_pur_rcm_notified_hsn" PRIMARY KEY ("rnh_id")
);

-- CreateTable
CREATE TABLE "purchase"."suppliers" (
    "sup_id" UUID NOT NULL DEFAULT uuidv7(),
    "sup_company_id" UUID,
    "sup_branch_id" UUID,
    "sup_group_id" UUID NOT NULL,
    "sup_purchase_type" VARCHAR(20) NOT NULL,
    "sup_name" VARCHAR(200) NOT NULL,
    "sup_short" VARCHAR(50),
    "sup_addr1" VARCHAR(250),
    "sup_addr2" VARCHAR(250),
    "sup_addr3" VARCHAR(250),
    "sup_city" VARCHAR(250),
    "sup_district" VARCHAR(250),
    "sup_state_name" VARCHAR(100) NOT NULL,
    "sup_country" VARCHAR(60) DEFAULT 'India',
    "sup_pincode" VARCHAR(10),
    "sup_tel" VARCHAR(20),
    "sup_phone" VARCHAR(20),
    "sup_mail_id" VARCHAR(120),
    "sup_whatsapp_no" VARCHAR(20),
    "sup_website_address" VARCHAR(200),
    "sup_cheque_pre_name" VARCHAR(200),
    "sup_notes" VARCHAR(250),
    "sup_credit_days" INTEGER NOT NULL DEFAULT 0,
    "sup_cash_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "sup_msme_category" VARCHAR(10),
    "sup_msme_activity" VARCHAR(15),
    "sup_msme_agreement" BOOLEAN NOT NULL DEFAULT false,
    "sup_msme_agreed_days" SMALLINT,
    "sup_drug_licence_expiry" DATE,
    "sup_fssai_no" VARCHAR(20),
    "sup_fssai_valid_to" DATE,
    "sup_default_godown_id" UUID,
    "sup_show_notes_on_entry" BOOLEAN NOT NULL DEFAULT false,
    "sup_is_import" BOOLEAN NOT NULL DEFAULT false,
    "sup_collection_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sup_gst_no" VARCHAR(15),
    "sup_state_code" CHAR(2) NOT NULL,
    "sup_pan_no" VARCHAR(10),
    "sup_gst_type" VARCHAR(30) NOT NULL,
    "sup_sup_cst" VARCHAR(25),
    "sup_drug_liscence_no" VARCHAR(100),
    "sup_region_name" VARCHAR(200),
    "sup_region_addr1" VARCHAR(250),
    "sup_region_addr2" VARCHAR(250),
    "sup_region_addr3" VARCHAR(250),
    "sup_region_city" VARCHAR(250),
    "sup_region_district" VARCHAR(250),
    "sup_region_state_name" VARCHAR(100),
    "sup_region_country" VARCHAR(60) DEFAULT 'India',
    "sup_billed_date" DATE,
    "sup_sort_order" INTEGER DEFAULT 0,
    "sup_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sup_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sup_sync_date" TIMESTAMPTZ(6),
    "sup_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sup_created_by" VARCHAR(100),
    "sup_modified_on" TIMESTAMPTZ(6) NOT NULL,
    "sup_modified_by" VARCHAR(100),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("sup_id")
);

-- CreateTable
CREATE TABLE "purchase"."supplier_groups" (
    "spg_id" UUID NOT NULL DEFAULT uuidv7(),
    "spg_name" TEXT NOT NULL,
    "spg_alias" TEXT,
    "spg_short" VARCHAR(50),
    "spg_desc" TEXT,
    "spg_is_active" BOOLEAN NOT NULL DEFAULT true,
    "spg_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "spg_sync_date" TIMESTAMPTZ,
    "spg_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spg_created_by" VARCHAR(100),
    "spg_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spg_modified_by" VARCHAR(100),

    CONSTRAINT "supplier_groups_pkey" PRIMARY KEY ("spg_id")
);

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
    "arm_description" TEXT,
    "arm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "arm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "arm_sync_date" TIMESTAMPTZ,
    "arm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arm_created_by" VARCHAR(100),
    "arm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arm_modified_by" VARCHAR(100),

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
    "ctm_description" TEXT,
    "ctm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ctm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ctm_sync_date" TIMESTAMPTZ,
    "ctm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ctm_created_by" VARCHAR(100),
    "ctm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ctm_modified_by" VARCHAR(100),

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
    "cus_form60_on" DATE,
    "cus_pan_verified_on" DATE,
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
    "cus_company_id" UUID,
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
    "cgr_company_id" UUID,
    "cgr_branch_id" UUID,
    "cgr_name" VARCHAR NOT NULL,
    "cgr_alias" VARCHAR,
    "cgr_short" VARCHAR(50),
    "cgr_narration" VARCHAR(250),
    "cgr_order" DECIMAL NOT NULL DEFAULT 0,
    "cgr_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "cgr_collection_days" INTEGER[],
    "cgr_debit_allowed" BOOLEAN NOT NULL DEFAULT false,
    "cgr_debit_days" INTEGER NOT NULL DEFAULT 0,
    "cgr_debit_limit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cgr_bills_limit" INTEGER NOT NULL DEFAULT 0,
    "cgr_overdue_billing" BOOLEAN NOT NULL DEFAULT false,
    "cgr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "cgr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "cgr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cgr_modified_on" TIMESTAMPTZ(6) NOT NULL,
    "cgr_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "cust_groups_pkey" PRIMARY KEY ("cgr_id")
);

-- CreateTable
CREATE TABLE "employee_departments" (
    "edpt_id" UUID NOT NULL DEFAULT uuidv7(),
    "edpt_name" VARCHAR(150) NOT NULL,
    "edpt_code" VARCHAR(50),
    "edpt_alias" TEXT,
    "edpt_remarks" VARCHAR(250),
    "edpt_is_active" BOOLEAN NOT NULL DEFAULT true,
    "edpt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "edpt_sync_date" TIMESTAMPTZ,
    "edpt_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edpt_created_by" VARCHAR(100),
    "edpt_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edpt_modified_by" VARCHAR(100),

    CONSTRAINT "employee_departments_pkey" PRIMARY KEY ("edpt_id")
);

-- CreateTable
CREATE TABLE "employee_designations" (
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
CREATE TABLE "employee_master" (
    "emp_id" UUID NOT NULL DEFAULT uuidv7(),
    "emp_company_id" UUID,
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

    CONSTRAINT "employee_master_pkey" PRIMARY KEY ("emp_id")
);

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
    "csr_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "cust_item_rates_pkey" PRIMARY KEY ("csr_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_coupon" (
    "lcp_id" UUID NOT NULL DEFAULT uuidv7(),
    "lcp_comp_id" UUID NOT NULL,
    "lcp_branch_id" UUID,
    "lcp_tenant_id" UUID,
    "lcp_acc_year" CHAR(9) NOT NULL,
    "lcp_lcb_id" UUID NOT NULL,
    "lcp_code" VARCHAR(40) NOT NULL,
    "lcp_pin" VARCHAR(10),
    "lcp_cust_id" UUID,
    "lcp_member_id" UUID,
    "lcp_party_ledger_id" UUID,
    "lcp_issued_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "lcp_valid_from" DATE,
    "lcp_valid_upto" DATE,
    "lcp_src_module" VARCHAR(20),
    "lcp_src_doc_type" VARCHAR(30),
    "lcp_src_doc_id" UUID,
    "lcp_src_acc_year" CHAR(9),
    "lcp_src_doc_refno" VARCHAR(100),
    "lcp_face_value" DECIMAL(18,2) NOT NULL,
    "lcp_issue_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lcp_used_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lcp_topup_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lcp_use_count" INTEGER NOT NULL DEFAULT 0,
    "lcp_last_used_on" DATE,
    "lcp_balance_value" DECIMAL(18,2),
    "lcp_status" VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    "lcp_redeemed_on" DATE,
    "lcp_cancelled_on" DATE,
    "lcp_cancelled_by" UUID,
    "lcp_cancel_reason" VARCHAR(250),
    "lcp_remarks" VARCHAR(250),
    "lcp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lcp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lcp_sync_date" TIMESTAMPTZ(6),
    "lcp_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lcp_created_by" VARCHAR(50),
    "lcp_modified_on" TIMESTAMPTZ(6),
    "lcp_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_coupon" PRIMARY KEY ("lcp_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_coupon_batch" (
    "lcb_id" UUID NOT NULL DEFAULT uuidv7(),
    "lcb_comp_id" UUID NOT NULL,
    "lcb_branch_id" UUID,
    "lcb_tenant_id" UUID,
    "lcb_code" VARCHAR(20) NOT NULL,
    "lcb_name" VARCHAR(150) NOT NULL,
    "lcb_source" VARCHAR(15) NOT NULL,
    "lcb_value_type" VARCHAR(10) NOT NULL DEFAULT 'AMOUNT',
    "lcb_face_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lcb_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "lcb_max_value" DECIMAL(18,2),
    "lcb_min_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lcb_allow_partial" BOOLEAN NOT NULL DEFAULT false,
    "lcb_allow_topup" BOOLEAN NOT NULL DEFAULT false,
    "lcb_max_per_bill" SMALLINT NOT NULL DEFAULT 1,
    "lcb_is_transferable" BOOLEAN NOT NULL DEFAULT true,
    "lcb_pin_required" BOOLEAN NOT NULL DEFAULT false,
    "lcb_prefix" VARCHAR(10),
    "lcb_code_length" SMALLINT NOT NULL DEFAULT 12,
    "lcb_max_issue_count" INTEGER,
    "lcb_issued_count" INTEGER NOT NULL DEFAULT 0,
    "lcb_redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "lcb_valid_from" DATE,
    "lcb_valid_upto" DATE,
    "lcb_validity_days" INTEGER,
    "lcb_branch_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "lcb_cust_group_id" UUID,
    "lcb_redeem_tender_id" UUID,
    "lcb_remarks" VARCHAR(500),
    "lcb_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lcb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lcb_sync_date" TIMESTAMPTZ(6),
    "lcb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lcb_created_by" VARCHAR(50),
    "lcb_modified_on" TIMESTAMPTZ(6),
    "lcb_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_coupon_batch" PRIMARY KEY ("lcb_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_coupon_txn" (
    "lct_id" UUID NOT NULL DEFAULT uuidv7(),
    "lct_comp_id" UUID NOT NULL,
    "lct_branch_id" UUID NOT NULL,
    "lct_tenant_id" UUID,
    "lct_acc_year" CHAR(9) NOT NULL,
    "lct_lcp_id" UUID NOT NULL,
    "lct_lcb_id" UUID NOT NULL,
    "lct_cust_id" UUID,
    "lct_member_id" UUID,
    "lct_txn_type" VARCHAR(20) NOT NULL,
    "lct_row_no" INTEGER NOT NULL DEFAULT 1,
    "lct_amount" DECIMAL(18,2) NOT NULL,
    "lct_txn_date" DATE NOT NULL,
    "lct_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lct_percent_applied" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "lct_src_module" VARCHAR(20),
    "lct_src_doc_type" VARCHAR(30),
    "lct_src_doc_id" UUID,
    "lct_src_acc_year" CHAR(9),
    "lct_src_doc_refno" VARCHAR(100),
    "lct_tender_id" UUID,
    "lct_tender_acc_year" CHAR(9),
    "lct_reversal_of_id" UUID,
    "lct_reversal_of_acc_year" CHAR(9),
    "lct_reversal_reason" VARCHAR(250),
    "lct_approved_by" UUID,
    "lct_user_id" UUID,
    "lct_session_id" UUID,
    "lct_device_id" UUID,
    "lct_remarks" VARCHAR(250),
    "lct_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lct_sync_date" TIMESTAMPTZ(6),
    "lct_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lct_created_by" VARCHAR(50),
    "lct_modified_on" TIMESTAMPTZ(6),
    "lct_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_coupon_txn" PRIMARY KEY ("lct_id","lct_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_gift_redeem" (
    "lgr_id" UUID NOT NULL DEFAULT uuidv7(),
    "lgr_comp_id" UUID NOT NULL,
    "lgr_branch_id" UUID NOT NULL,
    "lgr_tenant_id" UUID,
    "lgr_acc_year" CHAR(9) NOT NULL,
    "lgr_device_id" UUID,
    "lgr_redeem_slno" BIGINT NOT NULL,
    "lgr_redeem_refno" VARCHAR(100) NOT NULL,
    "lgr_redeem_date" DATE NOT NULL,
    "lgr_redeem_time" TIME(6),
    "lgr_member_id" UUID NOT NULL,
    "lgr_cust_id" UUID NOT NULL,
    "lgr_lsc_id" UUID,
    "lgr_user_id" UUID,
    "lgr_emp_id" UUID,
    "lgr_opening_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgr_redeem_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgr_closing_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgr_total_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lgr_total_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lgr_total_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lgr_otp_no" VARCHAR(10),
    "lgr_approved_by" UUID,
    "lgr_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "lgr_print_count" INTEGER NOT NULL DEFAULT 0,
    "lgr_posted_voucher_id" UUID,
    "lgr_voucher_acc_year" CHAR(9),
    "lgr_reversal_of_id" UUID,
    "lgr_reversal_of_acc_year" CHAR(9),
    "lgr_reversal_reason" VARCHAR(250),
    "lgr_remarks" VARCHAR(500),
    "lgr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lgr_sync_date" TIMESTAMPTZ(6),
    "lgr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lgr_created_by" VARCHAR(50),
    "lgr_modified_on" TIMESTAMPTZ(6),
    "lgr_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_gift_redeem" PRIMARY KEY ("lgr_id","lgr_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_gift_redeem_item" (
    "lgd_id" UUID NOT NULL DEFAULT uuidv7(),
    "lgd_comp_id" UUID NOT NULL,
    "lgd_branch_id" UUID NOT NULL,
    "lgd_tenant_id" UUID,
    "lgd_acc_year" CHAR(9) NOT NULL,
    "lgd_lgr_id" UUID NOT NULL,
    "lgd_lgr_acc_year" CHAR(9) NOT NULL,
    "lgd_row_no" INTEGER NOT NULL DEFAULT 1,
    "lgd_lsg_id" UUID,
    "lgd_item_id" UUID NOT NULL,
    "lgd_unit_id" UUID NOT NULL,
    "lgd_godown_id" UUID,
    "lgd_barcode" VARCHAR(30),
    "lgd_batch_id" UUID,
    "lgd_batch_no" VARCHAR(50),
    "lgd_serial_no" VARCHAR(50),
    "lgd_batch_date" DATE,
    "lgd_expiry_date" DATE,
    "lgd_qty" DECIMAL(18,3) NOT NULL,
    "lgd_stock_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lgd_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgd_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lgd_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgd_max_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgd_cost_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgd_cost_wot" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lgd_notes" VARCHAR(250),
    "lgd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lgd_sync_date" TIMESTAMPTZ(6),
    "lgd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lgd_created_by" VARCHAR(50),
    "lgd_modified_on" TIMESTAMPTZ(6),
    "lgd_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_gift_redeem_item" PRIMARY KEY ("lgd_id","lgd_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_ledger" (
    "lld_id" UUID NOT NULL DEFAULT uuidv7(),
    "lld_comp_id" UUID NOT NULL,
    "lld_branch_id" UUID NOT NULL,
    "lld_tenant_id" UUID,
    "lld_acc_year" CHAR(9) NOT NULL,
    "lld_member_id" UUID NOT NULL,
    "lld_cust_id" UUID NOT NULL,
    "lld_lsc_id" UUID,
    "lld_lss_id" UUID,
    "lld_lsi_id" UUID,
    "lld_txn_type" VARCHAR(20) NOT NULL,
    "lld_row_no" INTEGER NOT NULL DEFAULT 1,
    "lld_points" DECIMAL(18,4) NOT NULL,
    "lld_txn_date" DATE NOT NULL,
    "lld_txn_time" TIME(6),
    "lld_lot_id" UUID,
    "lld_lot_acc_year" CHAR(9),
    "lld_consumed_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lld_lot_balance" DECIMAL(18,4),
    "lld_expires_on" DATE,
    "lld_active_from" DATE,
    "lld_src_module" VARCHAR(20),
    "lld_src_doc_type" VARCHAR(30),
    "lld_src_doc_id" UUID,
    "lld_src_acc_year" CHAR(9),
    "lld_src_doc_refno" VARCHAR(100),
    "lld_src_row_no" INTEGER,
    "lld_base_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lld_base_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lld_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lld_factor" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "lld_money_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lld_tender_id" UUID,
    "lld_tender_acc_year" CHAR(9),
    "lld_reversal_of_id" UUID,
    "lld_reversal_of_acc_year" CHAR(9),
    "lld_reversal_reason" VARCHAR(250),
    "lld_approved_by" UUID,
    "lld_user_id" UUID,
    "lld_session_id" UUID,
    "lld_device_id" UUID,
    "lld_remarks" VARCHAR(250),
    "lld_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lld_sync_date" TIMESTAMPTZ(6),
    "lld_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lld_created_by" VARCHAR(50),
    "lld_modified_on" TIMESTAMPTZ(6),
    "lld_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_ledger" PRIMARY KEY ("lld_id","lld_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_member" (
    "lmb_id" UUID NOT NULL DEFAULT uuidv7(),
    "lmb_comp_id" UUID NOT NULL,
    "lmb_branch_id" UUID,
    "lmb_tenant_id" UUID,
    "lmb_acc_year" CHAR(9) NOT NULL,
    "lmb_cust_id" UUID NOT NULL,
    "lmb_party_ledger_id" UUID,
    "lmb_lsc_id" UUID,
    "lmb_card_no" VARCHAR(30),
    "lmb_mobile" VARCHAR(20),
    "lmb_enrolled_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "lmb_earned_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lmb_redeemed_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lmb_expired_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lmb_gift_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lmb_adjusted_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lmb_balance_points" DECIMAL(18,4),
    "lmb_lifetime_bill_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lmb_lifetime_bill_cnt" INTEGER NOT NULL DEFAULT 0,
    "lmb_last_earn_on" DATE,
    "lmb_last_redeem_on" DATE,
    "lmb_last_activity_on" DATE,
    "lmb_next_expiry_on" DATE,
    "lmb_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "lmb_merged_into_id" UUID,
    "lmb_block_reason" VARCHAR(250),
    "lmb_remarks" VARCHAR(250),
    "lmb_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lmb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lmb_sync_date" TIMESTAMPTZ(6),
    "lmb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lmb_created_by" VARCHAR(50),
    "lmb_modified_on" TIMESTAMPTZ(6),
    "lmb_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_member" PRIMARY KEY ("lmb_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_scheme" (
    "lsc_id" UUID NOT NULL DEFAULT uuidv7(),
    "lsc_comp_id" UUID NOT NULL,
    "lsc_branch_id" UUID,
    "lsc_tenant_id" UUID,
    "lsc_code" VARCHAR(30) NOT NULL,
    "lsc_name" VARCHAR(150) NOT NULL,
    "lsc_type" VARCHAR(20) NOT NULL DEFAULT 'BOTH',
    "lsc_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "lsc_priority" SMALLINT NOT NULL DEFAULT 1,
    "lsc_auto_apply" BOOLEAN NOT NULL DEFAULT true,
    "lsc_apply_on" VARCHAR(20) NOT NULL DEFAULT 'BILL_AMOUNT',
    "lsc_calc_on_amount_type" VARCHAR(20) NOT NULL DEFAULT 'NET_AMOUNT',
    "lsc_include_tax" BOOLEAN NOT NULL DEFAULT false,
    "lsc_bill_type" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "lsc_min_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lsc_max_earn_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsc_earn_on_discounted" BOOLEAN NOT NULL DEFAULT true,
    "lsc_earn_on_charges" BOOLEAN NOT NULL DEFAULT false,
    "lsc_earn_with_redeem" BOOLEAN NOT NULL DEFAULT false,
    "lsc_rounding_method" VARCHAR(10) NOT NULL DEFAULT 'FLOOR',
    "lsc_points_decimals" SMALLINT NOT NULL DEFAULT 2,
    "lsc_branch_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "lsc_cust_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "lsc_item_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "lsc_price_level_id" INTEGER,
    "lsc_pool_mode" VARCHAR(10) NOT NULL DEFAULT 'COMPANY',
    "lsc_allow_cross_branch_redeem" BOOLEAN NOT NULL DEFAULT true,
    "lsc_allow_point_redeem" BOOLEAN NOT NULL DEFAULT false,
    "lsc_allow_gift_redeem" BOOLEAN NOT NULL DEFAULT false,
    "lsc_redeem_tender_id" UUID,
    "lsc_redeem_value_per_point" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsc_min_redeem_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsc_max_redeem_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsc_max_redeem_perc" DECIMAL(6,3) NOT NULL DEFAULT 100,
    "lsc_redeem_min_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lsc_redeem_multiple" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsc_expiry_basis" VARCHAR(20) NOT NULL DEFAULT 'EARN_DATE',
    "lsc_points_valid_days" INTEGER NOT NULL DEFAULT 0,
    "lsc_activation_days" SMALLINT NOT NULL DEFAULT 0,
    "lsc_return_mode" VARCHAR(10) NOT NULL DEFAULT 'REVERSE',
    "lsc_start_date" DATE NOT NULL,
    "lsc_end_date" DATE NOT NULL,
    "lsc_valid_from_time" TIME(6),
    "lsc_valid_to_time" TIME(6),
    "lsc_valid_weekdays" VARCHAR(30),
    "lsc_remarks" TEXT,
    "lsc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lsc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lsc_sync_date" TIMESTAMPTZ(6),
    "lsc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lsc_created_by" VARCHAR(50),
    "lsc_modified_on" TIMESTAMPTZ(6),
    "lsc_modified_by" VARCHAR(50),
    "lsc_approved_on" TIMESTAMPTZ(6),
    "lsc_approved_by" UUID,

    CONSTRAINT "pk_loyalty_scheme" PRIMARY KEY ("lsc_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_scheme_branch" (
    "lsb_id" UUID NOT NULL DEFAULT uuidv7(),
    "lsb_lsc_id" UUID NOT NULL,
    "lsb_slno" INTEGER NOT NULL DEFAULT 1,
    "lsb_branch_id" UUID NOT NULL,
    "lsb_is_exclude" BOOLEAN NOT NULL DEFAULT false,
    "lsb_notes" TEXT,
    "lsb_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lsb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lsb_sync_date" TIMESTAMPTZ(6),
    "lsb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lsb_created_by" VARCHAR(50),
    "lsb_modified_on" TIMESTAMPTZ(6),
    "lsb_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_scheme_branch" PRIMARY KEY ("lsb_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_scheme_gift" (
    "lsg_id" UUID NOT NULL DEFAULT uuidv7(),
    "lsg_lsc_id" UUID NOT NULL,
    "lsg_slno" INTEGER NOT NULL DEFAULT 1,
    "lsg_item_id" UUID NOT NULL,
    "lsg_unit_id" UUID NOT NULL,
    "lsg_item_qty" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "lsg_redeem_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsg_repeat" BOOLEAN NOT NULL DEFAULT false,
    "lsg_max_qty_per_bill" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lsg_stock_check" BOOLEAN NOT NULL DEFAULT true,
    "lsg_valid_from" DATE,
    "lsg_valid_upto" DATE,
    "lsg_notes" TEXT,
    "lsg_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lsg_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lsg_sync_date" TIMESTAMPTZ(6),
    "lsg_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lsg_created_by" VARCHAR(50),
    "lsg_modified_on" TIMESTAMPTZ(6),
    "lsg_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_scheme_gift" PRIMARY KEY ("lsg_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_scheme_item" (
    "lsi_id" UUID NOT NULL DEFAULT uuidv7(),
    "lsi_lsc_id" UUID NOT NULL,
    "lsi_slno" INTEGER NOT NULL DEFAULT 1,
    "lsi_kind" VARCHAR(20) NOT NULL,
    "lsi_scope_id" UUID NOT NULL,
    "lsi_item_id" UUID,
    "lsi_group_id" UUID,
    "lsi_category_id" UUID,
    "lsi_brand_id" UUID,
    "lsi_section_id" UUID,
    "lsi_is_exclude" BOOLEAN NOT NULL DEFAULT false,
    "lsi_factor" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "lsi_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsi_max_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lsi_match_priority" SMALLINT NOT NULL DEFAULT 1,
    "lsi_notes" TEXT,
    "lsi_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lsi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lsi_sync_date" TIMESTAMPTZ(6),
    "lsi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lsi_created_by" VARCHAR(50),
    "lsi_modified_on" TIMESTAMPTZ(6),
    "lsi_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_scheme_item" PRIMARY KEY ("lsi_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_scheme_party" (
    "lsp_id" UUID NOT NULL DEFAULT uuidv7(),
    "lsp_lsc_id" UUID NOT NULL,
    "lsp_slno" INTEGER NOT NULL DEFAULT 1,
    "lsp_kind" VARCHAR(20) NOT NULL,
    "lsp_scope_id" UUID NOT NULL,
    "lsp_cust_id" UUID,
    "lsp_cust_group_id" UUID,
    "lsp_is_exclude" BOOLEAN NOT NULL DEFAULT false,
    "lsp_match_priority" SMALLINT NOT NULL DEFAULT 1,
    "lsp_notes" TEXT,
    "lsp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lsp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lsp_sync_date" TIMESTAMPTZ(6),
    "lsp_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lsp_created_by" VARCHAR(50),
    "lsp_modified_on" TIMESTAMPTZ(6),
    "lsp_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_scheme_party" PRIMARY KEY ("lsp_id")
);

-- CreateTable
CREATE TABLE "sales"."loyalty_scheme_slab" (
    "lss_id" UUID NOT NULL DEFAULT uuidv7(),
    "lss_lsc_id" UUID NOT NULL,
    "lss_slno" INTEGER NOT NULL DEFAULT 1,
    "lss_item_id" UUID,
    "lss_unit_id" UUID,
    "lss_exceeds" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lss_upto" DECIMAL(18,3),
    "lss_each" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "lss_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lss_factor" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "lss_max_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lss_notes" TEXT,
    "lss_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lss_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "lss_sync_date" TIMESTAMPTZ(6),
    "lss_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lss_created_by" VARCHAR(50),
    "lss_modified_on" TIMESTAMPTZ(6),
    "lss_modified_by" VARCHAR(50),

    CONSTRAINT "pk_loyalty_scheme_slab" PRIMARY KEY ("lss_id")
);

-- CreateTable
CREATE TABLE "sales"."promotion_scheme" (
    "prm_id" UUID NOT NULL DEFAULT uuidv7(),
    "prm_comp_id" UUID NOT NULL,
    "prm_branch_id" UUID,
    "prm_tenant_id" UUID,
    "prm_code" VARCHAR(30) NOT NULL,
    "prm_name" VARCHAR(150) NOT NULL,
    "prm_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "prm_apply_on" VARCHAR(20) NOT NULL DEFAULT 'ITEM_QTY',
    "prm_benefit" VARCHAR(20) NOT NULL DEFAULT 'DISC_PERC',
    "prm_priority" SMALLINT NOT NULL DEFAULT 1,
    "prm_stack_mode" VARCHAR(10) NOT NULL DEFAULT 'EXCLUSIVE',
    "prm_auto_apply" BOOLEAN NOT NULL DEFAULT true,
    "prm_allow_with_manual_disc" BOOLEAN NOT NULL DEFAULT false,
    "prm_calc_on_amount_type" VARCHAR(20) NOT NULL DEFAULT 'NET_AMOUNT',
    "prm_include_tax" BOOLEAN NOT NULL DEFAULT false,
    "prm_bill_type" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "prm_min_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "prm_min_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "prm_branch_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "prm_cust_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "prm_item_scope" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "prm_price_level_id" INTEGER,
    "prm_max_benefit_per_bill" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "prm_max_uses_total" INTEGER NOT NULL DEFAULT 0,
    "prm_max_uses_per_cust" INTEGER NOT NULL DEFAULT 0,
    "prm_budget_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "prm_coupon_batch_id" UUID,
    "prm_start_date" DATE NOT NULL,
    "prm_end_date" DATE NOT NULL,
    "prm_valid_from_time" TIME(6),
    "prm_valid_to_time" TIME(6),
    "prm_valid_weekdays" VARCHAR(30),
    "prm_remarks" TEXT,
    "prm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "prm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "prm_sync_date" TIMESTAMPTZ(6),
    "prm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prm_created_by" VARCHAR(50),
    "prm_modified_on" TIMESTAMPTZ(6),
    "prm_modified_by" VARCHAR(50),
    "prm_approved_on" TIMESTAMPTZ(6),
    "prm_approved_by" UUID,

    CONSTRAINT "pk_promotion_scheme" PRIMARY KEY ("prm_id")
);

-- CreateTable
CREATE TABLE "sales"."promotion_scheme_branch" (
    "prb_id" UUID NOT NULL DEFAULT uuidv7(),
    "prb_prm_id" UUID NOT NULL,
    "prb_slno" INTEGER NOT NULL DEFAULT 1,
    "prb_branch_id" UUID NOT NULL,
    "prb_is_exclude" BOOLEAN NOT NULL DEFAULT false,
    "prb_notes" TEXT,
    "prb_is_active" BOOLEAN NOT NULL DEFAULT true,
    "prb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "prb_sync_date" TIMESTAMPTZ(6),
    "prb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prb_created_by" VARCHAR(50),
    "prb_modified_on" TIMESTAMPTZ(6),
    "prb_modified_by" VARCHAR(50),

    CONSTRAINT "pk_promotion_scheme_branch" PRIMARY KEY ("prb_id")
);

-- CreateTable
CREATE TABLE "sales"."promotion_scheme_item" (
    "pri_id" UUID NOT NULL DEFAULT uuidv7(),
    "pri_prm_id" UUID NOT NULL,
    "pri_slno" INTEGER NOT NULL DEFAULT 1,
    "pri_kind" VARCHAR(20) NOT NULL,
    "pri_scope_id" UUID NOT NULL,
    "pri_item_id" UUID,
    "pri_group_id" UUID,
    "pri_category_id" UUID,
    "pri_brand_id" UUID,
    "pri_section_id" UUID,
    "pri_unit_id" UUID,
    "pri_is_exclude" BOOLEAN NOT NULL DEFAULT false,
    "pri_disc_perc" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pri_disc_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pri_disc_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pri_min_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "pri_factor" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "pri_max_benefit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pri_match_priority" SMALLINT NOT NULL DEFAULT 1,
    "pri_notes" TEXT,
    "pri_is_active" BOOLEAN NOT NULL DEFAULT true,
    "pri_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pri_sync_date" TIMESTAMPTZ(6),
    "pri_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pri_created_by" VARCHAR(50),
    "pri_modified_on" TIMESTAMPTZ(6),
    "pri_modified_by" VARCHAR(50),

    CONSTRAINT "pk_promotion_scheme_item" PRIMARY KEY ("pri_id")
);

-- CreateTable
CREATE TABLE "sales"."promotion_scheme_party" (
    "prp_id" UUID NOT NULL DEFAULT uuidv7(),
    "prp_prm_id" UUID NOT NULL,
    "prp_slno" INTEGER NOT NULL DEFAULT 1,
    "prp_kind" VARCHAR(20) NOT NULL,
    "prp_scope_id" UUID NOT NULL,
    "prp_cust_id" UUID,
    "prp_cust_group_id" UUID,
    "prp_area_id" UUID,
    "prp_city_id" UUID,
    "prp_is_exclude" BOOLEAN NOT NULL DEFAULT false,
    "prp_match_priority" SMALLINT NOT NULL DEFAULT 1,
    "prp_notes" TEXT,
    "prp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "prp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "prp_sync_date" TIMESTAMPTZ(6),
    "prp_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prp_created_by" VARCHAR(50),
    "prp_modified_on" TIMESTAMPTZ(6),
    "prp_modified_by" VARCHAR(50),

    CONSTRAINT "pk_promotion_scheme_party" PRIMARY KEY ("prp_id")
);

-- CreateTable
CREATE TABLE "sales"."promotion_scheme_slab" (
    "prs_id" UUID NOT NULL DEFAULT uuidv7(),
    "prs_prm_id" UUID NOT NULL,
    "prs_slno" INTEGER NOT NULL DEFAULT 1,
    "prs_benefit" VARCHAR(20) NOT NULL,
    "prs_exceeds" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "prs_upto" DECIMAL(18,3),
    "prs_each" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "prs_is_repeat" BOOLEAN NOT NULL DEFAULT false,
    "prs_max_repeats" INTEGER NOT NULL DEFAULT 0,
    "prs_free_item_id" UUID,
    "prs_free_unit_id" UUID,
    "prs_free_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "prs_free_stock_check" BOOLEAN NOT NULL DEFAULT true,
    "prs_disc_perc" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "prs_disc_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "prs_disc_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "prs_fixed_price" DECIMAL(18,4),
    "prs_max_benefit_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "prs_notes" TEXT,
    "prs_is_active" BOOLEAN NOT NULL DEFAULT true,
    "prs_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "prs_sync_date" TIMESTAMPTZ(6),
    "prs_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prs_created_by" VARCHAR(50),
    "prs_modified_on" TIMESTAMPTZ(6),
    "prs_modified_by" VARCHAR(50),

    CONSTRAINT "pk_promotion_scheme_slab" PRIMARY KEY ("prs_id")
);

-- CreateTable
CREATE TABLE "sales"."promotion_usage" (
    "pru_id" UUID NOT NULL DEFAULT uuidv7(),
    "pru_acc_year" CHAR(9) NOT NULL,
    "pru_comp_id" UUID NOT NULL,
    "pru_branch_id" UUID,
    "pru_prm_id" UUID NOT NULL,
    "pru_cust_id" UUID,
    "pru_scheme_code" VARCHAR(30),
    "pru_scheme_name" VARCHAR(150),
    "pru_benefit" VARCHAR(20),
    "pru_src_module" VARCHAR(20) NOT NULL DEFAULT 'SALES',
    "pru_src_doc_type" VARCHAR(30) NOT NULL DEFAULT 'SALE_BILL',
    "pru_src_doc_id" UUID NOT NULL,
    "pru_src_acc_year" CHAR(9),
    "pru_src_doc_refno" VARCHAR(100),
    "pru_doc_date" DATE NOT NULL,
    "pru_base_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pru_base_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "pru_benefit_amt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pru_free_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "pru_line_count" INTEGER NOT NULL DEFAULT 0,
    "pru_coupon_id" UUID,
    "pru_is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "pru_reversal_of_id" UUID,
    "pru_reversal_of_acc_year" CHAR(9),
    "pru_reversal_reason" VARCHAR(250),
    "pru_user_id" UUID,
    "pru_device_id" UUID,
    "pru_remarks" TEXT,
    "pru_is_active" BOOLEAN NOT NULL DEFAULT true,
    "pru_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "pru_sync_date" TIMESTAMPTZ(6),
    "pru_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pru_created_by" VARCHAR(50),
    "pru_modified_on" TIMESTAMPTZ(6),
    "pru_modified_by" VARCHAR(50),

    CONSTRAINT "pk_promotion_usage" PRIMARY KEY ("pru_id","pru_acc_year")
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

-- CreateTable
CREATE TABLE "sales"."sale_agent_groups" (
    "sa_grp_id" UUID NOT NULL DEFAULT uuidv7(),
    "sa_grp_name" VARCHAR(150) NOT NULL,
    "sa_grp_code" VARCHAR(50) NOT NULL,
    "sa_grp_pos" INTEGER DEFAULT 0,
    "sa_grp_desc" VARCHAR(250),
    "sa_grp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sa_grp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sa_grp_sync_date" TIMESTAMPTZ,
    "sa_grp_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sa_grp_created_by" UUID NOT NULL,
    "sa_grp_modified_on" TIMESTAMPTZ,
    "sa_grp_modified_by" UUID,

    CONSTRAINT "sale_agent_groups_pkey" PRIMARY KEY ("sa_grp_id")
);

-- CreateTable
CREATE TABLE "sales"."sale_bill" (
    "sb_id" UUID NOT NULL DEFAULT uuidv7(),
    "sb_company_id" UUID NOT NULL,
    "sb_branch_id" UUID NOT NULL,
    "sb_tenant_id" UUID,
    "sb_acc_year" CHAR(9) NOT NULL,
    "sb_session_id" UUID,
    "sb_counter_id" UUID,
    "sb_device_type" VARCHAR(20) NOT NULL,
    "sb_device_id" TEXT NOT NULL,
    "sb_doc_type" VARCHAR(30) NOT NULL DEFAULT 'TAX_INVOICE',
    "sb_bill_type" VARCHAR(20) NOT NULL DEFAULT 'CASH',
    "sb_category_id" UUID,
    "sb_price_level" INTEGER NOT NULL,
    "sb_bill_slno" BIGINT,
    "sb_bill_refno" VARCHAR(100),
    "sb_usr_refno" VARCHAR(100),
    "sb_bill_date" DATE NOT NULL,
    "sb_bill_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sb_due_days" INTEGER,
    "sb_due_date" DATE,
    "sb_src_doc_type" VARCHAR(30),
    "sb_src_doc_id" UUID,
    "sb_src_doc_refno" VARCHAR(100),
    "sb_src_doc_date" DATE,
    "sb_src_doc_year" VARCHAR(9),
    "sb_cust_id" UUID,
    "sb_cust_name" VARCHAR(200) NOT NULL,
    "sb_cust_addr" VARCHAR(500),
    "sb_cust_place" VARCHAR(100),
    "sb_cust_pin" VARCHAR(10),
    "sb_cust_phone" VARCHAR(20),
    "sb_cust_gstin" VARCHAR(15),
    "sb_cust_gst_type" VARCHAR(20),
    "sb_cust_stcd" CHAR(2),
    "sb_pos_stcd" CHAR(2),
    "sb_state_name" VARCHAR(100),
    "sb_has_load" BOOLEAN NOT NULL DEFAULT false,
    "sb_has_unload" BOOLEAN NOT NULL DEFAULT false,
    "sb_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "sb_has_promo" BOOLEAN NOT NULL DEFAULT false,
    "sb_has_comm" BOOLEAN NOT NULL DEFAULT false,
    "sb_has_loyalty" BOOLEAN NOT NULL DEFAULT false,
    "sb_bill_mode" VARCHAR(10) NOT NULL DEFAULT 'WHOLESALE',
    "sb_usr_refdate" DATE,
    "sb_has_dc" BOOLEAN NOT NULL DEFAULT false,
    "sb_dc_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_cogs_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_delivery_status" VARCHAR(20) NOT NULL DEFAULT 'NA',
    "sb_delivered_on" TIMESTAMPTZ(6),
    "sb_cust_pan" VARCHAR(10),
    "sb_form60_ref" VARCHAR(50),
    "sb_tcs_perc" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "sb_tcs_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_loyalty_member_id" UUID,
    "sb_loyalty_earned" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_loyalty_redeemed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_revision_no" INTEGER NOT NULL DEFAULT 1,
    "sb_doc_register_id" UUID,
    "sb_lsc_id" UUID,
    "sb_loyalty_earn_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sb_loyalty_redeem_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sb_user_id" UUID NOT NULL,
    "sb_salesman_id" UUID[],
    "sb_agent_id" UUID,
    "sb_agent_comm_perc" DECIMAL(15,4),
    "sb_agent_comm_amt" DECIMAL(15,2),
    "sb_driver_id" UUID,
    "sb_loadman_id" UUID[],
    "sb_packed_id" UUID[],
    "sb_supervisor_id" UUID,
    "sb_vehicle_id" UUID,
    "sb_vehicle_no" VARCHAR(20),
    "sb_tot_items" INTEGER NOT NULL DEFAULT 0,
    "sb_tot_weight" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sb_tot_bags" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sb_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_item_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_spl_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_bill_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_addl_disc1" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_addl_disc2" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_cash_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_other_amt1" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_other_amt2" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_bill_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_total_cost" DECIMAL(15,2),
    "sb_margin_amt" DECIMAL(15,2),
    "sb_margin_amt_wot" DECIMAL(15,2),
    "sb_margin_perc" DECIMAL(15,4),
    "sb_mrp_savings" DECIMAL(15,3) DEFAULT 0,
    "sb_mrp_savings_perc" DECIMAL(15,4) DEFAULT 0,
    "sb_pay_mode" VARCHAR(20),
    "sb_credit_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_surcharge_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_tender_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_refund_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_advance_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_note_adj_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_paid_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_balance_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_pay_status" VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    "sb_returned_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sb_return_status" VARCHAR(20),
    "sb_payment_terms" VARCHAR(250),
    "sb_delivery_terms" VARCHAR(250),
    "sb_terms_conditions" TEXT,
    "sb_remarks" VARCHAR(500),
    "sb_freight_calc_type" VARCHAR(12),
    "sb_loading_calc_type" VARCHAR(12),
    "sb_disc_alter_base" BOOLEAN,
    "sb_round_off_step" DECIMAL(15,2) NOT NULL DEFAULT 1,
    "sb_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "sb_posted_voucher_id" UUID,
    "sb_draft_cheques" JSONB,
    "sb_approved_on" TIMESTAMPTZ(6),
    "sb_approved_by" UUID,
    "sb_version_no" INTEGER NOT NULL DEFAULT 1,
    "sb_print_count" INTEGER NOT NULL DEFAULT 0,
    "sb_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sb_sync_date" TIMESTAMPTZ(6),
    "sb_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sb_created_by" VARCHAR NOT NULL,
    "sb_modified_on" TIMESTAMPTZ(6),
    "sb_modified_by" VARCHAR,

    CONSTRAINT "pk_sale_bill" PRIMARY KEY ("sb_id","sb_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_bill_item" (
    "sbi_id" UUID NOT NULL DEFAULT uuidv7(),
    "sbi_bill_id" UUID NOT NULL,
    "sbi_company_id" UUID NOT NULL,
    "sbi_branch_id" UUID NOT NULL,
    "sbi_tenant_id" UUID,
    "sbi_acc_year" CHAR(9) NOT NULL,
    "sbi_line_no" INTEGER NOT NULL,
    "sbi_split_no" INTEGER NOT NULL DEFAULT 1,
    "sbi_src_doc_type" VARCHAR(30),
    "sbi_src_doc_id" UUID,
    "sbi_src_doc_year" CHAR(9),
    "sbi_src_doc_refno" VARCHAR(100),
    "sbi_src_doc_line_no" INTEGER,
    "sbi_src_item_qty" DECIMAL(15,3),
    "sbi_src_free_qty" DECIMAL(15,3),
    "sbi_item_id" UUID NOT NULL,
    "sbi_item_unit_id" UUID NOT NULL,
    "sbi_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "sbi_hsn_code" VARCHAR(8),
    "sbi_price_level" INTEGER NOT NULL,
    "sbi_ean_code" VARCHAR(100),
    "sbi_size" VARCHAR(50),
    "sbi_size_uom" VARCHAR(20),
    "sbi_godown_id" UUID NOT NULL,
    "sbi_stock_id" UUID,
    "sbi_lot_id" UUID,
    "sbi_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "sbi_src_item_id" UUID,
    "sbi_cogs_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_promo_usage_id" UUID,
    "sbi_batch_no" VARCHAR(100),
    "sbi_batch_date" DATE,
    "sbi_expiry_date" DATE,
    "sbi_serial_no" VARCHAR(100),
    "sbi_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "sbi_is_promo" BOOLEAN NOT NULL DEFAULT false,
    "sbi_is_free" BOOLEAN NOT NULL DEFAULT false,
    "sbi_free_type" VARCHAR(20),
    "sbi_is_service" BOOLEAN NOT NULL DEFAULT false,
    "sbi_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "sbi_case_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_bill_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_length_qty" DECIMAL(15,3) DEFAULT 0,
    "sbi_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_weight_qty" DECIMAL(15,3) DEFAULT 0,
    "sbi_available_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_return_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_rate_pre_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_rate_diff" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_act_price" DECIMAL(15,4),
    "sbi_max_price" DECIMAL(15,4),
    "sbi_min_price" DECIMAL(15,4),
    "sbi_cost_price" DECIMAL(15,4),
    "sbi_cost_pre_tax" DECIMAL(15,2),
    "sbi_item_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_item_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_item_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_spl_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_spl_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_spl_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_sch_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_sch_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_sch_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_bill_sch_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_bill_sch_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_bill_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_addl_disc1_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_addl_disc1_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_addl_disc2_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_addl_disc2_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_cash_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_cash_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_net_gross" DECIMAL(17,4),
    "sbi_chrg_before_tax" DECIMAL(17,4),
    "sbi_chrg_after_tax" DECIMAL(17,4),
    "sbi_tax_id" UUID,
    "sbi_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_tax_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_cgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_sgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_igst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_cess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_acess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_acess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sbi_acess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_batch_config" INTEGER NOT NULL DEFAULT 0,
    "sbi_freight_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_load_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_unload_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sbi_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sbi_sold_price" DECIMAL(15,4),
    "sbi_sold_pre_tax" DECIMAL(15,2),
    "sbi_item_profit" DECIMAL(15,2),
    "sbi_profit_pre_tax" DECIMAL(15,2),
    "sbi_mrp_savings" DECIMAL(15,3),
    "sbi_mrp_savings_perc" DECIMAL(15,4),
    "sbi_salesman_id" UUID,
    "sbi_scheme_id" UUID,
    "sbi_scheme_name" VARCHAR(150),
    "sbi_loyalty_pv" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sbi_loyalty_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sbi_remarks" VARCHAR(250),
    "sbi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sbi_sync_date" TIMESTAMPTZ(6),
    "sbi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sbi_created_by" TEXT NOT NULL,
    "sbi_modified_on" TIMESTAMPTZ(6),
    "sbi_modified_by" TEXT,

    CONSTRAINT "pk_sale_bill_item" PRIMARY KEY ("sbi_id","sbi_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_dc" (
    "sdc_id" UUID NOT NULL DEFAULT uuidv7(),
    "sdc_company_id" UUID NOT NULL,
    "sdc_branch_id" UUID NOT NULL,
    "sdc_tenant_id" UUID,
    "sdc_acc_year" CHAR(9) NOT NULL,
    "sdc_session_id" UUID,
    "sdc_counter_id" UUID NOT NULL,
    "sdc_device_type" VARCHAR(20),
    "sdc_device_id" TEXT,
    "sdc_doc_type" VARCHAR(30) NOT NULL DEFAULT 'DELIVERY_CHALLAN',
    "sdc_purpose" VARCHAR(20) NOT NULL DEFAULT 'SUPPLY',
    "sdc_dc_slno" BIGINT NOT NULL,
    "sdc_dc_refno" VARCHAR(100) NOT NULL,
    "sdc_usr_refno" VARCHAR(100),
    "sdc_usr_refdate" DATE,
    "sdc_dc_date" DATE NOT NULL,
    "sdc_dc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdc_price_level" INTEGER NOT NULL DEFAULT 1,
    "sdc_src_doc_type" VARCHAR(30),
    "sdc_src_doc_id" UUID,
    "sdc_src_doc_acc_year" CHAR(9),
    "sdc_src_doc_refno" VARCHAR(100),
    "sdc_src_doc_date" DATE,
    "sdc_cust_id" UUID NOT NULL,
    "sdc_cust_name" VARCHAR(200) NOT NULL,
    "sdc_cust_addr" VARCHAR(500),
    "sdc_cust_place" VARCHAR(100),
    "sdc_cust_pin" VARCHAR(10),
    "sdc_cust_phone" VARCHAR(20),
    "sdc_cust_gstin" VARCHAR(15),
    "sdc_cust_gst_type" VARCHAR(20),
    "sdc_cust_stcd" CHAR(2),
    "sdc_pos_stcd" CHAR(2),
    "sdc_state_name" VARCHAR(100),
    "sdc_driver_id" UUID,
    "sdc_supervisor_id" UUID,
    "sdc_loadman_id" UUID[],
    "sdc_vehicle_id" UUID,
    "sdc_vehicle_no" VARCHAR(20),
    "sdc_user_id" UUID NOT NULL,
    "sdc_salesman_id" UUID[],
    "sdc_agent_id" UUID,
    "sdc_tot_items" INTEGER NOT NULL DEFAULT 0,
    "sdc_tot_weight" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdc_tot_bags" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdc_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_other_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_dc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_total_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_billed_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_returned_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_fulfil_status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "sdc_has_load" BOOLEAN NOT NULL DEFAULT false,
    "sdc_has_unload" BOOLEAN NOT NULL DEFAULT false,
    "sdc_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "sdc_has_promo" BOOLEAN NOT NULL DEFAULT false,
    "sdc_packed_id" UUID[],
    "sdc_item_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_spl_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdc_freight_calc_type" VARCHAR(12),
    "sdc_loading_calc_type" VARCHAR(12),
    "sdc_disc_alter_base" BOOLEAN,
    "sdc_round_off_step" DECIMAL(15,2) NOT NULL DEFAULT 1,
    "sdc_payment_terms" VARCHAR(250),
    "sdc_delivery_terms" VARCHAR(250),
    "sdc_remarks" VARCHAR(500),
    "sdc_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "sdc_posted_voucher_id" UUID,
    "sdc_revision_no" INTEGER NOT NULL DEFAULT 1,
    "sdc_print_count" INTEGER NOT NULL DEFAULT 0,
    "sdc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sdc_sync_date" TIMESTAMPTZ(6),
    "sdc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdc_created_by" VARCHAR(50) NOT NULL,
    "sdc_modified_on" TIMESTAMPTZ(6),
    "sdc_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_dc" PRIMARY KEY ("sdc_id","sdc_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_dc_item" (
    "sdi_id" UUID NOT NULL DEFAULT uuidv7(),
    "sdi_dc_id" UUID NOT NULL,
    "sdi_company_id" UUID NOT NULL,
    "sdi_branch_id" UUID NOT NULL,
    "sdi_tenant_id" UUID,
    "sdi_acc_year" CHAR(9) NOT NULL,
    "sdi_line_no" INTEGER NOT NULL,
    "sdi_split_no" INTEGER NOT NULL DEFAULT 1,
    "sdi_src_doc_type" VARCHAR(30),
    "sdi_src_doc_id" UUID,
    "sdi_src_doc_acc_year" CHAR(9),
    "sdi_src_doc_refno" VARCHAR(100),
    "sdi_src_line_no" INTEGER,
    "sdi_src_item_id" UUID,
    "sdi_item_id" UUID NOT NULL,
    "sdi_item_unit_id" UUID NOT NULL,
    "sdi_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "sdi_hsn_code" VARCHAR(8),
    "sdi_tax_id" UUID,
    "sdi_price_level" INTEGER,
    "sdi_ean_code" VARCHAR(100),
    "sdi_size" VARCHAR(50),
    "sdi_size_uom" VARCHAR(20),
    "sdi_godown_id" UUID NOT NULL,
    "sdi_lot_id" UUID,
    "sdi_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "sdi_batch_no" VARCHAR(100),
    "sdi_batch_date" DATE,
    "sdi_expiry_date" DATE,
    "sdi_serial_no" VARCHAR(100),
    "sdi_is_free" BOOLEAN NOT NULL DEFAULT false,
    "sdi_free_type" VARCHAR(20),
    "sdi_is_service" BOOLEAN NOT NULL DEFAULT false,
    "sdi_case_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdi_dc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdi_free_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdi_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdi_weight_qty" DECIMAL(15,3) DEFAULT 0,
    "sdi_billed_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdi_returned_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdi_open_qty" DECIMAL(15,3),
    "sdi_line_status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "sdi_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_rate_pre_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_max_price" DECIMAL(15,4),
    "sdi_cost_price" DECIMAL(15,4),
    "sdi_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "sdi_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_tax_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_cgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_sgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_igst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_cess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_is_promo" BOOLEAN NOT NULL DEFAULT false,
    "sdi_act_price" DECIMAL(15,4),
    "sdi_min_price" DECIMAL(15,4),
    "sdi_item_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_item_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_spl_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_spl_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_sch_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_sch_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdi_chrg_before_tax" DECIMAL(17,4),
    "sdi_chrg_after_tax" DECIMAL(17,4),
    "sdi_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdi_salesman_id" UUID,
    "sdi_scheme_id" UUID,
    "sdi_scheme_name" VARCHAR(150),
    "sdi_remarks" VARCHAR(250),
    "sdi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sdi_sync_date" TIMESTAMPTZ(6),
    "sdi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdi_created_by" VARCHAR(50) NOT NULL,
    "sdi_modified_on" TIMESTAMPTZ(6),
    "sdi_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_dc_item" PRIMARY KEY ("sdi_id","sdi_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_dc_return" (
    "sdr_id" UUID NOT NULL DEFAULT uuidv7(),
    "sdr_company_id" UUID NOT NULL,
    "sdr_branch_id" UUID NOT NULL,
    "sdr_tenant_id" UUID,
    "sdr_acc_year" CHAR(9) NOT NULL,
    "sdr_session_id" UUID,
    "sdr_counter_id" UUID NOT NULL,
    "sdr_device_type" VARCHAR(20),
    "sdr_device_id" TEXT,
    "sdr_doc_type" VARCHAR(30) NOT NULL DEFAULT 'DC_RETURN',
    "sdr_return_slno" BIGINT NOT NULL,
    "sdr_return_refno" VARCHAR(100) NOT NULL,
    "sdr_usr_refno" VARCHAR(100),
    "sdr_usr_refdate" DATE,
    "sdr_return_date" DATE NOT NULL,
    "sdr_return_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdr_dc_id" UUID NOT NULL,
    "sdr_dc_acc_year" CHAR(9) NOT NULL,
    "sdr_dc_refno" VARCHAR(100),
    "sdr_dc_date" DATE,
    "sdr_reason_id" UUID,
    "sdr_return_reason" VARCHAR(250),
    "sdr_cust_id" UUID NOT NULL,
    "sdr_cust_name" VARCHAR(200) NOT NULL,
    "sdr_cust_gstin" VARCHAR(15),
    "sdr_cust_stcd" CHAR(2),
    "sdr_pos_stcd" CHAR(2),
    "sdr_driver_id" UUID,
    "sdr_supervisor_id" UUID,
    "sdr_loadman_id" UUID[],
    "sdr_vehicle_id" UUID,
    "sdr_vehicle_no" VARCHAR(20),
    "sdr_user_id" UUID NOT NULL,
    "sdr_salesman_id" UUID[],
    "sdr_tot_items" INTEGER NOT NULL DEFAULT 0,
    "sdr_tot_weight" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdr_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdr_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdr_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdr_return_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdr_total_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdr_remarks" VARCHAR(500),
    "sdr_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "sdr_posted_voucher_id" UUID,
    "sdr_print_count" INTEGER NOT NULL DEFAULT 0,
    "sdr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sdr_sync_date" TIMESTAMPTZ(6),
    "sdr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdr_created_by" VARCHAR(50) NOT NULL,
    "sdr_modified_on" TIMESTAMPTZ(6),
    "sdr_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_dc_return" PRIMARY KEY ("sdr_id","sdr_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_dc_return_item" (
    "sdri_id" UUID NOT NULL DEFAULT uuidv7(),
    "sdri_return_id" UUID NOT NULL,
    "sdri_company_id" UUID NOT NULL,
    "sdri_branch_id" UUID NOT NULL,
    "sdri_tenant_id" UUID,
    "sdri_acc_year" CHAR(9) NOT NULL,
    "sdri_line_no" INTEGER NOT NULL,
    "sdri_dc_item_id" UUID NOT NULL,
    "sdri_dc_acc_year" CHAR(9) NOT NULL,
    "sdri_dc_line_no" INTEGER,
    "sdri_item_id" UUID NOT NULL,
    "sdri_item_unit_id" UUID NOT NULL,
    "sdri_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "sdri_hsn_code" VARCHAR(8),
    "sdri_godown_id" UUID NOT NULL,
    "sdri_lot_id" UUID,
    "sdri_condition" VARCHAR(20) NOT NULL DEFAULT 'RESTOCK',
    "sdri_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "sdri_batch_no" VARCHAR(100),
    "sdri_expiry_date" DATE,
    "sdri_serial_no" VARCHAR(100),
    "sdri_return_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdri_free_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdri_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sdri_weight_qty" DECIMAL(15,3) DEFAULT 0,
    "sdri_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_cost_price" DECIMAL(15,4),
    "sdri_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_tax_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_price_level" INTEGER NOT NULL,
    "sdri_ean_code" VARCHAR(100),
    "sdri_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "sdri_is_service" BOOLEAN NOT NULL DEFAULT false,
    "sdri_rate_pre_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_max_price" DECIMAL(15,4),
    "sdri_item_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_item_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_sch_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_cgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_sgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_igst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_cess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sdri_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sdri_size" VARCHAR(50),
    "sdri_size_uom" VARCHAR(20),
    "sdri_tax_id" UUID,
    "sdri_remarks" VARCHAR(250),
    "sdri_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sdri_sync_date" TIMESTAMPTZ(6),
    "sdri_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdri_created_by" VARCHAR(50) NOT NULL,
    "sdri_modified_on" TIMESTAMPTZ(6),
    "sdri_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_dc_return_item" PRIMARY KEY ("sdri_id","sdri_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_freight_charges" (
    "fr_id" UUID NOT NULL DEFAULT uuidv7(),
    "fr_branch_id" UUID,
    "fr_company_id" UUID,
    "fr_from_km" INTEGER DEFAULT 0,
    "fr_to_km" INTEGER DEFAULT 0,
    "fr_from_weight" DECIMAL DEFAULT 0.0,
    "fr_to_weight" DECIMAL DEFAULT 0.0,
    "fr_freight_chrg" DECIMAL DEFAULT 0.0,
    "fr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "fr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "fr_sync_date" TIMESTAMPTZ,
    "fr_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fr_created_by" VARCHAR(100),
    "fr_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fr_modified_by" VARCHAR(100),

    CONSTRAINT "sale_freight_charges_pkey" PRIMARY KEY ("fr_id")
);

-- CreateTable
CREATE TABLE "sales"."sale_loading_charges" (
    "ilc_id" UUID NOT NULL DEFAULT uuidv7(),
    "ilc_comp_id" UUID,
    "ilc_branch_id" UUID,
    "ilc_from_weight" DECIMAL DEFAULT 0.0,
    "ilc_to_weight" DECIMAL DEFAULT 0.0,
    "ilc_load_chrg" DECIMAL DEFAULT 0.0,
    "ilc_unload_chrg" DECIMAL DEFAULT 0.0,
    "ilc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ilc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ilc_sync_date" TIMESTAMPTZ,
    "ilc_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ilc_created_by" VARCHAR(100),
    "ilc_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ilc_modified_by" VARCHAR(100),

    CONSTRAINT "sale_loading_charges_pkey" PRIMARY KEY ("ilc_id")
);

-- CreateTable
CREATE TABLE "sales"."sale_order" (
    "so_id" UUID NOT NULL DEFAULT uuidv7(),
    "so_company_id" UUID NOT NULL,
    "so_branch_id" UUID NOT NULL,
    "so_tenant_id" UUID,
    "so_acc_year" CHAR(9) NOT NULL,
    "so_session_id" UUID,
    "so_device_id" UUID NOT NULL,
    "so_doc_type" VARCHAR(30) NOT NULL DEFAULT 'SALES_ORDER',
    "so_order_type" VARCHAR(20) NOT NULL DEFAULT 'CASH',
    "so_price_level" INTEGER NOT NULL,
    "so_order_slno" BIGINT NOT NULL,
    "so_order_refno" VARCHAR(100) NOT NULL,
    "so_usr_refno" VARCHAR(100),
    "so_order_date" DATE NOT NULL,
    "so_order_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "so_delivery_date" DATE,
    "so_delivery_slot" VARCHAR(30),
    "so_priority" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "so_valid_until" DATE,
    "so_src_doc_type" VARCHAR(30),
    "so_src_doc_id" UUID,
    "so_src_doc_acc_year" CHAR(9),
    "so_src_doc_refno" VARCHAR(100),
    "so_src_doc_date" DATE,
    "so_delivery_mode" VARCHAR(20) NOT NULL DEFAULT 'STORE_PICKUP',
    "so_cust_id" UUID NOT NULL,
    "so_cust_name" VARCHAR(200) NOT NULL,
    "so_cust_addr" VARCHAR(500),
    "so_cust_place" VARCHAR(100),
    "so_cust_pin" VARCHAR(10),
    "so_cust_phone" VARCHAR(20),
    "so_cust_email" VARCHAR(150),
    "so_cust_gstin" VARCHAR(15),
    "so_cust_gst_type" VARCHAR(20),
    "so_cust_stcd" CHAR(2),
    "so_pos_stcd" CHAR(2),
    "so_state_name" VARCHAR(100),
    "so_contact_person" VARCHAR(150),
    "so_contact_phone" VARCHAR(20),
    "so_ship_name" VARCHAR(200),
    "so_ship_addr" VARCHAR(500),
    "so_ship_place" VARCHAR(100),
    "so_ship_pin" VARCHAR(10),
    "so_ship_phone" VARCHAR(20),
    "so_ship_stcd" CHAR(2),
    "so_ship_landmark" VARCHAR(250),
    "so_ship_lat" DECIMAL(9,6),
    "so_ship_lng" DECIMAL(9,6),
    "so_has_load" BOOLEAN NOT NULL DEFAULT false,
    "so_has_unload" BOOLEAN NOT NULL DEFAULT false,
    "so_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "so_has_promo" BOOLEAN NOT NULL DEFAULT false,
    "so_has_comm" BOOLEAN NOT NULL DEFAULT false,
    "so_has_loyalty" BOOLEAN NOT NULL DEFAULT false,
    "so_user_id" UUID NOT NULL,
    "so_salesman_id" UUID[],
    "so_agent_id" UUID,
    "so_agent_comm_perc" DECIMAL(15,4),
    "so_agent_comm_amt" DECIMAL(15,2),
    "so_packed_id" UUID[],
    "so_tot_items" INTEGER NOT NULL DEFAULT 0,
    "so_delivered_items" INTEGER NOT NULL DEFAULT 0,
    "so_tot_weight" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "so_tot_bags" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "so_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_item_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_spl_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_bill_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_addl_disc1" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_addl_disc2" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_cash_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "so_cash_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_other_amt1" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_other_amt2" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_order_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_total_cost" DECIMAL(15,2),
    "so_margin_amt" DECIMAL(15,2),
    "so_margin_amt_wot" DECIMAL(15,2),
    "so_margin_perc" DECIMAL(15,4),
    "so_margin_perc_wot" DECIMAL(15,4),
    "so_mrp_savings" DECIMAL(15,3) DEFAULT 0,
    "so_mrp_savings_perc" DECIMAL(15,4) DEFAULT 0,
    "so_advance_policy" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "so_advance_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "so_advance_required" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_advance_due_date" DATE,
    "so_is_advance_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "so_advance_ledger_id" UUID,
    "so_advance_recd_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_advance_adjusted_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_advance_refund_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_advance_forfeit_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_advance_balance_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_advance_status" VARCHAR(20) DEFAULT 'NONE',
    "so_advance_recd_on" TIMESTAMPTZ(6),
    "so_pay_mode" VARCHAR(20),
    "so_surcharge_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_tender_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_refund_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_pay_status" VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    "so_billed_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_cancelled_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_pending_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "so_fulfil_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "so_last_billed_on" TIMESTAMPTZ(6),
    "so_completed_on" TIMESTAMPTZ(6),
    "so_payment_terms" VARCHAR(250),
    "so_delivery_terms" VARCHAR(250),
    "so_terms_conditions" TEXT,
    "so_remarks" VARCHAR(500),
    "so_freight_calc_type" VARCHAR(12),
    "so_loading_calc_type" VARCHAR(12),
    "so_disc_alter_base" BOOLEAN,
    "so_round_off_step" DECIMAL(15,2) NOT NULL DEFAULT 1,
    "so_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "so_version_no" INTEGER NOT NULL DEFAULT 1,
    "so_print_count" INTEGER NOT NULL DEFAULT 0,
    "so_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "so_sync_date" TIMESTAMPTZ(6),
    "so_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "so_created_by" VARCHAR(50) NOT NULL,
    "so_modified_on" TIMESTAMPTZ(6),
    "so_modified_by" VARCHAR(50),
    "so_revision_no" INTEGER NOT NULL DEFAULT 1,
    "so_usr_refdate" DATE,

    CONSTRAINT "pk_sale_order" PRIMARY KEY ("so_id","so_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_order_item" (
    "soi_id" UUID NOT NULL DEFAULT uuidv7(),
    "soi_order_id" UUID NOT NULL,
    "soi_company_id" UUID NOT NULL,
    "soi_branch_id" UUID NOT NULL,
    "soi_tenant_id" UUID,
    "soi_acc_year" CHAR(9) NOT NULL,
    "soi_line_no" INTEGER NOT NULL,
    "soi_src_doc_type" VARCHAR(30),
    "soi_src_doc_id" UUID,
    "soi_src_doc_acc_year" CHAR(9),
    "soi_src_doc_refno" VARCHAR(100),
    "soi_src_line_no" INTEGER,
    "soi_item_id" UUID NOT NULL,
    "soi_item_unit_id" UUID NOT NULL,
    "soi_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "soi_hsn_code" VARCHAR(8),
    "soi_price_level" INTEGER NOT NULL,
    "soi_ean_code" VARCHAR(100),
    "soi_size" VARCHAR(50),
    "soi_size_uom" VARCHAR(20),
    "soi_godown_id" UUID,
    "soi_is_reserved" BOOLEAN NOT NULL DEFAULT false,
    "soi_reserved_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_reserve_expires_on" DATE,
    "soi_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "soi_is_promo" BOOLEAN NOT NULL DEFAULT false,
    "soi_is_free" BOOLEAN NOT NULL DEFAULT false,
    "soi_free_type" VARCHAR(20),
    "soi_is_service" BOOLEAN NOT NULL DEFAULT false,
    "soi_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "soi_case_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_order_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_length_qty" DECIMAL(15,3) DEFAULT 0,
    "soi_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_weight_qty" DECIMAL(15,3) DEFAULT 0,
    "soi_available_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_delivered_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_cancelled_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_pending_qty" DECIMAL(15,3) NOT NULL,
    "soi_billed_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_rate_pre_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_rate_diff" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_act_price" DECIMAL(15,4),
    "soi_max_price" DECIMAL(15,4),
    "soi_min_price" DECIMAL(15,4),
    "soi_cost_price" DECIMAL(15,4),
    "soi_cost_pre_tax" DECIMAL(15,2),
    "soi_is_rate_locked" BOOLEAN NOT NULL DEFAULT true,
    "soi_item_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_item_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_item_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_spl_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_spl_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_spl_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_sch_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_sch_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_sch_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_bill_sch_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_bill_sch_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_bill_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_addl_disc1_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_addl_disc1_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_addl_disc2_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_addl_disc2_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_cash_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_cash_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_net_gross" DECIMAL(17,4),
    "soi_chrg_before_tax" DECIMAL(17,4),
    "soi_chrg_after_tax" DECIMAL(17,4),
    "soi_tax_id" UUID,
    "soi_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_tax_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_cgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_sgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_igst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_cess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_acess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_acess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "soi_acess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_freight_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_load_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_unload_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "soi_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "soi_sold_price" DECIMAL(15,4),
    "soi_sold_pre_tax" DECIMAL(15,2),
    "soi_item_profit" DECIMAL(15,2),
    "soi_profit_pre_tax" DECIMAL(15,2),
    "soi_mrp_savings" DECIMAL(15,3),
    "soi_mrp_savings_perc" DECIMAL(15,4),
    "soi_delivery_date" DATE,
    "soi_line_status" VARCHAR(20) NOT NULL,
    "soi_salesman_id" UUID,
    "soi_scheme_id" UUID,
    "soi_scheme_name" VARCHAR(150),
    "soi_remarks" VARCHAR(250),
    "soi_cancel_reason" VARCHAR(250),
    "soi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "soi_sync_date" TIMESTAMPTZ(6),
    "soi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soi_created_by" VARCHAR(50) NOT NULL,
    "soi_modified_on" TIMESTAMPTZ(6),
    "soi_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_order_item" PRIMARY KEY ("soi_id","soi_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_quotation" (
    "sq_id" UUID NOT NULL DEFAULT uuidv7(),
    "sq_company_id" UUID NOT NULL,
    "sq_branch_id" UUID NOT NULL,
    "sq_tenant_id" UUID,
    "sq_acc_year" CHAR(9) NOT NULL,
    "sq_session_id" UUID,
    "sq_category_id" UUID,
    "sq_price_level" INTEGER NOT NULL,
    "sq_doc_type" VARCHAR(30) NOT NULL DEFAULT 'QUOTATION',
    "sq_quote_slno" BIGINT NOT NULL,
    "sq_quote_refno" VARCHAR(100) NOT NULL,
    "sq_usr_refno" VARCHAR(100),
    "sq_quote_date" DATE NOT NULL,
    "sq_quote_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sq_valid_until" DATE,
    "sq_validity_days" INTEGER,
    "sq_revision_no" INTEGER NOT NULL DEFAULT 0,
    "sq_parent_quote_id" UUID,
    "sq_parent_acc_year" CHAR(9),
    "sq_src_doc_type" VARCHAR(30),
    "sq_src_doc_id" UUID,
    "sq_src_doc_refno" VARCHAR(100),
    "sq_src_doc_date" DATE,
    "sq_cust_id" UUID,
    "sq_cust_area_id" UUID,
    "sq_cust_name" VARCHAR(200) NOT NULL,
    "sq_cust_addr" VARCHAR(500),
    "sq_cust_place" VARCHAR(100),
    "sq_cust_phone" VARCHAR(20),
    "sq_cust_email" VARCHAR(150),
    "sq_cust_gstin" VARCHAR(15),
    "sq_cust_gst_type" VARCHAR(20),
    "sq_cust_stcd" CHAR(2),
    "sq_pos_stcd" CHAR(2),
    "sq_state_name" VARCHAR(100),
    "sq_contact_person" VARCHAR(150),
    "sq_contact_phone" VARCHAR(20),
    "sq_has_load" BOOLEAN NOT NULL DEFAULT false,
    "sq_has_unload" BOOLEAN NOT NULL DEFAULT false,
    "sq_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "sq_has_promo" BOOLEAN NOT NULL DEFAULT false,
    "sq_has_comm" BOOLEAN NOT NULL DEFAULT false,
    "sq_user_id" UUID NOT NULL,
    "sq_salesman_id" UUID[],
    "sq_agent_id" UUID,
    "sq_tot_items" INTEGER NOT NULL DEFAULT 0,
    "sq_tot_weight" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sq_tot_bags" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sq_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_item_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_spl_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_bill_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_addl_disc1" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_addl_disc2" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_other_amt1" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_other_amt2" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_quote_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sq_total_cost" DECIMAL(15,2),
    "sq_margin_amt" DECIMAL(15,2),
    "sq_margin_perc" DECIMAL(15,4),
    "sq_payment_terms" VARCHAR(250),
    "sq_delivery_terms" VARCHAR(250),
    "sq_terms_conditions" TEXT,
    "sq_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "sq_sent_on" TIMESTAMPTZ(6),
    "sq_accepted_on" TIMESTAMPTZ(6),
    "sq_rejected_on" TIMESTAMPTZ(6),
    "sq_reject_reason" VARCHAR(250),
    "sq_converted_doc_type" VARCHAR(30),
    "sq_converted_doc_id" UUID,
    "sq_converted_on" TIMESTAMPTZ(6),
    "sq_approved_on" TIMESTAMPTZ(6),
    "sq_approved_by" UUID,
    "sq_cancelled_by" UUID,
    "sq_cancel_reason" VARCHAR(250),
    "sq_mrp_savings" DECIMAL(15,3) DEFAULT 0,
    "sq_mrp_savings_perc" DECIMAL(15,4) DEFAULT 0,
    "sq_print_count" INTEGER NOT NULL DEFAULT 0,
    "sq_device_type" VARCHAR(20),
    "sq_device_id" TEXT,
    "sq_remarks" VARCHAR(500),
    "sq_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sq_sync_date" TIMESTAMPTZ(6),
    "sq_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sq_created_by" TEXT NOT NULL,
    "sq_modified_on" TIMESTAMPTZ(6),
    "sq_modified_by" TEXT,
    "sq_freight_calc_type" VARCHAR(12),
    "sq_loading_calc_type" VARCHAR(12),
    "sq_disc_alter_base" BOOLEAN,

    CONSTRAINT "pk_sale_quotation" PRIMARY KEY ("sq_id","sq_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_quotation_item" (
    "sqi_id" UUID NOT NULL DEFAULT uuidv7(),
    "sqi_quote_id" UUID NOT NULL,
    "sqi_company_id" UUID NOT NULL,
    "sqi_branch_id" UUID NOT NULL,
    "sqi_tenant_id" UUID,
    "sqi_acc_year" CHAR(9) NOT NULL,
    "sqi_src_doc_type" VARCHAR(30),
    "sqi_src_item_id" UUID,
    "sqi_src_unit_id" UUID,
    "sqi_src_doc_refno" VARCHAR(100),
    "sqi_src_item_qty" DECIMAL(15,3),
    "sqi_line_no" INTEGER NOT NULL,
    "sqi_item_id" UUID NOT NULL,
    "sqi_item_unit_id" UUID NOT NULL,
    "sqi_hsn_code" VARCHAR(8),
    "sqi_price_level" INTEGER NOT NULL,
    "sqi_ean_code" VARCHAR(100),
    "sqi_batch_no" VARCHAR(100),
    "sqi_batch_date" DATE,
    "sqi_expiry_date" DATE,
    "sqi_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "sqi_is_promo" BOOLEAN NOT NULL DEFAULT false,
    "sqi_is_free" BOOLEAN NOT NULL DEFAULT false,
    "sqi_free_type" VARCHAR(20),
    "sqi_is_service" BOOLEAN NOT NULL DEFAULT false,
    "sqi_case_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_bill_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_length_qty" DECIMAL(15,3) DEFAULT 0,
    "sqi_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_weight_qty" DECIMAL(15,3) DEFAULT 0,
    "sqi_available_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_rate_pre_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_item_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_item_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_item_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_spl_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_spl_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_spl_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_sch_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_sch_disc_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_sch_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_bill_sch_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_bill_sch_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_bill_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_addl_disc1_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_addl_disc1_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_addl_disc2_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_addl_disc2_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_cash_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_cash_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_tax_id" UUID,
    "sqi_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_tax_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_cgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_sgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_igst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_cess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_acess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_acess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_acess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_freight_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_load_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_unload_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sqi_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sqi_cost_price" DECIMAL(15,4),
    "sqi_max_price" DECIMAL(15,4),
    "sqi_min_price" DECIMAL(15,4),
    "sqi_act_price" DECIMAL(15,4),
    "sqi_quote_price" DECIMAL(15,4),
    "sqi_item_profit" DECIMAL(15,2),
    "sqi_cost_pre_tax" DECIMAL(15,2),
    "sqi_quote_pre_tax" DECIMAL(15,2),
    "sqi_profit_pre_tax" DECIMAL(15,2),
    "sqi_mrp_savings" DECIMAL(15,3),
    "sqi_mrp_savings_perc" DECIMAL(15,4),
    "sqi_scheme_id" UUID,
    "sqi_scheme_name" VARCHAR(150),
    "sqi_remarks" VARCHAR(250),
    "sqi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sqi_sync_date" TIMESTAMPTZ(6),
    "sqi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sqi_created_by" TEXT NOT NULL,
    "sqi_modified_on" TIMESTAMPTZ(6),
    "sqi_modified_by" TEXT,
    "sqi_net_gross" DECIMAL(17,4),
    "sqi_chrg_before_tax" DECIMAL(17,4),
    "sqi_chrg_after_tax" DECIMAL(17,4),
    "sqi_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "sqi_rate_diff" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sqi_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "sqi_size" VARCHAR(50),
    "sqi_size_uom" VARCHAR(20),

    CONSTRAINT "pk_sale_quotation_item" PRIMARY KEY ("sqi_id","sqi_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_return" (
    "sr_id" UUID NOT NULL DEFAULT uuidv7(),
    "sr_company_id" UUID NOT NULL,
    "sr_branch_id" UUID NOT NULL,
    "sr_tenant_id" UUID,
    "sr_acc_year" CHAR(9) NOT NULL,
    "sr_session_id" UUID,
    "sr_counter_id" UUID NOT NULL,
    "sr_device_type" VARCHAR(20),
    "sr_device_id" TEXT,
    "sr_doc_type" VARCHAR(30) NOT NULL DEFAULT 'CREDIT_NOTE',
    "sr_bill_mode" VARCHAR(10) NOT NULL DEFAULT 'WHOLESALE',
    "sr_return_slno" BIGINT NOT NULL,
    "sr_return_refno" VARCHAR(100) NOT NULL,
    "sr_usr_refno" VARCHAR(100),
    "sr_usr_refdate" DATE,
    "sr_return_date" DATE NOT NULL,
    "sr_return_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sr_is_against_bill" BOOLEAN NOT NULL DEFAULT true,
    "sr_bill_id" UUID,
    "sr_bill_acc_year" CHAR(9),
    "sr_bill_refno" VARCHAR(100),
    "sr_bill_date" DATE,
    "sr_reason_id" UUID,
    "sr_return_reason" VARCHAR(250),
    "sr_cust_id" UUID NOT NULL,
    "sr_cust_name" VARCHAR(200) NOT NULL,
    "sr_cust_addr" VARCHAR(500),
    "sr_cust_place" VARCHAR(100),
    "sr_cust_pin" VARCHAR(10),
    "sr_cust_phone" VARCHAR(20),
    "sr_cust_gstin" VARCHAR(15),
    "sr_cust_gst_type" VARCHAR(20),
    "sr_cust_stcd" CHAR(2),
    "sr_pos_stcd" CHAR(2),
    "sr_state_name" VARCHAR(100),
    "sr_price_level" INTEGER,
    "sr_user_id" UUID NOT NULL,
    "sr_salesman_id" UUID[],
    "sr_tot_items" INTEGER NOT NULL DEFAULT 0,
    "sr_tot_weight" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sr_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_other_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_return_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_total_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_settle_mode" VARCHAR(10) NOT NULL DEFAULT 'ADJUST',
    "sr_refund_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_adjusted_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_credit_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_settle_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "sr_loyalty_reverse_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sr_promo_clawback_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_has_load" BOOLEAN NOT NULL DEFAULT false,
    "sr_has_unload" BOOLEAN NOT NULL DEFAULT false,
    "sr_has_freight" BOOLEAN NOT NULL DEFAULT false,
    "sr_has_promo" BOOLEAN NOT NULL DEFAULT false,
    "sr_has_loyalty" BOOLEAN NOT NULL DEFAULT false,
    "sr_agent_id" UUID,
    "sr_agent_comm_amt" DECIMAL(15,2),
    "sr_driver_id" UUID,
    "sr_supervisor_id" UUID,
    "sr_loadman_id" UUID[],
    "sr_vehicle_id" UUID,
    "sr_vehicle_no" VARCHAR(20),
    "sr_tot_bags" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sr_item_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_spl_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_bill_sch_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_cash_disc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_freight_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_load_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_unload_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sr_disc_alter_base" BOOLEAN,
    "sr_round_off_step" DECIMAL(15,2) NOT NULL DEFAULT 1,
    "sr_remarks" VARCHAR(500),
    "sr_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "sr_posted_voucher_id" UUID,
    "sr_revision_no" INTEGER NOT NULL DEFAULT 1,
    "sr_print_count" INTEGER NOT NULL DEFAULT 0,
    "sr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sr_sync_date" TIMESTAMPTZ(6),
    "sr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sr_created_by" VARCHAR(50) NOT NULL,
    "sr_modified_on" TIMESTAMPTZ(6),
    "sr_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_return" PRIMARY KEY ("sr_id","sr_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."sale_return_item" (
    "sri_id" UUID NOT NULL DEFAULT uuidv7(),
    "sri_return_id" UUID NOT NULL,
    "sri_company_id" UUID NOT NULL,
    "sri_branch_id" UUID NOT NULL,
    "sri_tenant_id" UUID,
    "sri_acc_year" CHAR(9) NOT NULL,
    "sri_line_no" INTEGER NOT NULL,
    "sri_split_no" INTEGER NOT NULL DEFAULT 1,
    "sri_bill_item_id" UUID,
    "sri_bill_acc_year" CHAR(9),
    "sri_bill_line_no" INTEGER,
    "sri_item_id" UUID NOT NULL,
    "sri_item_unit_id" UUID NOT NULL,
    "sri_to_base_factor" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "sri_hsn_code" VARCHAR(8),
    "sri_tax_id" UUID,
    "sri_godown_id" UUID NOT NULL,
    "sri_lot_id" UUID,
    "sri_batch_no" VARCHAR(100),
    "sri_batch_date" DATE,
    "sri_expiry_date" DATE,
    "sri_serial_no" VARCHAR(100),
    "sri_condition" VARCHAR(20) NOT NULL DEFAULT 'RESTOCK',
    "sri_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "sri_case_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sri_return_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sri_free_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sri_net_qty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "sri_weight_qty" DECIMAL(15,3) DEFAULT 0,
    "sri_rate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_rate_pre_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_max_price" DECIMAL(15,4),
    "sri_cost_price" DECIMAL(15,4),
    "sri_gross_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_taxable_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_tax_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_cgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_cgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_sgst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_sgst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_igst_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_igst_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_cess_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_cess_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_tax_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_net_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_price_level" INTEGER NOT NULL,
    "sri_ean_code" VARCHAR(100),
    "sri_is_tax_incl" BOOLEAN NOT NULL DEFAULT false,
    "sri_is_promo" BOOLEAN NOT NULL DEFAULT false,
    "sri_is_free" BOOLEAN NOT NULL DEFAULT false,
    "sri_free_type" VARCHAR(20),
    "sri_is_service" BOOLEAN NOT NULL DEFAULT false,
    "sri_act_price" DECIMAL(15,4),
    "sri_min_price" DECIMAL(15,4),
    "sri_item_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_item_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_spl_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_spl_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_sch_disc_perc" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_sch_disc_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_bill_sch_amt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sri_chrg_before_tax" DECIMAL(17,4),
    "sri_chrg_after_tax" DECIMAL(17,4),
    "sri_cess_per_unit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "sri_salesman_id" UUID,
    "sri_scheme_id" UUID,
    "sri_scheme_name" VARCHAR(150),
    "sri_loyalty_points" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sri_size" VARCHAR(50),
    "sri_size_uom" VARCHAR(20),
    "sri_remarks" VARCHAR(250),
    "sri_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sri_sync_date" TIMESTAMPTZ(6),
    "sri_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sri_created_by" VARCHAR(50) NOT NULL,
    "sri_modified_on" TIMESTAMPTZ(6),
    "sri_modified_by" VARCHAR(50),

    CONSTRAINT "pk_sale_return_item" PRIMARY KEY ("sri_id","sri_acc_year")
);

-- CreateTable
CREATE TABLE "sales"."state_master" (
    "stm_id" UUID NOT NULL,
    "stm_name" TEXT NOT NULL,
    "stm_alias" TEXT,
    "stm_short" VARCHAR(20),
    "stm_order" DECIMAL NOT NULL DEFAULT 0.0,
    "stm_description" TEXT,
    "stm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "stm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stm_sync_date" TIMESTAMPTZ,
    "stm_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stm_created_by" VARCHAR(100),
    "stm_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stm_modified_by" VARCHAR(100),

    CONSTRAINT "state_master_pkey" PRIMARY KEY ("stm_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_ageing_slab" (
    "sag_id" UUID NOT NULL DEFAULT uuidv7(),
    "sag_company_id" UUID,
    "sag_slab_no" INTEGER NOT NULL,
    "sag_label" VARCHAR(50) NOT NULL,
    "sag_from_days" INTEGER NOT NULL,
    "sag_to_days" INTEGER,
    "sag_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sag_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sag_sync_date" TIMESTAMPTZ(6),
    "sag_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sag_created_by" TEXT,
    "sag_modified_on" TIMESTAMPTZ(6),
    "sag_modified_by" TEXT,

    CONSTRAINT "pk_stock_ageing_slab" PRIMARY KEY ("sag_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_balance" (
    "sbl_id" UUID NOT NULL DEFAULT uuidv7(),
    "sbl_company_id" UUID NOT NULL,
    "sbl_branch_id" UUID NOT NULL,
    "sbl_tenant_id" UUID,
    "sbl_godown_id" UUID NOT NULL,
    "sbl_item_id" UUID NOT NULL,
    "sbl_lot_id" UUID NOT NULL,
    "sbl_base_uom_id" UUID NOT NULL,
    "sbl_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "sbl_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_out_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_free_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_free_out_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_on_hand_qty" DECIMAL(18,6),
    "sbl_reserved_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_transit_in_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_available_qty" DECIMAL(18,6),
    "sbl_avg_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_avg_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sbl_stock_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sbl_stock_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sbl_first_in_date" DATE,
    "sbl_last_in_date" DATE,
    "sbl_last_out_date" DATE,
    "sbl_batch_no" VARCHAR(100),
    "sbl_mrp" DECIMAL(18,6),
    "sbl_sale_price" DECIMAL(18,6),
    "sbl_expiry_date" DATE,
    "sbl_supplier_id" UUID,
    "sbl_row_version" BIGINT NOT NULL DEFAULT 1,
    "sbl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sbl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sbl_sync_date" TIMESTAMPTZ(6),
    "sbl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sbl_created_by" TEXT,
    "sbl_modified_on" TIMESTAMPTZ(6),
    "sbl_modified_by" TEXT,

    CONSTRAINT "pk_stock_balance" PRIMARY KEY ("sbl_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_batch_detail" (
    "sbd_id" UUID NOT NULL,
    "sbd_company_id" UUID NOT NULL,
    "sbd_batch_no" VARCHAR(100) NOT NULL,
    "sbd_item_id" UUID NOT NULL,
    "sbd_size_id" UUID,
    "sbd_colour_id" UUID,
    "sbd_model" VARCHAR(100),
    "sbd_src_doc_type" VARCHAR(30),
    "sbd_src_doc_id" UUID,
    "sbd_src_line_id" UUID,
    "sbd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sbd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sbd_sync_date" TIMESTAMPTZ(6),
    "sbd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sbd_created_by" TEXT,
    "sbd_modified_on" TIMESTAMPTZ(6),
    "sbd_modified_by" TEXT,

    CONSTRAINT "pk_stock_batch_detail" PRIMARY KEY ("sbd_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_cost_revaluation" (
    "scr_id" UUID NOT NULL DEFAULT uuidv7(),
    "scr_acc_year" CHAR(9) NOT NULL,
    "scr_company_id" UUID NOT NULL,
    "scr_branch_id" UUID NOT NULL,
    "scr_item_id" UUID NOT NULL,
    "scr_lot_id" UUID NOT NULL,
    "scr_value" DECIMAL(18,2) NOT NULL,
    "scr_value_wot" DECIMAL(18,2) NOT NULL,
    "scr_basis_base_qty" DECIMAL(18,6) NOT NULL,
    "scr_doc_date" DATE NOT NULL,
    "scr_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scr_src_module" VARCHAR(20) NOT NULL,
    "scr_src_doc_type" VARCHAR(30) NOT NULL,
    "scr_src_doc_id" UUID NOT NULL,
    "scr_src_acc_year" CHAR(9) NOT NULL,
    "scr_src_line_id" UUID NOT NULL,
    "scr_src_refno" VARCHAR(100),
    "scr_is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "scr_reverses_id" UUID,
    "scr_narration" TEXT,
    "scr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "scr_sync_date" TIMESTAMPTZ(6),
    "scr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scr_created_by" TEXT,

    CONSTRAINT "pk_stock_cost_revaluation" PRIMARY KEY ("scr_id","scr_acc_year")
);

-- CreateTable
CREATE TABLE "stock"."stock_demand_daily" (
    "sdd_id" UUID NOT NULL DEFAULT uuidv7(),
    "sdd_company_id" UUID NOT NULL,
    "sdd_branch_id" UUID NOT NULL,
    "sdd_tenant_id" UUID,
    "sdd_item_id" UUID NOT NULL,
    "sdd_base_uom_id" UUID NOT NULL,
    "sdd_demand_date" DATE NOT NULL,
    "sdd_day_of_week" SMALLINT NOT NULL DEFAULT 0,
    "sdd_sold_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sdd_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sdd_return_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sdd_net_qty" DECIMAL(18,6),
    "sdd_promo_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sdd_bill_count" INTEGER NOT NULL DEFAULT 0,
    "sdd_line_count" INTEGER NOT NULL DEFAULT 0,
    "sdd_customer_count" INTEGER NOT NULL DEFAULT 0,
    "sdd_revenue_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdd_cogs_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdd_margin_wot" DECIMAL(18,2),
    "sdd_stockout_flag" BOOLEAN NOT NULL DEFAULT false,
    "sdd_stockout_hours" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "sdd_closed_flag" BOOLEAN NOT NULL DEFAULT false,
    "sdd_open_qty_start" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sdd_close_qty_end" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sdd_rebuilt_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sdd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sdd_sync_date" TIMESTAMPTZ(6),
    "sdd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_stock_demand_daily" PRIMARY KEY ("sdd_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_forecast" (
    "sfc_id" UUID NOT NULL DEFAULT uuidv7(),
    "sfc_company_id" UUID NOT NULL,
    "sfc_branch_id" UUID NOT NULL,
    "sfc_tenant_id" UUID,
    "sfc_item_id" UUID NOT NULL,
    "sfc_base_uom_id" UUID NOT NULL,
    "sfc_forecast_date" DATE NOT NULL,
    "sfc_horizon_days" INTEGER NOT NULL DEFAULT 30,
    "sfc_method" VARCHAR(30) NOT NULL DEFAULT 'MOVING_AVG',
    "sfc_forecast_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_forecast_lower" DECIMAL(18,6),
    "sfc_forecast_upper" DECIMAL(18,6),
    "sfc_confidence_perc" DECIMAL(9,3),
    "sfc_daily_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_history_days" INTEGER NOT NULL DEFAULT 0,
    "sfc_stockout_days" INTEGER NOT NULL DEFAULT 0,
    "sfc_trend_slope" DECIMAL(18,6),
    "sfc_seasonality_index" DECIMAL(9,4),
    "sfc_model_params" JSONB,
    "sfc_mape" DECIMAL(9,3),
    "sfc_rmse" DECIMAL(18,6),
    "sfc_bias" DECIMAL(18,6),
    "sfc_backtest_days" INTEGER,
    "sfc_on_hand_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_pipeline_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_safety_stock" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_reorder_point" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_suggested_order_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sfc_days_of_cover" DECIMAL(9,2),
    "sfc_expected_stockout_on" DATE,
    "sfc_preferred_supplier_id" UUID,
    "sfc_accepted_qty" DECIMAL(18,6),
    "sfc_accepted_by" UUID,
    "sfc_accepted_on" TIMESTAMPTZ(6),
    "sfc_computed_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sfc_computed_by" VARCHAR(50),
    "sfc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sfc_sync_date" TIMESTAMPTZ(6),
    "sfc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_stock_forecast" PRIMARY KEY ("sfc_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_item_cost" (
    "sic_id" UUID NOT NULL DEFAULT uuidv7(),
    "sic_company_id" UUID NOT NULL,
    "sic_branch_id" UUID NOT NULL,
    "sic_item_id" UUID NOT NULL,
    "sic_base_uom_id" UUID NOT NULL,
    "sic_total_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sic_total_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sic_total_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sic_avg_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sic_avg_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sic_last_purchase_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sic_last_purchase_date" DATE,
    "sic_last_sale_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sic_last_sale_date" DATE,
    "sic_max_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sic_row_version" BIGINT NOT NULL DEFAULT 1,
    "sic_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sic_sync_date" TIMESTAMPTZ(6),
    "sic_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sic_created_by" TEXT,
    "sic_modified_on" TIMESTAMPTZ(6),
    "sic_modified_by" TEXT,

    CONSTRAINT "pk_stock_item_cost" PRIMARY KEY ("sic_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_ledger" (
    "sml_id" UUID NOT NULL DEFAULT uuidv7(),
    "sml_company_id" UUID NOT NULL,
    "sml_branch_id" UUID NOT NULL,
    "sml_tenant_id" UUID,
    "sml_acc_year" CHAR(9) NOT NULL,
    "sml_godown_id" UUID NOT NULL,
    "sml_item_id" UUID NOT NULL,
    "sml_lot_id" UUID NOT NULL,
    "sml_uom_id" UUID NOT NULL,
    "sml_base_uom_id" UUID NOT NULL,
    "sml_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "sml_src_module" VARCHAR(20) NOT NULL,
    "sml_src_doc_type" VARCHAR(30) NOT NULL,
    "sml_src_doc_id" UUID NOT NULL,
    "sml_src_acc_year" CHAR(9),
    "sml_src_refno" VARCHAR(100),
    "sml_line_no" INTEGER NOT NULL DEFAULT 1,
    "sml_split_no" INTEGER NOT NULL DEFAULT 1,
    "sml_txn_type" VARCHAR(30) NOT NULL,
    "sml_direction" SMALLINT NOT NULL,
    "sml_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "sml_doc_date" DATE NOT NULL,
    "sml_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sml_posted_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sml_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_free_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_weight_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_signed_base_qty" DECIMAL(18,6),
    "sml_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_cost_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sml_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_cost_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sml_landed_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_landed_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sml_doc_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_doc_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sml_doc_amount_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sml_mrp" DECIMAL(18,6),
    "sml_batch_no" VARCHAR(100),
    "sml_expiry_date" DATE,
    "sml_is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "sml_reverses_id" UUID,
    "sml_reason_id" UUID,
    "sml_party_id" UUID,
    "sml_narration" TEXT,
    "sml_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sml_sync_date" TIMESTAMPTZ(6),
    "sml_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sml_created_by" TEXT,

    CONSTRAINT "pk_stock_ledger" PRIMARY KEY ("sml_id","sml_acc_year")
);

-- CreateTable
CREATE TABLE "stock"."stock_lot" (
    "slt_id" UUID NOT NULL DEFAULT uuidv7(),
    "slt_company_id" UUID NOT NULL,
    "slt_tenant_id" UUID,
    "slt_item_id" UUID NOT NULL,
    "slt_base_uom_id" UUID NOT NULL,
    "slt_batch_no" VARCHAR(100),
    "slt_mfg_batch_no" VARCHAR(100),
    "slt_mrp" DECIMAL(18,6),
    "slt_sale_price" DECIMAL(18,6),
    "slt_mfg_date" DATE,
    "slt_expiry_date" DATE,
    "slt_serial_no" VARCHAR(100),
    "slt_supplier_id" UUID,
    "slt_key_batch" VARCHAR(100),
    "slt_key_mrp" DECIMAL(18,6),
    "slt_key_sp" DECIMAL(18,6),
    "slt_key_expiry" DATE,
    "slt_key_serial" VARCHAR(100),
    "slt_key_supplier" UUID,
    "slt_track_signature" VARCHAR(8) NOT NULL DEFAULT 'N',
    "slt_first_inward_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "slt_first_inward_branch" UUID,
    "slt_inward_src_module" VARCHAR(20),
    "slt_inward_src_doc_type" VARCHAR(30),
    "slt_inward_src_doc_id" UUID,
    "slt_inward_src_acc_year" CHAR(9),
    "slt_inward_refno" VARCHAR(100),
    "slt_purchase_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "slt_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "slt_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "slt_landed_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "slt_tax_rate" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "slt_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "slt_closed_on" TIMESTAMPTZ(6),
    "slt_blocked_reason" VARCHAR(250),
    "slt_total_on_hand" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "slt_row_version" BIGINT NOT NULL DEFAULT 1,
    "slt_remarks" VARCHAR(250),
    "slt_is_active" BOOLEAN NOT NULL DEFAULT true,
    "slt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "slt_sync_date" TIMESTAMPTZ(6),
    "slt_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slt_created_by" TEXT,
    "slt_modified_on" TIMESTAMPTZ(6),
    "slt_modified_by" TEXT,

    CONSTRAINT "pk_stock_lot" PRIMARY KEY ("slt_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_movement_class" (
    "smc_id" UUID NOT NULL DEFAULT uuidv7(),
    "smc_company_id" UUID NOT NULL,
    "smc_branch_id" UUID NOT NULL,
    "smc_tenant_id" UUID,
    "smc_item_id" UUID NOT NULL,
    "smc_period_from" DATE NOT NULL,
    "smc_period_to" DATE NOT NULL,
    "smc_abc_class" CHAR(1),
    "smc_xyz_class" CHAR(1),
    "smc_fsn_class" CHAR(1),
    "smc_velocity_qty_per_day" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "smc_movement_count" INTEGER NOT NULL DEFAULT 0,
    "smc_days_since_last_sale" INTEGER,
    "smc_days_of_cover" DECIMAL(9,2),
    "smc_turn_ratio" DECIMAL(9,3),
    "smc_demand_cv" DECIMAL(9,4),
    "smc_period_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "smc_period_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "smc_avg_stock_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "smc_avg_stock_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "smc_closing_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "smc_closing_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "smc_rank_in_branch" INTEGER,
    "smc_cum_value_perc" DECIMAL(9,3),
    "smc_dead_stock_flag" BOOLEAN NOT NULL DEFAULT false,
    "smc_dead_since_date" DATE,
    "smc_dead_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "smc_computed_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "smc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "smc_sync_date" TIMESTAMPTZ(6),
    "smc_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_stock_movement_class" PRIMARY KEY ("smc_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_reason_master" (
    "srm_id" UUID NOT NULL DEFAULT uuidv7(),
    "srm_company_id" UUID,
    "srm_code" VARCHAR(30) NOT NULL,
    "srm_name" VARCHAR(150) NOT NULL,
    "srm_allowed_txn_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "srm_direction" VARCHAR(10) NOT NULL DEFAULT 'BOTH',
    "srm_require_remarks" BOOLEAN NOT NULL DEFAULT false,
    "srm_gl_ledger_id" UUID,
    "srm_sort_order" INTEGER NOT NULL DEFAULT 0,
    "srm_remarks" VARCHAR(250),
    "srm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "srm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "srm_sync_date" TIMESTAMPTZ(6),
    "srm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "srm_created_by" TEXT,
    "srm_modified_on" TIMESTAMPTZ(6),
    "srm_modified_by" TEXT,

    CONSTRAINT "pk_stock_reason_master" PRIMARY KEY ("srm_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_reorder_policy" (
    "srp_id" UUID NOT NULL DEFAULT uuidv7(),
    "srp_company_id" UUID NOT NULL,
    "srp_branch_id" UUID NOT NULL,
    "srp_godown_id" UUID,
    "srp_item_id" UUID NOT NULL,
    "srp_uom_id" UUID NOT NULL,
    "srp_min_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_max_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_reorder_level" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_reorder_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_safety_stock" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_lead_time_days" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "srp_lead_time_sd_days" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "srp_review_period_days" INTEGER NOT NULL DEFAULT 7,
    "srp_service_level_perc" DECIMAL(9,3) NOT NULL DEFAULT 95,
    "srp_moq" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_pack_multiple" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "srp_shelf_capacity_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srp_preferred_supplier_id" UUID,
    "srp_source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "srp_computed_on" TIMESTAMPTZ(6),
    "srp_auto_replenish" BOOLEAN NOT NULL DEFAULT false,
    "srp_remarks" VARCHAR(250),
    "srp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "srp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "srp_sync_date" TIMESTAMPTZ(6),
    "srp_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "srp_created_by" TEXT,
    "srp_modified_on" TIMESTAMPTZ(6),
    "srp_modified_by" TEXT,

    CONSTRAINT "pk_stock_reorder_policy" PRIMARY KEY ("srp_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_reservation" (
    "srv_id" UUID NOT NULL DEFAULT uuidv7(),
    "srv_company_id" UUID NOT NULL,
    "srv_branch_id" UUID NOT NULL,
    "srv_tenant_id" UUID,
    "srv_acc_year" CHAR(9) NOT NULL,
    "srv_godown_id" UUID NOT NULL,
    "srv_item_id" UUID NOT NULL,
    "srv_lot_id" UUID NOT NULL,
    "srv_base_uom_id" UUID NOT NULL,
    "srv_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "srv_src_module" VARCHAR(20) NOT NULL,
    "srv_src_doc_type" VARCHAR(30) NOT NULL,
    "srv_src_doc_id" UUID NOT NULL,
    "srv_src_acc_year" CHAR(9),
    "srv_src_refno" VARCHAR(100),
    "srv_line_no" INTEGER NOT NULL DEFAULT 1,
    "srv_reserved_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srv_consumed_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srv_released_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "srv_open_qty" DECIMAL(18,6),
    "srv_reserved_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "srv_expires_on" TIMESTAMPTZ(6),
    "srv_status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "srv_closed_on" TIMESTAMPTZ(6),
    "srv_close_reason" VARCHAR(250),
    "srv_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "srv_sync_date" TIMESTAMPTZ(6),
    "srv_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "srv_created_by" TEXT,
    "srv_modified_on" TIMESTAMPTZ(6),
    "srv_modified_by" TEXT,

    CONSTRAINT "pk_stock_reservation" PRIMARY KEY ("srv_id","srv_acc_year")
);

-- CreateTable
CREATE TABLE "stock"."stock_track_policy" (
    "stp_id" UUID NOT NULL DEFAULT uuidv7(),
    "stp_company_id" UUID,
    "stp_branch_id" UUID,
    "stp_scope" VARCHAR(20) NOT NULL DEFAULT 'COMPANY',
    "stp_scope_id" UUID,
    "stp_item_id" UUID,
    "stp_group_id" UUID,
    "stp_track_batch" BOOLEAN NOT NULL DEFAULT false,
    "stp_track_mrp" BOOLEAN NOT NULL DEFAULT false,
    "stp_track_sale_price" BOOLEAN NOT NULL DEFAULT false,
    "stp_track_expiry" BOOLEAN NOT NULL DEFAULT false,
    "stp_track_serial" BOOLEAN NOT NULL DEFAULT false,
    "stp_track_supplier" BOOLEAN NOT NULL DEFAULT false,
    "stp_track_signature" VARCHAR(8),
    "stp_valuation_method" VARCHAR(20) NOT NULL DEFAULT 'WAVG',
    "stp_issue_strategy" VARCHAR(20) NOT NULL DEFAULT 'FEFO',
    "stp_allow_negative" VARCHAR(10) NOT NULL DEFAULT 'ALLOW',
    "stp_shelf_life_days" INTEGER,
    "stp_near_expiry_days" INTEGER NOT NULL DEFAULT 30,
    "stp_block_expired_sale" BOOLEAN NOT NULL DEFAULT false,
    "stp_ageing_basis" VARCHAR(20) NOT NULL DEFAULT 'INWARD_DATE',
    "stp_effective_from" DATE NOT NULL DEFAULT '1900-01-01'::date,
    "stp_effective_to" DATE NOT NULL DEFAULT '9999-12-31'::date,
    "stp_remarks" VARCHAR(250),
    "stp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "stp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stp_sync_date" TIMESTAMPTZ(6),
    "stp_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stp_created_by" TEXT,
    "stp_modified_on" TIMESTAMPTZ(6),
    "stp_modified_by" TEXT,

    CONSTRAINT "pk_stock_track_policy" PRIMARY KEY ("stp_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_track_preset" (
    "spt_id" UUID NOT NULL DEFAULT uuidv7(),
    "spt_company_id" UUID,
    "spt_code" VARCHAR(30) NOT NULL,
    "spt_name" VARCHAR(150) NOT NULL,
    "spt_description" VARCHAR(250),
    "spt_track_batch" BOOLEAN NOT NULL DEFAULT false,
    "spt_track_mrp" BOOLEAN NOT NULL DEFAULT false,
    "spt_track_sale_price" BOOLEAN NOT NULL DEFAULT false,
    "spt_track_expiry" BOOLEAN NOT NULL DEFAULT false,
    "spt_track_serial" BOOLEAN NOT NULL DEFAULT false,
    "spt_track_supplier" BOOLEAN NOT NULL DEFAULT false,
    "spt_track_signature" VARCHAR(8),
    "spt_valuation_method" VARCHAR(20) NOT NULL DEFAULT 'WAVG',
    "spt_issue_strategy" VARCHAR(20) NOT NULL DEFAULT 'FEFO',
    "spt_allow_negative" VARCHAR(10) NOT NULL DEFAULT 'ALLOW',
    "spt_shelf_life_days" INTEGER,
    "spt_near_expiry_days" INTEGER NOT NULL DEFAULT 30,
    "spt_block_expired_sale" BOOLEAN NOT NULL DEFAULT false,
    "spt_ageing_basis" VARCHAR(20) NOT NULL DEFAULT 'INWARD_DATE',
    "spt_sort_order" INTEGER NOT NULL DEFAULT 0,
    "spt_remarks" VARCHAR(250),
    "spt_is_active" BOOLEAN NOT NULL DEFAULT true,
    "spt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "spt_sync_date" TIMESTAMPTZ(6),
    "spt_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spt_created_by" TEXT,
    "spt_modified_on" TIMESTAMPTZ(6),
    "spt_modified_by" TEXT,

    CONSTRAINT "pk_stock_track_preset" PRIMARY KEY ("spt_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_transit" (
    "stt_id" UUID NOT NULL DEFAULT uuidv7(),
    "stt_company_id" UUID NOT NULL,
    "stt_tenant_id" UUID,
    "stt_from_branch_id" UUID NOT NULL,
    "stt_from_godown_id" UUID NOT NULL,
    "stt_to_branch_id" UUID NOT NULL,
    "stt_to_godown_id" UUID NOT NULL,
    "stt_item_id" UUID NOT NULL,
    "stt_lot_id" UUID NOT NULL,
    "stt_base_uom_id" UUID NOT NULL,
    "stt_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "stt_out_voucher_id" UUID NOT NULL,
    "stt_out_acc_year" CHAR(9) NOT NULL,
    "stt_out_refno" VARCHAR(100),
    "stt_in_voucher_id" UUID,
    "stt_in_acc_year" CHAR(9),
    "stt_in_refno" VARCHAR(100),
    "stt_sent_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stt_received_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stt_damage_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stt_short_qty" DECIMAL(18,6),
    "stt_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stt_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "stt_transit_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "stt_sent_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stt_expected_on" DATE,
    "stt_received_on" TIMESTAMPTZ(6),
    "stt_status" VARCHAR(20) NOT NULL DEFAULT 'IN_TRANSIT',
    "stt_lr_no" VARCHAR(50),
    "stt_vehicle_no" VARCHAR(30),
    "stt_remarks" VARCHAR(250),
    "stt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stt_sync_date" TIMESTAMPTZ(6),
    "stt_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stt_created_by" TEXT,
    "stt_modified_on" TIMESTAMPTZ(6),
    "stt_modified_by" TEXT,

    CONSTRAINT "pk_stock_transit" PRIMARY KEY ("stt_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_valuation_snap" (
    "svs_id" UUID NOT NULL DEFAULT uuidv7(),
    "svs_company_id" UUID NOT NULL,
    "svs_branch_id" UUID NOT NULL,
    "svs_tenant_id" UUID,
    "svs_acc_year" CHAR(9) NOT NULL,
    "svs_godown_id" UUID NOT NULL,
    "svs_item_id" UUID NOT NULL,
    "svs_lot_id" UUID NOT NULL,
    "svs_base_uom_id" UUID NOT NULL,
    "svs_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "svs_snap_type" VARCHAR(20) NOT NULL DEFAULT 'MONTH',
    "svs_snap_date" DATE NOT NULL,
    "svs_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svs_avg_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svs_avg_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svs_value_at_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svs_value_at_cost_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svs_value_at_mrp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svs_value_at_sp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svs_batch_no" VARCHAR(100),
    "svs_mrp" DECIMAL(18,6),
    "svs_expiry_date" DATE,
    "svs_supplier_id" UUID,
    "svs_age_days" INTEGER,
    "svs_frozen_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "svs_frozen_by" UUID,
    "svs_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "svs_sync_date" TIMESTAMPTZ(6),
    "svs_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_stock_valuation_snap" PRIMARY KEY ("svs_id")
);

-- CreateTable
CREATE TABLE "stock"."stock_voucher" (
    "svh_id" UUID NOT NULL DEFAULT uuidv7(),
    "svh_company_id" UUID NOT NULL,
    "svh_branch_id" UUID NOT NULL,
    "svh_tenant_id" UUID,
    "svh_acc_year" CHAR(9) NOT NULL,
    "svh_device_id" UUID NOT NULL,
    "svh_session_id" UUID,
    "svh_voucher_type" VARCHAR(30) NOT NULL,
    "svh_slno" BIGINT NOT NULL,
    "svh_refno" VARCHAR(100) NOT NULL,
    "svh_usr_refno" VARCHAR(100),
    "svh_doc_date" DATE NOT NULL,
    "svh_doc_datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "svh_from_godown_id" UUID,
    "svh_to_godown_id" UUID,
    "svh_to_branch_id" UUID,
    "svh_supplier_id" UUID,
    "svh_party_ref" VARCHAR(100),
    "svh_reason_id" UUID,
    "svh_link_src_module" VARCHAR(20),
    "svh_link_src_doc_type" VARCHAR(30),
    "svh_link_src_doc_id" UUID,
    "svh_link_src_acc_year" CHAR(9),
    "svh_line_count" INTEGER NOT NULL DEFAULT 0,
    "svh_total_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svh_total_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svh_total_value_wot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svh_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "svh_version_no" INTEGER NOT NULL DEFAULT 1,
    "svh_freeze_stock" BOOLEAN NOT NULL DEFAULT false,
    "svh_freeze_from" TIMESTAMPTZ(6),
    "svh_freeze_to" TIMESTAMPTZ(6),
    "svh_rate_source" VARCHAR(20),
    "svh_remarks" VARCHAR(250),
    "svh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "svh_sync_date" TIMESTAMPTZ(6),
    "svh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "svh_created_by" TEXT,
    "svh_modified_on" TIMESTAMPTZ(6),
    "svh_modified_by" TEXT,
    "svh_load_enabled" BOOLEAN NOT NULL DEFAULT false,
    "svh_load_datetime" TIMESTAMPTZ(6),
    "svh_loadman_id" UUID[],
    "svh_driver_id" UUID,
    "svh_supervisor_id" UUID,
    "svh_vehicle_id" UUID,
    "svh_vehicle_no" VARCHAR(30),
    "svh_loading_charge" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "svh_unload_enabled" BOOLEAN NOT NULL DEFAULT false,
    "svh_unload_datetime" TIMESTAMPTZ(6),
    "svh_unloadman_id" UUID[],
    "svh_unload_supervisor_id" UUID,
    "svh_unloading_charge" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "pk_stock_voucher" PRIMARY KEY ("svh_id","svh_acc_year")
);

-- CreateTable
CREATE TABLE "stock"."stock_voucher_item" (
    "svi_id" UUID NOT NULL DEFAULT uuidv7(),
    "svi_voucher_id" UUID NOT NULL,
    "svi_company_id" UUID NOT NULL,
    "svi_branch_id" UUID NOT NULL,
    "svi_tenant_id" UUID,
    "svi_acc_year" CHAR(9) NOT NULL,
    "svi_line_no" INTEGER NOT NULL,
    "svi_split_no" INTEGER NOT NULL DEFAULT 1,
    "svi_item_id" UUID NOT NULL,
    "svi_uom_id" UUID NOT NULL,
    "svi_base_uom_id" UUID NOT NULL,
    "svi_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "svi_godown_id" UUID NOT NULL,
    "svi_lot_id" UUID,
    "svi_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE',
    "svi_to_bucket" VARCHAR(20),
    "svi_barcode" TEXT,
    "svi_batch_no" VARCHAR(100),
    "svi_mfg_date" DATE,
    "svi_expiry_date" DATE,
    "svi_mrp" DECIMAL(18,6),
    "svi_sale_price" DECIMAL(18,6),
    "svi_serial_no" VARCHAR(100),
    "svi_supplier_id" UUID,
    "svi_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_free_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_free_base_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_weight_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_book_qty" DECIMAL(18,6),
    "svi_counted_qty" DECIMAL(18,6),
    "svi_diff_qty" DECIMAL(18,6),
    "svi_cost_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_cost_rate_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_landed_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "svi_tax_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
    "svi_value" DECIMAL(18,2),
    "svi_value_wot" DECIMAL(18,2),
    "svi_reason_id" UUID,
    "svi_direction" SMALLINT,
    "svi_remarks" VARCHAR(250),
    "svi_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "svi_sync_date" TIMESTAMPTZ(6),
    "svi_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "svi_created_by" TEXT,
    "svi_modified_on" TIMESTAMPTZ(6),
    "svi_modified_by" TEXT,
    "svi_load_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "svi_unload_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "pk_stock_voucher_item" PRIMARY KEY ("svi_id","svi_acc_year")
);

-- CreateIndex
CREATE INDEX "idx_acc_group_company_id" ON "accounts"."acc_group_master"("acc_group_company_id");

-- CreateIndex
CREATE INDEX "idx_acc_group_parent_id" ON "accounts"."acc_group_master"("acc_group_parent_id");

-- CreateIndex
CREATE INDEX "idx_acc_group_type" ON "accounts"."acc_group_master"("acc_group_type");

-- CreateIndex
CREATE INDEX "ix_alm_ledger" ON "accounts"."acc_ledger_map"("alm_ledger_id");

-- CreateIndex
CREATE INDEX "idx_led_company_id" ON "accounts"."acc_ledger_master"("led_company_id");

-- CreateIndex
CREATE INDEX "idx_led_branch_id" ON "accounts"."acc_ledger_master"("led_branch_id");

-- CreateIndex
CREATE INDEX "idx_led_group_id" ON "accounts"."acc_ledger_master"("led_group_id");

-- CreateIndex
CREATE INDEX "idx_led_active" ON "accounts"."acc_ledger_master"("led_is_active");

-- CreateIndex
CREATE INDEX "idx_led_gstin" ON "accounts"."acc_ledger_master"("led_gstin_no");

-- CreateIndex
CREATE INDEX "idx_led_ledger_type" ON "accounts"."acc_ledger_master"("led_ledger_type");

-- CreateIndex
CREATE INDEX "ix_aor_target" ON "accounts"."acc_opening_run"("aor_company_id", "aor_to_acc_year", "aor_run_at" DESC);

-- CreateIndex
CREATE INDEX "ix_asl_import" ON "accounts"."acc_settlement_line"("asl_import_id", "asl_acc_year", "asl_match_status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_asl_row" ON "accounts"."acc_settlement_line"("asl_import_id", "asl_row_no", "asl_acc_year");

-- CreateIndex
CREATE INDEX "ix_tnd_type" ON "accounts"."acc_tender_master"("tnd_type_id");

-- CreateIndex
CREATE INDEX "ix_tnd_ledger" ON "accounts"."acc_tender_master"("tnd_ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ttm_name" ON "accounts"."acc_tender_types"("ttm_type_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gde_gdr" ON "accounts"."acc_voucher_doc_einvoice"("gde_gdr_id", "gde_acc_year");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gdw_gdr" ON "accounts"."acc_voucher_doc_ewaybill"("gdw_gdr_id", "gdw_acc_year");

-- CreateIndex
CREATE INDEX "ix_av_voucher" ON "accounts"."acc_vouchers"("av_voucher_id", "av_acc_year");

-- CreateIndex
CREATE INDEX "ix_av_role" ON "accounts"."acc_vouchers"("av_company_id", "av_role", "av_voucher_date");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_company_branch_year" ON "accounts"."acc_voucher_seq"("seq_company_id", "seq_branch_id", "seq_acc_year");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_vchr_type" ON "accounts"."acc_voucher_seq"("seq_vchr_type_id");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_device" ON "accounts"."acc_voucher_seq"("seq_device_id");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_period_key" ON "accounts"."acc_voucher_seq"("seq_period_key");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_status" ON "accounts"."acc_voucher_seq"("seq_is_active", "seq_is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "uq_acc_voucher_seq_scope" ON "accounts"."acc_voucher_seq"("seq_vchr_type_id", "seq_company_id", "seq_branch_id", "seq_acc_year", "seq_device_code", "seq_period_key");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_types_active_sort" ON "accounts"."acc_voucher_types"("vchr_is_active", "vchr_sort_order", "vchr_type_name");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_types_nature" ON "accounts"."acc_voucher_types"("vchr_nature");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_types_category" ON "accounts"."acc_voucher_types"("vchr_category");

-- CreateIndex
CREATE UNIQUE INDEX "uq_acc_voucher_types_code" ON "accounts"."acc_voucher_types"("vchr_type_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_acc_voucher_types_name" ON "accounts"."acc_voucher_types"("vchr_type_name");

-- CreateIndex
CREATE INDEX "idx_saa_company" ON "accounts"."acc_ship_addrs"("saa_company_id");

-- CreateIndex
CREATE INDEX "idx_saa_branch" ON "accounts"."acc_ship_addrs"("saa_branch_id");

-- CreateIndex
CREATE INDEX "idx_saa_ledger" ON "accounts"."acc_ship_addrs"("saa_ledger_id");

-- CreateIndex
CREATE INDEX "idx_saa_ledger_default" ON "accounts"."acc_ship_addrs"("saa_ledger_id", "saa_is_default");

-- CreateIndex
CREATE INDEX "idx_lba_ledger" ON "accounts"."acc_ledger_bank_accounts"("lba_ledger_id");

-- CreateIndex
CREATE INDEX "idx_lba_company" ON "accounts"."acc_ledger_bank_accounts"("lba_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tbd_id_date" ON "accounts"."till_business_day"("tbd_id", "tbd_acc_year", "tbd_business_date");

-- CreateIndex
CREATE INDEX "ix_tcl_count" ON "accounts"."till_count_line"("tcl_count_id", "tcl_acc_year", "tcl_row_no");

-- CreateIndex
CREATE INDEX "ix_tev_session" ON "accounts"."till_event"("tev_session_id", "tev_acc_year", "tev_event_on");

-- CreateIndex
CREATE INDEX "ix_tev_branch_code" ON "accounts"."till_event"("tev_company_id", "tev_branch_id", "tev_event_code", "tev_event_on");

-- CreateIndex
CREATE INDEX "ix_tsr_session" ON "accounts"."till_session_review"("tsr_session_id", "tsr_acc_year");

-- CreateIndex
CREATE INDEX "ix_tsr_day" ON "accounts"."till_session_review"("tsr_day_id", "tsr_acc_year");

-- CreateIndex
CREATE INDEX "ix_tvd_session" ON "accounts"."till_void"("tvd_session_id", "tvd_acc_year", "tvd_voided_on");

-- CreateIndex
CREATE INDEX "ix_tvd_branch_on" ON "accounts"."till_void"("tvd_company_id", "tvd_branch_id", "tvd_voided_on");

-- CreateIndex
CREATE INDEX "ix_tvd_cashier" ON "accounts"."till_void"("tvd_cashier_id", "tvd_acc_year", "tvd_voided_on");

-- CreateIndex
CREATE UNIQUE INDEX "ux_tvd_doc" ON "accounts"."till_void"("tvd_src_doc_type", "tvd_src_doc_id", "tvd_acc_year");

-- CreateIndex
CREATE INDEX "idx_audit_log_date" ON "audit"."audit_log"("log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_screen_date" ON "audit"."audit_log"("log_screen_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_user_date" ON "audit"."audit_log"("log_user_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_branch_date" ON "audit"."audit_log"("log_branch_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_table_date" ON "audit"."audit_log"("log_table_name", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_screen_status" ON "audit"."audit_screen"("screen_status");

-- CreateIndex
CREATE INDEX "idx_uls_active_session" ON "audit"."user_login_sessions"("uls_company_id", "uls_user_id", "uls_login_on" DESC);

-- CreateIndex
CREATE INDEX "idx_uls_device_date" ON "audit"."user_login_sessions"("uls_device_id", "uls_login_on" DESC);

-- CreateIndex
CREATE INDEX "dropdown_columns_dropdown_columns_dropdown_id_idx" ON "fixed"."dropdown_columns"("dropdown_columns_dropdown_id");

-- CreateIndex
CREATE INDEX "dropdown_columns_dropdown_columns_dropdown_id_dropdown_colu_idx" ON "fixed"."dropdown_columns"("dropdown_columns_dropdown_id", "dropdown_columns_no");

-- CreateIndex
CREATE UNIQUE INDEX "device_master_dev_device_uid_key" ON "fixed"."device_master"("dev_device_uid");

-- CreateIndex
CREATE INDEX "idx_device_uid" ON "fixed"."device_master"("dev_device_uid");

-- CreateIndex
CREATE UNIQUE INDEX "uq_error_message" ON "fixed"."error_message"("erm_code", "erm_variant", "erm_lang");

-- CreateIndex
CREATE INDEX "ix_form_field_tree" ON "fixed"."form_field"("field_section_id", "field_position");

-- CreateIndex
CREATE INDEX "idx_grid_columns_grid_id" ON "fixed"."grid_columns"("grid_id");

-- CreateIndex
CREATE INDEX "idx_grid_columns_filter" ON "fixed"."grid_columns"("grid_id", "grid_column_filter");

-- CreateIndex
CREATE INDEX "idx_grid_columns_deleted" ON "fixed"."grid_columns"("grid_id", "grid_column_is_deleted");

-- CreateIndex
CREATE INDEX "idx_grid_details_status" ON "fixed"."grid_details"("grid_status");

-- CreateIndex
CREATE INDEX "idx_grid_details_deleted" ON "fixed"."grid_details"("grid_is_deleted");

-- CreateIndex
CREATE INDEX "hsn_master_hsn_code_idx" ON "fixed"."hsn_master"("hsn_code");

-- CreateIndex
CREATE INDEX "menu_master_menu_parent_idx" ON "fixed"."menu_master"("menu_parent");

-- CreateIndex
CREATE INDEX "menu_master_menu_position_idx" ON "fixed"."menu_master"("menu_position");

-- CreateIndex
CREATE INDEX "idx_state_codes_active" ON "fixed"."state_codes"("is_active");

-- CreateIndex
CREATE INDEX "idx_state_codes_name" ON "fixed"."state_codes"("state_name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adj_reasons_sar_code_key" ON "fixed"."stock_adj_reasons"("sar_code");

-- CreateIndex
CREATE INDEX "idx_category_parent_id" ON "inventory"."item_category_master"("category_parent_id");

-- CreateIndex
CREATE INDEX "idx_category_active" ON "inventory"."item_category_master"("category_is_active");

-- CreateIndex
CREATE INDEX "idx_gdl_parent" ON "inventory"."godown_locations"("gdl_parent_id");

-- CreateIndex
CREATE INDEX "idx_gdl_sort" ON "inventory"."godown_locations"("gdl_branch_id", "gdl_parent_id", "gdl_sort");

-- CreateIndex
CREATE INDEX "idx_btm_item" ON "inventory"."item_batch_master"("btm_company_id", "btm_item_id");

-- CreateIndex
CREATE INDEX "idx_ibs_item" ON "inventory"."item_batch_stock"("ibs_acc_year", "ibs_company_id", "ibs_branch_id", "ibs_item_id");

-- CreateIndex
CREATE INDEX "idx_ibs_batch" ON "inventory"."item_batch_stock"("ibs_acc_year", "ibs_company_id", "ibs_branch_id", "ibs_godown_id", "ibs_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ibs_scope" ON "inventory"."item_batch_stock"("ibs_acc_year", "ibs_company_id", "ibs_branch_id", "ibs_godown_id", "ibs_item_id", "ibs_batch_id", "ibs_stock_bucket");

-- CreateIndex
CREATE INDEX "idx_brand_parent_id" ON "inventory"."item_brand_master"("brand_parent_id");

-- CreateIndex
CREATE INDEX "idx_brand_active" ON "inventory"."item_brand_master"("brand_is_active");

-- CreateIndex
CREATE INDEX "idx_ean_code" ON "inventory"."item_ean_codes"("ean_code");

-- CreateIndex
CREATE INDEX "idx_ean_item" ON "inventory"."item_ean_codes"("ean_item_id");

-- CreateIndex
CREATE INDEX "idx_itg_parent_id" ON "inventory"."item_group_master"("itg_parent_id");

-- CreateIndex
CREATE INDEX "idx_itg_active" ON "inventory"."item_group_master"("itg_is_active");

-- CreateIndex
CREATE UNIQUE INDEX "item_gst_units_item_gst_unit_code_key" ON "inventory"."item_gst_units"("item_gst_unit_code");

-- CreateIndex
CREATE INDEX "idx_item_group" ON "inventory"."item_master"("item_group_id");

-- CreateIndex
CREATE INDEX "idx_item_name_en" ON "inventory"."item_master"("item_name_en");

-- CreateIndex
CREATE INDEX "idx_item_barcode" ON "inventory"."item_master"("item_default_barcode");

-- CreateIndex
CREATE INDEX "ix_ipcl_scope_date" ON "inventory"."item_price_change_log"("ipcl_company_id", "ipcl_branch_id", "ipcl_changed_on" DESC);

-- CreateIndex
CREATE INDEX "ix_ipcl_item_date" ON "inventory"."item_price_change_log"("ipcl_item_id", "ipcl_changed_on" DESC);

-- CreateIndex
CREATE INDEX "ix_ipcl_user_date" ON "inventory"."item_price_change_log"("ipcl_user_id", "ipcl_changed_on" DESC);

-- CreateIndex
CREATE INDEX "ix_ipcl_date" ON "inventory"."item_price_change_log"("ipcl_changed_on" DESC);

-- CreateIndex
CREATE INDEX "ix_ipcl_set" ON "inventory"."item_price_change_log"("ipcl_change_set_id");

-- CreateIndex
CREATE INDEX "idx_item_price_master_item" ON "inventory"."item_price_master"("ipm_item_id", "ipm_uc_unit_id");

-- CreateIndex
CREATE INDEX "idx_ir_item" ON "inventory"."item_reorders"("ir_item_id");

-- CreateIndex
CREATE INDEX "idx_ir_unit" ON "inventory"."item_reorders"("ir_uc_unit_id");

-- CreateIndex
CREATE INDEX "idx_ir_godown" ON "inventory"."item_reorders"("ir_godown_id");

-- CreateIndex
CREATE INDEX "idx_sec_parent_id" ON "inventory"."item_section_master"("sec_parent_id");

-- CreateIndex
CREATE INDEX "idx_sec_active" ON "inventory"."item_section_master"("sec_is_active");

-- CreateIndex
CREATE INDEX "idx_sec_position" ON "inventory"."item_section_master"("sec_position");

-- CreateIndex
CREATE INDEX "idx_isb_item" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_item_id");

-- CreateIndex
CREATE INDEX "idx_isb_godown" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_godown_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_isb_balance_scope" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_godown_id", "isb_item_id", "isb_unit_id", "isb_stock_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stl_source_line_split" ON "inventory"."item_stock_ledger"("stl_voucher_id", "stl_line_no", "stl_split_no", "stl_godown_id", "stl_batch_id");

-- CreateIndex
CREATE INDEX "idx_ith_item_dates" ON "inventory"."item_tax_history"("ith_item_id", "ith_effective_from", "ith_effective_to");

-- CreateIndex
CREATE INDEX "idx_tax_active" ON "inventory"."item_tax_master"("tax_is_active");

-- CreateIndex
CREATE INDEX "idx_tax_rate_total" ON "inventory"."item_tax_master"("tax_gst_rate_total");

-- CreateIndex
CREATE INDEX "idx_tax_sales_ledger" ON "inventory"."item_tax_master"("tax_sales_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tax_cgst_out" ON "inventory"."item_tax_master"("tax_cgst_output_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tax_sgst_out" ON "inventory"."item_tax_master"("tax_sgst_output_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tax_igst_out" ON "inventory"."item_tax_master"("tax_igst_output_ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tax_name_global" ON "inventory"."item_tax_master"("tax_name");

-- CreateIndex
CREATE INDEX "idx_item_unit_conversion_item" ON "inventory"."item_unit_conversion"("iuc_item_id", "iuc_unit_slno");

-- CreateIndex
CREATE INDEX "idx_unit_active" ON "inventory"."item_unit_master"("unit_is_active");

-- CreateIndex
CREATE INDEX "idx_unit_base" ON "inventory"."item_unit_master"("unit_base_unit_id");

-- CreateIndex
CREATE INDEX "ix_trl_ledger" ON "inventory"."tax_rate_ledger"("trl_ledger_id");

-- CreateIndex
CREATE INDEX "ix_trl_role" ON "inventory"."tax_rate_ledger"("trl_role");

-- CreateIndex
CREATE UNIQUE INDEX "ux_app_setting_def_key" ON "app_setting_def"("asd_key");

-- CreateIndex
CREATE UNIQUE INDEX "branch_master_br_code_key" ON "branch_master"("br_code");

-- CreateIndex
CREATE INDEX "idx_branch_comp_id" ON "branch_master"("br_comp_id");

-- CreateIndex
CREATE INDEX "idx_branch_state_code" ON "branch_master"("br_state_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_charge_code" ON "charge_master"("chg_code");

-- CreateIndex
CREATE INDEX "idx_chg_ledger_code" ON "charge_master"("chg_ledger_code");

-- CreateIndex
CREATE UNIQUE INDEX "companys_comp_code_key" ON "companys"("comp_code");

-- CreateIndex
CREATE UNIQUE INDEX "companys_comp_name_key" ON "companys"("comp_name");

-- CreateIndex
CREATE UNIQUE INDEX "companys_comp_gstin_no_key" ON "companys"("comp_gstin_no");

-- CreateIndex
CREATE UNIQUE INDEX "ux_company_aato" ON "company_aato"("caa_company_id", "caa_fin_year");

-- CreateIndex
CREATE INDEX "idx_cog_group_active" ON "company_group_master"("cog_is_active");

-- CreateIndex
CREATE INDEX "ix_dtm_parent" ON "db_table_master"("dtm_parent_id");

-- CreateIndex
CREATE INDEX "ix_dtm_menu" ON "db_table_master"("dtm_menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dtm_table" ON "db_table_master"("dtm_schema", "dtm_table");

-- CreateIndex
CREATE INDEX "idx_fiscal_years_comp" ON "fiscal_years"("comp_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "ux_gst_provider_code" ON "gst_provider"("gpv_code");

-- CreateIndex
CREATE INDEX "ix_gpa_provider" ON "gst_provider_account"("gpa_gpv_id");

-- CreateIndex
CREATE INDEX "ix_gpe_service" ON "gst_provider_endpoint"("gpe_gps_id");

-- CreateIndex
CREATE INDEX "ix_gem_provider" ON "gst_provider_error_map"("gem_gpv_id");

-- CreateIndex
CREATE INDEX "ix_gps_provider" ON "gst_provider_service"("gps_gpv_id");

-- CreateIndex
CREATE INDEX "ix_plg_recent" ON "print_log"("plg_company_id", "plg_printed_on" DESC);

-- CreateIndex
CREATE INDEX "ix_plg_version" ON "print_log"("plg_version_id");

-- CreateIndex
CREATE INDEX "ix_plg_purpose" ON "print_log"("plg_purpose_id");

-- CreateIndex
CREATE INDEX "ix_plg_template" ON "print_log"("plg_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_psl_token" ON "print_share_link"("psl_token");

-- CreateIndex
CREATE INDEX "ix_psl_doc" ON "print_share_link"("psl_doc_id");

-- CreateIndex
CREATE INDEX "ix_psl_expires_on" ON "print_share_link"("psl_expires_on");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ptl_id_company_key" ON "print_template"("ptl_id", "ptl_company_key");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ptv_template_rev" ON "print_template_version"("ptv_template_id", "ptv_rev_no");

-- CreateIndex
CREATE INDEX "ix_txn_charge_detail_doc" ON "txn_charge_detail"("cd_doc_type", "cd_doc_id");

-- CreateIndex
CREATE INDEX "ix_txn_charge_detail_chg" ON "txn_charge_detail"("cd_chg_id");

-- CreateIndex
CREATE INDEX "ix_txn_charge_detail_ledger" ON "txn_charge_detail"("cd_ledger_code");

-- CreateIndex
CREATE INDEX "ix_txn_charge_detail_comp" ON "txn_charge_detail"("cd_comp_id");

-- CreateIndex
CREATE INDEX "ix_txn_charge_detail_branch" ON "txn_charge_detail"("cd_branch_id");

-- CreateIndex
CREATE INDEX "ix_tsl_doc_recent" ON "txn_status_log"("tsl_src_doc_type", "tsl_src_doc_id", "tsl_changed_on" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ux_tsl_doc_seq" ON "txn_status_log"("tsl_src_doc_type", "tsl_src_doc_id", "tsl_acc_year", "tsl_seq_no");

-- CreateIndex
CREATE INDEX "user_menus_um_user_id_idx" ON "user_menus"("um_user_id");

-- CreateIndex
CREATE INDEX "user_menus_um_user_id_um_can_view_um_visibility_idx" ON "user_menus"("um_user_id", "um_can_view", "um_visibility");

-- CreateIndex
CREATE INDEX "user_menus_um_user_id_um_is_favourite_um_is_pinned_idx" ON "user_menus"("um_user_id", "um_is_favourite", "um_is_pinned");

-- CreateIndex
CREATE UNIQUE INDEX "user_menus_um_user_id_um_menu_id_key" ON "user_menus"("um_user_id", "um_menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_po_device_slno" ON "purchase"."pur_order"("po_company_id", "po_branch_id", "po_acc_year", "po_device_id", "po_slno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_po_refno" ON "purchase"."pur_order"("po_company_id", "po_branch_id", "po_acc_year", "po_refno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_grn_device_slno" ON "purchase"."pur_grn"("grn_company_id", "grn_branch_id", "grn_acc_year", "grn_device_id", "grn_slno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_grn_refno" ON "purchase"."pur_grn"("grn_company_id", "grn_branch_id", "grn_acc_year", "grn_refno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_pi_device_slno" ON "purchase"."pur_invoice"("pi_company_id", "pi_branch_id", "pi_acc_year", "pi_device_id", "pi_slno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_pi_refno" ON "purchase"."pur_invoice"("pi_company_id", "pi_branch_id", "pi_acc_year", "pi_refno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_psr_device_slno" ON "purchase"."pur_shortage_receipt"("psr_company_id", "psr_branch_id", "psr_acc_year", "psr_device_id", "psr_slno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_psr_refno" ON "purchase"."pur_shortage_receipt"("psr_company_id", "psr_branch_id", "psr_acc_year", "psr_refno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_pr_device_slno" ON "purchase"."pur_return"("pr_company_id", "pr_branch_id", "pr_acc_year", "pr_device_id", "pr_slno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_pr_refno" ON "purchase"."pur_return"("pr_company_id", "pr_branch_id", "pr_acc_year", "pr_refno");

-- CreateIndex
CREATE INDEX "idx_sup_company" ON "purchase"."suppliers"("sup_company_id");

-- CreateIndex
CREATE INDEX "idx_sup_group" ON "purchase"."suppliers"("sup_group_id");

-- CreateIndex
CREATE INDEX "idx_sup_gst" ON "purchase"."suppliers"("sup_gst_no");

-- CreateIndex
CREATE INDEX "idx_spg_active" ON "purchase"."supplier_groups"("spg_is_active");

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
CREATE INDEX "idx_cgr_company" ON "sales"."cust_groups"("cgr_company_id");

-- CreateIndex
CREATE INDEX "idx_cgr_active" ON "sales"."cust_groups"("cgr_company_id", "cgr_is_active");

-- CreateIndex
CREATE INDEX "idx_edpt_active" ON "employee_departments"("edpt_is_active");

-- CreateIndex
CREATE INDEX "idx_ed_active" ON "employee_designations"("ed_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_company" ON "employee_master"("emp_company_id");

-- CreateIndex
CREATE INDEX "idx_emp_active" ON "employee_master"("emp_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_department" ON "employee_master"("emp_department_id");

-- CreateIndex
CREATE INDEX "idx_emp_designation" ON "employee_master"("emp_designation_id");

-- CreateIndex
CREATE INDEX "idx_csr_customer" ON "sales"."cust_item_rates"("csr_customer_id");

-- CreateIndex
CREATE INDEX "idx_csr_unit_rate" ON "sales"."cust_item_rates"("csr_unit_rate_id");

-- CreateIndex
CREATE INDEX "idx_csr_branch" ON "sales"."cust_item_rates"("csr_branch_id");

-- CreateIndex
CREATE INDEX "idx_csr_active_deleted" ON "sales"."cust_item_rates"("csr_is_deleted", "csr_is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_prm_benefit" ON "sales"."promotion_scheme"("prm_id", "prm_benefit");

-- CreateIndex
CREATE INDEX "idx_sale_agent_groups_id" ON "sales"."sale_agent_groups"("sa_grp_id");

-- CreateIndex
CREATE INDEX "idx_sale_agent_groups_name" ON "sales"."sale_agent_groups"("sa_grp_name");

-- CreateIndex
CREATE INDEX "idx_sale_agent_groups_active_deleted" ON "sales"."sale_agent_groups"("sa_grp_is_active", "sa_grp_is_deleted");

-- CreateIndex
CREATE INDEX "ix_sb_src_doc" ON "sales"."sale_bill"("sb_src_doc_id", "sb_src_doc_year");

-- CreateIndex
CREATE INDEX "ix_sbi_src_doc" ON "sales"."sale_bill_item"("sbi_src_doc_id", "sbi_src_doc_year", "sbi_src_doc_line_no");

-- CreateIndex
CREATE UNIQUE INDEX "ux_sdc_refno" ON "sales"."sale_dc"("sdc_company_id", "sdc_branch_id", "sdc_acc_year", "sdc_dc_refno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_sdc_counter_slno" ON "sales"."sale_dc"("sdc_company_id", "sdc_branch_id", "sdc_acc_year", "sdc_counter_id", "sdc_dc_slno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_sdr_refno" ON "sales"."sale_dc_return"("sdr_company_id", "sdr_branch_id", "sdr_acc_year", "sdr_return_refno");

-- CreateIndex
CREATE INDEX "idx_fr_active" ON "sales"."sale_freight_charges"("fr_is_active");

-- CreateIndex
CREATE INDEX "idx_ilc_active" ON "sales"."sale_loading_charges"("ilc_is_active");

-- CreateIndex
CREATE INDEX "ix_so_cust" ON "sales"."sale_order"("so_cust_id");

-- CreateIndex
CREATE INDEX "ix_soi_order" ON "sales"."sale_order_item"("soi_order_id");

-- CreateIndex
CREATE INDEX "ix_sq_date" ON "sales"."sale_quotation"("sq_company_id", "sq_branch_id", "sq_quote_date");

-- CreateIndex
CREATE INDEX "ix_sqi_quote" ON "sales"."sale_quotation_item"("sqi_quote_id");

-- CreateIndex
CREATE INDEX "ix_sqi_item" ON "sales"."sale_quotation_item"("sqi_item_id");

-- CreateIndex
CREATE INDEX "ix_sqi_hsn" ON "sales"."sale_quotation_item"("sqi_hsn_code");

-- CreateIndex
CREATE UNIQUE INDEX "ux_sr_refno" ON "sales"."sale_return"("sr_company_id", "sr_branch_id", "sr_acc_year", "sr_return_refno");

-- CreateIndex
CREATE UNIQUE INDEX "ux_sr_counter_slno" ON "sales"."sale_return"("sr_company_id", "sr_branch_id", "sr_acc_year", "sr_counter_id", "sr_return_slno");

-- CreateIndex
CREATE INDEX "idx_stm_active" ON "sales"."state_master"("stm_is_active");

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_bill" FOREIGN KEY ("abj_bill_id", "abj_bill_acc_year") REFERENCES "accounts"."acc_bill_balance"("abl_id", "abl_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_against_bill" FOREIGN KEY ("abj_against_bill_id", "abj_against_bill_acc_year") REFERENCES "accounts"."acc_bill_balance"("abl_id", "abl_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_party" FOREIGN KEY ("abj_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_settlement_ledger" FOREIGN KEY ("abj_settlement_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_voucher" FOREIGN KEY ("abj_voucher_id", "abj_voucher_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_tender" FOREIGN KEY ("abj_tender_id", "abj_tender_acc_year") REFERENCES "accounts"."acc_tender_detail"("td_id", "td_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_abj_cheque" FOREIGN KEY ("abj_cheque_id", "abj_cheque_acc_year") REFERENCES "accounts"."acc_pdc_register"("apd_id", "apd_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_balance" ADD CONSTRAINT "fk_abl_voucher" FOREIGN KEY ("abl_voucher_id", "abl_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_balance" ADD CONSTRAINT "fk_abl_voucher_type" FOREIGN KEY ("abl_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_balance" ADD CONSTRAINT "fk_abl_party" FOREIGN KEY ("abl_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_balance" ADD CONSTRAINT "fk_abl_parent" FOREIGN KEY ("abl_parent_bill_id", "abl_parent_acc_year") REFERENCES "accounts"."acc_bill_balance"("abl_id", "abl_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_cheque_book" ADD CONSTRAINT "fk_acb_bank_ledger" FOREIGN KEY ("acb_bank_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_group_master" ADD CONSTRAINT "acc_group_master_acc_group_parent_id_fkey" FOREIGN KEY ("acc_group_parent_id") REFERENCES "accounts"."acc_group_master"("acc_group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_group_master" ADD CONSTRAINT "acc_group_master_acc_group_company_id_fkey" FOREIGN KEY ("acc_group_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_map" ADD CONSTRAINT "fk_alm_company" FOREIGN KEY ("alm_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_map" ADD CONSTRAINT "fk_alm_role" FOREIGN KEY ("alm_role") REFERENCES "accounts"."acc_ledger_role"("alr_role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_map" ADD CONSTRAINT "fk_alm_ledger" FOREIGN KEY ("alm_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_company_id_fkey" FOREIGN KEY ("led_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_group_id_fkey" FOREIGN KEY ("led_group_id") REFERENCES "accounts"."acc_group_master"("acc_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "acc_ledger_master_led_branch_id_fkey" FOREIGN KEY ("led_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_master" ADD CONSTRAINT "fk_led_tax" FOREIGN KEY ("led_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_opening_balance" ADD CONSTRAINT "fk_op_ledger" FOREIGN KEY ("op_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_opening_balance" ADD CONSTRAINT "fk_op_company" FOREIGN KEY ("op_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_opening_balance" ADD CONSTRAINT "fk_op_branch" FOREIGN KEY ("op_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_opening_run" ADD CONSTRAINT "fk_aor_company" FOREIGN KEY ("aor_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_opening_run" ADD CONSTRAINT "fk_aor_branch" FOREIGN KEY ("aor_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_party_tax_certificate" ADD CONSTRAINT "fk_ptc_party" FOREIGN KEY ("ptc_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_party_tax_certificate" ADD CONSTRAINT "fk_ptc_company" FOREIGN KEY ("ptc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_party" FOREIGN KEY ("apd_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_bank_ledger" FOREIGN KEY ("apd_bank_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_voucher" FOREIGN KEY ("apd_voucher_id", "apd_voucher_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_clear_voucher" FOREIGN KEY ("apd_clear_voucher_id", "apd_clear_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_bounce_voucher" FOREIGN KEY ("apd_bounce_voucher_id", "apd_bounce_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_charge_voucher" FOREIGN KEY ("apd_charge_voucher_id", "apd_charge_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_pdc_register" ADD CONSTRAINT "fk_apd_replaced_by" FOREIGN KEY ("apd_replaced_by_id", "apd_replaced_by_acc_year") REFERENCES "accounts"."acc_pdc_register"("apd_id", "apd_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_settlement_import" ADD CONSTRAINT "fk_asi_bank" FOREIGN KEY ("asi_bank_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_settlement_line" ADD CONSTRAINT "fk_asl_import" FOREIGN KEY ("asl_import_id", "asl_acc_year") REFERENCES "accounts"."acc_settlement_import"("asi_id", "asi_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_settlement_line" ADD CONSTRAINT "fk_asl_reason" FOREIGN KEY ("asl_reason_id") REFERENCES "accounts"."till_reason"("trs_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tcs_register" ADD CONSTRAINT "fk_atc_party" FOREIGN KEY ("atc_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tcs_register" ADD CONSTRAINT "fk_atc_reversal_of" FOREIGN KEY ("atc_reversal_of_id") REFERENCES "accounts"."acc_tcs_register"("atc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tds_register" ADD CONSTRAINT "fk_atd_party" FOREIGN KEY ("atd_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tds_register" ADD CONSTRAINT "fk_atd_reversal_of" FOREIGN KEY ("atd_reversal_of_id") REFERENCES "accounts"."acc_tds_register"("atd_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."tds_rates" ADD CONSTRAINT "tds_rates_tdr_company_id_fkey" FOREIGN KEY ("tdr_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_temp_credit" ADD CONSTRAINT "fk_atc_party" FOREIGN KEY ("atc_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_temp_credit" ADD CONSTRAINT "fk_atc_bill" FOREIGN KEY ("atc_src_doc_id", "atc_acc_year") REFERENCES "sales"."sale_bill"("sb_id", "sb_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_temp_credit" ADD CONSTRAINT "fk_atc_abl" FOREIGN KEY ("atc_abl_id", "atc_abl_acc_year") REFERENCES "accounts"."acc_bill_balance"("abl_id", "abl_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_temp_credit" ADD CONSTRAINT "fk_atc_tender" FOREIGN KEY ("atc_tender_id", "atc_tender_acc_year") REFERENCES "accounts"."acc_tender_detail"("td_id", "td_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_company" FOREIGN KEY ("td_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_branch" FOREIGN KEY ("td_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_user" FOREIGN KEY ("td_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_tender" FOREIGN KEY ("td_tender_id") REFERENCES "accounts"."acc_tender_master"("tnd_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_tender_type" FOREIGN KEY ("td_tender_type_id") REFERENCES "accounts"."acc_tender_types"("ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_ledger" FOREIGN KEY ("td_tender_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_settle_ledger" FOREIGN KEY ("td_settle_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_party_ledger" FOREIGN KEY ("td_party_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_surcharge_ledger" FOREIGN KEY ("td_surcharge_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_company" FOREIGN KEY ("tnd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_branch" FOREIGN KEY ("tnd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_type" FOREIGN KEY ("tnd_type_id") REFERENCES "accounts"."acc_tender_types"("ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_ledger" FOREIGN KEY ("tnd_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_settlement_ledger" FOREIGN KEY ("tnd_settlement_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_surcharge_ledger" FOREIGN KEY ("tnd_surcharge_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_master" ADD CONSTRAINT "fk_tnd_bank_account" FOREIGN KEY ("tnd_bank_account_id") REFERENCES "accounts"."acc_ledger_bank_accounts"("lba_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_company" FOREIGN KEY ("vtx_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_branch" FOREIGN KEY ("vtx_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_gdr" FOREIGN KEY ("vtx_gdr_id", "vtx_acc_year") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id", "gdr_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_einvoice" ADD CONSTRAINT "fk_gde_gdr" FOREIGN KEY ("gde_gdr_id", "gde_acc_year") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id", "gdr_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_ewaybill" ADD CONSTRAINT "fk_gdw_gdr" FOREIGN KEY ("gdw_gdr_id", "gdw_acc_year") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id", "gdr_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_ewaybill" ADD CONSTRAINT "fk_gdw_vehicle" FOREIGN KEY ("gdw_vehicle_id") REFERENCES "vehicle_master"("veh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_company" FOREIGN KEY ("gdr_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_branch" FOREIGN KEY ("gdr_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_party" FOREIGN KEY ("gdr_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_type" FOREIGN KEY ("gdr_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_company" FOREIGN KEY ("avh_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_branch" FOREIGN KEY ("avh_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_voucher_type" FOREIGN KEY ("avh_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_party" FOREIGN KEY ("avh_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_opp_ledger" FOREIGN KEY ("avh_opposite_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_user" FOREIGN KEY ("avh_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_against" FOREIGN KEY ("avh_against_voucher_id", "avh_against_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_avh_reversal" FOREIGN KEY ("avh_reversal_voucher_id", "avh_reversal_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_header" FOREIGN KEY ("av_voucher_id", "av_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_ledger" FOREIGN KEY ("av_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_opp_ledger" FOREIGN KEY ("av_opp_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_voucher_type" FOREIGN KEY ("av_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_doc" FOREIGN KEY ("av_doc_id", "av_doc_acc_year") REFERENCES "accounts"."acc_bill_balance"("abl_id", "abl_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_role" FOREIGN KEY ("av_role") REFERENCES "accounts"."acc_ledger_role"("alr_role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_seq" ADD CONSTRAINT "fk_acc_voucher_seq_type" FOREIGN KEY ("seq_vchr_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_seq" ADD CONSTRAINT "fk_acc_voucher_seq_company" FOREIGN KEY ("seq_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_seq" ADD CONSTRAINT "fk_acc_voucher_seq_branch" FOREIGN KEY ("seq_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_types" ADD CONSTRAINT "fk_vchr_menu" FOREIGN KEY ("vchr_menu_id") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" ADD CONSTRAINT "acc_ship_addrs_saa_company_id_fkey" FOREIGN KEY ("saa_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" ADD CONSTRAINT "acc_ship_addrs_saa_branch_id_fkey" FOREIGN KEY ("saa_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ship_addrs" ADD CONSTRAINT "acc_ship_addrs_saa_ledger_id_fkey" FOREIGN KEY ("saa_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_bank_accounts" ADD CONSTRAINT "acc_ledger_bank_accounts_lba_company_id_fkey" FOREIGN KEY ("lba_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_ledger_bank_accounts" ADD CONSTRAINT "acc_ledger_bank_accounts_lba_ledger_id_fkey" FOREIGN KEY ("lba_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_approval" ADD CONSTRAINT "fk_tap_reason" FOREIGN KEY ("tap_reason_id") REFERENCES "accounts"."till_reason"("trs_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_cash_movement" ADD CONSTRAINT "fk_tcm_ledger" FOREIGN KEY ("tcm_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_cash_movement" ADD CONSTRAINT "fk_tcm_reason" FOREIGN KEY ("tcm_reason_id") REFERENCES "accounts"."till_reason"("trs_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_cash_movement" ADD CONSTRAINT "fk_tcm_safe" FOREIGN KEY ("tcm_safe_id") REFERENCES "accounts"."till_safe"("tsf_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_counter" ADD CONSTRAINT "fk_tcn_device" FOREIGN KEY ("tcn_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_counter" ADD CONSTRAINT "fk_tcn_safe" FOREIGN KEY ("tcn_safe_id") REFERENCES "accounts"."till_safe"("tsf_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_count_line" ADD CONSTRAINT "fk_tcl_count" FOREIGN KEY ("tcl_count_id", "tcl_acc_year") REFERENCES "accounts"."till_count"("tct_id", "tct_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_count_line" ADD CONSTRAINT "fk_tcl_tender_type" FOREIGN KEY ("tcl_tender_type_id") REFERENCES "accounts"."acc_tender_types"("ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_count_line" ADD CONSTRAINT "fk_tcl_denom" FOREIGN KEY ("tcl_denomination_id") REFERENCES "accounts"."till_denomination"("tdn_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_reason" ADD CONSTRAINT "fk_trs_ledger" FOREIGN KEY ("trs_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_safe" ADD CONSTRAINT "fk_tsf_ledger" FOREIGN KEY ("tsf_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_session" ADD CONSTRAINT "fk_tss_day" FOREIGN KEY ("tss_day_id", "tss_acc_year", "tss_business_date") REFERENCES "accounts"."till_business_day"("tbd_id", "tbd_acc_year", "tbd_business_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_session" ADD CONSTRAINT "fk_tss_counter" FOREIGN KEY ("tss_counter_id") REFERENCES "accounts"."till_counter"("tcn_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_variance" ADD CONSTRAINT "fk_tvr_session" FOREIGN KEY ("tvr_session_id", "tvr_acc_year") REFERENCES "accounts"."till_session"("tss_id", "tss_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_variance" ADD CONSTRAINT "fk_tvr_tender_type" FOREIGN KEY ("tvr_tender_type_id") REFERENCES "accounts"."acc_tender_types"("ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."till_variance" ADD CONSTRAINT "fk_tvr_reason" FOREIGN KEY ("tvr_reason_id") REFERENCES "accounts"."till_reason"("trs_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_log_screen_id_fkey" FOREIGN KEY ("log_screen_id") REFERENCES "audit"."audit_screen"("screen_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit"."user_login_sessions" ADD CONSTRAINT "user_login_sessions_uls_company_id_fkey" FOREIGN KEY ("uls_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."dropdown_columns" ADD CONSTRAINT "dropdown_columns_dropdown_columns_dropdown_id_fkey" FOREIGN KEY ("dropdown_columns_dropdown_id") REFERENCES "fixed"."dropdown_details"("dropdown_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."device_master" ADD CONSTRAINT "device_master_dev_company_id_fkey" FOREIGN KEY ("dev_company_id") REFERENCES "companys"("comp_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."device_master" ADD CONSTRAINT "device_master_dev_branch_id_fkey" FOREIGN KEY ("dev_branch_id") REFERENCES "branch_master"("br_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."device_master" ADD CONSTRAINT "device_master_dev_user_id_fkey" FOREIGN KEY ("dev_user_id") REFERENCES "user_master"("usr_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."form_section" ADD CONSTRAINT "form_section_section_menu_id_fkey" FOREIGN KEY ("section_menu_id") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."form_field" ADD CONSTRAINT "form_field_field_section_id_fkey" FOREIGN KEY ("field_section_id") REFERENCES "fixed"."form_section"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."grid_columns" ADD CONSTRAINT "grid_columns_grid_id_fkey" FOREIGN KEY ("grid_id") REFERENCES "fixed"."grid_details"("grid_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."menu_master" ADD CONSTRAINT "menu_master_menu_parent_fkey" FOREIGN KEY ("menu_parent") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."ui_table_columns" ADD CONSTRAINT "fk_ui_tables" FOREIGN KEY ("ui_tbl_clm_table_id") REFERENCES "fixed"."ui_tables"("ui_tbl_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_category_master" ADD CONSTRAINT "item_category_master_category_parent_id_fkey" FOREIGN KEY ("category_parent_id") REFERENCES "inventory"."item_category_master"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."godown_locations" ADD CONSTRAINT "godown_locations_gdl_parent_id_fkey" FOREIGN KEY ("gdl_parent_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_batch_stock" ADD CONSTRAINT "fk_ibs_batch" FOREIGN KEY ("ibs_batch_id") REFERENCES "inventory"."item_batch_master"("btm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_brand_master" ADD CONSTRAINT "item_brand_master_brand_parent_id_fkey" FOREIGN KEY ("brand_parent_id") REFERENCES "inventory"."item_brand_master"("brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_colour_master" ADD CONSTRAINT "fk_icl_company" FOREIGN KEY ("icl_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_ean_codes" ADD CONSTRAINT "fk_ean_item_unit" FOREIGN KEY ("ean_uc_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_group_master" ADD CONSTRAINT "item_group_master_itg_parent_id_fkey" FOREIGN KEY ("itg_parent_id") REFERENCES "inventory"."item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_group_master" ADD CONSTRAINT "fk_itg_track_preset" FOREIGN KEY ("itg_track_preset_id") REFERENCES "stock"."stock_track_preset"("spt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_master" ADD CONSTRAINT "item_master_item_group_id_fkey" FOREIGN KEY ("item_group_id") REFERENCES "inventory"."item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_master" ADD CONSTRAINT "fk_item_track_preset" FOREIGN KEY ("item_track_preset_id") REFERENCES "stock"."stock_track_preset"("spt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_master" ADD CONSTRAINT "item_master_item_category_id_fkey" FOREIGN KEY ("item_category_id") REFERENCES "inventory"."item_category_master"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_master" ADD CONSTRAINT "item_master_item_base_unit_id_fkey" FOREIGN KEY ("item_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_master" ADD CONSTRAINT "item_master_item_default_tax_id_fkey" FOREIGN KEY ("item_default_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_master" ADD CONSTRAINT "item_master_item_company_id_fkey" FOREIGN KEY ("item_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "fk_ipm_item" FOREIGN KEY ("ipm_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "fk_ipm_company_id" FOREIGN KEY ("ipm_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "fk_ipm_branch_id" FOREIGN KEY ("ipm_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "fk_ipm_unit" FOREIGN KEY ("ipm_uc_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_price_master" ADD CONSTRAINT "fk_ipm_godown_id" FOREIGN KEY ("ipm_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_item" FOREIGN KEY ("iqp_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_item_unit" FOREIGN KEY ("iqp_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_company_id" FOREIGN KEY ("iqp_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_branch_id" FOREIGN KEY ("iqp_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_price_level" FOREIGN KEY ("iqp_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_party_id" FOREIGN KEY ("iqp_party_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_reorders" ADD CONSTRAINT "item_reorders_ir_item_id_fkey" FOREIGN KEY ("ir_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_reorders" ADD CONSTRAINT "fk_ir_item_unit" FOREIGN KEY ("ir_uc_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_section_master" ADD CONSTRAINT "item_section_master_sec_parent_id_fkey" FOREIGN KEY ("sec_parent_id") REFERENCES "inventory"."item_section_master"("sec_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_size_master" ADD CONSTRAINT "fk_isz_company" FOREIGN KEY ("isz_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_tax_history" ADD CONSTRAINT "item_tax_history_ith_item_id_fkey" FOREIGN KEY ("ith_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_tax_history" ADD CONSTRAINT "item_tax_history_ith_tax_id_fkey" FOREIGN KEY ("ith_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_unit_conversion" ADD CONSTRAINT "fk_iuc_item_id" FOREIGN KEY ("iuc_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_unit_conversion" ADD CONSTRAINT "fk_iuc_unit_id" FOREIGN KEY ("iuc_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_unit_conversion" ADD CONSTRAINT "fk_iuc_base_unit_id" FOREIGN KEY ("iuc_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_unit_master" ADD CONSTRAINT "item_unit_master_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "inventory"."item_gst_units"("item_gst_unit_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_unit_master" ADD CONSTRAINT "item_unit_master_unit_base_unit_id_fkey" FOREIGN KEY ("unit_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."tax_rate_master" ADD CONSTRAINT "fk_tax_supersedes" FOREIGN KEY ("tax_supersedes_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."tax_rate_master" ADD CONSTRAINT "fk_tax_above_tax" FOREIGN KEY ("tax_above_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory"."tax_rate_ledger" ADD CONSTRAINT "fk_trl_tax" FOREIGN KEY ("trl_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."tax_rate_ledger" ADD CONSTRAINT "fk_trl_role" FOREIGN KEY ("trl_role") REFERENCES "accounts"."acc_ledger_role"("alr_role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."tax_rate_ledger" ADD CONSTRAINT "fk_trl_ledger" FOREIGN KEY ("trl_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_setting_value" ADD CONSTRAINT "fk_asv_setting" FOREIGN KEY ("asv_setting_key") REFERENCES "app_setting_def"("asd_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_setting_value" ADD CONSTRAINT "fk_asv_company" FOREIGN KEY ("asv_company_id") REFERENCES "companys"("comp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_setting_value" ADD CONSTRAINT "fk_asv_branch" FOREIGN KEY ("asv_branch_id") REFERENCES "branch_master"("br_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_setting_value" ADD CONSTRAINT "fk_asv_device" FOREIGN KEY ("asv_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_setting_value" ADD CONSTRAINT "fk_asv_user" FOREIGN KEY ("asv_user_id") REFERENCES "user_master"("usr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_master" ADD CONSTRAINT "branch_master_br_comp_id_fkey" FOREIGN KEY ("br_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_master" ADD CONSTRAINT "charge_master_chg_ledger_code_fkey" FOREIGN KEY ("chg_ledger_code") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_master" ADD CONSTRAINT "fk_chg_tax" FOREIGN KEY ("chg_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companys" ADD CONSTRAINT "companys_comp_stylesheet_id_fkey" FOREIGN KEY ("comp_stylesheet_id") REFERENCES "app_theme_master"("thm_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aato" ADD CONSTRAINT "fk_caa_company" FOREIGN KEY ("caa_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_table_master" ADD CONSTRAINT "fk_dtm_parent" FOREIGN KEY ("dtm_parent_id") REFERENCES "db_table_master"("dtm_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_table_master" ADD CONSTRAINT "fk_dtm_menu" FOREIGN KEY ("dtm_menu_id") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_fy_prev_fy_id_fkey" FOREIGN KEY ("fy_prev_fy_id") REFERENCES "fiscal_years"("fy_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gst_auth_session" ADD CONSTRAINT "fk_gas_credential" FOREIGN KEY ("gas_gcc_id") REFERENCES "gst_company_credential"("gcc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_company_credential" ADD CONSTRAINT "fk_gcc_company" FOREIGN KEY ("gcc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_company_credential" ADD CONSTRAINT "fk_gcc_branch" FOREIGN KEY ("gcc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_company_credential" ADD CONSTRAINT "fk_gcc_provider" FOREIGN KEY ("gcc_gpv_id") REFERENCES "gst_provider"("gpv_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_provider_account" ADD CONSTRAINT "fk_gpa_provider" FOREIGN KEY ("gpa_gpv_id") REFERENCES "gst_provider"("gpv_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_provider_endpoint" ADD CONSTRAINT "fk_gpe_service" FOREIGN KEY ("gpe_gps_id") REFERENCES "gst_provider_service"("gps_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_provider_error_map" ADD CONSTRAINT "fk_gem_provider" FOREIGN KEY ("gem_gpv_id") REFERENCES "gst_provider"("gpv_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_provider_field_map" ADD CONSTRAINT "fk_gfm_endpoint" FOREIGN KEY ("gfm_gpe_id") REFERENCES "gst_provider_endpoint"("gpe_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_provider_service" ADD CONSTRAINT "fk_gps_provider" FOREIGN KEY ("gps_gpv_id") REFERENCES "gst_provider"("gpv_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_profile" ADD CONSTRAINT "fk_prf_company" FOREIGN KEY ("prf_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_profile" ADD CONSTRAINT "fk_prf_branch" FOREIGN KEY ("prf_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_profile" ADD CONSTRAINT "fk_prf_device" FOREIGN KEY ("prf_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_profile" ADD CONSTRAINT "fk_prf_created_by" FOREIGN KEY ("prf_created_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_profile" ADD CONSTRAINT "fk_prf_modified_by" FOREIGN KEY ("prf_modified_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_company" FOREIGN KEY ("plg_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_branch" FOREIGN KEY ("plg_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_device" FOREIGN KEY ("plg_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_purpose" FOREIGN KEY ("plg_purpose_id") REFERENCES "print_purpose"("ppo_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_template" FOREIGN KEY ("plg_template_id") REFERENCES "print_template"("ptl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_version" FOREIGN KEY ("plg_version_id") REFERENCES "print_template_version"("ptv_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_printer" FOREIGN KEY ("plg_printer_id") REFERENCES "printer_profile"("prf_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_log" ADD CONSTRAINT "fk_plg_printed_by" FOREIGN KEY ("plg_printed_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_purpose" ADD CONSTRAINT "fk_ppo_company" FOREIGN KEY ("ppo_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_purpose" ADD CONSTRAINT "fk_ppo_created_by" FOREIGN KEY ("ppo_created_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_purpose" ADD CONSTRAINT "fk_ppo_modified_by" FOREIGN KEY ("ppo_modified_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template" ADD CONSTRAINT "fk_ptl_company" FOREIGN KEY ("ptl_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template" ADD CONSTRAINT "fk_ptl_purpose" FOREIGN KEY ("ptl_purpose_id") REFERENCES "print_purpose"("ppo_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template" ADD CONSTRAINT "fk_ptl_forked_from" FOREIGN KEY ("ptl_forked_from_id") REFERENCES "print_template"("ptl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template" ADD CONSTRAINT "fk_ptl_created_by" FOREIGN KEY ("ptl_created_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template" ADD CONSTRAINT "fk_ptl_modified_by" FOREIGN KEY ("ptl_modified_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template" ADD CONSTRAINT "fk_ptl_published_rev" FOREIGN KEY ("ptl_published_rev_id") REFERENCES "print_template_version"("ptv_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_company" FOREIGN KEY ("pta_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_branch" FOREIGN KEY ("pta_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_device" FOREIGN KEY ("pta_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_purpose" FOREIGN KEY ("pta_purpose_id") REFERENCES "print_purpose"("ppo_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_template" FOREIGN KEY ("pta_template_id", "pta_template_company_key") REFERENCES "print_template"("ptl_id", "ptl_company_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_printer" FOREIGN KEY ("pta_printer_id") REFERENCES "printer_profile"("prf_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_created_by" FOREIGN KEY ("pta_created_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_assignment" ADD CONSTRAINT "fk_pta_modified_by" FOREIGN KEY ("pta_modified_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_dataset" ADD CONSTRAINT "fk_ptd_version" FOREIGN KEY ("ptd_version_id") REFERENCES "print_template_version"("ptv_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_dataset" ADD CONSTRAINT "fk_ptd_created_by" FOREIGN KEY ("ptd_created_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_dataset" ADD CONSTRAINT "fk_ptd_modified_by" FOREIGN KEY ("ptd_modified_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_version" ADD CONSTRAINT "fk_ptv_template" FOREIGN KEY ("ptv_template_id") REFERENCES "print_template"("ptl_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_version" ADD CONSTRAINT "fk_ptv_approved_by" FOREIGN KEY ("ptv_approved_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_version" ADD CONSTRAINT "fk_ptv_created_by" FOREIGN KEY ("ptv_created_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_version" ADD CONSTRAINT "fk_ptv_modified_by" FOREIGN KEY ("ptv_modified_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_charge_detail" ADD CONSTRAINT "fk_cd_charge" FOREIGN KEY ("cd_chg_id") REFERENCES "charge_master"("chg_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "txn_charge_detail" ADD CONSTRAINT "fk_cd_ledger" FOREIGN KEY ("cd_ledger_code") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_charge_detail" ADD CONSTRAINT "fk_cd_tax" FOREIGN KEY ("cd_tax_code") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_charge_detail" ADD CONSTRAINT "fk_cd_company" FOREIGN KEY ("cd_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_charge_detail" ADD CONSTRAINT "fk_cd_branch" FOREIGN KEY ("cd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_charge_detail" ADD CONSTRAINT "fk_cd_src" FOREIGN KEY ("cd_src_cd_id", "cd_src_acc_year") REFERENCES "txn_charge_detail"("cd_id", "cd_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_transport_detail" ADD CONSTRAINT "fk_ttd_transporter" FOREIGN KEY ("ttd_transporter_id") REFERENCES "transporter_master"("trn_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_transport_detail" ADD CONSTRAINT "fk_ttd_from_godown" FOREIGN KEY ("ttd_from_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_transport_detail" ADD CONSTRAINT "fk_ttd_to_godown" FOREIGN KEY ("ttd_to_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_hold" ADD CONSTRAINT "fk_txh_device" FOREIGN KEY ("txh_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_hold" ADD CONSTRAINT "fk_txh_lock_device" FOREIGN KEY ("txh_locked_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_hold" ADD CONSTRAINT "fk_txh_staff" FOREIGN KEY ("txh_staff_id") REFERENCES "employee_master"("emp_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_status_log" ADD CONSTRAINT "fk_tsl_device" FOREIGN KEY ("tsl_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_menus" ADD CONSTRAINT "user_menus_um_user_id_fkey" FOREIGN KEY ("um_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_menus" ADD CONSTRAINT "user_menus_um_menu_id_fkey" FOREIGN KEY ("um_menu_id") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_master" ADD CONSTRAINT "fk_veh_transporter" FOREIGN KEY ("veh_transporter_id") REFERENCES "transporter_master"("trn_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_master" ADD CONSTRAINT "fk_veh_driver" FOREIGN KEY ("veh_driver_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_order" ADD CONSTRAINT "fk_po_agent" FOREIGN KEY ("po_agent_id") REFERENCES "purchase"."pur_agent"("pag_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_order" ADD CONSTRAINT "fk_po_terms" FOREIGN KEY ("po_terms_id") REFERENCES "purchase"."pur_terms"("pte_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_order_item" ADD CONSTRAINT "fk_poi_po" FOREIGN KEY ("poi_po_id", "poi_acc_year") REFERENCES "purchase"."pur_order"("po_id", "po_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_grn_item" ADD CONSTRAINT "fk_gri_grn" FOREIGN KEY ("gri_grn_id", "gri_acc_year") REFERENCES "purchase"."pur_grn"("grn_id", "grn_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_invoice" ADD CONSTRAINT "fk_pi_agent" FOREIGN KEY ("pi_agent_id") REFERENCES "purchase"."pur_agent"("pag_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_invoice_item" ADD CONSTRAINT "fk_pii_pi" FOREIGN KEY ("pii_pi_id", "pii_acc_year") REFERENCES "purchase"."pur_invoice"("pi_id", "pi_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_shortage_close" ADD CONSTRAINT "fk_psc_shortage" FOREIGN KEY ("psc_shortage_id", "psc_shortage_acc_year") REFERENCES "purchase"."pur_shortage"("psh_id", "psh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_shortage_receipt_item" ADD CONSTRAINT "fk_psri_psr" FOREIGN KEY ("psri_psr_id", "psri_acc_year") REFERENCES "purchase"."pur_shortage_receipt"("psr_id", "psr_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_shortage_receipt_item" ADD CONSTRAINT "fk_psri_shortage" FOREIGN KEY ("psri_shortage_id", "psri_shortage_acc_year") REFERENCES "purchase"."pur_shortage"("psh_id", "psh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_return_item" ADD CONSTRAINT "fk_pri_pr" FOREIGN KEY ("pri_pr_id", "pri_acc_year") REFERENCES "purchase"."pur_return"("pr_id", "pr_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_claim_settlement" ADD CONSTRAINT "fk_pcs_return_item" FOREIGN KEY ("pcs_return_item_id", "pcs_return_item_acc_year") REFERENCES "purchase"."pur_return_item"("pri_id", "pri_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."pur_claim_settlement" ADD CONSTRAINT "fk_pcs_shortage_close" FOREIGN KEY ("pcs_shortage_close_id", "pcs_shortage_close_acc_year") REFERENCES "purchase"."pur_shortage_close"("psc_id", "psc_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."suppliers" ADD CONSTRAINT "fk_sup_ledger" FOREIGN KEY ("sup_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase"."suppliers" ADD CONSTRAINT "suppliers_sup_group_id_fkey" FOREIGN KEY ("sup_group_id") REFERENCES "purchase"."supplier_groups"("spg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."area_master" ADD CONSTRAINT "area_master_arm_city_id_fkey" FOREIGN KEY ("arm_city_id") REFERENCES "sales"."city_master"("ctm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."city_master" ADD CONSTRAINT "city_master_ctm_state_id_fkey" FOREIGN KEY ("ctm_state_id") REFERENCES "sales"."state_master"("stm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "fk_cus_ledger" FOREIGN KEY ("cus_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_area_id_fkey" FOREIGN KEY ("cus_area_id") REFERENCES "sales"."area_master"("arm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_group_id_fkey" FOREIGN KEY ("cus_group_id") REFERENCES "sales"."cust_groups"("cgr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_company_id_fkey" FOREIGN KEY ("cus_company_id") REFERENCES "companys"("comp_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_price_level_id_fkey" FOREIGN KEY ("cus_price_level_id") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."cust_groups" ADD CONSTRAINT "cust_groups_cgr_company_id_fkey" FOREIGN KEY ("cgr_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_master" ADD CONSTRAINT "employee_master_emp_company_id_fkey" FOREIGN KEY ("emp_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_master" ADD CONSTRAINT "employee_master_emp_designation_id_fkey" FOREIGN KEY ("emp_designation_id") REFERENCES "employee_designations"("ed_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_master" ADD CONSTRAINT "employee_master_emp_department_id_fkey" FOREIGN KEY ("emp_department_id") REFERENCES "employee_departments"("edpt_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_batch" FOREIGN KEY ("lcp_lcb_id") REFERENCES "sales"."loyalty_coupon_batch"("lcb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_company" FOREIGN KEY ("lcp_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_branch" FOREIGN KEY ("lcp_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_cust" FOREIGN KEY ("lcp_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_member" FOREIGN KEY ("lcp_member_id") REFERENCES "sales"."loyalty_member"("lmb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_cancelled_by" FOREIGN KEY ("lcp_cancelled_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon" ADD CONSTRAINT "fk_lcp_party_ledger" FOREIGN KEY ("lcp_party_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_batch" ADD CONSTRAINT "fk_lcb_company" FOREIGN KEY ("lcb_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_batch" ADD CONSTRAINT "fk_lcb_branch" FOREIGN KEY ("lcb_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_batch" ADD CONSTRAINT "fk_lcb_redeem_tender" FOREIGN KEY ("lcb_redeem_tender_id") REFERENCES "accounts"."acc_tender_master"("tnd_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_batch" ADD CONSTRAINT "fk_lcb_cust_group" FOREIGN KEY ("lcb_cust_group_id") REFERENCES "sales"."cust_groups"("cgr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_coupon" FOREIGN KEY ("lct_lcp_id") REFERENCES "sales"."loyalty_coupon"("lcp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_batch" FOREIGN KEY ("lct_lcb_id") REFERENCES "sales"."loyalty_coupon_batch"("lcb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_cust" FOREIGN KEY ("lct_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_member" FOREIGN KEY ("lct_member_id") REFERENCES "sales"."loyalty_member"("lmb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_company" FOREIGN KEY ("lct_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_branch" FOREIGN KEY ("lct_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_user" FOREIGN KEY ("lct_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_approved_by" FOREIGN KEY ("lct_approved_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_device" FOREIGN KEY ("lct_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_tender" FOREIGN KEY ("lct_tender_id", "lct_tender_acc_year") REFERENCES "accounts"."acc_tender_detail"("td_id", "td_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_coupon_txn" ADD CONSTRAINT "fk_lct_reversal" FOREIGN KEY ("lct_reversal_of_id", "lct_reversal_of_acc_year") REFERENCES "sales"."loyalty_coupon_txn"("lct_id", "lct_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_company" FOREIGN KEY ("lgr_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_branch" FOREIGN KEY ("lgr_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_device" FOREIGN KEY ("lgr_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_member" FOREIGN KEY ("lgr_member_id") REFERENCES "sales"."loyalty_member"("lmb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_cust" FOREIGN KEY ("lgr_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_scheme" FOREIGN KEY ("lgr_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_user" FOREIGN KEY ("lgr_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_emp" FOREIGN KEY ("lgr_emp_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_approved_by" FOREIGN KEY ("lgr_approved_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem" ADD CONSTRAINT "fk_lgr_reversal" FOREIGN KEY ("lgr_reversal_of_id", "lgr_reversal_of_acc_year") REFERENCES "sales"."loyalty_gift_redeem"("lgr_id", "lgr_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_header" FOREIGN KEY ("lgd_lgr_id", "lgd_lgr_acc_year") REFERENCES "sales"."loyalty_gift_redeem"("lgr_id", "lgr_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_company" FOREIGN KEY ("lgd_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_branch" FOREIGN KEY ("lgd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_gift" FOREIGN KEY ("lgd_lsg_id") REFERENCES "sales"."loyalty_scheme_gift"("lsg_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_item" FOREIGN KEY ("lgd_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_unit" FOREIGN KEY ("lgd_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_godown" FOREIGN KEY ("lgd_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_gift_redeem_item" ADD CONSTRAINT "fk_lgd_batch" FOREIGN KEY ("lgd_batch_id") REFERENCES "inventory"."item_batch_master"("btm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_member" FOREIGN KEY ("lld_member_id") REFERENCES "sales"."loyalty_member"("lmb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_cust" FOREIGN KEY ("lld_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_company" FOREIGN KEY ("lld_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_branch" FOREIGN KEY ("lld_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_scheme" FOREIGN KEY ("lld_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_slab" FOREIGN KEY ("lld_lss_id") REFERENCES "sales"."loyalty_scheme_slab"("lss_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_item_rule" FOREIGN KEY ("lld_lsi_id") REFERENCES "sales"."loyalty_scheme_item"("lsi_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_user" FOREIGN KEY ("lld_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_approved_by" FOREIGN KEY ("lld_approved_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_device" FOREIGN KEY ("lld_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_lot" FOREIGN KEY ("lld_lot_id", "lld_lot_acc_year") REFERENCES "sales"."loyalty_ledger"("lld_id", "lld_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_reversal" FOREIGN KEY ("lld_reversal_of_id", "lld_reversal_of_acc_year") REFERENCES "sales"."loyalty_ledger"("lld_id", "lld_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_ledger" ADD CONSTRAINT "fk_lld_tender" FOREIGN KEY ("lld_tender_id", "lld_tender_acc_year") REFERENCES "accounts"."acc_tender_detail"("td_id", "td_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_member" ADD CONSTRAINT "fk_lmb_company" FOREIGN KEY ("lmb_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_member" ADD CONSTRAINT "fk_lmb_branch" FOREIGN KEY ("lmb_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_member" ADD CONSTRAINT "fk_lmb_cust" FOREIGN KEY ("lmb_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_member" ADD CONSTRAINT "fk_lmb_party_ledger" FOREIGN KEY ("lmb_party_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_member" ADD CONSTRAINT "fk_lmb_scheme" FOREIGN KEY ("lmb_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_member" ADD CONSTRAINT "fk_lmb_merged_into" FOREIGN KEY ("lmb_merged_into_id") REFERENCES "sales"."loyalty_member"("lmb_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme" ADD CONSTRAINT "fk_lsc_company" FOREIGN KEY ("lsc_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme" ADD CONSTRAINT "fk_lsc_branch" FOREIGN KEY ("lsc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme" ADD CONSTRAINT "fk_lsc_price_level" FOREIGN KEY ("lsc_price_level_id") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme" ADD CONSTRAINT "fk_lsc_redeem_tender" FOREIGN KEY ("lsc_redeem_tender_id") REFERENCES "accounts"."acc_tender_master"("tnd_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme" ADD CONSTRAINT "fk_lsc_approved_by" FOREIGN KEY ("lsc_approved_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_branch" ADD CONSTRAINT "fk_lsb_scheme" FOREIGN KEY ("lsb_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_branch" ADD CONSTRAINT "fk_lsb_branch" FOREIGN KEY ("lsb_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_gift" ADD CONSTRAINT "fk_lsg_scheme" FOREIGN KEY ("lsg_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_gift" ADD CONSTRAINT "fk_lsg_item" FOREIGN KEY ("lsg_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_gift" ADD CONSTRAINT "fk_lsg_unit" FOREIGN KEY ("lsg_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_item" ADD CONSTRAINT "fk_lsi_scheme" FOREIGN KEY ("lsi_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_item" ADD CONSTRAINT "fk_lsi_item" FOREIGN KEY ("lsi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_item" ADD CONSTRAINT "fk_lsi_group" FOREIGN KEY ("lsi_group_id") REFERENCES "inventory"."item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_item" ADD CONSTRAINT "fk_lsi_category" FOREIGN KEY ("lsi_category_id") REFERENCES "inventory"."item_category_master"("category_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_item" ADD CONSTRAINT "fk_lsi_brand" FOREIGN KEY ("lsi_brand_id") REFERENCES "inventory"."item_brand_master"("brand_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_item" ADD CONSTRAINT "fk_lsi_section" FOREIGN KEY ("lsi_section_id") REFERENCES "inventory"."item_section_master"("sec_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_party" ADD CONSTRAINT "fk_lsp_scheme" FOREIGN KEY ("lsp_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_party" ADD CONSTRAINT "fk_lsp_cust" FOREIGN KEY ("lsp_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_party" ADD CONSTRAINT "fk_lsp_cust_group" FOREIGN KEY ("lsp_cust_group_id") REFERENCES "sales"."cust_groups"("cgr_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_slab" ADD CONSTRAINT "fk_lss_scheme" FOREIGN KEY ("lss_lsc_id") REFERENCES "sales"."loyalty_scheme"("lsc_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_slab" ADD CONSTRAINT "fk_lss_item" FOREIGN KEY ("lss_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."loyalty_scheme_slab" ADD CONSTRAINT "fk_lss_unit" FOREIGN KEY ("lss_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme" ADD CONSTRAINT "fk_prm_company" FOREIGN KEY ("prm_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme" ADD CONSTRAINT "fk_prm_branch" FOREIGN KEY ("prm_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme" ADD CONSTRAINT "fk_prm_price_level" FOREIGN KEY ("prm_price_level_id") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme" ADD CONSTRAINT "fk_prm_approved_by" FOREIGN KEY ("prm_approved_by") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_branch" ADD CONSTRAINT "fk_prb_scheme" FOREIGN KEY ("prb_prm_id") REFERENCES "sales"."promotion_scheme"("prm_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_branch" ADD CONSTRAINT "fk_prb_branch" FOREIGN KEY ("prb_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_scheme" FOREIGN KEY ("pri_prm_id") REFERENCES "sales"."promotion_scheme"("prm_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_item" FOREIGN KEY ("pri_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_group" FOREIGN KEY ("pri_group_id") REFERENCES "inventory"."item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_category" FOREIGN KEY ("pri_category_id") REFERENCES "inventory"."item_category_master"("category_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_brand" FOREIGN KEY ("pri_brand_id") REFERENCES "inventory"."item_brand_master"("brand_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_section" FOREIGN KEY ("pri_section_id") REFERENCES "inventory"."item_section_master"("sec_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_item" ADD CONSTRAINT "fk_pri_unit" FOREIGN KEY ("pri_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_party" ADD CONSTRAINT "fk_prp_scheme" FOREIGN KEY ("prp_prm_id") REFERENCES "sales"."promotion_scheme"("prm_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_party" ADD CONSTRAINT "fk_prp_cust" FOREIGN KEY ("prp_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_party" ADD CONSTRAINT "fk_prp_cust_group" FOREIGN KEY ("prp_cust_group_id") REFERENCES "sales"."cust_groups"("cgr_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_party" ADD CONSTRAINT "fk_prp_area" FOREIGN KEY ("prp_area_id") REFERENCES "sales"."area_master"("arm_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_party" ADD CONSTRAINT "fk_prp_city" FOREIGN KEY ("prp_city_id") REFERENCES "sales"."city_master"("ctm_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_slab" ADD CONSTRAINT "fk_prs_scheme_benefit" FOREIGN KEY ("prs_prm_id", "prs_benefit") REFERENCES "sales"."promotion_scheme"("prm_id", "prm_benefit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_slab" ADD CONSTRAINT "fk_prs_free_item" FOREIGN KEY ("prs_free_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_scheme_slab" ADD CONSTRAINT "fk_prs_free_unit" FOREIGN KEY ("prs_free_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_company" FOREIGN KEY ("pru_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_branch" FOREIGN KEY ("pru_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_scheme" FOREIGN KEY ("pru_prm_id") REFERENCES "sales"."promotion_scheme"("prm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_cust" FOREIGN KEY ("pru_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_coupon" FOREIGN KEY ("pru_coupon_id") REFERENCES "sales"."loyalty_coupon"("lcp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_device" FOREIGN KEY ("pru_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_user" FOREIGN KEY ("pru_user_id") REFERENCES "user_master"("usr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."promotion_usage" ADD CONSTRAINT "fk_pru_reversal" FOREIGN KEY ("pru_reversal_of_id", "pru_reversal_of_acc_year") REFERENCES "sales"."promotion_usage"("pru_id", "pru_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_agents" ADD CONSTRAINT "fk_sa_company_id" FOREIGN KEY ("sa_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_agents" ADD CONSTRAINT "fk_sa_branch_id" FOREIGN KEY ("sa_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_agents" ADD CONSTRAINT "fk_sa_group_id" FOREIGN KEY ("sa_group_id") REFERENCES "sales"."sale_agent_groups"("sa_grp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill" ADD CONSTRAINT "fk_sb_cust" FOREIGN KEY ("sb_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill" ADD CONSTRAINT "fk_sb_pos_state" FOREIGN KEY ("sb_pos_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill" ADD CONSTRAINT "fk_sb_price_level" FOREIGN KEY ("sb_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill" ADD CONSTRAINT "fk_sb_driver" FOREIGN KEY ("sb_driver_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill" ADD CONSTRAINT "fk_sb_supervisor" FOREIGN KEY ("sb_supervisor_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill" ADD CONSTRAINT "fk_sb_vehicle" FOREIGN KEY ("sb_vehicle_id") REFERENCES "vehicle_master"("veh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill_item" ADD CONSTRAINT "fk_sbi_bill" FOREIGN KEY ("sbi_bill_id", "sbi_acc_year") REFERENCES "sales"."sale_bill"("sb_id", "sb_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill_item" ADD CONSTRAINT "fk_sbi_item" FOREIGN KEY ("sbi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill_item" ADD CONSTRAINT "fk_sbi_tax" FOREIGN KEY ("sbi_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill_item" ADD CONSTRAINT "fk_sbi_price_level" FOREIGN KEY ("sbi_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill_item" ADD CONSTRAINT "fk_sbi_item_unit" FOREIGN KEY ("sbi_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_bill_item" ADD CONSTRAINT "fk_sbi_lot" FOREIGN KEY ("sbi_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc" ADD CONSTRAINT "fk_sdc_cust" FOREIGN KEY ("sdc_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc" ADD CONSTRAINT "fk_sdc_pos_state" FOREIGN KEY ("sdc_pos_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc" ADD CONSTRAINT "fk_sdc_driver" FOREIGN KEY ("sdc_driver_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc" ADD CONSTRAINT "fk_sdc_supervisor" FOREIGN KEY ("sdc_supervisor_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc" ADD CONSTRAINT "fk_sdc_vehicle" FOREIGN KEY ("sdc_vehicle_id") REFERENCES "vehicle_master"("veh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_item" ADD CONSTRAINT "fk_sdi_dc" FOREIGN KEY ("sdi_dc_id", "sdi_acc_year") REFERENCES "sales"."sale_dc"("sdc_id", "sdc_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_item" ADD CONSTRAINT "fk_sdi_item" FOREIGN KEY ("sdi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_item" ADD CONSTRAINT "fk_sdi_item_unit" FOREIGN KEY ("sdi_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_item" ADD CONSTRAINT "fk_sdi_godown" FOREIGN KEY ("sdi_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_item" ADD CONSTRAINT "fk_sdi_lot" FOREIGN KEY ("sdi_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return" ADD CONSTRAINT "fk_sdr_dc" FOREIGN KEY ("sdr_dc_id", "sdr_dc_acc_year") REFERENCES "sales"."sale_dc"("sdc_id", "sdc_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return" ADD CONSTRAINT "fk_sdr_cust" FOREIGN KEY ("sdr_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return" ADD CONSTRAINT "fk_sdr_reason" FOREIGN KEY ("sdr_reason_id") REFERENCES "stock"."stock_reason_master"("srm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return" ADD CONSTRAINT "fk_sdr_driver" FOREIGN KEY ("sdr_driver_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return" ADD CONSTRAINT "fk_sdr_supervisor" FOREIGN KEY ("sdr_supervisor_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return" ADD CONSTRAINT "fk_sdr_vehicle" FOREIGN KEY ("sdr_vehicle_id") REFERENCES "vehicle_master"("veh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return_item" ADD CONSTRAINT "fk_sdri_return" FOREIGN KEY ("sdri_return_id", "sdri_acc_year") REFERENCES "sales"."sale_dc_return"("sdr_id", "sdr_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return_item" ADD CONSTRAINT "fk_sdri_dc_item" FOREIGN KEY ("sdri_dc_item_id", "sdri_dc_acc_year") REFERENCES "sales"."sale_dc_item"("sdi_id", "sdi_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return_item" ADD CONSTRAINT "fk_sdri_item" FOREIGN KEY ("sdri_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return_item" ADD CONSTRAINT "fk_sdri_item_unit" FOREIGN KEY ("sdri_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return_item" ADD CONSTRAINT "fk_sdri_godown" FOREIGN KEY ("sdri_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_dc_return_item" ADD CONSTRAINT "fk_sdri_lot" FOREIGN KEY ("sdri_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_freight_charges" ADD CONSTRAINT "fk_fr_company_id" FOREIGN KEY ("fr_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_freight_charges" ADD CONSTRAINT "fk_fr_branch_id" FOREIGN KEY ("fr_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_loading_charges" ADD CONSTRAINT "fk_ilc_comp_id" FOREIGN KEY ("ilc_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_loading_charges" ADD CONSTRAINT "fk_ilc_branch_id" FOREIGN KEY ("ilc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_cust" FOREIGN KEY ("so_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_pos_state" FOREIGN KEY ("so_pos_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_ship_state" FOREIGN KEY ("so_ship_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_price_level" FOREIGN KEY ("so_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_salesman_agent" FOREIGN KEY ("so_agent_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_advance_ledger" FOREIGN KEY ("so_advance_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order" ADD CONSTRAINT "fk_so_device" FOREIGN KEY ("so_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order_item" ADD CONSTRAINT "fk_soi_order" FOREIGN KEY ("soi_order_id", "soi_acc_year") REFERENCES "sales"."sale_order"("so_id", "so_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order_item" ADD CONSTRAINT "fk_soi_item" FOREIGN KEY ("soi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order_item" ADD CONSTRAINT "fk_soi_tax" FOREIGN KEY ("soi_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order_item" ADD CONSTRAINT "fk_soi_price_level" FOREIGN KEY ("soi_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_order_item" ADD CONSTRAINT "fk_soi_item_unit" FOREIGN KEY ("soi_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_parent" FOREIGN KEY ("sq_parent_quote_id", "sq_parent_acc_year") REFERENCES "sales"."sale_quotation"("sq_id", "sq_acc_year") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_cust" FOREIGN KEY ("sq_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_cust_area" FOREIGN KEY ("sq_cust_area_id") REFERENCES "sales"."area_master"("arm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_price_level" FOREIGN KEY ("sq_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_pos_state" FOREIGN KEY ("sq_pos_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_quote" FOREIGN KEY ("sqi_quote_id", "sqi_acc_year") REFERENCES "sales"."sale_quotation"("sq_id", "sq_acc_year") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_item" FOREIGN KEY ("sqi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_tax" FOREIGN KEY ("sqi_tax_id") REFERENCES "inventory"."tax_rate_master"("tax_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_price_level" FOREIGN KEY ("sqi_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_item_unit" FOREIGN KEY ("sqi_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_bill" FOREIGN KEY ("sr_bill_id", "sr_bill_acc_year") REFERENCES "sales"."sale_bill"("sb_id", "sb_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_cust" FOREIGN KEY ("sr_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_pos_state" FOREIGN KEY ("sr_pos_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_reason" FOREIGN KEY ("sr_reason_id") REFERENCES "stock"."stock_reason_master"("srm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_driver" FOREIGN KEY ("sr_driver_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_supervisor" FOREIGN KEY ("sr_supervisor_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return" ADD CONSTRAINT "fk_sr_vehicle" FOREIGN KEY ("sr_vehicle_id") REFERENCES "vehicle_master"("veh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return_item" ADD CONSTRAINT "fk_sri_return" FOREIGN KEY ("sri_return_id", "sri_acc_year") REFERENCES "sales"."sale_return"("sr_id", "sr_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return_item" ADD CONSTRAINT "fk_sri_bill_item" FOREIGN KEY ("sri_bill_item_id", "sri_bill_acc_year") REFERENCES "sales"."sale_bill_item"("sbi_id", "sbi_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return_item" ADD CONSTRAINT "fk_sri_item" FOREIGN KEY ("sri_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return_item" ADD CONSTRAINT "fk_sri_item_unit" FOREIGN KEY ("sri_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return_item" ADD CONSTRAINT "fk_sri_godown" FOREIGN KEY ("sri_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_return_item" ADD CONSTRAINT "fk_sri_lot" FOREIGN KEY ("sri_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ageing_slab" ADD CONSTRAINT "fk_sag_company" FOREIGN KEY ("sag_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_company" FOREIGN KEY ("sbl_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_branch" FOREIGN KEY ("sbl_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_godown" FOREIGN KEY ("sbl_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_item" FOREIGN KEY ("sbl_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_lot" FOREIGN KEY ("sbl_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_base_uom" FOREIGN KEY ("sbl_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_balance" ADD CONSTRAINT "fk_sbl_supplier" FOREIGN KEY ("sbl_supplier_id") REFERENCES "purchase"."suppliers"("sup_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_batch_detail" ADD CONSTRAINT "fk_sbd_company" FOREIGN KEY ("sbd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_batch_detail" ADD CONSTRAINT "fk_sbd_item" FOREIGN KEY ("sbd_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_batch_detail" ADD CONSTRAINT "fk_sbd_size" FOREIGN KEY ("sbd_size_id") REFERENCES "inventory"."item_size_master"("isz_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_batch_detail" ADD CONSTRAINT "fk_sbd_colour" FOREIGN KEY ("sbd_colour_id") REFERENCES "inventory"."item_colour_master"("icl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_cost_revaluation" ADD CONSTRAINT "fk_scr_branch" FOREIGN KEY ("scr_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_cost_revaluation" ADD CONSTRAINT "fk_scr_item" FOREIGN KEY ("scr_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_cost_revaluation" ADD CONSTRAINT "fk_scr_lot" FOREIGN KEY ("scr_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_demand_daily" ADD CONSTRAINT "fk_sdd_company" FOREIGN KEY ("sdd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_demand_daily" ADD CONSTRAINT "fk_sdd_branch" FOREIGN KEY ("sdd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_demand_daily" ADD CONSTRAINT "fk_sdd_item" FOREIGN KEY ("sdd_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_demand_daily" ADD CONSTRAINT "fk_sdd_base_uom" FOREIGN KEY ("sdd_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_forecast" ADD CONSTRAINT "fk_sfc_company" FOREIGN KEY ("sfc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_forecast" ADD CONSTRAINT "fk_sfc_branch" FOREIGN KEY ("sfc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_forecast" ADD CONSTRAINT "fk_sfc_item" FOREIGN KEY ("sfc_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_forecast" ADD CONSTRAINT "fk_sfc_base_uom" FOREIGN KEY ("sfc_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_forecast" ADD CONSTRAINT "fk_sfc_supplier" FOREIGN KEY ("sfc_preferred_supplier_id") REFERENCES "purchase"."suppliers"("sup_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_item_cost" ADD CONSTRAINT "fk_sic_company" FOREIGN KEY ("sic_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_item_cost" ADD CONSTRAINT "fk_sic_branch" FOREIGN KEY ("sic_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_item_cost" ADD CONSTRAINT "fk_sic_item" FOREIGN KEY ("sic_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_item_cost" ADD CONSTRAINT "fk_sic_base_uom" FOREIGN KEY ("sic_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_company" FOREIGN KEY ("sml_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_branch" FOREIGN KEY ("sml_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_godown" FOREIGN KEY ("sml_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_item" FOREIGN KEY ("sml_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_lot" FOREIGN KEY ("sml_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_uom" FOREIGN KEY ("sml_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_base_uom" FOREIGN KEY ("sml_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_ledger" ADD CONSTRAINT "fk_sml_reason" FOREIGN KEY ("sml_reason_id") REFERENCES "stock"."stock_reason_master"("srm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_lot" ADD CONSTRAINT "fk_slt_company" FOREIGN KEY ("slt_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_lot" ADD CONSTRAINT "fk_slt_item" FOREIGN KEY ("slt_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_lot" ADD CONSTRAINT "fk_slt_base_uom" FOREIGN KEY ("slt_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_lot" ADD CONSTRAINT "fk_slt_supplier" FOREIGN KEY ("slt_supplier_id") REFERENCES "purchase"."suppliers"("sup_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_lot" ADD CONSTRAINT "fk_slt_branch" FOREIGN KEY ("slt_first_inward_branch") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_movement_class" ADD CONSTRAINT "fk_smc_company" FOREIGN KEY ("smc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_movement_class" ADD CONSTRAINT "fk_smc_branch" FOREIGN KEY ("smc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_movement_class" ADD CONSTRAINT "fk_smc_item" FOREIGN KEY ("smc_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reason_master" ADD CONSTRAINT "fk_srm_company" FOREIGN KEY ("srm_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reason_master" ADD CONSTRAINT "fk_srm_gl_ledger" FOREIGN KEY ("srm_gl_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reorder_policy" ADD CONSTRAINT "fk_srp_company" FOREIGN KEY ("srp_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reorder_policy" ADD CONSTRAINT "fk_srp_branch" FOREIGN KEY ("srp_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reorder_policy" ADD CONSTRAINT "fk_srp_godown" FOREIGN KEY ("srp_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reorder_policy" ADD CONSTRAINT "fk_srp_item" FOREIGN KEY ("srp_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reorder_policy" ADD CONSTRAINT "fk_srp_uom" FOREIGN KEY ("srp_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reorder_policy" ADD CONSTRAINT "fk_srp_supplier" FOREIGN KEY ("srp_preferred_supplier_id") REFERENCES "purchase"."suppliers"("sup_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reservation" ADD CONSTRAINT "fk_srv_company" FOREIGN KEY ("srv_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reservation" ADD CONSTRAINT "fk_srv_branch" FOREIGN KEY ("srv_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reservation" ADD CONSTRAINT "fk_srv_godown" FOREIGN KEY ("srv_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reservation" ADD CONSTRAINT "fk_srv_item" FOREIGN KEY ("srv_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reservation" ADD CONSTRAINT "fk_srv_lot" FOREIGN KEY ("srv_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_reservation" ADD CONSTRAINT "fk_srv_base_uom" FOREIGN KEY ("srv_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_track_policy" ADD CONSTRAINT "fk_stp_company" FOREIGN KEY ("stp_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_track_policy" ADD CONSTRAINT "fk_stp_branch" FOREIGN KEY ("stp_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_track_policy" ADD CONSTRAINT "fk_stp_item" FOREIGN KEY ("stp_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock"."stock_track_policy" ADD CONSTRAINT "fk_stp_group" FOREIGN KEY ("stp_group_id") REFERENCES "inventory"."item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock"."stock_track_preset" ADD CONSTRAINT "fk_spt_company" FOREIGN KEY ("spt_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_company" FOREIGN KEY ("stt_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_from_branch" FOREIGN KEY ("stt_from_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_to_branch" FOREIGN KEY ("stt_to_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_from_godown" FOREIGN KEY ("stt_from_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_to_godown" FOREIGN KEY ("stt_to_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_item" FOREIGN KEY ("stt_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_lot" FOREIGN KEY ("stt_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_transit" ADD CONSTRAINT "fk_stt_base_uom" FOREIGN KEY ("stt_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_valuation_snap" ADD CONSTRAINT "fk_svs_company" FOREIGN KEY ("svs_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_valuation_snap" ADD CONSTRAINT "fk_svs_branch" FOREIGN KEY ("svs_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_valuation_snap" ADD CONSTRAINT "fk_svs_godown" FOREIGN KEY ("svs_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_valuation_snap" ADD CONSTRAINT "fk_svs_item" FOREIGN KEY ("svs_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_valuation_snap" ADD CONSTRAINT "fk_svs_lot" FOREIGN KEY ("svs_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_company" FOREIGN KEY ("svh_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_branch" FOREIGN KEY ("svh_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_to_branch" FOREIGN KEY ("svh_to_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_device" FOREIGN KEY ("svh_device_id") REFERENCES "fixed"."device_master"("dev_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_from_godown" FOREIGN KEY ("svh_from_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_to_godown" FOREIGN KEY ("svh_to_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_supplier" FOREIGN KEY ("svh_supplier_id") REFERENCES "purchase"."suppliers"("sup_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_reason" FOREIGN KEY ("svh_reason_id") REFERENCES "stock"."stock_reason_master"("srm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_driver" FOREIGN KEY ("svh_driver_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_supervisor" FOREIGN KEY ("svh_supervisor_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_unload_supervisor" FOREIGN KEY ("svh_unload_supervisor_id") REFERENCES "employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher" ADD CONSTRAINT "fk_svh_vehicle" FOREIGN KEY ("svh_vehicle_id") REFERENCES "vehicle_master"("veh_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_voucher" FOREIGN KEY ("svi_voucher_id", "svi_acc_year") REFERENCES "stock"."stock_voucher"("svh_id", "svh_acc_year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_item" FOREIGN KEY ("svi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_uom" FOREIGN KEY ("svi_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_base_uom" FOREIGN KEY ("svi_base_uom_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_godown" FOREIGN KEY ("svi_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_lot" FOREIGN KEY ("svi_lot_id") REFERENCES "stock"."stock_lot"("slt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_supplier" FOREIGN KEY ("svi_supplier_id") REFERENCES "purchase"."suppliers"("sup_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock"."stock_voucher_item" ADD CONSTRAINT "fk_svi_reason" FOREIGN KEY ("svi_reason_id") REFERENCES "stock"."stock_reason_master"("srm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

