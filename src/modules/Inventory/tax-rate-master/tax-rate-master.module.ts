import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TaxRateMasterController } from './tax-rate-master.controller';
import { TaxRateMasterExceptionFilter } from './tax-rate-master-exception.filter';
import { TaxRateMasterService } from './tax-rate-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TaxRateMasterController],
  providers: [TaxRateMasterService, TaxRateMasterExceptionFilter],
  exports: [TaxRateMasterService],
})
export class TaxRateMasterModule {}
