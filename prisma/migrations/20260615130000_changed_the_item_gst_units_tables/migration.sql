-- Rename inventory."ItemGstUnits" to inventory.item_gst_units to follow the snake_case table
-- naming convention (the model now carries @@map("item_gst_units")).
--
-- Authored as a rename rather than the drop+create that `prisma migrate dev` autogenerates for a
-- @@map change, so the 44 seeded GST UQC rows (20260615123000_seed_item_gst_units) are preserved.
-- The primary-key constraint and identity sequence are renamed too so their names match what Prisma
-- would generate for the new table name and no naming drift is reported on the next migrate dev.

ALTER TABLE "inventory"."ItemGstUnits" RENAME TO "item_gst_units";
ALTER TABLE "inventory"."item_gst_units" RENAME CONSTRAINT "ItemGstUnits_pkey" TO "item_gst_units_pkey";
ALTER SEQUENCE "inventory"."ItemGstUnits_item_gst_unit_id_seq" RENAME TO "item_gst_units_item_gst_unit_id_seq";
