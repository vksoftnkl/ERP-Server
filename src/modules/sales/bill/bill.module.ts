import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { BillController } from './bill.controller';
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
@Module({
  imports: [AuditLogModule],
  controllers: [BillController],
  providers: [BillService, BillExceptionFilter],
  exports: [BillService],
})
export class BillModule {}
