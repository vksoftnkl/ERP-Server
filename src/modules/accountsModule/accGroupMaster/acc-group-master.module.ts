import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AccGroupMasterExceptionFilter } from './acc-group-master-exception.filter';
import { AccGroupMasterController } from './acc-group-master.controller';
import { AccGroupMasterService } from './acc-group-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AccGroupMasterController],
  providers: [AccGroupMasterService, AccGroupMasterExceptionFilter],
})
export class AccGroupMasterModule {}
