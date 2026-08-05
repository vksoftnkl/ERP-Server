import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TransactionHoldController } from './transaction-hold.controller';
import { TransactionHoldExceptionFilter } from './transaction-hold-exception.filter';
import { TransactionHoldService } from './transaction-hold.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TransactionHoldController],
  providers: [TransactionHoldService, TransactionHoldExceptionFilter],
  // Exported for the till flow that turns a hold into a document and has to
  // stamp the conversion trace inside its own transaction.
  exports: [TransactionHoldService],
})
export class TransactionHoldModule {}
