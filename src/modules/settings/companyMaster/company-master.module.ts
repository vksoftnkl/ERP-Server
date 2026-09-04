import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { CompanyMasterController } from './company-master.controller';
import { CompanyMasterExceptionFilter } from './company-master-exception.filter';
import { CompanyMasterService } from './company-master.service';

@Module({
  imports: [AuditLogModule],
  controllers: [CompanyMasterController],
  providers: [CompanyMasterService, CompanyMasterExceptionFilter],
})
export class CompanyMasterModule {}
