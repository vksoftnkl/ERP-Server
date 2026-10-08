import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { LedgerMapController } from './ledger-map.controller';
import { LedgerMapExceptionFilter } from './ledger-map-exception.filter';
import { LedgerMapService } from './ledger-map.service';

@Module({
  imports: [AuditLogModule],
  controllers: [LedgerMapController],
  providers: [LedgerMapService, LedgerMapExceptionFilter],
})
export class LedgerMapModule {}
