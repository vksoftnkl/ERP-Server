-- AddForeignKey
ALTER TABLE "inventory"."item_unit_conversion" ADD CONSTRAINT "fk_iuc_company_id" FOREIGN KEY ("iuc_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
