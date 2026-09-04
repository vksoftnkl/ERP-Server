-- DropForeignKey
ALTER TABLE "branch_master" DROP CONSTRAINT "branch_master_comp_id_fkey";

-- DropIndex
DROP INDEX "idx_branch_comp_id";

-- AlterTable
-- Rename comp_id -> br_comp_id in place to preserve the 6 existing rows
-- (Prisma cannot detect renames, so its generated diff would drop+add the
-- column, which fails on a required column without a default).
ALTER TABLE "branch_master" RENAME COLUMN "comp_id" TO "br_comp_id";

-- CreateIndex
CREATE INDEX "idx_branch_comp_id" ON "branch_master"("br_comp_id");

-- AddForeignKey
ALTER TABLE "branch_master" ADD CONSTRAINT "branch_master_br_comp_id_fkey" FOREIGN KEY ("br_comp_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
