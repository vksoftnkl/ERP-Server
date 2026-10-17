/*
  Warnings:

  - A unique constraint covering the columns `[sar_code]` on the table `stock_adj_reasons` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "stock_adj_reasons_sar_code_key" ON "fixed"."stock_adj_reasons"("sar_code");
