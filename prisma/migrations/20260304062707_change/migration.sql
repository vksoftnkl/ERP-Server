-- AlterTable
ALTER TABLE "fixed"."price_levels" ADD COLUMN     "price_lvl_SyncDate" TIMESTAMPTZ,
ADD COLUMN     "price_lvl_createdBy" VARCHAR(100),
ADD COLUMN     "price_lvl_createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "price_lvl_isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price_lvl_modifiedBy" VARCHAR(100),
ADD COLUMN     "price_lvl_modifiedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

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
