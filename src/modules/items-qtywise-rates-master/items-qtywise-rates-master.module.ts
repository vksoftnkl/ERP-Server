import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemQtywiseRateExceptionFilter } from './item-qtywise-rate-exception.filter';
import { ItemsQtywiseRatesMasterController } from './items-qtywise-rates-master.controller';
import { ItemsQtywiseRatesMasterService } from './items-qtywise-rates-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsQtywiseRatesMasterController],
  providers: [ItemsQtywiseRatesMasterService, ItemQtywiseRateExceptionFilter],
})
export class ItemsQtywiseRatesMasterModule {}
