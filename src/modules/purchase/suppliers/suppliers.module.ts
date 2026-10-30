import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccountLedgerMastersModule } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { SupplierExceptionFilter } from './supplier-exception.filter';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PartyModule } from '../../../common/party/party.module';

@Module({
  imports: [AuditLogModule, AccountLedgerMastersModule, PartyModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, SupplierExceptionFilter],
})
export class SuppliersModule {}
