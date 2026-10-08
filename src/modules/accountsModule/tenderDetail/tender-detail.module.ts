import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TenderDetailController } from './tender-detail.controller';
import { TenderDetailExceptionFilter } from './tender-detail-exception.filter';
import { TenderDetailService } from './tender-detail.service';
@Module({
  imports: [AuditLogModule],
  controllers: [TenderDetailController],
  providers: [TenderDetailService, TenderDetailExceptionFilter],
  // Exported for the documents that capture their tenders as part of one save
  // (see BillService.syncDocumentTenders usage).
  exports: [TenderDetailService],
})
export class TenderDetailModule {}
