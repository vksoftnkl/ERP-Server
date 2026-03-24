-- Add acc_voucher_types constraints and ensure the supporting indexes exist.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_types_code"
ON "accounts"."acc_voucher_types" ("vchr_type_code");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_acc_voucher_types_name"
ON "accounts"."acc_voucher_types" ("vchr_type_name");

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_types_active_sort"
ON "accounts"."acc_voucher_types" ("vchr_is_active", "vchr_sort_order", "vchr_type_name");

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_types_nature"
ON "accounts"."acc_voucher_types" ("vchr_nature");

CREATE INDEX IF NOT EXISTS "idx_acc_voucher_types_category"
ON "accounts"."acc_voucher_types" ("vchr_category");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_types'
      AND constraint_name = 'uq_acc_voucher_types_code'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "uq_acc_voucher_types_code"
      UNIQUE USING INDEX "uq_acc_voucher_types_code";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_types'
      AND constraint_name = 'uq_acc_voucher_types_name'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "uq_acc_voucher_types_name"
      UNIQUE USING INDEX "uq_acc_voucher_types_name";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_category'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_category"
      CHECK (
        "vchr_category" IN (
          'ACCOUNTING'::"accounts"."VoucherCategory",
          'INVENTORY'::"accounts"."VoucherCategory",
          'BOTH'::"accounts"."VoucherCategory"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_nature'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_nature"
      CHECK (
        "vchr_nature" IN (
          'SALES'::"accounts"."VoucherNature",
          'PURCHASE'::"accounts"."VoucherNature",
          'RECEIPT'::"accounts"."VoucherNature",
          'PAYMENT'::"accounts"."VoucherNature",
          'JOURNAL'::"accounts"."VoucherNature",
          'CONTRA'::"accounts"."VoucherNature",
          'DEBIT_NOTE'::"accounts"."VoucherNature",
          'CREDIT_NOTE'::"accounts"."VoucherNature",
          'STOCK_JOURNAL'::"accounts"."VoucherNature"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_numbering_mode'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_numbering_mode"
      CHECK (
        "vchr_numbering_mode" IN (
          'AUTO'::"accounts"."VoucherNumberingMode",
          'MANUAL'::"accounts"."VoucherNumberingMode",
          'AUTO_MANUAL'::"accounts"."VoucherNumberingMode"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_reset_freq'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_reset_freq"
      CHECK (
        "vchr_reset_freq" IN (
          'NEVER'::"accounts"."VoucherResetFreq",
          'DAILY'::"accounts"."VoucherResetFreq",
          'MONTHLY'::"accounts"."VoucherResetFreq",
          'YEARLY'::"accounts"."VoucherResetFreq"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_no_width'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_no_width"
      CHECK ("vchr_no_width" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_sort_order'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_sort_order"
      CHECK ("vchr_sort_order" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_cash_bank_exclusive'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_cash_bank_exclusive"
      CHECK (
        NOT (
          "vchr_is_cash_voucher" = true
          AND "vchr_is_bank_voucher" = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_manual_mode_consistency'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_manual_mode_consistency"
      CHECK (
        (
          "vchr_numbering_mode" IN (
            'MANUAL'::"accounts"."VoucherNumberingMode",
            'AUTO_MANUAL'::"accounts"."VoucherNumberingMode"
          )
          AND "vchr_allow_manual_no" IN (true, false)
        )
        OR
        (
          "vchr_numbering_mode" = 'AUTO'::"accounts"."VoucherNumberingMode"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_types'
      AND c.conname = 'chk_acc_voucher_types_affect_anything'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_types"
      ADD CONSTRAINT "chk_acc_voucher_types_affect_anything"
      CHECK (
        "vchr_affects_accounts" = true
        OR "vchr_affects_inventory" = true
      );
  END IF;
END $$;
