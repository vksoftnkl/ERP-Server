-- Add acc_voucher_tenders checks and partial indexes.

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_tenders_voucher"
ON "accounts"."acc_voucher_tenders" (
  "vtd_company_id",
  "vtd_branch_id",
  "vtd_acc_year",
  "vtd_voucher_id"
)
WHERE "vtd_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_tenders_type"
ON "accounts"."acc_voucher_tenders" (
  "vtd_company_id",
  "vtd_branch_id",
  "vtd_acc_year",
  "vtd_tender_type_id"
)
WHERE "vtd_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_tenders_tender"
ON "accounts"."acc_voucher_tenders" (
  "vtd_company_id",
  "vtd_branch_id",
  "vtd_acc_year",
  "vtd_tender_id"
)
WHERE "vtd_is_deleted" = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_tenders'
      AND c.conname = 'chk_acc_voucher_tenders_tra_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_tenders"
      ADD CONSTRAINT "chk_acc_voucher_tenders_tra_type"
      CHECK (
        "vtd_tra_type" IN (
          'R'::"accounts"."TenderTraType",
          'P'::"accounts"."TenderTraType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_tenders'
      AND c.conname = 'chk_acc_voucher_tenders_amounts'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_tenders"
      ADD CONSTRAINT "chk_acc_voucher_tenders_amounts"
      CHECK (
        "vtd_tender_amount" >= 0
        AND "vtd_surcharge_percent" >= 0
        AND "vtd_surcharge_amount" >= 0
        AND "vtd_total_amount" >= 0
        AND "vtd_refund_amount" >= 0
      );
  END IF;
END $$;
