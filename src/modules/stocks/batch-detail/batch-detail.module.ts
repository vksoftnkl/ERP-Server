import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/modules/audit-log/audit-log.module';
import { BatchDetailController } from './batch-detail.controller';
import { BatchDetailService } from './batch-detail.service';

/** Textile addendum 2 — `/stock/batch-detail/models` and `/stock/batch-detail/update`. */
@Module({
  imports: [AuditLogModule],
  controllers: [BatchDetailController],
  providers: [BatchDetailService],
})
export class BatchDetailModule {}
