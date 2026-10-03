/*
  Warnings:

  - You are about to drop the `sale_charge_detail` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sale_charge_detail" DROP CONSTRAINT "fk_cd_branch";

-- DropForeignKey
ALTER TABLE "sale_charge_detail" DROP CONSTRAINT "fk_cd_charge";

-- DropForeignKey
ALTER TABLE "sale_charge_detail" DROP CONSTRAINT "fk_cd_company";

-- DropForeignKey
ALTER TABLE "sale_charge_detail" DROP CONSTRAINT "fk_cd_ledger";

-- DropTable
DROP TABLE "sale_charge_detail";

-- CreateTable
CREATE TABLE "sales"."sale_charge_detail" (
    "cd_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cd_doc_type" VARCHAR(12) NOT NULL,
    "cd_doc_id" UUID NOT NULL,
    "cd_slno" INTEGER,
    "cd_comp_id" UUID NOT NULL,
    "cd_branch_id" UUID NOT NULL,
    "cd_acc_year" CHAR(9) NOT NULL,
    "cd_voucher_no" BIGINT,
    "cd_chg_id" UUID NOT NULL,
    "cd_chg_name" VARCHAR(100),
    "cd_role" VARCHAR(15),
    "cd_method" VARCHAR(10),
    "cd_type" VARCHAR(10) NOT NULL DEFAULT 'ADD',
    "cd_apply_on" VARCHAR(10),
    "cd_ledger_code" UUID NOT NULL,
    "cd_landing_cost" BOOLEAN NOT NULL DEFAULT false,
    "cd_cost_alloc" VARCHAR(10),
    "cd_before_tax" BOOLEAN NOT NULL DEFAULT false,
    "cd_tax_apl" BOOLEAN NOT NULL DEFAULT false,
    "cd_sep_post" BOOLEAN NOT NULL DEFAULT false,
    "cd_unit" VARCHAR(15),
    "cd_qty_val" DECIMAL(18,4),
    "cd_weight" DECIMAL(18,4),
    "cd_rate" DECIMAL(14,4),
    "cd_amount" DECIMAL(14,4),
    "cd_tax_code" UUID,
    "cd_hsn" VARCHAR(15),
    "cd_tax_perc" DECIMAL(9,4),
    "cd_tax_amt" DECIMAL(14,4),
    "cd_sgst_perc" DECIMAL(9,4),
    "cd_sgst_amt" DECIMAL(14,4),
    "cd_cgst_perc" DECIMAL(9,4),
    "cd_cgst_amt" DECIMAL(14,4),
    "cd_igst_perc" DECIMAL(9,4),
    "cd_igst_amt" DECIMAL(14,4),
    "cd_cess_perc" DECIMAL(9,4),
    "cd_cess_amt" DECIMAL(14,4),
    "cd_net_amt" DECIMAL(14,4),
    "cd_remarks" VARCHAR(255),
    "cd_is_active" BOOLEAN NOT NULL DEFAULT true,
    "cd_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "cd_sync_date" TIMESTAMPTZ,
    "cd_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cd_created_by" UUID,
    "cd_modified_on" TIMESTAMPTZ,
    "cd_modified_by" UUID,

    CONSTRAINT "sale_charge_detail_pkey" PRIMARY KEY ("cd_id")
);

-- CreateIndex
CREATE INDEX "ix_sale_charge_detail_doc" ON "sales"."sale_charge_detail"("cd_doc_type", "cd_doc_id");

-- CreateIndex
CREATE INDEX "ix_sale_charge_detail_chg" ON "sales"."sale_charge_detail"("cd_chg_id");

-- CreateIndex
CREATE INDEX "ix_sale_charge_detail_ledger" ON "sales"."sale_charge_detail"("cd_ledger_code");

-- CreateIndex
CREATE INDEX "ix_sale_charge_detail_comp" ON "sales"."sale_charge_detail"("cd_comp_id");

-- CreateIndex
CREATE INDEX "ix_sale_charge_detail_branch" ON "sales"."sale_charge_detail"("cd_branch_id");

-- AddForeignKey
ALTER TABLE "sales"."sale_charge_detail" ADD CONSTRAINT "fk_cd_charge" FOREIGN KEY ("cd_chg_id") REFERENCES "charge_master"("chg_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales"."sale_charge_detail" ADD CONSTRAINT "fk_cd_ledger" FOREIGN KEY ("cd_ledger_code") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_charge_detail" ADD CONSTRAINT "fk_cd_company" FOREIGN KEY ("cd_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."sale_charge_detail" ADD CONSTRAINT "fk_cd_branch" FOREIGN KEY ("cd_branch_id") REFERENCES "branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;
