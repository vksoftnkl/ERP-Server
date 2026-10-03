import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { GodownsMasterModule } from '../../Inventory/godowns-master/godowns-master.module';
import { BranchMasterController } from './branch-master.controller';
import { BranchMasterExceptionFilter } from './branch-master-exception.filter';
import { BranchMasterService } from './branch-master.service';

@Module({
  imports: [AuditLogModule, GodownsMasterModule],
  controllers: [BranchMasterController],
  providers: [BranchMasterService, BranchMasterExceptionFilter],
  // CompanyMasterService seeds a new company's Main Branch (notes 78).
  exports: [BranchMasterService],
})
export class BranchMasterModule {}
