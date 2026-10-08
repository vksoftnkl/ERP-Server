-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_company" FOREIGN KEY ("psb_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_branch" FOREIGN KEY ("psb_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_godown" FOREIGN KEY ("psb_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_item" FOREIGN KEY ("psb_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_unit" FOREIGN KEY ("psb_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_batch_detail" ADD CONSTRAINT "fk_physical_stock_batch_detail_base_unit" FOREIGN KEY ("psb_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_company" FOREIGN KEY ("psd_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_branch" FOREIGN KEY ("psd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_godown" FOREIGN KEY ("psd_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_item" FOREIGN KEY ("psd_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_unit" FOREIGN KEY ("psd_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_detail" ADD CONSTRAINT "fk_physical_stock_detail_base_unit" FOREIGN KEY ("psd_base_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_header" ADD CONSTRAINT "fk_physical_stock_header_company" FOREIGN KEY ("psc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_header" ADD CONSTRAINT "fk_physical_stock_header_branch" FOREIGN KEY ("psc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."physical_stock_header" ADD CONSTRAINT "fk_physical_stock_header_godown" FOREIGN KEY ("psc_godown_id") REFERENCES "inventory"."godown_locations"("gdl_id") ON DELETE RESTRICT ON UPDATE CASCADE;
