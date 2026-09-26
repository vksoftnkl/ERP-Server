import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { PrintTemplateController } from './print-template.controller';
import { PrintTemplateExceptionFilter } from './print-template-exception.filter';
import { PrintTemplateService } from './print-template.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PrintTemplateController],
  providers: [PrintTemplateService, PrintTemplateExceptionFilter],
  exports: [PrintTemplateService],
})
export class PrintTemplateModule {}
