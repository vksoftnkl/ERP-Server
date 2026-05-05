import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { GspCompanyServiceController } from './gsp-company-service.controller';
import { GspCompanyServiceExceptionFilter } from './gsp-company-service-exception.filter';
import { GspCompanyServiceService } from './gsp-company-service.service';

@Module({
  imports: [AuditLogModule],
  controllers: [GspCompanyServiceController],
  providers: [GspCompanyServiceService, GspCompanyServiceExceptionFilter],
})
export class GspCompanyServiceModule {}
