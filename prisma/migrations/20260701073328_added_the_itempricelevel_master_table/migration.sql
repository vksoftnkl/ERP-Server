-- CreateTable
CREATE TABLE "inventory"."item_price_levels" (
    "ipl_id" SERIAL NOT NULL,
    "ipl_name" TEXT NOT NULL,
    "ipl_uname" TEXT NOT NULL,
    "ipl_status" BOOLEAN NOT NULL DEFAULT true,
    "ipl_admin" BOOLEAN NOT NULL DEFAULT false,
    "ipl_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ipl_created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipl_sync_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipl_created_by" TEXT NOT NULL,
    "ipl_modified_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipl_modified_by" TEXT NOT NULL,

    CONSTRAINT "item_price_levels_pkey" PRIMARY KEY ("ipl_id")
);
