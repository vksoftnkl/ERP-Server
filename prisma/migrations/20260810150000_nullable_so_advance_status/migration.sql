-- sales.sale_order is LIST-partitioned by so_acc_year; a plain ALTER TABLE on
-- the parent recurses into every partition, so no per-partition statement is
-- needed here.
-- AlterTable
ALTER TABLE "sales"."sale_order" ALTER COLUMN "so_advance_status" DROP NOT NULL;
