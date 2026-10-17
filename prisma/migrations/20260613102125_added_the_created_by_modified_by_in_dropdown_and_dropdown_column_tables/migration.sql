-- AlterTable
ALTER TABLE "fixed"."dropdown_columns" ADD COLUMN     "dropdown_columns_created_by" TEXT,
ADD COLUMN     "dropdown_columns_modified_by" TEXT;

-- AlterTable
ALTER TABLE "fixed"."dropdown_details" ADD COLUMN     "dropdown_created_by" TEXT,
ADD COLUMN     "dropdown_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dropdown_modified_by" TEXT,
ADD COLUMN     "dropdown_modified_on" TIMESTAMPTZ(6);
