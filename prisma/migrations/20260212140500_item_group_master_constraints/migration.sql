ALTER TABLE "item_group_master"
ADD COLUMN "itg_company_id" UUID;

UPDATE "item_group_master"
SET "itg_company_id" = '00000000-0000-0000-0000-000000000000'
WHERE "itg_company_id" IS NULL;

ALTER TABLE "item_group_master"
ALTER COLUMN "itg_company_id" SET NOT NULL;

UPDATE "item_group_master"
SET "itg_path_ids_cache" = '{}'::uuid[]
WHERE "itg_path_ids_cache" IS NULL;

ALTER TABLE "item_group_master"
ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[],
ALTER COLUMN "itg_path_ids_cache" SET NOT NULL;

CREATE INDEX "idx_itg_company_id" ON "item_group_master"("itg_company_id");

CREATE UNIQUE INDEX "uq_itg_name_per_company"
ON "item_group_master"("itg_company_id", "itg_name");

ALTER TABLE "item_group_master"
ADD CONSTRAINT "chk_itg_not_self_parent"
CHECK ("itg_parent_id" IS NULL OR "itg_parent_id" <> "itg_id");
