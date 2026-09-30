import { Module } from '@nestjs/common';
import { ItemPriceExceptionFilter } from './item-price-exception.filter';
import { ItemsPriceMasterController } from './items-price-master.controller';
import { ItemsPriceMasterService } from './items-price-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { AppSettingsModule } from 'src/modules/settings/appSettings/app-settings.module';
import { PriceBucketService } from './price-bucket.service';

@Module({
  // AppSettingsModule: a sale-price bucket mirrors sales.default_price_level,
  // read through AppSettingValueService.resolveEffective (PriceBucketService).
  imports: [AuditLogModule, AppSettingsModule],
  controllers: [ItemsPriceMasterController],
  providers: [ItemsPriceMasterService, PriceBucketService, ItemPriceExceptionFilter],
  exports: [ItemsPriceMasterService, PriceBucketService],
})
export class ItemsPriceMasterModule {}
