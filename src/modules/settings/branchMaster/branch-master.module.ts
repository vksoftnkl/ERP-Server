import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { BranchMasterController } from './branch-master.controller';
import { BranchMasterExceptionFilter } from './branch-master-exception.filter';
import { BranchMasterService } from './branch-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [BranchMasterController],
  providers: [BranchMasterService, BranchMasterExceptionFilter],
})
export class BranchMasterModule {}
