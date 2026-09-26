-- AddForeignKey
ALTER TABLE "fixed"."device_master" ADD CONSTRAINT "device_master_dev_branch_id_fkey" FOREIGN KEY ("dev_branch_id") REFERENCES "branch_master"("br_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."device_master" ADD CONSTRAINT "device_master_dev_user_id_fkey" FOREIGN KEY ("dev_user_id") REFERENCES "user_master"("usrId") ON DELETE SET NULL ON UPDATE CASCADE;
