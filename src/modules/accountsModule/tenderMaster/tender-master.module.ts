import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TenderMasterController } from './tender-master.controller';
import { TenderMasterExceptionFilter } from './tender-master-exception.filter';
import { TenderMasterService } from './tender-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TenderMasterController],
  providers: [TenderMasterService, TenderMasterExceptionFilter],
})
export class TenderMasterModule {}
