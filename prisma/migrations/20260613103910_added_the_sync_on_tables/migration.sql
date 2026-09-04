-- AlterTable
ALTER TABLE "fixed"."dropdown_columns" ADD COLUMN     "dropdown_columns_sync_on" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "fixed"."dropdown_details" ADD COLUMN     "dropdown_sync_on" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "fixed"."grid_columns" ADD COLUMN     "grid_column_created_by" TEXT,
ADD COLUMN     "grid_column_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "grid_column_modified_by" TEXT,
ADD COLUMN     "grid_column_modified_on" TIMESTAMPTZ(6),
ADD COLUMN     "grid_column_sync_on" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "fixed"."grid_details" ADD COLUMN     "grid_created_by" TEXT,
ADD COLUMN     "grid_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "grid_modified_by" TEXT,
ADD COLUMN     "grid_modified_on" TIMESTAMPTZ(6),
ADD COLUMN     "grid_sync_on" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "fixed"."ui_tables" ADD COLUMN     "ui_tbl_sync_on" TIMESTAMPTZ(6);
