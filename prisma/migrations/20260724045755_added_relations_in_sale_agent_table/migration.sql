-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_item" FOREIGN KEY ("iqp_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_item_unit" FOREIGN KEY ("iqp_item_unit_id") REFERENCES "inventory"."item_unit_conversion"("iuc_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_company_id" FOREIGN KEY ("iqp_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_branch_id" FOREIGN KEY ("iqp_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_price_level" FOREIGN KEY ("iqp_price_level") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."item_qty_price" ADD CONSTRAINT "fk_iqp_party_id" FOREIGN KEY ("iqp_party_id") REFERENCES "sales"."customers"("cus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_agents" ADD CONSTRAINT "fk_sa_company_id" FOREIGN KEY ("sa_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_agents" ADD CONSTRAINT "fk_sa_branch_id" FOREIGN KEY ("sa_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_agents" ADD CONSTRAINT "fk_sa_group_id" FOREIGN KEY ("sa_group_id") REFERENCES "sales"."sale_agent_groups"("sa_grp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
