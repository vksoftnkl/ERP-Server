import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { AppSettingsModule } from 'src/modules/settings/appSettings/app-settings.module';
import { ItemsPriceMasterModule } from 'src/modules/Inventory/items-price-master/items-price-master.module';
import { SellingPriceBulkController } from './selling-price-bulk.controller';
import { SellingPriceBulkExceptionFilter } from './selling-price-bulk-exception.filter';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import { StockMrpPriceGateway } from './stock-mrp-price.gateway';

/**
 * Change Selling Price (bulk), menu 30.
 *
 * Under `stocks/` because the table it OWNS is `stock.stock_mrp_price`, even
 * though half its fan-out lands in `inventory.item_price_master`. The table
 * decides where a module lives; the destinations of its writes do not.
 *
 * All three imports are load-bearing and all three already export what is
 * needed: AppSettingsModule exports AppSettingValueService (for §0.3's
 * below-cost setting), ItemsPriceMasterModule exports ItemsPriceMasterService
 * (whose `save(rows, tx)` takes this module's transaction, §6), and
 * AuditLogModule the audit trail every write here is filed under.
 */
@Module({
  imports: [AuditLogModule, AppSettingsModule, ItemsPriceMasterModule],
  controllers: [SellingPriceBulkController],
  providers: [SellingPriceBulkService, SellingPriceBulkExceptionFilter, StockMrpPriceGateway],
  exports: [SellingPriceBulkService],
})
export class SellingPriceBulkModule {}
