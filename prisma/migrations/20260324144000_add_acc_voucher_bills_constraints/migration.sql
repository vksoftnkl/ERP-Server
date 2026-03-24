-- Add acc_voucher_bills checks and partial indexes.

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_bills_voucher"
ON "accounts"."acc_voucher_bills" (
  "avbd_company_id",
  "avbd_branch_id",
  "avbd_acc_year",
  "avbd_voucher_id"
)
WHERE "avbd_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_bills_party"
ON "accounts"."acc_voucher_bills" (
  "avbd_company_id",
  "avbd_branch_id",
  "avbd_acc_year",
  "avbd_party_id"
)
WHERE "avbd_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_bills_salesman"
ON "accounts"."acc_voucher_bills" (
  "avbd_company_id",
  "avbd_branch_id",
  "avbd_acc_year",
  "avbd_salesman_id"
)
WHERE "avbd_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_bills_origin"
ON "accounts"."acc_voucher_bills" (
  "avbd_company_id",
  "avbd_branch_id",
  "avbd_acc_year",
  "avbd_origin_voucher_id"
)
WHERE "avbd_is_deleted" = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND constraint_name = 'fk_acc_voucher_bills_company'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "fk_acc_voucher_bills_company"
      FOREIGN KEY ("avbd_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND constraint_name = 'fk_acc_voucher_bills_branch'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "fk_acc_voucher_bills_branch"
      FOREIGN KEY ("avbd_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND constraint_name = 'fk_acc_voucher_bills_party'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "fk_acc_voucher_bills_party"
      FOREIGN KEY ("avbd_party_id")
      REFERENCES "accounts"."acc_ledger_master"("led_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND constraint_name = 'fk_acc_voucher_bills_header'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "fk_acc_voucher_bills_header"
      FOREIGN KEY ("avbd_voucher_id")
      REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND constraint_name = 'fk_acc_voucher_bills_voucher_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "fk_acc_voucher_bills_voucher_type"
      FOREIGN KEY ("avbd_voucher_type_id")
      REFERENCES "accounts"."acc_voucher_types"("vchr_type_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND constraint_name = 'fk_acc_voucher_bills_against_header'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "fk_acc_voucher_bills_against_header"
      FOREIGN KEY ("avbd_against_voucher_id")
      REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_bills'
      AND c.conname = 'chk_acc_voucher_bills_ref_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "chk_acc_voucher_bills_ref_type"
      CHECK (
        "avbd_ref_type" IN (
          'NEW_REF'::"accounts"."VoucherBillRefType",
          'AGAINST_REF'::"accounts"."VoucherBillRefType",
          'ON_ACCOUNT'::"accounts"."VoucherBillRefType",
          'ADVANCE'::"accounts"."VoucherBillRefType",
          'AGAINST_ADVANCE'::"accounts"."VoucherBillRefType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_bills'
      AND c.conname = 'chk_acc_voucher_bills_dr_cr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "chk_acc_voucher_bills_dr_cr"
      CHECK (
        "avbd_dr_cr" IN (
          'DR'::"accounts"."VoucherBillDrCr",
          'CR'::"accounts"."VoucherBillDrCr"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_bills'
      AND c.conname = 'chk_acc_voucher_bills_tra_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "chk_acc_voucher_bills_tra_type"
      CHECK (
        "avbd_tra_type" IN (
          'R'::"accounts"."VoucherBillTraType",
          'P'::"accounts"."VoucherBillTraType"
        )
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_bills'
      AND column_name = 'avbd_pay_mode'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_bills'
      AND c.conname = 'chk_acc_voucher_bills_pay_mode'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "chk_acc_voucher_bills_pay_mode"
      CHECK (
        "avbd_pay_mode" IS NULL
        OR "avbd_pay_mode" IN ('CASH', 'BANK', 'UPI', 'CARD', 'CHEQUE', 'WALLET')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_bills'
      AND c.conname = 'chk_acc_voucher_bills_amounts'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_bills"
      ADD CONSTRAINT "chk_acc_voucher_bills_amounts"
      CHECK (
        "avbd_bill_amount" >= 0
        AND "avbd_alloc_amount" >= 0
        AND "avbd_disc_amount" >= 0
        AND "avbd_balance_amount" >= 0
      );
  END IF;
END $$;
