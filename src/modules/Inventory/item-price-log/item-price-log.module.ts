import { Module } from '@nestjs/common';
import { ItemPriceLogController } from './item-price-log.controller';
import { ItemPriceLogService } from './item-price-log.service';
import { PriceChangeLogService } from './price-change-log.service';
import { PriceMasterWriter } from './price-master-writer.service';

/**
 * Notes 144 — the price change log: the one writer of the two price tables
 * (exported to the item card, Change Selling Price and qty slab modules), the
 * log it files every change in, and the report's read routes. Imports nothing
 * of those modules, so any of them can import it.
 */
@Module({
  controllers: [ItemPriceLogController],
  providers: [PriceMasterWriter, PriceChangeLogService, ItemPriceLogService],
  exports: [PriceMasterWriter],
})
export class ItemPriceLogModule {}
