-- Add acc_voucher_cheques checks and indexes.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_cheques_branch_cheque"
ON "accounts"."acc_voucher_cheques" (
  "chq_company_id",
  "chq_branch_id",
  "chq_cheque_no",
  "chq_cheque_date",
  "chq_cheque_amount"
)
WHERE "chq_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_cheques_party"
ON "accounts"."acc_voucher_cheques" (
  "chq_company_id",
  "chq_branch_id",
  "chq_party_id"
);

CREATE INDEX IF NOT EXISTS "idx_acc_cheques_status"
ON "accounts"."acc_voucher_cheques" (
  "chq_company_id",
  "chq_branch_id",
  "chq_status"
);

CREATE INDEX IF NOT EXISTS "idx_acc_cheques_dates"
ON "accounts"."acc_voucher_cheques" (
  "chq_company_id",
  "chq_branch_id",
  "chq_cheque_date",
  "chq_deposit_date",
  "chq_clear_date"
);

CREATE INDEX IF NOT EXISTS "idx_acc_cheques_voucher"
ON "accounts"."acc_voucher_cheques" (
  "chq_voucher_id"
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_cheques'
      AND constraint_name = 'fk_acc_cheques_voucher_company'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "fk_acc_cheques_voucher_company"
      FOREIGN KEY ("chq_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_cheques'
      AND constraint_name = 'fk_acc_cheques_voucher_branch'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "fk_acc_cheques_voucher_branch"
      FOREIGN KEY ("chq_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_cheques'
      AND constraint_name = 'fk_acc_cheques_voucher_header'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "fk_acc_cheques_voucher_header"
      FOREIGN KEY ("chq_voucher_id")
      REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_cheques'
      AND constraint_name = 'fk_acc_cheques_voucher_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "fk_acc_cheques_voucher_type"
      FOREIGN KEY ("chq_voucher_type_id")
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
      AND t.relname = 'acc_voucher_cheques'
      AND c.conname = 'chk_acc_cheques_tra_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "chk_acc_cheques_tra_type"
      CHECK (
        "chq_tra_type" IN (
          'R'::"accounts"."ChequeTraType",
          'P'::"accounts"."ChequeTraType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_cheques'
      AND c.conname = 'chk_acc_cheques_instrument_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "chk_acc_cheques_instrument_type"
      CHECK (
        "chq_instrument_type" IN (
          'CHEQUE'::"accounts"."ChequeInstrumentType",
          'PDC'::"accounts"."ChequeInstrumentType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_cheques'
      AND c.conname = 'chk_acc_cheques_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "chk_acc_cheques_status"
      CHECK (
        "chq_status" IN (
          'PENDING'::"accounts"."ChequeStatus",
          'IN_HAND'::"accounts"."ChequeStatus",
          'ISSUED'::"accounts"."ChequeStatus",
          'DEPOSITED'::"accounts"."ChequeStatus",
          'CLEARED'::"accounts"."ChequeStatus",
          'BOUNCED'::"accounts"."ChequeStatus",
          'RETURNED'::"accounts"."ChequeStatus",
          'CANCELLED'::"accounts"."ChequeStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_cheques'
      AND c.conname = 'chk_acc_cheques_amount'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_cheques"
      ADD CONSTRAINT "chk_acc_cheques_amount"
      CHECK ("chq_cheque_amount" >= 0);
  END IF;
END $$;
