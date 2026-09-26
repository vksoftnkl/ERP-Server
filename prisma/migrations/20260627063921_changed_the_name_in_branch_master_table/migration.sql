/*
  Warnings:

  - You are about to drop the column `gdl_godown_id` on the `godown_locations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gdl_branch_id,gdl_parent_id,gdl_name]` on the table `godown_locations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "inventory"."idx_gdl_sort";

-- DropIndex
DROP INDEX "inventory"."uq_gdl_unique_name_per_parent";

-- AlterTable
ALTER TABLE "inventory"."godown_locations" DROP COLUMN "gdl_godown_id";

-- CreateIndex
CREATE INDEX "idx_gdl_sort" ON "inventory"."godown_locations"("gdl_branch_id", "gdl_parent_id", "gdl_sort");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gdl_unique_name_per_parent" ON "inventory"."godown_locations"("gdl_branch_id", "gdl_parent_id", "gdl_name");
