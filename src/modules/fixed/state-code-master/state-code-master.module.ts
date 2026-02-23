import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { StateCodeMasterController } from './state-code-master.controller';
import { StateCodeMasterExceptionFilter } from './state-code-master-exception.filter';
import { StateCodeMasterService } from './state-code-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [StateCodeMasterController],
  providers: [StateCodeMasterService, StateCodeMasterExceptionFilter],
})
export class StateCodeMasterModule {}
