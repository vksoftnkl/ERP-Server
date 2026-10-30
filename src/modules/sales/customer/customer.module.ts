import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountLedgerMastersModule } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { CustomerController } from './customer.controller';
import { CustomerExceptionFilter } from './customer-exception.filter';
import { CustomerService } from './customer.service';
import { PartyModule } from '../../../common/party/party.module';

@Module({
  imports: [AuditLogModule, AccountLedgerMastersModule, PartyModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerExceptionFilter],
})
export class CustomerModule {}
