import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { AppSettingsModule } from 'src/modules/settings/appSettings/app-settings.module';
import { SellingPriceBulkController } from './selling-price-bulk.controller';
import { SellingPriceBulkExceptionFilter } from './selling-price-bulk-exception.filter';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import { PriceBucketGateway } from './price-bucket.gateway';

/**
 * Change Selling Price (bulk), menu 30.
 *
 * It writes `inventory.item_price_master` — the ONE price table, buckets and
 * headlines alike (plan-nestjs-one-price-table.md) — through PriceBucketGateway,
 * which holds every statement the screen runs. It lives under `stocks/`
 * because what it prices is stock: the grid is one row per live bucket on
 * hand, read from stock.stock_balance.
 *
 * AppSettingsModule exports AppSettingValueService (for §0.3's below-cost
 * setting); AuditLogModule the audit trail every save is filed under. There
 * is no ItemsPriceMasterModule import any more: the headline fan-out it
 * served is gone.
 *
 * PriceBucketGateway is exported as well: the Opening Stock item picker
 * (OpeningStockVoucherModule) seeds a line's MRP and sale price from the same
 * rows, and the rule that every bucket statement lives in that one class is
 * worth more than module tidiness.
 */
@Module({
  imports: [AuditLogModule, AppSettingsModule],
  controllers: [SellingPriceBulkController],
  providers: [SellingPriceBulkService, SellingPriceBulkExceptionFilter, PriceBucketGateway],
  exports: [SellingPriceBulkService, PriceBucketGateway],
})
export class SellingPriceBulkModule {}
