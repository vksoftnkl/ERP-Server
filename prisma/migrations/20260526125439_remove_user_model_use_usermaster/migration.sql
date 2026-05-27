-- DropForeignKey
ALTER TABLE "accounts"."acc_voucher_header" DROP CONSTRAINT "fk_acc_voucher_header_voucher_user";

-- DropForeignKey
ALTER TABLE "accounts"."acc_vouchers" DROP CONSTRAINT "fk_acc_vouchers_voucher_user";

-- Remap old users.user_id → user_master.usrId for VKPOS
UPDATE "accounts"."acc_voucher_header"
SET "avh_user_id" = '019e441b-6e48-7918-b246-b857ffb35db1'
WHERE "avh_user_id" = '5359b3c6-78b8-45bd-aa0d-819d3d3dd0e6';

UPDATE "accounts"."acc_vouchers"
SET "av_user_id" = '019e441b-6e48-7918-b246-b857ffb35db1'
WHERE "av_user_id" = '5359b3c6-78b8-45bd-aa0d-819d3d3dd0e6';

-- AddForeignKey
ALTER TABLE "accounts"."acc_voucher_header" ADD CONSTRAINT "fk_acc_voucher_header_voucher_user" FOREIGN KEY ("avh_user_id") REFERENCES "user_master"("usrId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."acc_vouchers" ADD CONSTRAINT "fk_acc_vouchers_voucher_user" FOREIGN KEY ("av_user_id") REFERENCES "user_master"("usrId") ON DELETE RESTRICT ON UPDATE CASCADE;
