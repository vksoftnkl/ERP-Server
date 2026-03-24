-- Recreate only inventory.item_price_master in the current Prisma shape.
-- This repairs manual table deletion without resetting unrelated schemas.

ALTER TABLE "inventory"."item_qtywise_rates"
  DROP CONSTRAINT IF EXISTS "item_qtywise_rates_iqr_unit_rate_id_fkey";

DROP TABLE IF EXISTS "inventory"."item_price_master";

CREATE TABLE "inventory"."item_price_master" (
  "ipm_id" UUID NOT NULL DEFAULT uuidv7(),
  "ipm_company_id" UUID,
  "ipm_branch_id" UUID,
  "ipm_item_id" UUID NOT NULL,
  "ipm_unit_id" UUID NOT NULL,
  "ipm_godown_id" UUID NOT NULL,
  "ipm_base_unit_id" UUID,
  "ipm_to_base_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "ipm_unit_slno" INTEGER NOT NULL DEFAULT 0,
  "ipm_unit_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "ipm_is_default_unit" BOOLEAN NOT NULL DEFAULT false,
  "ipm_is_big_unit" BOOLEAN NOT NULL DEFAULT false,
  "ipm_is_base_unit" BOOLEAN NOT NULL DEFAULT false,
  "ipm_cost_price" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_cost_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_sales_price_a" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_sales_price_b" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_sales_price_c" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_sales_price_d" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_price_a_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_price_b_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_price_c_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_price_d_wot" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_price_a_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
  "ipm_price_b_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
  "ipm_price_c_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
  "ipm_price_d_markup_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
  "ipm_max_price" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_min_price" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_disc_perc" DECIMAL(9,3) NOT NULL DEFAULT 0,
  "ipm_disc_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_addl_cess" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_profit_type" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  "ipm_round_off" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "ipm_loading_charge" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_freight_charge" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "ipm_loyalty_points" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "ipm_uom_remarks" VARCHAR(250),
  "ipm_cost_remarks" VARCHAR(250),
  "ipm_is_active" BOOLEAN NOT NULL DEFAULT true,
  "ipm_is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "ipm_sync_date" TIMESTAMPTZ(6),
  "ipm_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipm_created_by" UUID,
  "ipm_updated_on" TIMESTAMPTZ(6),
  "ipm_updated_by" UUID,
  CONSTRAINT "item_price_master_pkey" PRIMARY KEY ("ipm_id"),
  CONSTRAINT "fk_ipm_company_id" FOREIGN KEY ("ipm_company_id") REFERENCES "public"."companys"("comp_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "fk_ipm_branch_id" FOREIGN KEY ("ipm_branch_id") REFERENCES "public"."branch_master"("br_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "fk_ipm_item" FOREIGN KEY ("ipm_item_id") REFERENCES "inventory"."item_master"("item_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "fk_ipm_unit" FOREIGN KEY ("ipm_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "fk_ipm_base_unit" FOREIGN KEY ("ipm_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "fk_ipm_godown_id" FOREIGN KEY ("ipm_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "chk_ipm_to_base_factor" CHECK ("ipm_to_base_factor" > 0),
  CONSTRAINT "chk_ipm_profit_type" CHECK ("ipm_profit_type" IN ('BY_PERCENT', 'BY_AMOUNT', 'MANUAL')),
  CONSTRAINT "chk_ipm_nonnegative" CHECK (
    "ipm_cost_price" >= 0
    AND "ipm_cost_wot" >= 0
    AND "ipm_sales_price_a" >= 0
    AND "ipm_sales_price_b" >= 0
    AND "ipm_sales_price_c" >= 0
    AND "ipm_sales_price_d" >= 0
    AND "ipm_price_a_wot" >= 0
    AND "ipm_price_b_wot" >= 0
    AND "ipm_price_c_wot" >= 0
    AND "ipm_price_d_wot" >= 0
    AND "ipm_max_price" >= 0
    AND "ipm_min_price" >= 0
    AND "ipm_disc_perc" >= 0
    AND "ipm_disc_qty" >= 0
    AND "ipm_addl_cess" >= 0
    AND "ipm_loading_charge" >= 0
    AND "ipm_freight_charge" >= 0
    AND "ipm_loyalty_points" >= 0
  )
);

CREATE UNIQUE INDEX "uq_item_price_master_branch"
ON "inventory"."item_price_master" (
  "ipm_company_id",
  "ipm_branch_id",
  "ipm_item_id",
  "ipm_unit_id"
)
WHERE "ipm_branch_id" IS NOT NULL
  AND "ipm_is_deleted" = false;

CREATE INDEX "idx_item_price_master_item"
ON "inventory"."item_price_master" (
  "ipm_item_id",
  "ipm_unit_id"
);

ALTER TABLE "inventory"."item_qtywise_rates"
  ADD CONSTRAINT "item_qtywise_rates_iqr_unit_rate_id_fkey"
  FOREIGN KEY ("iqr_unit_rate_id")
  REFERENCES "inventory"."item_price_master"("ipm_id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  NOT VALID;
