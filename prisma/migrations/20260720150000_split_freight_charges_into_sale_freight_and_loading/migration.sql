-- Split "sales"."freight_charges" into two focused tables:
--   - sale_freight_charges: distance/weight-slab freight charge, now scoped
--     per company/branch (fr_company_id / fr_branch_id are new).
--   - sale_loading_charges: weight-slab load/unload charge, company/branch
--     agnostic (matches item_price_master, which already carries its own
--     ipm_loading_charge/ipm_freight_charge overrides per item).
-- The single existing row is carried over into both new tables before the
-- old table is dropped, since it splits 1:1 across the new columns.

-- CreateTable
CREATE TABLE "sales"."sale_freight_charges" (
    "fr_id" UUID NOT NULL DEFAULT uuidv7(),
    "fr_branch_id" UUID,
    "fr_company_id" UUID,
    "fr_from_km" INTEGER DEFAULT 0,
    "fr_to_km" INTEGER DEFAULT 0,
    "fr_from_weight" DECIMAL DEFAULT 0.0,
    "fr_to_weight" DECIMAL DEFAULT 0.0,
    "fr_freight_chrg" DECIMAL DEFAULT 0.0,
    "fr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "fr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "fr_sync_date" TIMESTAMPTZ,
    "fr_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fr_created_by" VARCHAR(100),
    "fr_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fr_modified_by" VARCHAR(100),

    CONSTRAINT "sale_freight_charges_pkey" PRIMARY KEY ("fr_id")
);

-- CreateTable
CREATE TABLE "sales"."sale_loading_charges" (
    "ilc_id" UUID NOT NULL DEFAULT uuidv7(),
    "ilc_from_weight" DECIMAL DEFAULT 0.0,
    "ilc_to_weight" DECIMAL DEFAULT 0.0,
    "ilc_load_chrg" DECIMAL DEFAULT 0.0,
    "ilc_unload_chrg" DECIMAL DEFAULT 0.0,
    "ilc_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ilc_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ilc_sync_date" TIMESTAMPTZ,
    "ilc_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ilc_created_by" VARCHAR(100),
    "ilc_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ilc_modified_by" VARCHAR(100),

    CONSTRAINT "sale_loading_charges_pkey" PRIMARY KEY ("ilc_id")
);

-- CreateIndex
CREATE INDEX "idx_ilc_active" ON "sales"."sale_loading_charges"("ilc_is_active");

-- Carry over the existing freight_charges rows (fr_company_id/fr_branch_id
-- have no old equivalent and stay NULL).
INSERT INTO "sales"."sale_freight_charges"
  ("fr_id", "fr_from_km", "fr_to_km", "fr_from_weight", "fr_to_weight", "fr_freight_chrg",
   "fr_is_active", "fr_is_deleted", "fr_sync_date", "fr_created_on", "fr_created_by",
   "fr_modified_on", "fr_modified_by")
SELECT "fr_id", "fr_from_km", "fr_to_km", "fr_from_weight", "fr_to_weight", "fr_freight_chrg",
       "fr_is_active", "fr_is_deleted", "fr_sync_date", "fr_created_on", "fr_created_by",
       "fr_modified_on", "fr_modified_by"
FROM "sales"."freight_charges";

INSERT INTO "sales"."sale_loading_charges"
  ("ilc_from_weight", "ilc_to_weight", "ilc_load_chrg", "ilc_unload_chrg",
   "ilc_is_active", "ilc_is_deleted", "ilc_sync_date", "ilc_created_on", "ilc_created_by",
   "ilc_modified_on", "ilc_modified_by")
SELECT "fr_from_weight", "fr_to_weight", "fr_load_chrg", "fr_unload_chrg",
       "fr_is_active", "fr_is_deleted", "fr_sync_date", "fr_created_on", "fr_created_by",
       "fr_modified_on", "fr_modified_by"
FROM "sales"."freight_charges";

-- DropTable
-- (also drops the old idx_fr_active index, freeing the name for reuse below)
DROP TABLE "sales"."freight_charges";

-- CreateIndex
CREATE INDEX "idx_fr_active" ON "sales"."sale_freight_charges"("fr_is_active");

-- AddForeignKey
ALTER TABLE "sales"."sale_freight_charges" ADD CONSTRAINT "fk_fr_company_id" FOREIGN KEY ("fr_company_id") REFERENCES "public"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_freight_charges" ADD CONSTRAINT "fk_fr_branch_id" FOREIGN KEY ("fr_branch_id") REFERENCES "public"."branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;
