import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { FreightChargesController } from './freight-charges.controller';
import { FreightChargesExceptionFilter } from './freight-charges-exception.filter';
import { FreightChargesService } from './freight-charges.service';

@Module({
  imports: [AuditLogModule],
  controllers: [FreightChargesController],
  providers: [FreightChargesService, FreightChargesExceptionFilter],
})
export class FreightChargesModule {}
