-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail" ADD CONSTRAINT "fk_osl_unit" FOREIGN KEY ("osl_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail" ADD CONSTRAINT "fk_osl_base_uom_price" FOREIGN KEY ("osl_base_uom_id") REFERENCES "inventory"."item_price_master"("ipm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail" ADD CONSTRAINT "fk_osl_godown" FOREIGN KEY ("osl_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;
