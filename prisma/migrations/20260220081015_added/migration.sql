/*
  Warnings:

  - You are about to alter the column `log_ip` on the `audit_log` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- AlterTable
ALTER TABLE "audit"."audit_log" ALTER COLUMN "log_ip" SET DATA TYPE inet;

-- AlterTable
ALTER TABLE "category_master" ALTER COLUMN "category_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "godown_locations" ALTER COLUMN "gdl_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_group_master" ALTER COLUMN "itg_path_ids_cache" SET DEFAULT '{}'::uuid[];

-- AlterTable
ALTER TABLE "item_section_master" ALTER COLUMN "sec_path_ids" SET DEFAULT '{}'::uuid[];
