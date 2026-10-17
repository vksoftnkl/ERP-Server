-- CreateTable
CREATE TABLE "inventory"."ItemGstUnits" (
    "item_gst_unit_id" SERIAL NOT NULL,
    "item_gst_unit_code" TEXT,
    "item_gst_unit_name" TEXT,
    "item_gst_unit_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_gst_unit_created_by" TEXT,
    "item_gst_unit_modified_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_gst_unit_modified_by" TEXT,
    "item_gst_unit_sync_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemGstUnits_pkey" PRIMARY KEY ("item_gst_unit_id")
);