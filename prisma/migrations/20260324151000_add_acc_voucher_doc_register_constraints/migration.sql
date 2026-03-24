-- Add acc_voucher_doc_register checks and ensure the expected FK names exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_register'
      AND constraint_name = 'fk_gdr_voucher_company'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "fk_gdr_voucher_company"
      FOREIGN KEY ("gdr_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_register'
      AND constraint_name = 'fk_gdr_voucher_branch'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "fk_gdr_voucher_branch"
      FOREIGN KEY ("gdr_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_register'
      AND constraint_name = 'fk_gdr_voucher_party'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "fk_gdr_voucher_party"
      FOREIGN KEY ("gdr_party_id")
      REFERENCES "accounts"."acc_ledger_master"("led_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_register'
      AND constraint_name = 'fk_gdr_voucher_header'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "fk_gdr_voucher_header"
      FOREIGN KEY ("gdr_voucher_id")
      REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_register'
      AND constraint_name = 'fk_gdr_voucher_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "fk_gdr_voucher_type"
      FOREIGN KEY ("gdr_voucher_type_id")
      REFERENCES "accounts"."acc_voucher_types"("vchr_type_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_doc_sign'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_doc_sign"
      CHECK ("gdr_doc_sign" IN (1, -1));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_source_module'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_source_module"
      CHECK (
        "gdr_source_module" IN (
          'SALES'::"accounts"."GdrSourceModule",
          'PURCHASE'::"accounts"."GdrSourceModule",
          'INVENTORY'::"accounts"."GdrSourceModule",
          'ACCOUNTS'::"accounts"."GdrSourceModule",
          'SERVICE'::"accounts"."GdrSourceModule",
          'JOBWORK'::"accounts"."GdrSourceModule",
          'POS'::"accounts"."GdrSourceModule",
          'OTHER'::"accounts"."GdrSourceModule"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_tran_nature'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_tran_nature"
      CHECK (
        "gdr_tran_nature" IN (
          'SALE'::"accounts"."GdrTranNature",
          'SALES_RETURN'::"accounts"."GdrTranNature",
          'PURCHASE'::"accounts"."GdrTranNature",
          'PURCHASE_RETURN'::"accounts"."GdrTranNature",
          'STOCK_TRANSFER'::"accounts"."GdrTranNature",
          'DELIVERY_CHALLAN'::"accounts"."GdrTranNature",
          'JOBWORK_SEND'::"accounts"."GdrTranNature",
          'JOBWORK_RECEIVE'::"accounts"."GdrTranNature",
          'DEBIT_NOTE'::"accounts"."GdrTranNature",
          'CREDIT_NOTE'::"accounts"."GdrTranNature",
          'EXPORT'::"accounts"."GdrTranNature",
          'IMPORT'::"accounts"."GdrTranNature",
          'ADVANCE'::"accounts"."GdrTranNature",
          'ADV_ADJUSTMENT'::"accounts"."GdrTranNature",
          'ADJUSTMENT'::"accounts"."GdrTranNature",
          'OTHER'::"accounts"."GdrTranNature"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_doc_flow'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_doc_flow"
      CHECK (
        "gdr_doc_flow" IN (
          'OUTWARD'::"accounts"."GdrDocFlow",
          'INWARD'::"accounts"."GdrDocFlow",
          'INTERNAL'::"accounts"."GdrDocFlow"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_doc_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_doc_type"
      CHECK (
        "gdr_doc_type" IN (
          'INVOICE'::"accounts"."GdrDocType",
          'CREDIT_NOTE'::"accounts"."GdrDocType",
          'DEBIT_NOTE'::"accounts"."GdrDocType",
          'BILL_OF_SUPPLY'::"accounts"."GdrDocType",
          'DELIVERY_CHALLAN'::"accounts"."GdrDocType",
          'CHALLAN'::"accounts"."GdrDocType",
          'ADVANCE'::"accounts"."GdrDocType",
          'ADV_ADJUSTMENT'::"accounts"."GdrDocType",
          'EXPORT_DOC'::"accounts"."GdrDocType",
          'IMPORT_DOC'::"accounts"."GdrDocType",
          'OTHER'::"accounts"."GdrDocType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_doc_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_doc_status"
      CHECK (
        "gdr_doc_status" IN (
          'DRAFT'::"accounts"."GdrDocStatus",
          'POSTED'::"accounts"."GdrDocStatus",
          'CANCELED'::"accounts"."GdrDocStatus",
          'ARCHIVED'::"accounts"."GdrDocStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_supply_class'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_supply_class"
      CHECK (
        "gdr_supply_class" IS NULL
        OR "gdr_supply_class" IN (
          'GOODS'::"accounts"."GdrSupplyClass",
          'SERVICES'::"accounts"."GdrSupplyClass",
          'MIXED'::"accounts"."GdrSupplyClass"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_taxability'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_taxability"
      CHECK (
        "gdr_taxability" IN (
          'TAXABLE'::"accounts"."GdrTaxability",
          'EXEMPT'::"accounts"."GdrTaxability",
          'NIL_RATED'::"accounts"."GdrTaxability",
          'NON_GST'::"accounts"."GdrTaxability",
          'MIXED'::"accounts"."GdrTaxability"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_supply_nature'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_supply_nature"
      CHECK (
        "gdr_supply_nature" IS NULL
        OR "gdr_supply_nature" IN (
          'INTRA_STATE'::"accounts"."GdrSupplyNature",
          'INTER_STATE'::"accounts"."GdrSupplyNature",
          'IMPORT'::"accounts"."GdrSupplyNature",
          'EXPORT'::"accounts"."GdrSupplyNature",
          'SEZ'::"accounts"."GdrSupplyNature",
          'OTHER'::"accounts"."GdrSupplyNature"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_party_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_party_type"
      CHECK (
        "gdr_party_type" IN (
          'CUSTOMER'::"accounts"."GdrPartyType",
          'VENDOR'::"accounts"."GdrPartyType",
          'BRANCH'::"accounts"."GdrPartyType",
          'JOBWORKER'::"accounts"."GdrPartyType",
          'TRANSPORTER'::"accounts"."GdrPartyType",
          'OTHER'::"accounts"."GdrPartyType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_amounts'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_amounts"
      CHECK (
        "gdr_gross_value" >= 0
        AND "gdr_discount_value" >= 0
        AND "gdr_taxable_value" >= 0
        AND "gdr_cgst_value" >= 0
        AND "gdr_sgst_value" >= 0
        AND "gdr_igst_value" >= 0
        AND "gdr_cess_value" >= 0
        AND "gdr_state_cess_value" >= 0
        AND "gdr_tcs_value" >= 0
        AND "gdr_other_charge" >= 0
        AND "gdr_bill_value" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_party_gstin_len'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_party_gstin_len"
      CHECK ("gdr_party_gstin" IS NULL OR char_length("gdr_party_gstin") = 15);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_party_ecom_gstin_len'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_party_ecom_gstin_len"
      CHECK ("gdr_party_ecom_gstin" IS NULL OR char_length("gdr_party_ecom_gstin") = 15);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_ship_gstin_len'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_ship_gstin_len"
      CHECK ("gdr_ship_gstin" IS NULL OR char_length("gdr_ship_gstin") = 15);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_dispatch_gstin_len'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_dispatch_gstin_len"
      CHECK ("gdr_dispatch_gstin" IS NULL OR char_length("gdr_dispatch_gstin") = 15);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_doc_cancel_date'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_doc_cancel_date"
      CHECK (
        "gdr_doc_status" <> 'CANCELED'::"accounts"."GdrDocStatus"
        OR "gdr_doc_canceled_on" IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_note_pair'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_note_pair"
      CHECK (
        ("gdr_doc_note_no" IS NULL AND "gdr_doc_note_date" IS NULL)
        OR ("gdr_doc_note_no" IS NOT NULL AND "gdr_doc_note_date" IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_register'
      AND c.conname = 'chk_gdr_bill_value_non_negative'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_register"
      ADD CONSTRAINT "chk_gdr_bill_value_non_negative"
      CHECK ("gdr_bill_value" >= 0);
  END IF;
END $$;
