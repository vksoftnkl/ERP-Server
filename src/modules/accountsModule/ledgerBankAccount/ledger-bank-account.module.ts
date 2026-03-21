import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { LedgerBankAccountController } from './ledger-bank-account.controller';
import { LedgerBankAccountExceptionFilter } from './ledger-bank-account-exception.filter';
import { LedgerBankAccountService } from './ledger-bank-account.service';

@Module({
  imports: [AuditLogModule],
  controllers: [LedgerBankAccountController],
  providers: [LedgerBankAccountService, LedgerBankAccountExceptionFilter],
})
export class LedgerBankAccountModule {}
