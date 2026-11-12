import { Module } from '@nestjs/common';
import { PartyModule } from '../../../common/party/party.module';
import { AccountLedgerMastersModule } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TransporterController } from './transporter.controller';
import { TransporterExceptionFilter } from './transporter-exception.filter';
import { TransporterService } from './transporter.service';

@Module({
  imports: [AuditLogModule, AccountLedgerMastersModule, PartyModule],
  controllers: [TransporterController],
  providers: [TransporterService, TransporterExceptionFilter],
})
export class TransporterModule {}
