/*
  Warnings:

  - Added the required column `section_gui_name` to the `form_section` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "fixed"."form_field" ADD COLUMN     "field_created_by" TEXT,
ADD COLUMN     "field_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "field_updated_by" TEXT,
ADD COLUMN     "field_updated_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "fixed"."form_section" ADD COLUMN     "section_created_by" TEXT,
ADD COLUMN     "section_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "section_gui_name" TEXT,
ADD COLUMN     "section_sync_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "section_updated_by" TEXT,
ADD COLUMN     "section_updated_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "section_name" SET DATA TYPE TEXT;

-- Backfill section_gui_name for pre-existing rows from section_name, then enforce NOT NULL
UPDATE "fixed"."form_section" SET "section_gui_name" = "section_name" WHERE "section_gui_name" IS NULL;
ALTER TABLE "fixed"."form_section" ALTER COLUMN "section_gui_name" SET NOT NULL;
