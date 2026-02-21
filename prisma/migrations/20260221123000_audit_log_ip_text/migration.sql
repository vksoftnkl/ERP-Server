-- AlterTable
ALTER TABLE "audit"."audit_log"
ALTER COLUMN "log_ip" TYPE TEXT
USING "log_ip"::TEXT;
