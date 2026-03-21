/*
  Warnings:

  - You are about to drop the `tender_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tender_type_master` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "accounts"."tender_master" DROP CONSTRAINT "tender_master_tnd_ledger_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts"."tender_master" DROP CONSTRAINT "tender_master_tnd_type_id_fkey";

-- DropTable
DROP TABLE "accounts"."tender_master";

-- DropTable
DROP TABLE "accounts"."tender_type_master";

-- CreateTable
CREATE TABLE "accounts"."account_tender_master" (
    "acc_tnd_id" UUID NOT NULL DEFAULT uuidv7(),
    "acc_tnd_type_id" BIGINT NOT NULL,
    "acc_tnd_tnd_name" TEXT NOT NULL,
    "acc_tnd_tnd_short_name" TEXT NOT NULL,
    "acc_tnd_tnd_ledger_id" UUID NOT NULL,
    "acc_tnd_tnd_min_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "acc_tnd_tnd_max_amount" DECIMAL(14,2),
    "acc_tnd_tnd_display_position" INTEGER NOT NULL DEFAULT 0,
    "acc_tnd_tnd_surcharge_perc" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "acc_tnd_tnd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "acc_tnd_tnd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "acc_tnd_tnd_remarks" TEXT,
    "acc_tnd_tnd_edit_surcharge" BOOLEAN NOT NULL DEFAULT false,
    "acc_tnd_tnd_edit_ledger" BOOLEAN NOT NULL DEFAULT false,
    "acc_tnd_tnd_sync_date" TIMESTAMPTZ,
    "acc_tnd_tnd_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acc_tnd_tnd_created_by" VARCHAR(100),
    "acc_tnd_tnd_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acc_tnd_tnd_modified_by" VARCHAR(100),

    CONSTRAINT "account_tender_master_pkey" PRIMARY KEY ("acc_tnd_id")
);

-- CreateTable
CREATE TABLE "accounts"."tender_type" (
    "acc_ttm_type_id" BIGSERIAL NOT NULL,
    "acc_ttm_type_name" TEXT NOT NULL,
    "acc_ttm_type_short_name" TEXT NOT NULL,
    "acc_ttm_type_is_active" BOOLEAN NOT NULL DEFAULT true,
    "acc_ttm_type_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "acc_ttm_type_sync_date" TIMESTAMPTZ,
    "acc_ttm_type_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acc_ttm_type_created_by" VARCHAR(100),
    "acc_ttm_type_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acc_ttm_type_modified_by" VARCHAR(100),

    CONSTRAINT "tender_type_pkey" PRIMARY KEY ("acc_ttm_type_id")
);

-- CreateIndex
CREATE INDEX "idx_tnd_master_type" ON "accounts"."account_tender_master"("acc_tnd_type_id");

-- CreateIndex
CREATE INDEX "idx_tnd_master_ledger" ON "accounts"."account_tender_master"("acc_tnd_tnd_ledger_id");

-- CreateIndex
CREATE INDEX "idx_tnd_master_position" ON "accounts"."account_tender_master"("acc_tnd_tnd_display_position");

-- CreateIndex
CREATE INDEX "idx_acc_ttm_type_is_active" ON "accounts"."tender_type"("acc_ttm_type_is_active");

-- AddForeignKey
ALTER TABLE "accounts"."account_tender_master" ADD CONSTRAINT "account_tender_master_acc_tnd_type_id_fkey" FOREIGN KEY ("acc_tnd_type_id") REFERENCES "accounts"."tender_type"("acc_ttm_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."account_tender_master" ADD CONSTRAINT "account_tender_master_acc_tnd_tnd_ledger_id_fkey" FOREIGN KEY ("acc_tnd_tnd_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;
