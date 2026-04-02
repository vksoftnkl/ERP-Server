-- Align erp_device_master indexes to the filtered form.
-- The current project stores erp_device_master in the "fixed" schema.

DROP INDEX IF EXISTS "fixed"."idx_dev_login_check";
CREATE INDEX IF NOT EXISTS "idx_dev_login_check"
ON "fixed"."erp_device_master" ("dev_company_id", "dev_device_uid")
WHERE "dev_is_deleted" = false;

DROP INDEX IF EXISTS "fixed"."idx_dev_allowed";
CREATE INDEX IF NOT EXISTS "idx_dev_allowed"
ON "fixed"."erp_device_master" ("dev_company_id", "dev_is_allowed", "dev_is_blocked")
WHERE "dev_is_deleted" = false;
