-- Link sale_quotation_item to inventory.item_unit_conversion via a new nullable
-- sqi_item_unit_id column; the FK only constrains rows that carry a unit conversion.

-- AlterTable
ALTER TABLE "sales"."sale_quotation_item" ADD COLUMN "sqi_item_unit_id" UUID;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_item_unit" FOREIGN KEY ("sqi_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;
