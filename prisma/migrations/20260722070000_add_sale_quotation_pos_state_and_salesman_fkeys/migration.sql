-- AlterTable
ALTER TABLE "sales"."sale_quotation" ADD COLUMN "sq_state_name" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_pos_state" FOREIGN KEY ("sq_pos_stcd") REFERENCES "fixed"."state_codes"("state_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_quotation" ADD CONSTRAINT "fk_sq_salesman" FOREIGN KEY ("sq_salesman_id") REFERENCES "public"."employee_master"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
