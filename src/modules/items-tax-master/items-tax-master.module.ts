import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemTaxExceptionFilter } from './item-tax-exception.filter';
import { ItemsTaxMasterController } from './items-tax-master.controller';
import { ItemsTaxMasterService } from './items-tax-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsTaxMasterController],
  providers: [ItemsTaxMasterService, ItemTaxExceptionFilter],
})
export class ItemsTaxMasterModule {}
