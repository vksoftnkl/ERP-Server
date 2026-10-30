import { Module } from '@nestjs/common';
import { ItemQtyPriceExceptionFilter } from './item-qty-price-exception.filter';
import { ItemsQtyPriceMasterController } from './items-qty-price-master.controller';
import { ItemsQtyPriceMasterService } from './items-qty-price-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { ItemPriceLogModule } from '../item-price-log/item-price-log.module';

@Module({
  // ItemPriceLogModule: every slab write goes through its PriceMasterWriter (notes 144).
  imports: [AuditLogModule, ItemPriceLogModule],
  controllers: [ItemsQtyPriceMasterController],
  providers: [ItemsQtyPriceMasterService, ItemQtyPriceExceptionFilter],
  exports: [ItemsQtyPriceMasterService],
})
export class ItemsQtyPriceMasterModule {}
