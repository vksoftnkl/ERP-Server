import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { TenderTypeMasterController } from './tender-type-master.controller';
import { TenderTypeMasterExceptionFilter } from './tender-type-master-exception.filter';
import { TenderTypeMasterService } from './tender-type-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TenderTypeMasterController],
  providers: [TenderTypeMasterService, TenderTypeMasterExceptionFilter],
})
export class TenderTypeMasterModule {}
