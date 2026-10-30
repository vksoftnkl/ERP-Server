-- AlterTable
ALTER TABLE "sales"."sale_bill_item" ADD COLUMN     "sbi_src_doc_line_no" INTEGER,
ADD COLUMN     "sbi_src_doc_year" CHAR(9);
