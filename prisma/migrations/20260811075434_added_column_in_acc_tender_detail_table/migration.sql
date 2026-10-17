-- AlterTable
ALTER TABLE "accounts"."acc_tender_detail" ADD COLUMN     "td_surcharge_ledger_id" UUID;

-- AddForeignKey
ALTER TABLE "accounts"."acc_tender_detail" ADD CONSTRAINT "fk_td_surcharge_ledger" FOREIGN KEY ("td_surcharge_ledger_id") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;
