import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { BranchMasterModule } from '../branchMaster/branch-master.module';
import { CompanyMasterController } from './company-master.controller';
import { CompanyMasterExceptionFilter } from './company-master-exception.filter';
import { CompanyMasterService } from './company-master.service';

@Module({
  imports: [AuditLogModule, BranchMasterModule],
  controllers: [CompanyMasterController],
  providers: [CompanyMasterService, CompanyMasterExceptionFilter],
})
export class CompanyMasterModule {}
