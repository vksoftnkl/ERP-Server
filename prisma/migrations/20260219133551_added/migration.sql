/*
  Warnings:

  - You are about to alter the column `log_ip` on the `audit_log` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- AlterTable
ALTER TABLE "audit"."audit_log" ALTER COLUMN "log_ip" SET DATA TYPE inet;

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "category_master" (
    "category_id" UUID NOT NULL DEFAULT uuidv7(),
    "category_name" VARCHAR(150) NOT NULL,
    "category_alias" VARCHAR(100),
    "category_short" VARCHAR(50),
    "category_description" VARCHAR(250),
    "category_parent_id" UUID,
    "category_sort" INTEGER,
    "category_level" INTEGER,
    "category_path_ids_cache" UUID[] DEFAULT '{}'::uuid[],
    "category_tax_claim" BOOLEAN,
    "category_default_tax_id" UUID,
    "category_default_hsn" VARCHAR(20),
    "category_default_uom_id" UUID,
    "category_photo" BYTEA,
    "category_photo_url" TEXT,
    "category_is_active" BOOLEAN NOT NULL DEFAULT true,
    "category_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "category_sync_date" TIMESTAMPTZ(6),
    "category_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_created_by" VARCHAR(100),
    "category_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_modified_by" VARCHAR(100),

    CONSTRAINT "category_master_pkey" PRIMARY KEY ("category_id")
);

-- CreateIndex
CREATE INDEX "idx_category_parent_id" ON "category_master"("category_parent_id");

-- CreateIndex
CREATE INDEX "idx_category_active" ON "category_master"("category_is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_category_name" ON "category_master"("category_name");

-- AddForeignKey
ALTER TABLE "category_master" ADD CONSTRAINT "category_master_category_parent_id_fkey" FOREIGN KEY ("category_parent_id") REFERENCES "category_master"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_item_category_id_fkey" FOREIGN KEY ("item_category_id") REFERENCES "category_master"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;
