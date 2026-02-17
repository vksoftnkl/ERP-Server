-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "grid";

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "grid"."grid_columns" (
    "grid_serialid" BIGSERIAL NOT NULL,
    "grid_id" BIGINT NOT NULL,
    "grid_column_number" INTEGER NOT NULL,
    "grid_column_name" TEXT NOT NULL,
    "grid_column_width" DECIMAL(12,2),
    "grid_column_alignment" TEXT,
    "grid_column_visibility" BOOLEAN NOT NULL DEFAULT true,
    "grid_column_filter" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_condition" TEXT,
    "grid_column_condition_color" TEXT,
    "grid_column_group" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_total" BOOLEAN NOT NULL DEFAULT false,
    "grid_column_data_type" TEXT,
    "grid_column_color" TEXT,
    "grid_column_notes" TEXT,
    "grid_column_is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "grid_columns_pkey" PRIMARY KEY ("grid_serialid")
);

-- CreateTable
CREATE TABLE "grid"."grid_details" (
    "grid_id" BIGSERIAL NOT NULL,
    "grid_name" TEXT NOT NULL,
    "grid_description" TEXT,
    "grid_sort_column" INTEGER,
    "grid_sort_order" INTEGER,
    "grid_sql" TEXT,
    "grid_status" BOOLEAN NOT NULL DEFAULT true,
    "grid_is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "grid_details_pkey" PRIMARY KEY ("grid_id")
);

-- CreateIndex
CREATE INDEX "idx_grid_columns_grid_id" ON "grid"."grid_columns"("grid_id");

-- CreateIndex
CREATE INDEX "idx_grid_columns_filter" ON "grid"."grid_columns"("grid_id", "grid_column_filter");

-- CreateIndex
CREATE INDEX "idx_grid_columns_deleted" ON "grid"."grid_columns"("grid_id", "grid_column_is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grid_columns_number" ON "grid"."grid_columns"("grid_id", "grid_column_number");

-- CreateIndex
CREATE INDEX "idx_grid_details_status" ON "grid"."grid_details"("grid_status");

-- CreateIndex
CREATE INDEX "idx_grid_details_deleted" ON "grid"."grid_details"("grid_is_deleted");

-- AddForeignKey
ALTER TABLE "grid"."grid_columns" ADD CONSTRAINT "grid_columns_grid_id_fkey" FOREIGN KEY ("grid_id") REFERENCES "grid"."grid_details"("grid_id") ON DELETE CASCADE ON UPDATE CASCADE;
