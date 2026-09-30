import { Module } from '@nestjs/common';
import { SellingPriceBulkModule } from '../selling-price-bulk/selling-price-bulk.module';
import { StockVoucherModule } from '../stock-voucher/stock-voucher.module';
import { OpeningStockLookupService } from './opening-stock-lookup.service';
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
 *
 * SellingPriceBulkModule is imported for one provider, PriceBucketGateway:
 * the item picker seeds a line's MRP and sale price from the price table's
 * bucket rows (inventory.item_price_master), and every statement that reads
 * that table by bucket lives in that gateway.
 * OpeningStockLookupService is this module's own — the picker is the one read
 * on the screen that is not a document operation, so it is not on
 * StockVoucherService.
 */
@Module({
  imports: [StockVoucherModule, SellingPriceBulkModule],
  controllers: [OpeningStockVoucherController],
  providers: [OpeningStockLookupService],
})
export class OpeningStockVoucherModule {}
