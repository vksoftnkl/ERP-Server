import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { PrintTemplateAssignmentController } from './print-template-assignment.controller';
import { PrintTemplateAssignmentExceptionFilter } from './print-template-assignment-exception.filter';
import { PrintTemplateAssignmentService } from './print-template-assignment.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PrintTemplateAssignmentController],
  providers: [PrintTemplateAssignmentService, PrintTemplateAssignmentExceptionFilter],
})
export class PrintTemplateAssignmentModule {}
