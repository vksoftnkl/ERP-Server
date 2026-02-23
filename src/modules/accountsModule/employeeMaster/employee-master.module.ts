import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { EmployeeMasterController } from './employee-master.controller';
import { EmployeeMasterExceptionFilter } from './employee-master-exception.filter';
import { EmployeeMasterService } from './employee-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [EmployeeMasterController],
  providers: [EmployeeMasterService, EmployeeMasterExceptionFilter],
})
export class EmployeeMasterModule {}
