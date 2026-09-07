import { Module } from '@nestjs/common';
import { StockVoucherModule } from '../stock-voucher/stock-voucher.module';
import { OpeningStockVoucherController } from './opening-stock-voucher.controller';

/**
 * The OPENING half of the stock voucher engine: one controller over the shared
 * StockVoucherService, with the voucher type pinned by the route.
 *
 * Imports nothing from the retired `stock.opening_stock_header` / `_detail`
 * module — those tables were dropped in 20260907070000. If a helper there had
 * looked reusable it would have been because it solved the legacy table's
 * problem, not this one: that module wrote its own header and detail rows and
 * left stock ledger and balance posting explicitly out of scope, which is the
 * exact opposite of what this one does.
 */
@Module({
  imports: [StockVoucherModule],
  controllers: [OpeningStockVoucherController],
})
export class OpeningStockVoucherModule {}
