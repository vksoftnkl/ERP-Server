import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { TillModule } from '../../till/till.module';
import { TenderDetailController } from './tender-detail.controller';
import { TenderDetailExceptionFilter } from './tender-detail-exception.filter';
import { TenderDetailService } from './tender-detail.service';
@Module({
  // AppSettingsModule (tender.duplicate_ref) and TillModule (DUPLICATE_REF_BLOCKED):
  // the non-cash plan's reference guard (§3).
  imports: [AuditLogModule, AppSettingsModule, TillModule],
  controllers: [TenderDetailController],
  providers: [TenderDetailService, TenderDetailExceptionFilter],
  // Exported for the documents that capture their tenders as part of one save
  // (see BillService.syncDocumentTenders usage).
  exports: [TenderDetailService],
})
export class TenderDetailModule {}
