/*
  Warnings:

  - The `isb_tracking_type` column on the `item_stock_balance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isb_stock_bucket` column on the `item_stock_balance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `stl_tracking_type` column on the `item_stock_ledger` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `stl_txn_type` on the `item_stock_ledger` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "inventory"."item_stock_balance" DROP COLUMN "isb_tracking_type",
ADD COLUMN     "isb_tracking_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
DROP COLUMN "isb_stock_bucket",
ADD COLUMN     "isb_stock_bucket" VARCHAR(20) NOT NULL DEFAULT 'SALEABLE';

-- AlterTable
ALTER TABLE "inventory"."item_stock_ledger" DROP COLUMN "stl_txn_type",
ADD COLUMN     "stl_txn_type" VARCHAR(30) NOT NULL,
DROP COLUMN "stl_tracking_type",
ADD COLUMN     "stl_tracking_type" VARCHAR(20) NOT NULL DEFAULT 'NONE';

-- DropEnum
DROP TYPE "inventory"."ItemStockBalanceTrackingType";

-- DropEnum
DROP TYPE "inventory"."StockTrackingType";

-- DropEnum
DROP TYPE "inventory"."StockTxnType";

-- CreateIndex
CREATE UNIQUE INDEX "uq_isb_balance_scope" ON "inventory"."item_stock_balance"("isb_acc_year", "isb_company_id", "isb_branch_id", "isb_godown_id", "isb_item_id", "isb_unit_id", "isb_stock_bucket");
