/*
  Warnings:

  - The primary key for the `grid_columns` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `gridColumn_position` on the `grid_columns` table. All the data in the column will be lost.
  - You are about to drop the column `gridColumn_sql_field_name` on the `grid_columns` table. All the data in the column will be lost.
  - You are about to drop the column `grid_serialid` on the `grid_columns` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "fixed"."grid_columns" DROP CONSTRAINT "grid_columns_pkey",
DROP COLUMN "gridColumn_position",
DROP COLUMN "gridColumn_sql_field_name",
DROP COLUMN "grid_serialid",
ADD COLUMN     "grid_column_position" DECIMAL(12,2),
ADD COLUMN     "grid_column_sql_field_name" TEXT,
ADD COLUMN     "grid_serial_id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "grid_columns_pkey" PRIMARY KEY ("grid_serial_id");
