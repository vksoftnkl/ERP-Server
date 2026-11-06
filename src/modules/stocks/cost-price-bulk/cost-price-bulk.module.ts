import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { AppSettingsModule } from 'src/modules/settings/appSettings/app-settings.module';
import { ItemPriceLogModule } from '../../Inventory/item-price-log/item-price-log.module';
import { CostPriceBulkExceptionFilter } from './cost-price-bulk-exception.filter';
import { CostPriceBulkController } from './cost-price-bulk.controller';
import { CostPriceBulkGateway } from './cost-price-bulk.gateway';
import { CostPriceBulkService } from './cost-price-bulk.service';

/**
 * Cost Price – Bulk Change, menu 298 (plan 2026-11-05). Writes prices only
 * through ItemPriceLogModule's PriceMasterWriter; AppSettingsModule gives the
 * below-cost setting, AuditLogModule the audit trail. The error filter
 * extends Change Selling Price's (plus the numeric-overflow 422).
 */
@Module({
  imports: [AuditLogModule, AppSettingsModule, ItemPriceLogModule],
  controllers: [CostPriceBulkController],
  providers: [CostPriceBulkService, CostPriceBulkGateway, CostPriceBulkExceptionFilter],
})
export class CostPriceBulkModule {}
