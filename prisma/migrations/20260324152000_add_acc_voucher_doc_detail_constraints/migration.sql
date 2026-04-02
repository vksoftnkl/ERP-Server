-- Add acc_voucher_doc_detail checks and partial index.

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_doc_detail_voucher"
ON "accounts"."acc_voucher_doc_detail" (
  "vtx_company_id",
  "vtx_branch_id",
  "vtx_acc_year",
  "vtx_voucher_id"
)
WHERE "vtx_is_deleted" = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_detail'
      AND constraint_name = 'fk_acc_voucher_doc_detail_company'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "fk_acc_voucher_doc_detail_company"
      FOREIGN KEY ("vtx_company_id")
      REFERENCES "public"."companys"("comp_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_detail'
      AND constraint_name = 'fk_acc_voucher_doc_detail_branch'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "fk_acc_voucher_doc_detail_branch"
      FOREIGN KEY ("vtx_branch_id")
      REFERENCES "public"."branch_master"("br_id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_detail'
      AND constraint_name = 'fk_acc_voucher_doc_detail_gdr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "fk_acc_voucher_doc_detail_gdr"
      FOREIGN KEY ("vtx_gdr_id")
      REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_detail'
      AND constraint_name = 'fk_acc_voucher_doc_detail_header'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "fk_acc_voucher_doc_detail_header"
      FOREIGN KEY ("vtx_voucher_id")
      REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_row_no'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_row_no"
      CHECK ("vtx_row_no" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_taxability'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_taxability"
      CHECK (
        "vtx_taxability" IN (
          'TAXABLE'::"accounts"."VoucherDocDetailTaxability",
          'EXEMPT'::"accounts"."VoucherDocDetailTaxability",
          'NIL_RATED'::"accounts"."VoucherDocDetailTaxability",
          'NON_GST'::"accounts"."VoucherDocDetailTaxability",
          'MIXED'::"accounts"."VoucherDocDetailTaxability"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_values'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_values"
      CHECK (
        "vtx_item_qty" >= 0
        AND "vtx_item_rate" >= 0
        AND "vtx_item_discount" >= 0
        AND "vtx_taxable_value" >= 0
        AND "vtx_total_tax_rate" >= 0
        AND "vtx_cgst_rate" >= 0
        AND "vtx_sgst_rate" >= 0
        AND "vtx_igst_rate" >= 0
        AND "vtx_cess_rate" >= 0
        AND "vtx_cgst_amount" >= 0
        AND "vtx_sgst_amount" >= 0
        AND "vtx_igst_amount" >= 0
        AND "vtx_cess_amount" >= 0
        AND "vtx_total_tax_amount" >= 0
        AND "vtx_other_amount" >= 0
        AND "vtx_total_value" >= 0
        AND "vtx_bill_value" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_total_match'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_total_match"
      CHECK (
        "vtx_total_tax_amount" =
        ("vtx_cgst_amount" + "vtx_sgst_amount" + "vtx_igst_amount" + "vtx_cess_amount")
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_line_value_match'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_line_value_match"
      CHECK (
        "vtx_total_value" =
        ("vtx_taxable_value" + "vtx_total_tax_amount" + "vtx_other_amount")
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_supply_tax_logic'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_supply_tax_logic"
      CHECK (
        (
          "vtx_supply_nature" = 'INTRA_STATE'::"accounts"."VoucherDocDetailSupplyNature"
          AND "vtx_igst_rate" = 0
          AND "vtx_igst_amount" = 0
        )
        OR
        (
          "vtx_supply_nature" = 'INTER_STATE'::"accounts"."VoucherDocDetailSupplyNature"
          AND "vtx_cgst_rate" = 0
          AND "vtx_sgst_rate" = 0
          AND "vtx_cgst_amount" = 0
          AND "vtx_sgst_amount" = 0
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_detail'
      AND c.conname = 'chk_acc_voucher_doc_detail_non_taxable_zero'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_detail"
      ADD CONSTRAINT "chk_acc_voucher_doc_detail_non_taxable_zero"
      CHECK (
        "vtx_taxability" = 'TAXABLE'::"accounts"."VoucherDocDetailTaxability"
        OR (
          "vtx_total_tax_rate" = 0
          AND "vtx_cgst_rate" = 0
          AND "vtx_sgst_rate" = 0
          AND "vtx_igst_rate" = 0
          AND "vtx_cess_rate" = 0
          AND "vtx_cgst_amount" = 0
          AND "vtx_sgst_amount" = 0
          AND "vtx_igst_amount" = 0
          AND "vtx_cess_amount" = 0
          AND "vtx_total_tax_amount" = 0
        )
      );
  END IF;
END $$;
