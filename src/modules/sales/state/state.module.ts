import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { StateController } from './state.controller';
import { StateExceptionFilter } from './state-exception.filter';
import { StateService } from './state.service';

@Module({
  imports: [AuditLogModule],
  controllers: [StateController],
  providers: [StateService, StateExceptionFilter],
})
export class StateModule {}
