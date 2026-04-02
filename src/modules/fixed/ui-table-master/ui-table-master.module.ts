import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { UiTableMasterController } from './ui-table-master.controller';
import { UiTableMasterExceptionFilter } from './ui-table-master-exception.filter';
import { UiTableMasterService } from './ui-table-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [UiTableMasterController],
  providers: [UiTableMasterService, UiTableMasterExceptionFilter],
})
export class UiTableMasterModule {}
