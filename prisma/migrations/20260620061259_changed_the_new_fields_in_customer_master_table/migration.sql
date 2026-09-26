/*
  Warnings:

  - You are about to drop the column `authorize_signature` on the `companys` table. All the data in the column will be lost.
  - You are about to drop the column `books_lock_date` on the `companys` table. All the data in the column will be lost.
  - You are about to drop the column `cin_no` on the `companys` table. All the data in the column will be lost.
  - You are about to drop the column `regionalname` on the `companys` table. All the data in the column will be lost.
  - You are about to drop the column `tan_no` on the `companys` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companys" DROP COLUMN "authorize_signature",
DROP COLUMN "books_lock_date",
DROP COLUMN "cin_no",
DROP COLUMN "regionalname",
DROP COLUMN "tan_no",
ADD COLUMN     "comp_authorize_signature" TEXT,
ADD COLUMN     "comp_books_lock_date" DATE,
ADD COLUMN     "comp_cin_no" TEXT,
ADD COLUMN     "comp_regionalname" TEXT,
ADD COLUMN     "comp_tan_no" TEXT;
