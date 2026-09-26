import { Module } from '@nestjs/common';
import { ItemPriceExceptionFilter } from './item-price-exception.filter';
import { ItemsPriceMasterController } from './items-price-master.controller';
import { ItemsPriceMasterService } from './items-price-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsPriceMasterController],
  providers: [ItemsPriceMasterService, ItemPriceExceptionFilter],
  exports: [ItemsPriceMasterService],
})
export class ItemsPriceMasterModule {}
