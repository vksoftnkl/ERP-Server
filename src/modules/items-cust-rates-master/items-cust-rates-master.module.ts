import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemCustRateExceptionFilter } from './item-cust-rate-exception.filter';
import { ItemsCustRatesMasterController } from './items-cust-rates-master.controller';
import { ItemsCustRatesMasterService } from './items-cust-rates-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsCustRatesMasterController],
  providers: [ItemsCustRatesMasterService, ItemCustRateExceptionFilter],
})
export class ItemsCustRatesMasterModule {}
