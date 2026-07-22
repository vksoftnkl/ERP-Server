import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { SaleAgentController } from './sale-agent.controller';
import { SaleAgentExceptionFilter } from './sale-agent-exception.filter';
import { SaleAgentService } from './sale-agent.service';

@Module({
  imports: [AuditLogModule],
  controllers: [SaleAgentController],
  providers: [SaleAgentService, SaleAgentExceptionFilter],
})
export class SaleAgentModule {}
