-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "units" (
    "unit_id" SERIAL NOT NULL,
    "unit_name" VARCHAR(50) NOT NULL,
    "unit_alias" VARCHAR(50),
    "unit_code" VARCHAR(30),
    "unit_description" VARCHAR(100),
    "unit_decimal_count" INTEGER NOT NULL DEFAULT 0,
    "unit_weight" DECIMAL,
    "unit_loading" DECIMAL,
    "unit_unloading" DECIMAL,
    "unit_attach_charge" DECIMAL,
    "unit_is_pack_unit" BOOLEAN NOT NULL DEFAULT false,
    "unit_base_unit_id" INTEGER,
    "unit_conversion" DECIMAL,
    "unit_is_active" BOOLEAN NOT NULL DEFAULT true,
    "unit_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "unit_sync_date" TIMESTAMPTZ(6),
    "unit_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_created_by" VARCHAR(100),
    "unit_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_modified_by" VARCHAR(100),

    CONSTRAINT "units_pkey" PRIMARY KEY ("unit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_unit_name_key" ON "units"("unit_name");

-- CreateIndex
CREATE INDEX "idx_unit_active" ON "units"("unit_is_active");

-- CreateIndex
CREATE INDEX "idx_unit_base" ON "units"("unit_base_unit_id");

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_unit_base_unit_id_fkey" FOREIGN KEY ("unit_base_unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;
