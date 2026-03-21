import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { GspProviderMasterController } from './gsp-provider-master.controller';
import { GspProviderMasterExceptionFilter } from './gsp-provider-master-exception.filter';
import { GspProviderMasterService } from './gsp-provider-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [GspProviderMasterController],
  providers: [GspProviderMasterService, GspProviderMasterExceptionFilter],
})
export class GspProviderMasterModule {}
