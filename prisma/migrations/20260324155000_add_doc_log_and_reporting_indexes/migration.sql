-- Add acc_voucher_doc_api_log checks and document reporting/uniqueness indexes.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_doc_register_source"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_source_module",
  "gdr_source_doc_id"
)
WHERE "gdr_is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_doc_register_voucher"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_company_id",
  "gdr_branch_id",
  "gdr_acc_year",
  "gdr_voucher_type_id",
  "gdr_voucher_no"
)
WHERE "gdr_is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_doc_register_doc"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_company_id",
  "gdr_branch_id",
  "gdr_acc_year",
  "gdr_doc_type",
  "gdr_doc_no",
  "gdr_doc_date"
)
WHERE "gdr_is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_doc_einvoice_irn"
ON "accounts"."acc_voucher_doc_einvoice" ("gde_irn")
WHERE "gde_irn" IS NOT NULL
  AND "gde_is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_doc_ewaybill_no"
ON "accounts"."acc_voucher_doc_ewaybill" ("gdw_no")
WHERE "gdw_no" IS NOT NULL
  AND "gdw_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gdr_branch_voucher_date"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_company_id",
  "gdr_branch_id",
  "gdr_acc_year",
  "gdr_voucher_date"
)
WHERE "gdr_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gdr_branch_doc_date"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_company_id",
  "gdr_branch_id",
  "gdr_acc_year",
  "gdr_doc_date"
)
WHERE "gdr_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gdr_party"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_company_id",
  "gdr_branch_id",
  "gdr_party_id"
)
WHERE "gdr_is_deleted" = false
  AND "gdr_party_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_gdr_doc_class"
ON "accounts"."acc_voucher_doc_register" (
  "gdr_source_module",
  "gdr_tran_nature",
  "gdr_doc_flow",
  "gdr_doc_type"
)
WHERE "gdr_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gdr_doc_status"
ON "accounts"."acc_voucher_doc_register" ("gdr_doc_status")
WHERE "gdr_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gde_status"
ON "accounts"."acc_voucher_doc_einvoice" ("gde_status")
WHERE "gde_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gdw_status"
ON "accounts"."acc_voucher_doc_ewaybill" ("gdw_status")
WHERE "gdw_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_gdl_gdr_requested_on"
ON "accounts"."acc_voucher_doc_api_log" (
  "gdl_gdr_id",
  "gdl_requested_on" DESC
);

CREATE INDEX IF NOT EXISTS "idx_gdl_api_action_status"
ON "accounts"."acc_voucher_doc_api_log" (
  "gdl_api_name",
  "gdl_action_name",
  "gdl_status"
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_api_log'
      AND constraint_name = 'fk_gdl_gdr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_api_log"
      ADD CONSTRAINT "fk_gdl_gdr"
      FOREIGN KEY ("gdl_gdr_id")
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
      AND t.relname = 'acc_voucher_doc_api_log'
      AND c.conname = 'chk_gdl_api_name'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_api_log"
      ADD CONSTRAINT "chk_gdl_api_name"
      CHECK (
        "gdl_api_name" IN (
          'EINVOICE'::"accounts"."GdlApiName",
          'EWAYBILL'::"accounts"."GdlApiName",
          'GST'::"accounts"."GdlApiName",
          'OTHER'::"accounts"."GdlApiName"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_api_log'
      AND c.conname = 'chk_gdl_action_name'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_api_log"
      ADD CONSTRAINT "chk_gdl_action_name"
      CHECK (
        "gdl_action_name" IN (
          'GENERATE'::"accounts"."GdlActionName",
          'CANCEL'::"accounts"."GdlActionName",
          'GET_DETAILS'::"accounts"."GdlActionName",
          'UPDATE_VEHICLE'::"accounts"."GdlActionName",
          'EXTEND_VALIDITY'::"accounts"."GdlActionName",
          'PRINT'::"accounts"."GdlActionName",
          'SYNC'::"accounts"."GdlActionName",
          'OTHER'::"accounts"."GdlActionName"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_api_log'
      AND c.conname = 'chk_gdl_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_api_log"
      ADD CONSTRAINT "chk_gdl_status"
      CHECK (
        "gdl_status" IN (
          'SUCCESS'::"accounts"."GdlStatus",
          'FAILED'::"accounts"."GdlStatus",
          'PENDING'::"accounts"."GdlStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_api_log'
      AND c.conname = 'chk_gdl_attempt_no'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_api_log"
      ADD CONSTRAINT "chk_gdl_attempt_no"
      CHECK ("gdl_attempt_no" > 0);
  END IF;
END $$;
