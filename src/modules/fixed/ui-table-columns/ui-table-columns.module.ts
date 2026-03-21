import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { UiTableColumnExceptionFilter } from './ui-table-column-exception.filter';
import { UiTableColumnsController } from './ui-table-columns.controller';
import { UiTableColumnsService } from './ui-table-columns.service';

@Module({
  imports: [AuditLogModule],
  controllers: [UiTableColumnsController],
  providers: [UiTableColumnsService, UiTableColumnExceptionFilter],
})
export class UiTableColumnsModule {}
