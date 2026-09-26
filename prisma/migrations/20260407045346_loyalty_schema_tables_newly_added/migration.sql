/*
  Warnings:

  - You are about to drop the `loyaltysch_gift` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `loyaltysch_list` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `loyaltysch_points` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "loyaltysch_gift" DROP CONSTRAINT "loyaltysch_gift_gift_ls_id_fkey";

-- DropForeignKey
ALTER TABLE "loyaltysch_points" DROP CONSTRAINT "loyaltysch_points_lspt_ls_id_fkey";

-- DropTable
DROP TABLE "loyaltysch_gift";

-- DropTable
DROP TABLE "loyaltysch_list";

-- DropTable
DROP TABLE "loyaltysch_points";

-- RenameForeignKey
ALTER TABLE "sales"."loyalty_sch_gift" RENAME CONSTRAINT "fk_loyalty_sch_gift_ls_id" TO "loyalty_sch_gift_lsg_ls_id_fkey";

-- RenameForeignKey
ALTER TABLE "sales"."loyalty_sch_party" RENAME CONSTRAINT "fk_loyalty_sch_party_ls_id" TO "loyalty_sch_party_lps_ls_id_fkey";

-- RenameForeignKey
ALTER TABLE "sales"."loyalty_sch_points" RENAME CONSTRAINT "fk_loyalty_sch_points_ls_id" TO "loyalty_sch_points_lspt_ls_id_fkey";
