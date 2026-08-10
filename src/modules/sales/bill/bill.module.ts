import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailModule } from '../../master/charge-detail/charge-detail.module';
import { TenderDetailModule } from '../../accountsModule/tenderDetail/tender-detail.module';
import { BillController } from './bill.controller';
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
@Module({
  // ChargeDetailModule / TenderDetailModule export the services that own the
  // bill's applied charge lines (txn_charge_detail) and its tendered amounts
  // (acc_tender_detail).
  imports: [AuditLogModule, ChargeDetailModule, TenderDetailModule],
  controllers: [BillController],
  providers: [BillService, BillExceptionFilter],
  exports: [BillService],
})
export class BillModule {}
