import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { DeviceListMasterController } from './device-list-master.controller';
import { DeviceListMasterExceptionFilter } from './device-list-master-exception.filter';
import { DeviceListMasterService } from './device-list-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [DeviceListMasterController],
  providers: [DeviceListMasterService, DeviceListMasterExceptionFilter],
})
export class DeviceListMasterModule {}
