-- AlterTable
ALTER TABLE "fixed"."menu_master" ADD COLUMN     "menu_is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "menu_separator" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "inventory"."category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "inventory"."item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "purchase"."suppliers" ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sales"."cust_groups" ALTER COLUMN "cgr_order" SET DEFAULT 0,
ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;
