-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_header"
ADD CONSTRAINT "fk_osh_voucher_header"
FOREIGN KEY ("osh_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail"
ADD CONSTRAINT "fk_osl_voucher_header"
FOREIGN KEY ("osl_voucher_id") REFERENCES "accounts"."acc_voucher_header"("avh_voucher_id")
ON DELETE CASCADE
ON UPDATE CASCADE;
