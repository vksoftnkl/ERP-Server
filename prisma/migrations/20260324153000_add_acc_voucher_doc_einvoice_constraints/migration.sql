-- Add acc_voucher_doc_einvoice checks and ensure the expected FK/unique names exist.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_gde_gdr"
ON "accounts"."acc_voucher_doc_einvoice" ("gde_gdr_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_einvoice'
      AND constraint_name = 'uq_gde_gdr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_einvoice"
      ADD CONSTRAINT "uq_gde_gdr"
      UNIQUE USING INDEX "uq_gde_gdr";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_einvoice'
      AND constraint_name = 'fk_gde_gdr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_einvoice"
      ADD CONSTRAINT "fk_gde_gdr"
      FOREIGN KEY ("gde_gdr_id")
      REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_einvoice'
      AND c.conname = 'chk_gde_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_einvoice"
      ADD CONSTRAINT "chk_gde_status"
      CHECK (
        "gde_status" IN (
          'NA'::"accounts"."GdeStatus",
          'PENDING'::"accounts"."GdeStatus",
          'GENERATED'::"accounts"."GdeStatus",
          'FAILED'::"accounts"."GdeStatus",
          'CANCELED'::"accounts"."GdeStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_einvoice'
      AND c.conname = 'chk_gde_generated_irn'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_einvoice"
      ADD CONSTRAINT "chk_gde_generated_irn"
      CHECK (
        "gde_status" <> 'GENERATED'::"accounts"."GdeStatus"
        OR "gde_irn" IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_einvoice'
      AND c.conname = 'chk_gde_canceled_date'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_einvoice"
      ADD CONSTRAINT "chk_gde_canceled_date"
      CHECK (
        "gde_status" <> 'CANCELED'::"accounts"."GdeStatus"
        OR "gde_canceled_on" IS NOT NULL
      );
  END IF;
END $$;
