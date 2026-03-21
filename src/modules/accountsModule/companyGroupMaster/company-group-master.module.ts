import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { CompanyGroupMasterController } from './company-group-master.controller';
import { CompanyGroupMasterExceptionFilter } from './company-group-master-exception.filter';
import { CompanyGroupMasterService } from './company-group-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [CompanyGroupMasterController],
  providers: [CompanyGroupMasterService, CompanyGroupMasterExceptionFilter],
})
export class CompanyGroupMasterModule {}
