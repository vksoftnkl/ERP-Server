-- CreateTable
CREATE TABLE "configs" (
    "config_id" INTEGER NOT NULL,
    "config_name" TEXT,
    "config_value" TEXT,
    "config_sync_date" TIMESTAMPTZ(0),
    "config_created_by" VARCHAR(100),
    "config_created_on" TIMESTAMPTZ(0),
    "config_modified_by" VARCHAR(100),
    "config_modified_on" TIMESTAMPTZ(0),

    CONSTRAINT "configs_pkey" PRIMARY KEY ("config_id")
);
