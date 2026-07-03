import { Module } from '@nestjs/common';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterController } from './items-master.controller';
import { ItemsMasterService } from './items-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { ItemUnitConversionModule } from '../item-unit-conversion/item-unit-conversion.module';
import { ItemsPriceMasterModule } from '../items-price-master/items-price-master.module';
import { ItemsEanCodeMasterModule } from '../items-ean-code-master/items-ean-code-master.module';
import { ItemsReorderMasterModule } from '../items-reorder-master/items-reorder-master.module';
@Module({
  imports: [
    AuditLogModule,
    ItemUnitConversionModule,
    ItemsPriceMasterModule,
    ItemsEanCodeMasterModule,
    ItemsReorderMasterModule,
  ],
  controllers: [ItemsMasterController],
  providers: [ItemsMasterService, ItemExceptionFilter],
})
export class ItemsMasterModule {}
