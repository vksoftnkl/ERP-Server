import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ChargeMasterController } from './charge-master.controller';
import { ChargeMasterExceptionFilter } from './charge-master-exception.filter';
import { ChargeMasterService } from './charge-master.service';
@Module({
  imports: [AuditLogModule],
  controllers: [ChargeMasterController],
  providers: [ChargeMasterService, ChargeMasterExceptionFilter],
})
export class ChargeMasterModule {}