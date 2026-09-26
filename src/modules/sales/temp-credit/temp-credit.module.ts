import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TempCreditController, TempCreditExceptionFilter } from './temp-credit.controller';
import { TempCreditService } from './temp-credit.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TempCreditController],
  providers: [TempCreditService, TempCreditExceptionFilter],
  exports: [TempCreditService],
})
export class TempCreditModule {}
