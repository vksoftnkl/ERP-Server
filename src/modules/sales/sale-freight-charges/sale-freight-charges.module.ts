import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { SaleFreightChargeController } from './sale-freight-charges.controller';
import { SaleFreightChargeExceptionFilter } from './sale-freight-charges-exception.filter';
import { SaleFreightChargeService } from './sale-freight-charges.service';
@Module({
  imports: [AuditLogModule],
  controllers: [SaleFreightChargeController],
  providers: [SaleFreightChargeService, SaleFreightChargeExceptionFilter],
})
export class SaleFreightChargeModule {}