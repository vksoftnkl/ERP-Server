import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { GodownExceptionFilter } from './godown-exception.filter';
import { GodownsMasterController } from './godowns-master.controller';
import { GodownsMasterService } from './godowns-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [GodownsMasterController],
  providers: [GodownsMasterService, GodownExceptionFilter],
})
export class GodownsMasterModule {}
