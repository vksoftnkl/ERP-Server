import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { PrintTemplateAssignmentController } from './print-template-assignment.controller';
import { PrintTemplateAssignmentExceptionFilter } from './print-template-assignment-exception.filter';
import { PrintTemplateAssignmentService } from './print-template-assignment.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PrintTemplateAssignmentController],
  providers: [PrintTemplateAssignmentService, PrintTemplateAssignmentExceptionFilter],
  // The render path (§8) asks this module which design wins for a counter,
  // rather than carrying a second copy of the four-rung ladder. Exported for
  // that one consumer: resolution is a question about assignments, and the
  // answer must come from the module that owns the rows.
  exports: [PrintTemplateAssignmentService],
})
export class PrintTemplateAssignmentModule {}
