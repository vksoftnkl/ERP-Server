-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_header"
ADD CONSTRAINT "fk_osh_company"
FOREIGN KEY ("osh_company_id") REFERENCES "public"."companys"("comp_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_header"
ADD CONSTRAINT "fk_osh_branch"
FOREIGN KEY ("osh_branch_id") REFERENCES "public"."branch_master"("br_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail"
ADD CONSTRAINT "fk_osl_company"
FOREIGN KEY ("osl_company_id") REFERENCES "public"."companys"("comp_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail"
ADD CONSTRAINT "fk_osl_branch"
FOREIGN KEY ("osl_branch_id") REFERENCES "public"."branch_master"("br_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
