-- CreateTable
CREATE TABLE "fixed"."stock_adj_reasons" (
    "sar_id" UUID NOT NULL DEFAULT uuidv7(),
    "sar_code" VARCHAR(30) NOT NULL,
    "sar_name" VARCHAR(150) NOT NULL,
    "sar_reason_kind" VARCHAR(30) NOT NULL,
    "sar_default_resolution" VARCHAR(30) NOT NULL,
    "sar_affects_accounts" BOOLEAN NOT NULL DEFAULT true,
    "sar_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sar_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sar_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sar_created_by" UUID,
    "sar_modified_on" TIMESTAMPTZ(6),
    "sar_modified_by" UUID,

    CONSTRAINT "stock_adj_reasons_pkey" PRIMARY KEY ("sar_id")
);
