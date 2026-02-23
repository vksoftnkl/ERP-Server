import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ItemTaxHistoryExceptionFilter } from './item-tax-history-exception.filter';
import { ItemsTaxHistoryMasterController } from './items-tax-history-master.controller';
import { ItemsTaxHistoryMasterService } from './items-tax-history-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ItemsTaxHistoryMasterController],
  providers: [ItemsTaxHistoryMasterService, ItemTaxHistoryExceptionFilter],
})
export class ItemsTaxHistoryMasterModule {}
