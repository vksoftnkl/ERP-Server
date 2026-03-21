/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" VARCHAR(255) NOT NULL,
ADD COLUMN     "username" VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
