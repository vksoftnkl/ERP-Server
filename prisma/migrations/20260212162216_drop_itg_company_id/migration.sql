DROP INDEX IF EXISTS "uq_itg_name_per_company";
DROP INDEX IF EXISTS "idx_itg_company_id";

ALTER TABLE "item_group_master"
DROP COLUMN IF EXISTS "itg_company_id";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_itg_name"
ON "item_group_master"("itg_name");
