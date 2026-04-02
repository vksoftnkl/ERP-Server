-- Add supported bank_master constraints and filtered/expression indexes.
-- The current project stores bank_master in the "fixed" schema.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'fixed'
      AND t.relname = 'bank_master'
      AND c.conname = 'chk_bnk_name_not_blank'
  ) THEN
    ALTER TABLE "fixed"."bank_master"
      ADD CONSTRAINT "chk_bnk_name_not_blank"
      CHECK (length(trim("bnk_name")) > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bnk_name"
ON "fixed"."bank_master" (lower("bnk_name"))
WHERE "bnk_is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bnk_short_name"
ON "fixed"."bank_master" (lower("bnk_short_name"))
WHERE "bnk_short_name" IS NOT NULL
  AND "bnk_is_deleted" = false;

DROP INDEX IF EXISTS "fixed"."idx_bnk_active";
CREATE INDEX IF NOT EXISTS "idx_bnk_active"
ON "fixed"."bank_master" ("bnk_is_active")
WHERE "bnk_is_deleted" = false;

CREATE INDEX IF NOT EXISTS "idx_bnk_name_lower"
ON "fixed"."bank_master" (lower("bnk_name"))
WHERE "bnk_is_deleted" = false;
