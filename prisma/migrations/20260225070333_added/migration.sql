-- AlterTable
ALTER TABLE "grid"."grid_details" ALTER COLUMN "grid_sort_column" SET DATA TYPE TEXT,
ALTER COLUMN "grid_sort_order" SET DATA TYPE TEXT;

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
CREATE TABLE "fixed"."dropdown_details" (
    "dropdown_id" SERIAL NOT NULL,
    "dropdown_name" VARCHAR(200) NOT NULL,
    "dropdown_description" TEXT,
    "dropdown_sql" TEXT NOT NULL,
    "dropdown_sort_order" VARCHAR(20),
    "dropdown_sort_column" VARCHAR(100),
    "dropdown_completion" TEXT,
    "dropdown_sql_regional" TEXT,
    "dropdown_max_visible_items" INTEGER NOT NULL DEFAULT 10,
    "dropdown_show_header" BOOLEAN NOT NULL DEFAULT true,
    "dropdown_width" INTEGER,

    CONSTRAINT "dropdown_details_pkey" PRIMARY KEY ("dropdown_id")
);

-- CreateTable
CREATE TABLE "fixed"."hsn_master" (
    "hsn_id" SERIAL NOT NULL,
    "hsn_code" VARCHAR(50) NOT NULL,
    "hsn_name" VARCHAR(200) NOT NULL,
    "hsn_description" TEXT,
    "hsn_is_service" BOOLEAN NOT NULL DEFAULT false,
    "hsn_uqc" VARCHAR(10),
    "hsn_is_active" BOOLEAN NOT NULL DEFAULT true,
    "hsn_rate_of_tax" DECIMAL(7,4) NOT NULL DEFAULT 0,

    CONSTRAINT "hsn_master_pkey" PRIMARY KEY ("hsn_id")
);

-- CreateTable
CREATE TABLE "fixed"."menu_master" (
    "menu_id" SERIAL NOT NULL,
    "menu_parent" INTEGER,
    "menu_name" VARCHAR(200) NOT NULL,
    "menu_alias" VARCHAR(200),
    "menu_visiblity" BOOLEAN NOT NULL DEFAULT true,
    "menu_position" DECIMAL(12,2),
    "menu_icon_location_desktop" TEXT,
    "menu_icon_location_web" TEXT,
    "menu_icon_location_mobile" TEXT,
    "menu_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "menu_modified_on" TIMESTAMPTZ(6),
    "menu_sync_date" TIMESTAMPTZ(6),

    CONSTRAINT "menu_master_pkey" PRIMARY KEY ("menu_id")
);

-- CreateIndex
CREATE INDEX "hsn_master_hsn_code_idx" ON "fixed"."hsn_master"("hsn_code");

-- CreateIndex
CREATE INDEX "menu_master_menu_parent_idx" ON "fixed"."menu_master"("menu_parent");

-- CreateIndex
CREATE INDEX "menu_master_menu_position_idx" ON "fixed"."menu_master"("menu_position");

-- AddForeignKey
ALTER TABLE "fixed"."menu_master" ADD CONSTRAINT "menu_master_menu_parent_fkey" FOREIGN KEY ("menu_parent") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE SET NULL ON UPDATE CASCADE;
