import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemPriceExceptionFilter } from './item-price-exception.filter';
import { ItemsPriceMasterController } from './items-price-master.controller';
import { ItemsPriceMasterService } from './items-price-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsPriceMasterController],
  providers: [ItemsPriceMasterService, ItemPriceExceptionFilter],
})
export class ItemsPriceMasterModule {}
