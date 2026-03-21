/*
  Warnings:

  - You are about to drop the `grid_columns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `grid_details` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "grid"."grid_columns" DROP CONSTRAINT "grid_columns_grid_id_fkey";

-- DropTable
DROP TABLE "grid"."grid_columns";

-- DropTable
DROP TABLE "grid"."grid_details";

-- CreateTable
CREATE TABLE "fixed"."grid_columns" (
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
CREATE TABLE "fixed"."grid_details" (
    "grid_id" BIGSERIAL NOT NULL,
    "grid_name" TEXT NOT NULL,
    "grid_description" TEXT,
    "grid_sort_column" TEXT,
    "grid_sort_order" TEXT,
    "grid_sql" TEXT,
    "grid_status" BOOLEAN NOT NULL DEFAULT true,
    "grid_is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "grid_details_pkey" PRIMARY KEY ("grid_id")
);

-- CreateIndex
CREATE INDEX "idx_grid_columns_grid_id" ON "fixed"."grid_columns"("grid_id");

-- CreateIndex
CREATE INDEX "idx_grid_columns_filter" ON "fixed"."grid_columns"("grid_id", "grid_column_filter");

-- CreateIndex
CREATE INDEX "idx_grid_columns_deleted" ON "fixed"."grid_columns"("grid_id", "grid_column_is_deleted");

-- CreateIndex
CREATE INDEX "idx_grid_details_status" ON "fixed"."grid_details"("grid_status");

-- CreateIndex
CREATE INDEX "idx_grid_details_deleted" ON "fixed"."grid_details"("grid_is_deleted");

-- AddForeignKey
ALTER TABLE "fixed"."grid_columns" ADD CONSTRAINT "grid_columns_grid_id_fkey" FOREIGN KEY ("grid_id") REFERENCES "fixed"."grid_details"("grid_id") ON DELETE CASCADE ON UPDATE CASCADE;
