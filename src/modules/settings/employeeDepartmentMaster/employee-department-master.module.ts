import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { EmployeeDepartmentMasterController } from './employee-department-master.controller';
import { EmployeeDepartmentMasterExceptionFilter } from './employee-department-master-exception.filter';
import { EmployeeDepartmentMasterService } from './employee-department-master.service';
@Module({
  imports: [AuditLogModule],
  controllers: [EmployeeDepartmentMasterController],
  providers: [EmployeeDepartmentMasterService, EmployeeDepartmentMasterExceptionFilter],
})
export class EmployeeDepartmentMasterModule {}
