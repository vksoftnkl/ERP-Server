import { Module } from '@nestjs/common';
import { StockVoucherModule } from '../stock-voucher/stock-voucher.module';
import { PhysicalStockVoucherController } from './physical-stock-voucher.controller';
/**
 * The PHYSICAL COUNT half of the stock voucher engine: one controller over the
 * shared StockVoucherService, with the voucher type pinned by the route.
 *
 * THE SECOND CONSUMER OF THE EXPORTED SERVICE, and the first proof that
 * exporting it was right — a count is not a third copy of save/post/cancel, it
 * is a third rules record over the same two tables.
 *
 * It imports nothing from the retired inventory.physical_stock_header /
 * _detail / _batch_detail module: those tables were dropped by
 * 20260509061137_remove_four_tables, and the `nest g resource` output written
 * against them knows nothing about svi_counted_qty or the engine.
 */
@Module({
  imports: [StockVoucherModule],
  controllers: [PhysicalStockVoucherController],
})
export class PhysicalStockVoucherModule {}
