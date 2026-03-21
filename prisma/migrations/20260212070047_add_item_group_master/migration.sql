-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "item_group_master" (
    "itg_id" UUID NOT NULL DEFAULT uuidv7(),
    "itg_name" VARCHAR(150) NOT NULL,
    "itg_alias" VARCHAR(100),
    "itg_short" VARCHAR(50),
    "itg_description" VARCHAR(250),
    "itg_parent_id" UUID,
    "itg_sort" INTEGER,
    "itg_level" INTEGER,
    "itg_path_ids_cache" UUID[],
    "itg_tax_claim" BOOLEAN,
    "itg_default_tax_id" UUID,
    "itg_default_hsn" VARCHAR(20),
    "itg_default_uom_id" UUID,
    "itg_photo" BYTEA,
    "itg_photo_url" TEXT,
    "itg_is_active" BOOLEAN NOT NULL DEFAULT true,
    "itg_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "itg_sync_date" TIMESTAMPTZ(6),
    "itg_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itg_created_by" VARCHAR(100),
    "itg_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itg_modified_by" VARCHAR(100),

    CONSTRAINT "item_group_master_pkey" PRIMARY KEY ("itg_id")
);

-- CreateIndex
CREATE INDEX "idx_itg_parent_id" ON "item_group_master"("itg_parent_id");

-- CreateIndex
CREATE INDEX "idx_itg_active" ON "item_group_master"("itg_is_active");

-- AddForeignKey
ALTER TABLE "item_group_master" ADD CONSTRAINT "item_group_master_itg_parent_id_fkey" FOREIGN KEY ("itg_parent_id") REFERENCES "item_group_master"("itg_id") ON DELETE RESTRICT ON UPDATE CASCADE;
