-- CreateTable
CREATE TABLE "item_section_master" (
    "sec_id" UUID NOT NULL DEFAULT uuidv7(),
    "sec_name" VARCHAR(150) NOT NULL,
    "sec_alias" VARCHAR(100),
    "sec_short" VARCHAR(50),
    "sec_description" VARCHAR(250),
    "sec_company_id" UUID NOT NULL,
    "sec_parent_id" UUID,
    "sec_sort" INTEGER,
    "sec_level" INTEGER,
    "sec_path_ids" UUID[] DEFAULT '{}'::uuid[],
    "sec_position" INTEGER,
    "sec_color_code" VARCHAR(20),
    "sec_icon" VARCHAR(100),
    "sec_photo" BYTEA,
    "sec_photo_url" TEXT,
    "sec_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sec_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sec_sync_date" TIMESTAMPTZ(6),
    "sec_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sec_created_by" VARCHAR(100),
    "sec_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sec_modified_by" VARCHAR(100),

    CONSTRAINT "item_section_master_pkey" PRIMARY KEY ("sec_id")
);

-- CreateIndex
CREATE INDEX "idx_sec_company_id" ON "item_section_master"("sec_company_id");

-- CreateIndex
CREATE INDEX "idx_sec_parent_id" ON "item_section_master"("sec_parent_id");

-- CreateIndex
CREATE INDEX "idx_sec_active" ON "item_section_master"("sec_is_active");

-- CreateIndex
CREATE INDEX "idx_sec_position" ON "item_section_master"("sec_position");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sec_name_per_company" ON "item_section_master"("sec_company_id", "sec_name");

-- AddForeignKey
ALTER TABLE "item_section_master" ADD CONSTRAINT "item_section_master_sec_parent_id_fkey" FOREIGN KEY ("sec_parent_id") REFERENCES "item_section_master"("sec_id") ON DELETE RESTRICT ON UPDATE CASCADE;
