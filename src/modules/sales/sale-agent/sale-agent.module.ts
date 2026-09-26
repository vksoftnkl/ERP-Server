import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountLedgerMastersModule } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { SaleAgentController } from './sale-agent.controller';
import { SaleAgentExceptionFilter } from './sale-agent-exception.filter';
import { SaleAgentService } from './sale-agent.service';

@Module({
  imports: [AuditLogModule, AccountLedgerMastersModule],
  controllers: [SaleAgentController],
  providers: [SaleAgentService, SaleAgentExceptionFilter],
})
export class SaleAgentModule {}
