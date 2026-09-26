-- AlterTable
ALTER TABLE "sales"."sale_bill" ALTER COLUMN "sb_bill_slno" DROP NOT NULL,
ALTER COLUMN "sb_bill_refno" DROP NOT NULL;
