import { Module } from '@nestjs/common';
import { ItemQtywiseRateExceptionFilter } from './item-qtywise-rate-exception.filter';
import { ItemsQtywiseRatesMasterController } from './items-qtywise-rates-master.controller';
import { ItemsQtywiseRatesMasterService } from './items-qtywise-rates-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsQtywiseRatesMasterController],
  providers: [ItemsQtywiseRatesMasterService, ItemQtywiseRateExceptionFilter],
})
export class ItemsQtywiseRatesMasterModule {}
