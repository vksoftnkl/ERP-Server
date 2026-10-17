import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeDetailController } from './charge-detail.controller';
import { ChargeDetailExceptionFilter } from './charge-detail-exception.filter';
import { ChargeDetailService } from './charge-detail.service';
@Module({
  imports: [AuditLogModule],
  controllers: [ChargeDetailController],
  providers: [ChargeDetailService, ChargeDetailExceptionFilter],
  exports: [ChargeDetailService],
})
export class ChargeDetailModule {}
