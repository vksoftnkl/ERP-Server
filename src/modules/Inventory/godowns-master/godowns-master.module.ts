import { Module } from '@nestjs/common';
import { GodownExceptionFilter } from './godown-exception.filter';
import { GodownsMasterController } from './godowns-master.controller';
import { GodownsMasterService } from './godowns-master.service';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [GodownsMasterController],
  providers: [GodownsMasterService, GodownExceptionFilter],
  // BranchMasterService seeds a new company's Main Godown (notes 78).
  exports: [GodownsMasterService],
})
export class GodownsMasterModule {}
