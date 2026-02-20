/*
  Warnings:

  - The primary key for the `units` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `unit_id` column on the `units` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `unit_base_unit_id` column on the `units` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "units" DROP CONSTRAINT "units_unit_base_unit_id_fkey";

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "units" DROP CONSTRAINT "units_pkey",
DROP COLUMN "unit_id",
ADD COLUMN     "unit_id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "unit_base_unit_id",
ADD COLUMN     "unit_base_unit_id" UUID,
ADD CONSTRAINT "units_pkey" PRIMARY KEY ("unit_id");

-- CreateTable
CREATE TABLE "godown_locations" (
    "gdl_id" UUID NOT NULL DEFAULT uuidv7(),
    "gdl_godown_id" UUID NOT NULL,
    "gdl_branch_id" UUID NOT NULL,
    "gdl_name" VARCHAR(200) NOT NULL,
    "gdl_short" VARCHAR(50),
    "gdl_code" VARCHAR(30),
    "gdl_type" VARCHAR(20) NOT NULL DEFAULT 'BIN',
    "gdl_parent_id" UUID,
    "gdl_sort" INTEGER NOT NULL DEFAULT 0,
    "gdl_level" INTEGER NOT NULL DEFAULT 0,
    "gdl_path_ids_cache" UUID[] DEFAULT '{}'::uuid[],
    "gdl_del_sheet" BOOLEAN NOT NULL DEFAULT false,
    "gdl_split_stock" BOOLEAN NOT NULL DEFAULT false,
    "gdl_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "gdl_volume" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gdl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gdl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "gdl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdl_created_by" VARCHAR(100),
    "gdl_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdl_modified_by" VARCHAR(100),
    "gdl_remarks" VARCHAR(250),

    CONSTRAINT "godown_locations_pkey" PRIMARY KEY ("gdl_id")
);

-- CreateIndex
CREATE INDEX "idx_gdl_parent" ON "godown_locations"("gdl_parent_id");

-- CreateIndex
CREATE INDEX "idx_gdl_sort" ON "godown_locations"("gdl_godown_id", "gdl_parent_id", "gdl_sort");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gdl_unique_name_per_parent" ON "godown_locations"("gdl_godown_id", "gdl_parent_id", "gdl_name");

-- CreateIndex
CREATE INDEX "idx_unit_base" ON "units"("unit_base_unit_id");

-- AddForeignKey
ALTER TABLE "godown_locations" ADD CONSTRAINT "godown_locations_gdl_parent_id_fkey" FOREIGN KEY ("gdl_parent_id") REFERENCES "godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_unit_base_unit_id_fkey" FOREIGN KEY ("unit_base_unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;
