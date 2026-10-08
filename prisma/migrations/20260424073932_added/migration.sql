-- CreateTable
CREATE TABLE "batches_prefix" (
    "id" UUID NOT NULL,
    "prefix_used" TEXT,
    "sync_date" TIMESTAMPTZ(0),
    "created_by" VARCHAR(100),
    "created_on" TIMESTAMPTZ(0),
    "modified_by" VARCHAR(100),
    "modified_on" TIMESTAMPTZ(0),

    CONSTRAINT "batches_prefix_pkey" PRIMARY KEY ("id")
);
