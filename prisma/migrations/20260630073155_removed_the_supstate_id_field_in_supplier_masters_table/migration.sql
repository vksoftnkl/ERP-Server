/*
  Warnings:

  - You are about to drop the column `sup_state_id` on the `suppliers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "purchase"."suppliers" DROP COLUMN "sup_state_id";
