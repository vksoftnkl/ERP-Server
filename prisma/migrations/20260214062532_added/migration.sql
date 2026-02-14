-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- CreateTable
CREATE TABLE "item_brand_master" (
    "brand_id" UUID NOT NULL DEFAULT uuidv7(),
    "brand_name" VARCHAR(150) NOT NULL,
    "brand_alias" VARCHAR(150),
    "brand_short" VARCHAR(50),
    "brand_description" VARCHAR(250),
    "brand_photo" BYTEA,
    "brand_photo_url" TEXT,
    "brand_parent_id" UUID,
    "brand_sort" INTEGER,
    "brand_level" INTEGER,
    "brand_path_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "brand_is_active" BOOLEAN NOT NULL DEFAULT true,
    "brand_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "brand_sync_date" TIMESTAMPTZ(6),
    "brand_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_created_by" VARCHAR(100),
    "brand_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_modified_by" VARCHAR(100),

    CONSTRAINT "item_brand_master_pkey" PRIMARY KEY ("brand_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_brand_master_brand_name_key" ON "item_brand_master"("brand_name");

-- CreateIndex
CREATE INDEX "idx_brand_parent_id" ON "item_brand_master"("brand_parent_id");

-- CreateIndex
CREATE INDEX "idx_brand_active" ON "item_brand_master"("brand_is_active");

-- AddForeignKey
ALTER TABLE "item_brand_master" ADD CONSTRAINT "item_brand_master_brand_parent_id_fkey" FOREIGN KEY ("brand_parent_id") REFERENCES "item_brand_master"("brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;
