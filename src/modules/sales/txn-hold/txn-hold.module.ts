import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TxnHoldController } from './txn-hold.controller';
import { TxnHoldExceptionFilter } from './txn-hold-exception.filter';
import { TxnHoldService } from './txn-hold.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TxnHoldController],
  providers: [TxnHoldService, TxnHoldExceptionFilter],
  // Exported for the flow that turns a hold into a document and has to stamp the
  // conversion trail inside its own transaction.
  exports: [TxnHoldService],
})
export class TxnHoldModule {}
