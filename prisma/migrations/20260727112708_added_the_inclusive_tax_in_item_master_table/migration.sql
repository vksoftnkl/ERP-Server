-- AlterTable
ALTER TABLE "inventory"."item_master" ADD COLUMN     "item_inclusive_of_tax" BOOLEAN NOT NULL DEFAULT false;
