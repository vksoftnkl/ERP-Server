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

-- CreateTable
CREATE TABLE "fixed"."price_levels" (
    "price_lvl_id" SERIAL NOT NULL,
    "price_lvl_name" VARCHAR(200) NOT NULL,
    "price_lvl_short" VARCHAR(50),
    "price_lvl_is_active" BOOLEAN NOT NULL DEFAULT true,
    "price_lvl_is_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "price_levels_pkey" PRIMARY KEY ("price_lvl_id")
);
