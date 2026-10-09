import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountLedgerMastersModule } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { EmployeeMasterController } from './employee-master.controller';
import { EmployeeMasterExceptionFilter } from './employee-master-exception.filter';
import { EmployeeMasterService } from './employee-master.service';
import { StaffAdvanceLedgerService } from './staff-advance-ledger.service';

@Module({
  imports: [AuditLogModule, AccountLedgerMastersModule],
  controllers: [EmployeeMasterController],
  providers: [EmployeeMasterService, StaffAdvanceLedgerService, EmployeeMasterExceptionFilter],
})
export class EmployeeMasterModule {}
