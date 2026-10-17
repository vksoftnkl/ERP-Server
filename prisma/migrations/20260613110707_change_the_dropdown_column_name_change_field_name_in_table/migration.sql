-- Rename dropdown_columns columns from the legacy "dropColumns_*" naming to the
-- new "dropdown_columns_*" naming. Done with RENAME COLUMN to preserve existing data.

-- AlterTable: rename columns
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_id" TO "dropdown_columns_id";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_dropdown_id" TO "dropdown_columns_dropdown_id";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_no" TO "dropdown_columns_no";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_data_type" TO "dropdown_columns_data_type";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_name" TO "dropdown_columns_name";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_alias" TO "dropdown_columns_alias";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_width" TO "dropdown_columns_width";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_visiblity" TO "dropdown_columns_visiblity";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_allignment" TO "dropdown_columns_allignment";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_column_filter" TO "dropdown_columns_filter";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_created_on" TO "dropdown_columns_created_on";
ALTER TABLE "fixed"."dropdown_columns" RENAME COLUMN "dropColumns_modified_on" TO "dropdown_columns_modified_on";

-- Rename indexes and foreign key constraint to match the new column names
ALTER INDEX "fixed"."dropdown_columns_dropColumns_dropdown_id_idx" RENAME TO "dropdown_columns_dropdown_columns_dropdown_id_idx";
ALTER INDEX "fixed"."dropdown_columns_dropColumns_dropdown_id_dropColumns_column_idx" RENAME TO "dropdown_columns_dropdown_columns_dropdown_id_dropdown_colu_idx";
ALTER TABLE "fixed"."dropdown_columns" RENAME CONSTRAINT "dropdown_columns_dropColumns_dropdown_id_fkey" TO "dropdown_columns_dropdown_columns_dropdown_id_fkey";

-- AlterTable: add new nullable column on dropdown_details
ALTER TABLE "fixed"."dropdown_details" ADD COLUMN "dropdown_device_type" TEXT;
