-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateEnum
CREATE TYPE "audit"."audit_log_action" AS ENUM ('insert', 'update', 'approve', 'cancel');

-- CreateEnum
CREATE TYPE "audit"."audit_screen_type" AS ENUM ('master', 'transaction', 'settings', 'other');

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "audit"."audit_log" (
    "log_id" UUID NOT NULL DEFAULT uuidv7(),
    "log_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "log_action" "audit"."audit_log_action" NOT NULL,
    "log_screen_id" INTEGER NOT NULL,
    "log_table_name" TEXT NOT NULL,
    "log_pk" TEXT,
    "log_entity_id" UUID,
    "log_display_name" TEXT,
    "log_original_record" JSONB,
    "log_modified_record" JSONB,
    "log_changed_fields" JSONB,
    "log_user_id" UUID,
    "log_branch_id" UUID,
    "log_device_name" TEXT,
    "log_ip" inet,
    "log_app_name" TEXT,
    "log_notes" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "audit"."audit_screen" (
    "screen_id" SERIAL NOT NULL,
    "screen_name" TEXT NOT NULL,
    "screen_type" "audit"."audit_screen_type" NOT NULL DEFAULT 'other',
    "screen_status" BOOLEAN NOT NULL DEFAULT true,
    "screen_module" TEXT,
    "screen_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screen_created_by" UUID,
    "screen_modified_on" TIMESTAMPTZ(6),
    "screen_modified_by" UUID,

    CONSTRAINT "audit_screen_pkey" PRIMARY KEY ("screen_id")
);

-- CreateIndex
CREATE INDEX "idx_audit_log_date" ON "audit"."audit_log"("log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_screen_date" ON "audit"."audit_log"("log_screen_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_user_date" ON "audit"."audit_log"("log_user_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_branch_date" ON "audit"."audit_log"("log_branch_id", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_log_table_date" ON "audit"."audit_log"("log_table_name", "log_date");

-- CreateIndex
CREATE INDEX "idx_audit_screen_status" ON "audit"."audit_screen"("screen_status");

-- AddForeignKey
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_log_screen_id_fkey" FOREIGN KEY ("log_screen_id") REFERENCES "audit"."audit_screen"("screen_id") ON DELETE RESTRICT ON UPDATE CASCADE;
