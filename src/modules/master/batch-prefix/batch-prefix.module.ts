import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { BatchPrefixController } from './batch-prefix.controller';
import { BatchPrefixExceptionFilter } from './batch-prefix-exception.filter';
import { BatchPrefixService } from './batch-prefix.service';

@Module({
  imports: [AuditLogModule],
  controllers: [BatchPrefixController],
  providers: [BatchPrefixService, BatchPrefixExceptionFilter],
})
export class BatchPrefixModule {}
