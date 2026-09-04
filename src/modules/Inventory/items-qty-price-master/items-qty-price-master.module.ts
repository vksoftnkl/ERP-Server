import { Module } from '@nestjs/common';
import { ItemQtyPriceExceptionFilter } from './item-qty-price-exception.filter';
import { ItemsQtyPriceMasterController } from './items-qty-price-master.controller';
import { ItemsQtyPriceMasterService } from './items-qty-price-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsQtyPriceMasterController],
  providers: [ItemsQtyPriceMasterService, ItemQtyPriceExceptionFilter],
  exports: [ItemsQtyPriceMasterService],
})
export class ItemsQtyPriceMasterModule {}
