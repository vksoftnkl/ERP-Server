/*
  Warnings:

  - You are about to drop the column `tnd_tally_guid` on the `acc_tender_master` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "accounts"."acc_tender_master" DROP COLUMN "tnd_tally_guid";
