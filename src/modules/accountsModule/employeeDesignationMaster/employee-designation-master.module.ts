import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { EmployeeDesignationMasterController } from './employee-designation-master.controller';
import { EmployeeDesignationMasterExceptionFilter } from './employee-designation-master-exception.filter';
import { EmployeeDesignationMasterService } from './employee-designation-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [EmployeeDesignationMasterController],
  providers: [EmployeeDesignationMasterService, EmployeeDesignationMasterExceptionFilter],
})
export class EmployeeDesignationMasterModule {}
