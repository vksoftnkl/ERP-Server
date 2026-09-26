/*
  Warnings:

  - You are about to drop the column `av_bill_date` on the `acc_vouchers` table. All the data in the column will be lost.
  - You are about to drop the column `av_bill_id` on the `acc_vouchers` table. All the data in the column will be lost.
  - You are about to drop the column `av_bill_refno` on the `acc_vouchers` table. All the data in the column will be lost.
  - You are about to drop the `acc_bills` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" DROP CONSTRAINT "fk_aba_bill";

-- DropForeignKey
ALTER TABLE "accounts"."acc_bills" DROP CONSTRAINT "fk_abl_party";

-- DropForeignKey
ALTER TABLE "accounts"."acc_bills" DROP CONSTRAINT "fk_abl_voucher";

-- DropForeignKey
ALTER TABLE "accounts"."acc_bills" DROP CONSTRAINT "fk_abl_voucher_type";

-- DropForeignKey
ALTER TABLE "accounts"."acc_vouchers" DROP CONSTRAINT "fk_av_bill";

-- AlterTable
ALTER TABLE "accounts"."acc_vouchers" DROP COLUMN "av_bill_date",
DROP COLUMN "av_bill_id",
DROP COLUMN "av_bill_refno",
ADD COLUMN     "av_doc_id" UUID,
ADD COLUMN     "av_doc_refno" VARCHAR(100),
ALTER COLUMN "av_doc_date" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "av_created_by" SET DATA TYPE TEXT,
ALTER COLUMN "av_modified_by" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "accounts"."acc_bills";

-- CreateTable
CREATE TABLE "accounts"."acc_bills_balance" (
    "abl_id" UUID NOT NULL DEFAULT uuidv7(),
    "abl_company_id" UUID NOT NULL,
    "abl_branch_id" UUID NOT NULL,
    "abl_tenant_id" UUID,
    "abl_acc_year" CHAR(9) NOT NULL,
    "abl_party_id" UUID NOT NULL,
    "abl_salesman_id" UUID,
    "abl_agent_id" UUID,
    "abl_bill_type" VARCHAR(20) NOT NULL,
    "abl_voucher_id" UUID,
    "abl_voucher_line_id" UUID,
    "abl_voucher_type_id" INTEGER NOT NULL,
    "abl_voucher_no" BIGINT,
    "abl_doc_date" DATE,
    "abl_doc_refno" VARCHAR(50),
    "abl_bill_refno" VARCHAR(100) NOT NULL,
    "abl_bill_date" DATE NOT NULL,
    "abl_due_date" DATE,
    "abl_credit_days" SMALLINT NOT NULL DEFAULT 0,
    "abl_grace_days" SMALLINT NOT NULL DEFAULT 0,
    "abl_dr_cr" CHAR(2) NOT NULL,
    "abl_narration" TEXT,
    "abl_bill_amount" DECIMAL(18,2) NOT NULL,
    "abl_alloc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abl_disc_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abl_writeoff_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abl_pending_amount" DECIMAL(18,2),
    "abl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "abl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "abl_sync_date" TIMESTAMPTZ(6),
    "abl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abl_created_by" VARCHAR(50),
    "abl_modified_on" TIMESTAMPTZ(6),
    "abl_modified_by" VARCHAR(50),

    CONSTRAINT "pk_acc_bills" PRIMARY KEY ("abl_id")
);

-- AddForeignKey
ALTER TABLE "accounts"."acc_bill_adjustment" ADD CONSTRAINT "fk_aba_bill" FOREIGN KEY ("aba_bill_id") REFERENCES "accounts"."acc_bills_balance"("abl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bills_balance" ADD CONSTRAINT "fk_abl_voucher" FOREIGN KEY ("abl_voucher_id", "abl_acc_year") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id", "avh_acc_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bills_balance" ADD CONSTRAINT "fk_abl_voucher_type" FOREIGN KEY ("abl_voucher_type_id") REFERENCES "accounts"."acc_voucher_types"("vchr_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_bills_balance" ADD CONSTRAINT "fk_abl_party" FOREIGN KEY ("abl_party_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_av_doc" FOREIGN KEY ("av_doc_id") REFERENCES "accounts"."acc_bills_balance"("abl_id") ON DELETE RESTRICT ON UPDATE CASCADE;
