-- AlterTable
ALTER TABLE "sales"."sale_loading_charges" ADD COLUMN     "ilc_branch_id" UUID,
ADD COLUMN     "ilc_comp_id" UUID;

-- AddForeignKey
ALTER TABLE "sales"."sale_loading_charges" ADD CONSTRAINT "fk_ilc_comp_id" FOREIGN KEY ("ilc_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_loading_charges" ADD CONSTRAINT "fk_ilc_branch_id" FOREIGN KEY ("ilc_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;
