-- DropIndex
DROP INDEX "accounts"."idx_acc_group_type_code";

-- AlterTable
ALTER TABLE "accounts"."account_groups" DROP COLUMN "acc_group_type_code",
ADD COLUMN     "acc_group_is_reserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acc_group_tally_alter_id" BIGINT,
ADD COLUMN     "acc_group_tally_guid" VARCHAR(64),
ADD COLUMN     "acc_group_tally_master_id" BIGINT,
ADD COLUMN     "acc_group_type" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE INDEX "idx_acc_group_type" ON "accounts"."account_groups"("acc_group_type");
