-- Add acc_voucher_header checks and align the bill-refno index to the requested partial shape.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_header_voucher_id"
ON "accounts"."acc_voucher_header" (
  "avh_company_id",
  "avh_branch_id",
  "avh_acc_year",
  "avh_voucher_id"
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_header_voucher_refno"
ON "accounts"."acc_voucher_header" (
  "avh_company_id",
  "avh_branch_id",
  "avh_acc_year",
  "avh_voucher_type_id",
  "avh_voucher_refno"
);

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_header_voucher_no"
ON "accounts"."acc_voucher_header" (
  "avh_company_id",
  "avh_branch_id",
  "avh_acc_year",
  "avh_voucher_no"
);

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_header_voucher_slno"
ON "accounts"."acc_voucher_header" (
  "avh_company_id",
  "avh_branch_id",
  "avh_acc_year",
  "avh_voucher_type_id",
  "avh_voucher_slno"
);

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_header_branch_date"
ON "accounts"."acc_voucher_header" (
  "avh_company_id",
  "avh_branch_id",
  "avh_acc_year",
  "avh_voucher_date"
);

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_header_status"
ON "accounts"."acc_voucher_header" (
  "avh_company_id",
  "avh_branch_id",
  "avh_acc_year",
  "avh_voucher_status"
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    JOIN pg_index ix ON ix.indexrelid = i.oid
    WHERE n.nspname = 'accounts'
      AND i.relname = 'idx_acc_voucher_header_bill_refno'
      AND ix.indpred IS NULL
  ) THEN
    DROP INDEX "accounts"."idx_acc_voucher_header_bill_refno";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_header_bill_refno"
ON "accounts"."acc_voucher_header" (
  "avh_branch_id",
  "avh_acc_year",
  "avh_bill_refno"
)
WHERE "avh_is_deleted" = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_header'
      AND constraint_name = 'fk_acc_voucher_header_voucher_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "fk_acc_voucher_header_voucher_type"
      FOREIGN KEY ("avh_voucher_type_id")
      REFERENCES "accounts"."acc_voucher_types"("vchr_type_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_header'
      AND constraint_name = 'fk_acc_voucher_header_voucher_company'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "fk_acc_voucher_header_voucher_company"
      FOREIGN KEY ("avh_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_header'
      AND constraint_name = 'fk_acc_voucher_header_voucher_branch'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "fk_acc_voucher_header_voucher_branch"
      FOREIGN KEY ("avh_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_header'
      AND constraint_name = 'fk_acc_voucher_header_voucher_party'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "fk_acc_voucher_header_voucher_party"
      FOREIGN KEY ("avh_party_id")
      REFERENCES "accounts"."acc_ledger_master"("led_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_header'
      AND constraint_name = 'fk_acc_voucher_header_voucher_user'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "fk_acc_voucher_header_voucher_user"
      FOREIGN KEY ("avh_user_id")
      REFERENCES "public"."users"("user_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_status"
      CHECK (
        "avh_voucher_status" IN (
          'DRAFT'::"accounts"."VoucherStatus",
          'APPROVED'::"accounts"."VoucherStatus",
          'POSTED'::"accounts"."VoucherStatus",
          'CANCELLED'::"accounts"."VoucherStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_device_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_device_type"
      CHECK (
        "avh_device_type" IN (
          'PC'::"accounts"."DeviceType",
          'WEB'::"accounts"."DeviceType",
          'MOBILE'::"accounts"."DeviceType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_tally_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_tally_status"
      CHECK (
        "avh_tally_export_status" IN (
          'PENDING'::"accounts"."TallyExportStatus",
          'EXPORTED'::"accounts"."TallyExportStatus",
          'FAILED'::"accounts"."TallyExportStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_whatsapp_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_whatsapp_status"
      CHECK (
        "avh_whatsapp_status" IN (
          'NA'::"accounts"."MessageSendStatus",
          'PENDING'::"accounts"."MessageSendStatus",
          'SENT'::"accounts"."MessageSendStatus",
          'FAILED'::"accounts"."MessageSendStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_sms_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_sms_status"
      CHECK (
        "avh_sms_status" IN (
          'NA'::"accounts"."MessageSendStatus",
          'PENDING'::"accounts"."MessageSendStatus",
          'SENT'::"accounts"."MessageSendStatus",
          'FAILED'::"accounts"."MessageSendStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_amounts'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_amounts"
      CHECK (
        "avh_bill_amount" >= 0
        AND "avh_adjust_amount" >= 0
        AND "avh_total_debit" >= 0
        AND "avh_total_credit" >= 0
        AND "avh_print_count" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_header'
      AND c.conname = 'chk_acc_voucher_header_tally_export_consistency'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_header"
      ADD CONSTRAINT "chk_acc_voucher_header_tally_export_consistency"
      CHECK (
        "avh_tally_export_status" <> 'EXPORTED'::"accounts"."TallyExportStatus"
        OR "avh_tally_exported_on" IS NOT NULL
      );
  END IF;
END $$;
