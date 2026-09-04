/*
  Warnings:

  - You are about to drop the `erp_device_master` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "fixed"."erp_device_master" DROP CONSTRAINT "erp_device_master_dev_company_id_fkey";

-- DropTable
DROP TABLE "fixed"."erp_device_master";

-- CreateTable
CREATE TABLE "fixed"."device_master" (
    "dev_id" UUID NOT NULL DEFAULT uuidv7(),
    "dev_company_id" UUID,
    "dev_branch_id" UUID,
    "dev_user_id" UUID,
    "dev_device_uid" VARCHAR(120) NOT NULL,
    "dev_device_name" VARCHAR(120),
    "dev_device_type" VARCHAR(30) NOT NULL DEFAULT 'Desktop',
    "dev_platform" VARCHAR(30),
    "dev_mac_address" VARCHAR(50),
    "dev_is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "dev_block_reason" VARCHAR(250),
    "dev_last_ip" TEXT,
    "dev_last_login" TIMESTAMPTZ(6),
    "dev_is_active" BOOLEAN NOT NULL DEFAULT true,
    "dev_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "dev_sync_date" TIMESTAMPTZ(6),
    "dev_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dev_created_by" UUID,
    "dev_modified_on" TIMESTAMPTZ(6),
    "dev_modified_by" UUID,

    CONSTRAINT "device_master_pkey" PRIMARY KEY ("dev_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_master_dev_device_uid_key" ON "fixed"."device_master"("dev_device_uid");

-- CreateIndex
CREATE INDEX "idx_device_uid" ON "fixed"."device_master"("dev_device_uid");

-- AddForeignKey
ALTER TABLE "fixed"."device_master" ADD CONSTRAINT "device_master_dev_company_id_fkey" FOREIGN KEY ("dev_company_id") REFERENCES "companys"("comp_id") ON DELETE SET NULL ON UPDATE CASCADE;
