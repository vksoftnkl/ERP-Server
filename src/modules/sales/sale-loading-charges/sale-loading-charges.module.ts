import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { SaleLoadingChargeController } from './sale-loading-charges.controller';
import { SaleLoadingChargeExceptionFilter } from './sale-loading-charges-exception.filter';
import { SaleLoadingChargeService } from './sale-loading-charges.service';

@Module({
  imports: [AuditLogModule],
  controllers: [SaleLoadingChargeController],
  providers: [SaleLoadingChargeService, SaleLoadingChargeExceptionFilter],
})
export class SaleLoadingChargeModule {}
