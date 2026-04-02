-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "purchase"."suppliers" ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "fixed"."dropdown_columns" (
    "dropColumns_serial_id" BIGSERIAL NOT NULL,
    "dropColumns_dropdown_id" INTEGER NOT NULL,
    "dropColumns_column_no" INTEGER NOT NULL,
    "dropColumns_data_type" VARCHAR(50) NOT NULL,
    "dropColumns_column_name" VARCHAR(200) NOT NULL,
    "dropColumns_column_alias" VARCHAR(200),
    "dropColumns_column_width" DECIMAL(12,2),
    "dropColumns_column_visiblity" BOOLEAN NOT NULL DEFAULT true,
    "dropColumns_column_allignment" VARCHAR(30),
    "dropColumns_column_filter" BOOLEAN NOT NULL DEFAULT false,
    "dropColumns_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dropColumns_modified_on" TIMESTAMPTZ(6),

    CONSTRAINT "dropdown_columns_pkey" PRIMARY KEY ("dropColumns_serial_id")
);

-- CreateIndex
CREATE INDEX "dropdown_columns_dropColumns_dropdown_id_idx" ON "fixed"."dropdown_columns"("dropColumns_dropdown_id");

-- CreateIndex
CREATE INDEX "dropdown_columns_dropColumns_dropdown_id_dropColumns_column_idx" ON "fixed"."dropdown_columns"("dropColumns_dropdown_id", "dropColumns_column_no");

-- AddForeignKey
ALTER TABLE "fixed"."dropdown_columns" ADD CONSTRAINT "dropdown_columns_dropColumns_dropdown_id_fkey" FOREIGN KEY ("dropColumns_dropdown_id") REFERENCES "fixed"."dropdown_details"("dropdown_id") ON DELETE CASCADE ON UPDATE CASCADE;
