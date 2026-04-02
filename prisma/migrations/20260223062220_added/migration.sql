/*
  Warnings:

  - The primary key for the `suppliers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `supAddr1` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supAddr2` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supAddr3` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supBilledDate` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supBranchId` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCashDiscPerc` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supChequePreName` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCity` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCollectionDays` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCountry` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCreatedBy` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCreatedOn` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supCreditDays` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supDistrict` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supDrugLiscenceNo` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supGroupId` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supGstNo` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supGstType` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supId` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supIsActive` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supIsDeleted` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supMailId` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supModifiedBy` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supModifiedOn` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supName` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supNotes` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supPanNo` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supPhone` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supPincode` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supPurchaseType` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionAddr1` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionAddr2` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionAddr3` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionCity` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionCountry` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionDistrict` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionName` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supRegionStateName` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supShort` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supSortOrder` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supStateCode` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supStateName` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supSupCst` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supSyncDate` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supTel` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supWebsiteAddress` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supWhatsappNo` on the `suppliers` table. All the data in the column will be lost.
  - Added the required column `sup_group_id` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sup_gst_type` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sup_modified_on` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sup_name` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sup_purchase_type` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sup_state_code` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sup_state_name` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "purchase"."suppliers" DROP CONSTRAINT "suppliers_supGroupId_fkey";

-- DropIndex
DROP INDEX "purchase"."idx_sup_active";

-- DropIndex
DROP INDEX "purchase"."idx_sup_group";

-- DropIndex
DROP INDEX "purchase"."idx_sup_gst";

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "purchase"."suppliers" DROP CONSTRAINT "suppliers_pkey",
DROP COLUMN "supAddr1",
DROP COLUMN "supAddr2",
DROP COLUMN "supAddr3",
DROP COLUMN "supBilledDate",
DROP COLUMN "supBranchId",
DROP COLUMN "supCashDiscPerc",
DROP COLUMN "supChequePreName",
DROP COLUMN "supCity",
DROP COLUMN "supCollectionDays",
DROP COLUMN "supCountry",
DROP COLUMN "supCreatedBy",
DROP COLUMN "supCreatedOn",
DROP COLUMN "supCreditDays",
DROP COLUMN "supDistrict",
DROP COLUMN "supDrugLiscenceNo",
DROP COLUMN "supGroupId",
DROP COLUMN "supGstNo",
DROP COLUMN "supGstType",
DROP COLUMN "supId",
DROP COLUMN "supIsActive",
DROP COLUMN "supIsDeleted",
DROP COLUMN "supMailId",
DROP COLUMN "supModifiedBy",
DROP COLUMN "supModifiedOn",
DROP COLUMN "supName",
DROP COLUMN "supNotes",
DROP COLUMN "supPanNo",
DROP COLUMN "supPhone",
DROP COLUMN "supPincode",
DROP COLUMN "supPurchaseType",
DROP COLUMN "supRegionAddr1",
DROP COLUMN "supRegionAddr2",
DROP COLUMN "supRegionAddr3",
DROP COLUMN "supRegionCity",
DROP COLUMN "supRegionCountry",
DROP COLUMN "supRegionDistrict",
DROP COLUMN "supRegionName",
DROP COLUMN "supRegionStateName",
DROP COLUMN "supShort",
DROP COLUMN "supSortOrder",
DROP COLUMN "supStateCode",
DROP COLUMN "supStateName",
DROP COLUMN "supSupCst",
DROP COLUMN "supSyncDate",
DROP COLUMN "supTel",
DROP COLUMN "supWebsiteAddress",
DROP COLUMN "supWhatsappNo",
ADD COLUMN     "sup_addr1" VARCHAR(250),
ADD COLUMN     "sup_addr2" VARCHAR(250),
ADD COLUMN     "sup_addr3" VARCHAR(250),
ADD COLUMN     "sup_billed_date" DATE,
ADD COLUMN     "sup_branch_id" UUID,
ADD COLUMN     "sup_cash_disc_perc" DECIMAL(7,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sup_cheque_pre_name" VARCHAR(200),
ADD COLUMN     "sup_city" VARCHAR(250),
ADD COLUMN     "sup_collection_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "sup_company_id" UUID,
ADD COLUMN     "sup_country" VARCHAR(60) DEFAULT 'India',
ADD COLUMN     "sup_created_by" VARCHAR(100),
ADD COLUMN     "sup_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sup_credit_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sup_district" VARCHAR(250),
ADD COLUMN     "sup_drug_liscence_no" VARCHAR(100),
ADD COLUMN     "sup_group_id" UUID NOT NULL,
ADD COLUMN     "sup_gst_no" VARCHAR(15),
ADD COLUMN     "sup_gst_type" VARCHAR(30) NOT NULL,
ADD COLUMN     "sup_id" UUID NOT NULL DEFAULT uuidv7(),
ADD COLUMN     "sup_is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sup_is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sup_mail_id" VARCHAR(120),
ADD COLUMN     "sup_modified_by" VARCHAR(100),
ADD COLUMN     "sup_modified_on" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "sup_name" VARCHAR(200) NOT NULL,
ADD COLUMN     "sup_notes" VARCHAR(250),
ADD COLUMN     "sup_pan_no" VARCHAR(10),
ADD COLUMN     "sup_phone" VARCHAR(20),
ADD COLUMN     "sup_pincode" VARCHAR(10),
ADD COLUMN     "sup_purchase_type" VARCHAR(20) NOT NULL,
ADD COLUMN     "sup_region_addr1" VARCHAR(250),
ADD COLUMN     "sup_region_addr2" VARCHAR(250),
ADD COLUMN     "sup_region_addr3" VARCHAR(250),
ADD COLUMN     "sup_region_city" VARCHAR(250),
ADD COLUMN     "sup_region_country" VARCHAR(60) DEFAULT 'India',
ADD COLUMN     "sup_region_district" VARCHAR(250),
ADD COLUMN     "sup_region_name" VARCHAR(200),
ADD COLUMN     "sup_region_state_name" VARCHAR(100),
ADD COLUMN     "sup_short" VARCHAR(50),
ADD COLUMN     "sup_sort_order" INTEGER DEFAULT 0,
ADD COLUMN     "sup_state_code" CHAR(2) NOT NULL,
ADD COLUMN     "sup_state_id" UUID,
ADD COLUMN     "sup_state_name" VARCHAR(100) NOT NULL,
ADD COLUMN     "sup_sup_cst" VARCHAR(25),
ADD COLUMN     "sup_sync_date" TIMESTAMPTZ(6),
ADD COLUMN     "sup_tel" VARCHAR(20),
ADD COLUMN     "sup_website_address" VARCHAR(200),
ADD COLUMN     "sup_whatsapp_no" VARCHAR(20),
ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("sup_id");

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "idx_sup_company" ON "purchase"."suppliers"("sup_company_id");

-- CreateIndex
CREATE INDEX "idx_sup_group" ON "purchase"."suppliers"("sup_group_id");

-- CreateIndex
CREATE INDEX "idx_sup_gst" ON "purchase"."suppliers"("sup_gst_no");

-- AddForeignKey
ALTER TABLE "purchase"."suppliers" ADD CONSTRAINT "suppliers_sup_group_id_fkey" FOREIGN KEY ("sup_group_id") REFERENCES "purchase"."supplier_groups"("spgId") ON DELETE RESTRICT ON UPDATE CASCADE;
