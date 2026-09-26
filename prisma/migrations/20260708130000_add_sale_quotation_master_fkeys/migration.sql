-- Add master-lookup foreign keys for sale_quotation / sale_quotation_item.
-- Deliberately NO FKs for: company/branch/tenant/user (plain uuid + app-layer
-- validation, per current codebase direction), sq_agent_id / sq_session_id /
-- sq_category_id / sqi_scheme_id (no suitable master), sq_src_* / sq_converted_*
-- (polymorphic), and snapshot columns (cust name/addr/gstin, item code/name,
-- hsn, batch, state codes).

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_cust" FOREIGN KEY ("sq_cust_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_cust_area" FOREIGN KEY ("sq_cust_area_id") REFERENCES "sales"."area_master"("arm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_salesman" FOREIGN KEY ("sq_salesman_id") REFERENCES "sales"."salesman_master"("sman_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_price_level" FOREIGN KEY ("sq_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_item" FOREIGN KEY ("sqi_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_unit" FOREIGN KEY ("sqi_unit_id") REFERENCES "inventory"."item_unit_master"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation_item" ADD CONSTRAINT "fk_sqi_price_level" FOREIGN KEY ("sqi_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;
