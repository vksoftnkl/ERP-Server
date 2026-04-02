-- Add acc_vouchers checks and partial indexes.

CREATE INDEX IF NOT EXISTS "idx_acc_vouchers_voucher_id"
ON "accounts"."acc_vouchers" (
  "av_company_id",
  "av_branch_id",
  "av_acc_year",
  "av_voucher_id"
)
WHERE "av_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_vouchers_ledger_id"
ON "accounts"."acc_vouchers" (
  "av_company_id",
  "av_branch_id",
  "av_acc_year",
  "av_ledger_id"
)
WHERE "av_is_deleted" = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_header'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_header"
      FOREIGN KEY ("av_voucher_id")
      REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_voucher_type'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_voucher_type"
      FOREIGN KEY ("av_voucher_type_id")
      REFERENCES "accounts"."acc_voucher_types"("vchr_type_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_voucher_company'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_voucher_company"
      FOREIGN KEY ("av_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_voucher_branch'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_voucher_branch"
      FOREIGN KEY ("av_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_voucher_ledger'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_voucher_ledger"
      FOREIGN KEY ("av_ledger_id")
      REFERENCES "accounts"."acc_ledger_master"("led_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_voucher_opp_ledger'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_voucher_opp_ledger"
      FOREIGN KEY ("av_opp_ledger_id")
      REFERENCES "accounts"."acc_ledger_master"("led_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_vouchers'
      AND constraint_name = 'fk_acc_vouchers_voucher_user'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "fk_acc_vouchers_voucher_user"
      FOREIGN KEY ("av_user_id")
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
      AND t.relname = 'acc_vouchers'
      AND c.conname = 'chk_acc_vouchers_drcr'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "chk_acc_vouchers_drcr"
      CHECK (
        "av_dr_cr" IN (
          'DR'::"accounts"."DrCrType",
          'CR'::"accounts"."DrCrType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_vouchers'
      AND c.conname = 'chk_acc_vouchers_amount'
  ) THEN
    ALTER TABLE "accounts"."acc_vouchers"
      ADD CONSTRAINT "chk_acc_vouchers_amount"
      CHECK ("av_amount" >= 0);
  END IF;
END $$;
