-- AlterTable
ALTER TABLE "fixed"."ui_table_columns" ADD COLUMN     "ui_tbl_clm_table_id" BIGINT,
ALTER COLUMN "ui_tbl_clm_next_column" SET DEFAULT NULL,
ALTER COLUMN "ui_tbl_clm_previous_column" SET DEFAULT NULL;

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

-- AddForeignKey
ALTER TABLE "fixed"."ui_table_columns" ADD CONSTRAINT "ui_table_columns_ui_tbl_clm_table_id_fkey" FOREIGN KEY ("ui_tbl_clm_table_id") REFERENCES "fixed"."ui_tables"("ui_tbl_id") ON DELETE SET NULL ON UPDATE CASCADE;
