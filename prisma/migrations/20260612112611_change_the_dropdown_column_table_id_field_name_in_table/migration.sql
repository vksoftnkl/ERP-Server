/*
  Warnings:

  - The primary key for the `dropdown_columns` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `dropColumns_serial_id` on the `dropdown_columns` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "fixed"."dropdown_columns" DROP CONSTRAINT "dropdown_columns_pkey",
DROP COLUMN "dropColumns_serial_id",
ADD COLUMN     "dropColumns_id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "dropdown_columns_pkey" PRIMARY KEY ("dropColumns_id");
