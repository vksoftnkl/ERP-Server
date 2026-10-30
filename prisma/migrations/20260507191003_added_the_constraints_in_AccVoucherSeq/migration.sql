-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_company_branch_year" ON "accounts"."acc_voucher_seq"("seq_company_id", "seq_branch_id", "seq_acc_year");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_vchr_type" ON "accounts"."acc_voucher_seq"("seq_vchr_type_id");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_device" ON "accounts"."acc_voucher_seq"("seq_device_id");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_period_key" ON "accounts"."acc_voucher_seq"("seq_period_key");

-- CreateIndex
CREATE INDEX "idx_acc_voucher_seq_status" ON "accounts"."acc_voucher_seq"("seq_is_active", "seq_is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "uq_acc_voucher_seq_scope" ON "accounts"."acc_voucher_seq"("seq_vchr_type_id", "seq_company_id", "seq_branch_id", "seq_acc_year", "seq_device_code", "seq_period_key");

-- RenameForeignKey
ALTER TABLE "accounts"."acc_voucher_seq" RENAME CONSTRAINT "fk_acc_voucher_seq_voucher_type" TO "fk_acc_voucher_seq_type";
