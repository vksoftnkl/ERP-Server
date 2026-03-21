-- Move item master tables from public to inventory schema without dropping data.
-- This preserves dependent foreign keys (e.g. public.item_price_master -> item_master).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- Move tables (no-op if already moved)
ALTER TABLE IF EXISTS "public"."category_master" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."godown_locations" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."item_brand_master" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."item_group_master" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."item_master" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."item_reorders" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."item_section_master" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."item_tax_master" SET SCHEMA "inventory";
ALTER TABLE IF EXISTS "public"."units" SET SCHEMA "inventory";

-- Keep existing default adjustments from generated migration
ALTER TABLE "purchase"."suppliers"
  ALTER COLUMN "sup_cash_disc_perc" SET DEFAULT 0;

ALTER TABLE "sales"."cust_groups"
  ALTER COLUMN "cgr_order" SET DEFAULT 0,
  ALTER COLUMN "cgr_disc_perc" SET DEFAULT 0,
  ALTER COLUMN "cgr_debit_limit" SET DEFAULT 0;
