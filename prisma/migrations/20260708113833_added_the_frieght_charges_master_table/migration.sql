-- CreateTable
CREATE TABLE "sales"."freight_charges" (
    "fr_id" UUID NOT NULL DEFAULT uuidv7(),
    "fr_from_km" INTEGER DEFAULT 0,
    "fr_to_km" INTEGER DEFAULT 0,
    "fr_freight_chrg" DECIMAL DEFAULT 0.0,
    "fr_from_weight" DECIMAL DEFAULT 0.0,
    "fr_to_weight" DECIMAL DEFAULT 0.0,
    "fr_load_chrg" DECIMAL DEFAULT 0.0,
    "fr_unload_chrg" DECIMAL DEFAULT 0.0,
    "fr_is_active" BOOLEAN NOT NULL DEFAULT true,
    "fr_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "fr_sync_date" TIMESTAMPTZ,
    "fr_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fr_created_by" VARCHAR(100),
    "fr_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fr_modified_by" VARCHAR(100),

    CONSTRAINT "freight_charges_pkey" PRIMARY KEY ("fr_id")
);

-- CreateIndex
CREATE INDEX "idx_fr_active" ON "sales"."freight_charges"("fr_is_active");
