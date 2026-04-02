-- CreateEnum
CREATE TYPE "accounts"."VoucherBillRefType" AS ENUM ('NEW_REF', 'AGAINST_REF', 'ON_ACCOUNT', 'ADVANCE', 'AGAINST_ADVANCE');

-- CreateEnum
CREATE TYPE "accounts"."VoucherBillDrCr" AS ENUM ('DR', 'CR');

-- CreateEnum
CREATE TYPE "accounts"."VoucherBillTraType" AS ENUM ('R', 'P');

-- CreateEnum
CREATE TYPE "accounts"."ChequeTraType" AS ENUM ('R', 'P');

-- CreateEnum
CREATE TYPE "accounts"."ChequeInstrumentType" AS ENUM ('CHEQUE', 'PDC');

-- CreateEnum
CREATE TYPE "accounts"."ChequeStatus" AS ENUM ('PENDING', 'IN_HAND', 'ISSUED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "accounts"."GdlApiName" AS ENUM ('EINVOICE', 'EWAYBILL', 'GST', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdlActionName" AS ENUM ('GENERATE', 'CANCEL', 'GET_DETAILS', 'UPDATE_VEHICLE', 'EXTEND_VALIDITY', 'PRINT', 'SYNC', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts"."GdlStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

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
CREATE TYPE "accounts"."VoucherStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "accounts"."DeviceType" AS ENUM ('PC', 'WEB', 'MOBILE');

-- CreateEnum
CREATE TYPE "accounts"."TallyExportStatus" AS ENUM ('PENDING', 'EXPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "accounts"."MessageSendStatus" AS ENUM ('NA', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "accounts"."DrCrType" AS ENUM ('DR', 'CR');

-- CreateEnum
CREATE TYPE "accounts"."TenderTraType" AS ENUM ('R', 'P');

-- CreateEnum
CREATE TYPE "accounts"."VoucherCategory" AS ENUM ('ACCOUNTING', 'INVENTORY', 'BOTH');

-- CreateEnum
CREATE TYPE "accounts"."VoucherNature" AS ENUM ('SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'DEBIT_NOTE', 'CREDIT_NOTE', 'STOCK_JOURNAL');

-- CreateEnum
CREATE TYPE "accounts"."VoucherNumberingMode" AS ENUM ('AUTO', 'MANUAL', 'AUTO_MANUAL');

-- CreateEnum
CREATE TYPE "accounts"."VoucherResetFreq" AS ENUM ('NEVER', 'DAILY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_bills" (
    "avbd_id" UUID NOT NULL DEFAULT uuidv7(),
    "avbd_voucher_id" UUID NOT NULL,
    "avbd_voucher_line_id" UUID,
    "avbd_row_no" INTEGER NOT NULL,
    "avbd_acc_year" VARCHAR(9) NOT NULL,
    "avbd_company_id" UUID NOT NULL,
    "avbd_branch_id" UUID NOT NULL,
    "avbd_voucher_type_id" INTEGER NOT NULL,
    "avbd_voucher_no" BIGINT NOT NULL,
    "avbd_voucher_date" TIMESTAMPTZ(6) NOT NULL,
    "avbd_voucher_refno" VARCHAR(50),
    "avbd_party_id" UUID NOT NULL,
    "avbd_salesman_id" UUID,
    "avbd_user_id" UUID,
    "avbd_session_id" UUID,
    "avbd_ref_type" "accounts"."VoucherBillRefType" NOT NULL,
    "avbd_dr_cr" "accounts"."VoucherBillDrCr" NOT NULL,
    "avbd_tra_type" "accounts"."VoucherBillTraType" NOT NULL,
    "avbd_origin_voucher_id" UUID NOT NULL,
    "avbd_doc_date" DATE NOT NULL,
    "avbd_doc_refno" VARCHAR(50),
    "avbd_bill_date" DATE,
    "avbd_bill_refno" VARCHAR(100) NOT NULL,
    "avbd_due_date" DATE,
    "avbd_bill_narration" TEXT,
    "avbd_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avbd_alloc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avbd_disc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avbd_balance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avbd_profit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avbd_against_bill_refno" VARCHAR(100),
    "avbd_against_bill_date" DATE,
    "avbd_against_voucher_id" UUID,
    "avbd_against_voucher_line_id" UUID,
    "avbd_settlement_mode" VARCHAR(20),
    "avbd_settlement_ledger_id" UUID,
    "avbd_is_post_dated" BOOLEAN NOT NULL DEFAULT false,
    "avbd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "avbd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "avbd_sync_date" TIMESTAMPTZ(6),
    "avbd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avbd_created_by" UUID,
    "avbd_updated_on" TIMESTAMPTZ(6),
    "avbd_updated_by" UUID,

    CONSTRAINT "acc_voucher_bills_pkey" PRIMARY KEY ("avbd_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_cheques" (
    "chq_id" UUID NOT NULL DEFAULT uuidv7(),
    "chq_voucher_id" UUID NOT NULL,
    "chq_voucher_line_id" UUID,
    "chq_bill_id" UUID,
    "chq_acc_year" VARCHAR(9) NOT NULL,
    "chq_company_id" UUID NOT NULL,
    "chq_branch_id" UUID NOT NULL,
    "chq_voucher_type_id" INTEGER NOT NULL,
    "chq_voucher_no" BIGINT NOT NULL,
    "chq_voucher_date" DATE NOT NULL,
    "chq_voucher_refno" VARCHAR(50),
    "chq_party_id" UUID NOT NULL,
    "chq_salesman_id" UUID,
    "chq_user_id" UUID,
    "chq_session_id" UUID,
    "chq_tra_type" "accounts"."ChequeTraType" NOT NULL,
    "chq_instrument_type" "accounts"."ChequeInstrumentType" NOT NULL DEFAULT 'CHEQUE',
    "chq_is_post_dated" BOOLEAN NOT NULL DEFAULT false,
    "chq_is_account_payee" BOOLEAN NOT NULL DEFAULT false,
    "chq_cheque_no" VARCHAR(30) NOT NULL,
    "chq_cheque_date" DATE NOT NULL,
    "chq_cheque_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "chq_bank_ledger_id" UUID,
    "chq_bank_name" VARCHAR(500),
    "chq_bank_branch" VARCHAR(150),
    "chq_bank_ifsc" VARCHAR(20),
    "chq_payee_name" VARCHAR(500),
    "chq_drawer_name" VARCHAR(500),
    "chq_is_printed" BOOLEAN NOT NULL DEFAULT false,
    "chq_printed_on" TIMESTAMPTZ(6),
    "chq_received_on" DATE,
    "chq_issued_on" DATE,
    "chq_deposit_date" DATE,
    "chq_clear_date" DATE,
    "chq_bounce_date" DATE,
    "chq_return_date" DATE,
    "chq_cancelled_on" DATE,
    "chq_status" "accounts"."ChequeStatus" NOT NULL,
    "chq_notes" TEXT,
    "chq_log_text" TEXT,
    "chq_is_active" BOOLEAN NOT NULL DEFAULT true,
    "chq_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "chq_sync_date" TIMESTAMPTZ(6),
    "chq_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chq_created_by" UUID,
    "chq_updated_on" TIMESTAMPTZ(6),
    "chq_updated_by" UUID,

    CONSTRAINT "acc_voucher_cheques_pkey" PRIMARY KEY ("chq_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_doc_api_log" (
    "gdl_id" UUID NOT NULL DEFAULT uuidv7(),
    "gdl_gdr_id" UUID NOT NULL,
    "gdl_api_name" "accounts"."GdlApiName" NOT NULL,
    "gdl_action_name" "accounts"."GdlActionName" NOT NULL,
    "gdl_status" "accounts"."GdlStatus" NOT NULL,
    "gdl_attempt_no" INTEGER NOT NULL DEFAULT 1,
    "gdl_request_ref_no" VARCHAR(100),
    "gdl_external_ref_no" VARCHAR(100),
    "gdl_http_status" INTEGER,
    "gdl_error_code" VARCHAR(50),
    "gdl_error_message" VARCHAR(1000),
    "gdl_response_message" VARCHAR(1000),
    "gdl_request_payload" JSONB,
    "gdl_response_payload" JSONB,
    "gdl_requested_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdl_responded_on" TIMESTAMPTZ(6),
    "gdl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdl_created_by" UUID,

    CONSTRAINT "acc_voucher_doc_api_log_pkey" PRIMARY KEY ("gdl_id")
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
    "vtx_is_active" BOOLEAN NOT NULL DEFAULT true,
    "vtx_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "vtx_sync_date" TIMESTAMPTZ(6),
    "vtx_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vtx_created_by" UUID,
    "vtx_updated_on" TIMESTAMPTZ(6),
    "vtx_updated_by" UUID,

    CONSTRAINT "acc_voucher_doc_detail_pkey" PRIMARY KEY ("vtx_id")
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
    "gde_canceled_on" TIMESTAMPTZ(6),
    "gde_last_error_code" VARCHAR(50),
    "gde_last_message" VARCHAR(500),
    "gde_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gde_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gde_sync_date" TIMESTAMPTZ(6),
    "gde_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gde_created_by" UUID,
    "gde_updated_on" TIMESTAMPTZ(6),
    "gde_updated_by" UUID,

    CONSTRAINT "acc_voucher_doc_einvoice_pkey" PRIMARY KEY ("gde_id")
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
    "gdw_canceled_on" TIMESTAMPTZ(6),
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
    "gdw_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gdw_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gdw_sync_date" TIMESTAMPTZ(6),
    "gdw_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdw_created_by" UUID,
    "gdw_updated_on" TIMESTAMPTZ(6),
    "gdw_updated_by" UUID,

    CONSTRAINT "acc_voucher_doc_ewaybill_pkey" PRIMARY KEY ("gdw_id")
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
    "gdr_ship_name" VARCHAR(200),
    "gdr_ship_addr1" VARCHAR(200),
    "gdr_ship_addr2" VARCHAR(200),
    "gdr_ship_addr3" VARCHAR(200),
    "gdr_ship_location" VARCHAR(100),
    "gdr_ship_pin" VARCHAR(10),
    "gdr_ship_state_code" CHAR(2),
    "gdr_ship_state_name" VARCHAR(100),
    "gdr_ship_gstin" VARCHAR(15),
    "gdr_dispatch_name" VARCHAR(200),
    "gdr_dispatch_addr1" VARCHAR(200),
    "gdr_dispatch_addr2" VARCHAR(200),
    "gdr_dispatch_addr3" VARCHAR(200),
    "gdr_dispatch_location" VARCHAR(100),
    "gdr_dispatch_pin" VARCHAR(10),
    "gdr_dispatch_state_code" CHAR(2),
    "gdr_dispatch_state_name" VARCHAR(100),
    "gdr_dispatch_gstin" VARCHAR(15),
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
    "gdr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gdr_sync_date" TIMESTAMPTZ(6),
    "gdr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdr_created_by" UUID,
    "gdr_updated_on" TIMESTAMPTZ(6),
    "gdr_updated_by" UUID,

    CONSTRAINT "acc_voucher_doc_register_pkey" PRIMARY KEY ("gdr_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_header" (
    "avh_voucher_id" UUID NOT NULL DEFAULT uuidv7(),
    "avh_acc_year" VARCHAR(9) NOT NULL,
    "avh_company_id" UUID NOT NULL,
    "avh_branch_id" UUID NOT NULL,
    "avh_voucher_type_id" INTEGER NOT NULL,
    "avh_voucher_no" BIGINT NOT NULL,
    "avh_voucher_slno" BIGINT NOT NULL,
    "avh_user_refno" VARCHAR(50),
    "avh_voucher_date" TIMESTAMPTZ(6) NOT NULL,
    "avh_voucher_refno" VARCHAR(50) NOT NULL,
    "avh_bill_date" TIMESTAMPTZ(6),
    "avh_bill_refno" VARCHAR(100) NOT NULL,
    "avh_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_adjust_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avh_party_id" UUID NOT NULL,
    "avh_opposite_ledger_id" UUID,
    "avh_employee_id" UUID[],
    "avh_pay_notes" VARCHAR(100),
    "avh_remarks" TEXT,
    "avh_voucher_status" "accounts"."VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "avh_status_on" TIMESTAMPTZ(6),
    "avh_status_by" UUID,
    "avh_cancel_reason" VARCHAR(250),
    "avh_user_id" UUID NOT NULL,
    "avh_session_id" UUID,
    "avh_device_type" "accounts"."DeviceType" NOT NULL,
    "avh_device_id" UUID,
    "avh_counter_id" VARCHAR(20) NOT NULL,
    "avh_print_count" INTEGER NOT NULL DEFAULT 0,
    "avh_whatsapp_status" "accounts"."MessageSendStatus" NOT NULL DEFAULT 'NA',
    "avh_sms_status" "accounts"."MessageSendStatus" NOT NULL DEFAULT 'NA',
    "avh_tally_export_status" "accounts"."TallyExportStatus" NOT NULL DEFAULT 'PENDING',
    "avh_tally_exported_on" TIMESTAMPTZ(6),
    "avh_tally_guid" VARCHAR(100),
    "avh_tally_error_msg" TEXT,
    "avh_is_active" BOOLEAN NOT NULL DEFAULT true,
    "avh_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "avh_sync_date" TIMESTAMPTZ(6),
    "avh_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avh_created_by" UUID,
    "avh_updated_on" TIMESTAMPTZ(6),
    "avh_updated_by" UUID,

    CONSTRAINT "acc_voucher_header_pkey" PRIMARY KEY ("avh_voucher_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_vouchers" (
    "av_id" UUID NOT NULL DEFAULT uuidv7(),
    "av_voucher_id" UUID NOT NULL,
    "av_acc_year" VARCHAR(20) NOT NULL,
    "av_company_id" UUID NOT NULL,
    "av_branch_id" UUID NOT NULL,
    "av_voucher_type_id" INTEGER NOT NULL,
    "av_voucher_no" BIGINT NOT NULL,
    "av_row_no" INTEGER NOT NULL,
    "av_voucher_date" TIMESTAMPTZ(6) NOT NULL,
    "av_voucher_refno" VARCHAR(50),
    "av_bill_date" TIMESTAMPTZ(6),
    "av_bill_refno" VARCHAR(100),
    "av_dr_cr" "accounts"."DrCrType" NOT NULL,
    "av_ledger_id" UUID NOT NULL,
    "av_opp_ledger_id" UUID NOT NULL,
    "av_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "av_remarks" TEXT,
    "av_session_id" UUID,
    "av_user_id" UUID NOT NULL,
    "av_is_active" BOOLEAN NOT NULL DEFAULT true,
    "av_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "av_sync_date" TIMESTAMPTZ(6),
    "av_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "av_created_by" UUID,
    "av_updated_on" TIMESTAMPTZ(6),
    "av_updated_by" UUID,

    CONSTRAINT "acc_vouchers_pkey" PRIMARY KEY ("av_id")
);

-- CreateTable
CREATE TABLE "accounts"."acc_voucher_tenders" (
    "vtd_id" UUID NOT NULL DEFAULT uuidv7(),
    "vtd_voucher_id" UUID NOT NULL,
    "vtd_voucher_line_id" UUID,
    "vtd_row_no" INTEGER NOT NULL,
    "vtd_acc_year" VARCHAR(9) NOT NULL,
    "vtd_company_id" UUID NOT NULL,
    "vtd_branch_id" UUID NOT NULL,
    "vtd_voucher_type_id" INTEGER NOT NULL,
    "vtd_voucher_no" BIGINT NOT NULL,
    "vtd_voucher_date" DATE NOT NULL,
    "vtd_voucher_refno" VARCHAR(50) NOT NULL,
    "vtd_voucher_ledger_id" UUID NOT NULL,
    "vtd_session_id" UUID,
    "vtd_user_id" UUID NOT NULL,
    "vtd_counter_id" VARCHAR(30),
    "vtd_tra_type" "accounts"."TenderTraType" NOT NULL,
    "vtd_tender_type_id" BIGINT NOT NULL,
    "vtd_tender_id" UUID NOT NULL,
    "vtd_tender_ledger_id" UUID NOT NULL,
    "vtd_tender_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "vtd_surcharge_percent" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "vtd_surcharge_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "vtd_total_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "vtd_refund_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "vtd_is_change_return" BOOLEAN NOT NULL DEFAULT false,
    "vtd_card_bank" VARCHAR(150),
    "vtd_card_no_masked" VARCHAR(30),
    "vtd_card_expiry" DATE,
    "vtd_card_ref_no" VARCHAR(100),
    "vtd_auth_code" VARCHAR(100),
    "vtd_rrn_no" VARCHAR(100),
    "vtd_upi_id" VARCHAR(100),
    "vtd_terminal_id" VARCHAR(50),
    "vtd_chq_bank" VARCHAR(150),
    "vtd_chq_no" VARCHAR(30),
    "vtd_chq_date" DATE,
    "vtd_chq_payee_name" VARCHAR(150),
    "vtd_chq_print_status" VARCHAR(1),
    "vtd_chq_account_payee" BOOLEAN NOT NULL DEFAULT false,
    "vtd_is_approved" BOOLEAN NOT NULL DEFAULT false,
    "vtd_approved_on" TIMESTAMPTZ(6),
    "vtd_approved_by" UUID,
    "vtd_notes" TEXT,
    "vtd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "vtd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "vtd_sync_date" TIMESTAMPTZ(6),
    "vtd_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vtd_created_by" UUID,
    "vtd_updated_on" TIMESTAMPTZ(6),
    "vtd_updated_by" UUID,

    CONSTRAINT "acc_voucher_tenders_pkey" PRIMARY KEY ("vtd_id")
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
    "vchr_sync_date" TIMESTAMPTZ(6),
    "vchr_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vchr_created_by" VARCHAR(100),
    "vchr_updated_on" TIMESTAMPTZ(6),
    "vchr_updated_by" VARCHAR(100),

    CONSTRAINT "acc_voucher_types_pkey" PRIMARY KEY ("vchr_type_id")
);

-- CreateIndex
CREATE INDEX "idx_gdl_gdr_requested_on" ON "accounts"."acc_voucher_doc_api_log"("gdl_gdr_id", "gdl_requested_on" DESC);

-- CreateIndex
CREATE INDEX "idx_gdl_api_action_status" ON "accounts"."acc_voucher_doc_api_log"("gdl_api_name", "gdl_action_name", "gdl_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gde_gdr" ON "accounts"."acc_voucher_doc_einvoice"("gde_gdr_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gdw_gdr" ON "accounts"."acc_voucher_doc_ewaybill"("gdw_gdr_id");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_header_voucher_no" ON "accounts"."acc_voucher_header"("avh_company_id", "avh_branch_id", "avh_acc_year", "avh_voucher_no");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_header_voucher_slno" ON "accounts"."acc_voucher_header"("avh_company_id", "avh_branch_id", "avh_acc_year", "avh_voucher_type_id", "avh_voucher_slno");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_header_branch_date" ON "accounts"."acc_voucher_header"("avh_company_id", "avh_branch_id", "avh_acc_year", "avh_voucher_date");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_header_status" ON "accounts"."acc_voucher_header"("avh_company_id", "avh_branch_id", "avh_acc_year", "avh_voucher_status");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_header_bill_refno" ON "accounts"."acc_voucher_header"("avh_branch_id", "avh_acc_year", "avh_bill_refno");

-- CreateIndex
CREATE UNIQUE INDEX "uq_acc_voucher_header_voucher_id" ON "accounts"."acc_voucher_header"("avh_company_id", "avh_branch_id", "avh_acc_year", "avh_voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_acc_voucher_header_voucher_refno" ON "accounts"."acc_voucher_header"("avh_company_id", "avh_branch_id", "avh_acc_year", "avh_voucher_type_id", "avh_voucher_refno");

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

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_bills" ADD CONSTRAINT "fk_acc_voucher_bills_header" FOREIGN KEY ("avbd_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_bills" ADD CONSTRAINT "fk_acc_voucher_bills_voucher_type" FOREIGN KEY ("avbd_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_bills" ADD CONSTRAINT "fk_acc_voucher_bills_company" FOREIGN KEY ("avbd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_bills" ADD CONSTRAINT "fk_acc_voucher_bills_branch" FOREIGN KEY ("avbd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_bills" ADD CONSTRAINT "fk_acc_voucher_bills_party" FOREIGN KEY ("avbd_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_bills" ADD CONSTRAINT "fk_acc_voucher_bills_against_header" FOREIGN KEY ("avbd_against_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_cheques" ADD CONSTRAINT "fk_acc_cheques_voucher_header" FOREIGN KEY ("chq_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_cheques" ADD CONSTRAINT "fk_acc_cheques_voucher_type" FOREIGN KEY ("chq_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_cheques" ADD CONSTRAINT "fk_acc_cheques_voucher_company" FOREIGN KEY ("chq_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_cheques" ADD CONSTRAINT "fk_acc_cheques_voucher_branch" FOREIGN KEY ("chq_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_api_log" ADD CONSTRAINT "fk_gdl_gdr" FOREIGN KEY ("gdl_gdr_id") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_company" FOREIGN KEY ("vtx_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_branch" FOREIGN KEY ("vtx_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_gdr" FOREIGN KEY ("vtx_gdr_id") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_detail" ADD CONSTRAINT "fk_acc_voucher_doc_detail_header" FOREIGN KEY ("vtx_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_einvoice" ADD CONSTRAINT "fk_gde_gdr" FOREIGN KEY ("gde_gdr_id") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_ewaybill" ADD CONSTRAINT "fk_gdw_gdr" FOREIGN KEY ("gdw_gdr_id") REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_company" FOREIGN KEY ("gdr_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_branch" FOREIGN KEY ("gdr_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_party" FOREIGN KEY ("gdr_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_header" FOREIGN KEY ("gdr_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_doc_register" ADD CONSTRAINT "fk_gdr_voucher_type" FOREIGN KEY ("gdr_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_acc_voucher_header_voucher_type" FOREIGN KEY ("avh_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_acc_voucher_header_voucher_company" FOREIGN KEY ("avh_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_acc_voucher_header_voucher_branch" FOREIGN KEY ("avh_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_acc_voucher_header_voucher_party" FOREIGN KEY ("avh_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_acc_voucher_header_voucher_user" FOREIGN KEY ("avh_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_header" FOREIGN KEY ("av_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_type" FOREIGN KEY ("av_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_company" FOREIGN KEY ("av_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_branch" FOREIGN KEY ("av_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_ledger" FOREIGN KEY ("av_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_opp_ledger" FOREIGN KEY ("av_opp_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_user" FOREIGN KEY ("av_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_company" FOREIGN KEY ("vtd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_branch" FOREIGN KEY ("vtd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_type" FOREIGN KEY ("vtd_tender_type_id") REFERENCES "accounts"."tender_type"("acc_ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_tender" FOREIGN KEY ("vtd_tender_id") REFERENCES "accounts"."account_tender_master"("acc_tnd_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_tender_ledger" FOREIGN KEY ("vtd_tender_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_voucher_ledger" FOREIGN KEY ("vtd_voucher_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_header" FOREIGN KEY ("vtd_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_tenders" ADD CONSTRAINT "fk_acc_voucher_tenders_voucher_type" FOREIGN KEY ("vtd_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
