import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountLedgerMasterExceptionFilter } from './account-ledger-master-exception.filter';
import { AccountLedgerMastersController } from './account-ledger-masters.controller';
import { AccountLedgerMastersService } from './account-ledger-masters.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AccountLedgerMastersController],
  providers: [AccountLedgerMastersService, AccountLedgerMasterExceptionFilter],
})
export class AccountLedgerMastersModule {}
