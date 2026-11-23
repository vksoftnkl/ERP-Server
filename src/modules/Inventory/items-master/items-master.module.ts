import { Module } from '@nestjs/common';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterController } from './items-master.controller';
import { ItemsMasterService } from './items-master.service';
import { ItemMasterUpdateService } from './item-master-update.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { ItemUnitConversionModule } from '../item-unit-conversion/item-unit-conversion.module';
import { ItemsPriceMasterModule } from '../items-price-master/items-price-master.module';
import { ItemsEanCodeMasterModule } from '../items-ean-code-master/items-ean-code-master.module';
import { ItemsReorderMasterModule } from '../items-reorder-master/items-reorder-master.module';
import { StockTrackPolicyModule } from 'src/modules/stocks/stock-track-policy/stock-track-policy.module';
import { AppSettingsModule } from 'src/modules/settings/appSettings/app-settings.module';
import { CommonPostingModule } from 'src/common/posting/posting.module';
import { ItemHsnCheckService } from './item-hsn-check.service';
@Module({
  imports: [
    AuditLogModule,
    ItemUnitConversionModule,
    ItemsPriceMasterModule,
    ItemsEanCodeMasterModule,
    ItemsReorderMasterModule,
    StockTrackPolicyModule,
    AppSettingsModule, // inventory.hsn_check / hsn_min_length (item master review point 1)
    CommonPostingModule, // StatutoryService.hsnDigits (GST rule 46)
  ],
  controllers: [ItemsMasterController],
  providers: [ItemsMasterService, ItemMasterUpdateService, ItemHsnCheckService, ItemExceptionFilter],
})
export class ItemsMasterModule {}
