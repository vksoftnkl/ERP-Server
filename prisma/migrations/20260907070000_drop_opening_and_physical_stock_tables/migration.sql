/*
  Warnings:

  - You are about to drop the `opening_stock_detail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opening_stock_header` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physical_stock_batch_detail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physical_stock_detail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physical_stock_header` table. If the table is not empty, all the data it contains will be lost.

  The opening stock and physical stock (stock take) documents are superseded by the
  stock voucher tables in the `stock` schema. `fixed.stock_adj_reasons` is kept — only
  the physical_stock_detail foreign key into it goes away with the table.

  CASCADE takes the dependent foreign keys, indexes and generated-column defaults with
  each table, so no explicit DropForeignKey / DropIndex statements are needed here.
*/

-- DropTable
DROP TABLE IF EXISTS "stock"."physical_stock_batch_detail" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "stock"."physical_stock_detail" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "stock"."physical_stock_header" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "stock"."opening_stock_detail" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "stock"."opening_stock_header" CASCADE;
