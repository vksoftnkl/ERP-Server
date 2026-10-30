-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_seq"
  ADD CONSTRAINT "fk_acc_voucher_seq_company"
  FOREIGN KEY ("seq_company_id")
  REFERENCES "public"."companys"("comp_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_seq"
  ADD CONSTRAINT "fk_acc_voucher_seq_branch"
  FOREIGN KEY ("seq_branch_id")
  REFERENCES "public"."branch_master"("br_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
