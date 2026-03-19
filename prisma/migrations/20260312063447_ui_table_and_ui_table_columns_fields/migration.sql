-- AlterTable
ALTER TABLE "inventory"."category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "user_code" SET DEFAULT 'us' || nextval('user_code_seq');

-- AlterTable
ALTER TABLE "purchase"."suppliers" ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "fixed"."ui_tables" (
    "ui_tbl_id" BIGSERIAL NOT NULL,
    "ui_tbl_name" TEXT,
    "ui_tbl_editable" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ui_tbl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_sync_date" TIMESTAMPTZ(6),
    "ui_tbl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_created_by" VARCHAR(100),
    "ui_tbl_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_modified_by" VARCHAR(100),

    CONSTRAINT "ui_tables_pkey" PRIMARY KEY ("ui_tbl_id")
);

-- CreateTable
CREATE TABLE "fixed"."ui_table_columns" (
    "ui_tbl_clm_id" BIGSERIAL NOT NULL,
    "ui_tbl_clm_no" BIGINT,
    "ui_tbl_clm_name" TEXT,
    "ui_tbl_clm_column_width" DECIMAL DEFAULT 100,
    "ui_tbl_clm_column_visibility" BOOLEAN DEFAULT true,
    "ui_tbl_clm_column_focus" BOOLEAN DEFAULT false,
    "ui_tbl_clm_column_position" INTEGER NOT NULL DEFAULT 0,
    "ui_tbl_clm_column_necessity" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_clm_next_column" INTEGER DEFAULT NULL,
    "ui_tbl_clm_previous_column" INTEGER DEFAULT NULL,
    "ui_tbl_clm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ui_tbl_clm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ui_tbl_clm_sync_date" TIMESTAMPTZ(6),
    "ui_tbl_clm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_clm_created_by" VARCHAR(100),
    "ui_tbl_clm_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ui_tbl_clm_modified_by" VARCHAR(100),

    CONSTRAINT "ui_table_columns_pkey" PRIMARY KEY ("ui_tbl_clm_id")
);
